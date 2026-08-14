/**
 * The projects API — reads and mutates the folder tree under PROJECTS_ROOT,
 * which is the container's view of the repo's `resources/projects`.
 *
 * Dependency-free on purpose: it runs straight from `node`, so the image needs
 * no install step and the repo needs no runtime dependencies.
 *
 * Every path crossing this boundary is relative to the root and slash-joined
 * (the root itself is the empty string). `relativePath` is the only way one is
 * accepted, so no request can address anything outside the root.
 */
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PORT = Number(process.env.PORT ?? 20445)
const ROOT = path.resolve(process.env.PROJECTS_ROOT ?? '/resources/projects')

/**
 * A directory's kind is not something the filesystem records, so the app writes
 * it into the directory itself. Living inside the directory (rather than in one
 * manifest at the root) means a rename or a move by hand carries it along.
 * Unmarked directories stay unclassified — see `directoryType`.
 */
const TYPE_FILE = '.maestro.json'
const CREATABLE_TYPES = ['folder', 'project', 'workflow', 'agent']

/**
 * What a new project is given. Unlike TYPE_FILE these are the user's own — they
 * are plain contents, visible in the tree and theirs to edit afterwards.
 */
const PROJECT_FILE = 'project.json'
const README_FILE = 'README.md'
const PROJECT_SUBDIRECTORIES = ['agents', 'workflows', 'tools']

/**
 * What a new workflow is given — a single file, since (unlike a project) a
 * workflow has no subdirectories of its own yet. `columns` always stores the
 * fixed leading/trailing columns alongside whatever the client added, so a
 * later reader (including the eventual board) sees one complete ordered list
 * without recomputing it.
 */
const WORKFLOW_FILE = 'workflow.json'
const FIXED_LEADING_COLUMN = 'Backlog'
const FIXED_TRAILING_COLUMN = 'Done'
const MAX_WORKFLOW_COLUMNS = 20
const MAX_COLUMN_NAME_LENGTH = 60

/**
 * A card's own actions, applied one at a time by `PATCH /api/workflow-cards`.
 * None of them grow `cards` — move/delete/archive only reorder, relabel,
 * shrink, or transfer to `archived` — so unlike columns there is no length
 * cap to enforce here.
 */
const CARD_ACTIONS = ['move-up', 'move-down', 'move-right', 'delete', 'archive']

/** What a new agent is given — a single file, same as a workflow, with no
 *  fields that need server-side assembly. */
const AGENT_FILE = 'agent.json'

/** Bounds the recursive read against deep nesting and symlink cycles. */
const MAX_DEPTH = 12
const MAX_BODY_BYTES = 64 * 1024
const MAX_NAME_LENGTH = 255
const MAX_TEXT_LENGTH = 4096
/** Bounds a read the way MAX_BODY_BYTES bounds a write. */
const MAX_READ_BYTES = 512 * 1024

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---- routes ----

const routes = {
  'GET /api/tree': getTree,
  'GET /api/file': getFile,
  'POST /api/entries': createEntry,
  'PUT /api/entries': updateEntry,
  'PATCH /api/entry': renameEntry,
  'DELETE /api/entry': deleteEntry,
  'PATCH /api/workflow-cards': updateWorkflowCard,
}

async function getTree() {
  return { status: 200, body: { nodes: await readTree('', 0) } }
}

/**
 * Reads one file as text, for whatever the client shows it in.
 *
 * One `stat` answers both questions worth asking before reading a byte: that it
 * is a file at all, and that it is small enough to hand back in a JSON response.
 * The encoding is `utf8` unconditionally — this serves files to look at, and the
 * client decides which of them are worth looking at.
 */
async function getFile(_req, url) {
  const target = visiblePath(relativePath(url.searchParams.get('path')))
  const abs = path.join(ROOT, target)

  const info = await guardFs(() => stat(abs), `No such file: ${target}`)
  if (!info.isFile()) throw new HttpError(400, `Not a file: ${target}`)
  if (info.size > MAX_READ_BYTES) throw new HttpError(413, 'That file is too large to show')

  const content = await guardFs(() => readFile(abs, 'utf8'), `No such file: ${target}`)
  return { status: 200, body: { path: target, content } }
}

/**
 * Creates a folder or a project inside `parent`, recording which it is so the
 * tree can offer the right actions on it later. A name already in use is a
 * conflict, not something to work around — the client is naming something the
 * user is looking at, and needs to be told.
 *
 * A project is additionally given its structure here rather than by the client,
 * so what a project *is* stays one answer on the side that owns the filesystem.
 */
async function createEntry(req) {
  const body = await readJson(req)
  const parent = relativePath(body.parent, { allowRoot: true })
  const type = validType(body.type)
  const name = validName(body.name)

  // A project or a workflow carries details a folder does not. Validating them
  // here, before anything is written, means a bad body never leaves a
  // directory behind.
  const details =
    type === 'project'
      ? {
          name,
          location: hostPath(body.location),
          description: requiredText(body.description, 'description'),
        }
      : type === 'workflow'
        ? {
            description: requiredText(body.description, 'description'),
            columns: validColumns(body.columns),
          }
        : type === 'agent'
          ? { description: requiredText(body.description, 'description') }
          : null

  await ensureRoot()

  if (parent && !(await isDirectory(path.join(ROOT, parent)))) {
    throw new HttpError(404, `No such folder: ${parent}`)
  }

  const abs = path.join(ROOT, parent, name)

  try {
    await mkdirTyped(abs, type)
  } catch (error) {
    if (error.code === 'EEXIST') throw new HttpError(409, `"${name}" already exists`)
    throw mapFsError(error)
  }

  if (details) {
    try {
      if (type === 'project') await scaffoldProject(abs, details)
      else if (type === 'workflow') await scaffoldWorkflow(abs, details)
      else await scaffoldAgent(abs, details)
    } catch (error) {
      // Half a project (or workflow) is worse than none, and the directory is
      // ours: undo it.
      await rm(abs, { recursive: true, force: true }).catch(() => {})
      throw mapFsError(error)
    }
  }

  return { status: 201, body: { path: join(parent, name) } }
}

/**
 * Overwrites an existing workflow's `workflow.json` or agent's `agent.json`.
 * Unlike `createEntry`, this never creates anything — it is scoped to entries
 * this app already marked with a recognized type, so it cannot become a way
 * to write arbitrary file content. Today only `workflow` and `agent` are
 * editable this way; every other type still has no content-editing path,
 * matching the "not yet wired" state of projects.
 */
async function updateEntry(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const type = validType(body.type)
  const abs = path.join(ROOT, target)

  if (type !== 'workflow' && type !== 'agent') throw new HttpError(400, `"${type}" cannot be edited`)
  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== type) {
    throw new HttpError(404, `No such ${type}: ${target}`)
  }

  await guardFs(
    () =>
      type === 'workflow'
        ? scaffoldWorkflow(abs, {
            description: requiredText(body.description, 'description'),
            columns: validColumns(body.columns),
          })
        : scaffoldAgent(abs, { description: requiredText(body.description, 'description') }),
    `No such ${type}: ${target}`,
  )

  return { status: 200, body: { path: target } }
}

/**
 * Applies exactly one action to one card in an existing workflow's `cards`/
 * `archived` arrays, leaving `description`/`columns` untouched — unlike
 * `updateEntry`, this never goes through `scaffoldWorkflow`, which reassembles
 * columns and has nothing to say about a card move.
 */
async function updateWorkflowCard(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const cardId = validCardId(body.cardId)
  const action = validCardAction(body.action)

  await guardFs(async () => {
    const data = await readWorkflowJson(abs)
    const updated = applyCardAction(data, cardId, action)
    await writeFile(path.join(abs, WORKFLOW_FILE), `${JSON.stringify(updated, null, 2)}\n`)
  }, `No such workflow: ${target}`)

  return { status: 200, body: { path: target } }
}

async function renameEntry(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const name = validName(body.name)

  const parent = path.posix.dirname(target)
  const next = join(parent === '.' ? '' : parent, name)
  if (next === target) return { status: 200, body: { path: target } }

  if (await exists(path.join(ROOT, next))) throw new HttpError(409, `"${name}" already exists`)

  await guardFs(() => rename(path.join(ROOT, target), path.join(ROOT, next)), `No such entry: ${target}`)
  return { status: 200, body: { path: next } }
}

async function deleteEntry(_req, url) {
  const target = relativePath(url.searchParams.get('path'))
  await guardFs(
    () => rm(path.join(ROOT, target), { recursive: true }),
    `No such entry: ${target}`,
  )
  return { status: 204 }
}

// ---- reading the tree ----

/**
 * Mirrors the directory as the `TreeNode[]` the sidebar renders. Dotfiles are
 * skipped: this is a project browser, not a file manager — which is also what
 * keeps TYPE_FILE out of the tree, and why `validName` refuses to create a name
 * the tree would then hide.
 */
async function readTree(relDir, depth) {
  const entries = await readDirectory(path.join(ROOT, relDir))
  const nodes = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const rel = join(relDir, entry.name)
    const abs = path.join(ROOT, rel)
    const kind = await kindOf(entry, abs)

    if (kind === 'file') nodes.push({ type: 'file', name: entry.name, path: rel })
    else if (kind === 'directory') {
      nodes.push({
        type: await directoryType(abs),
        name: entry.name,
        path: rel,
        children: depth < MAX_DEPTH ? await readTree(rel, depth + 1) : [],
      })
    }
    // anything else (socket, fifo, broken symlink) has no place in the tree
  }

  return nodes.sort(directoriesFirst)
}

/**
 * A directory this app created says what it is; anything else — a project's own
 * subdirectory, or something the user dropped in by hand — is reported as a
 * plain `directory`, which the UI treats as contents rather than organization.
 */
async function directoryType(abs) {
  try {
    const { type } = JSON.parse(await readFile(path.join(abs, TYPE_FILE), 'utf8'))
    if (CREATABLE_TYPES.includes(type)) return type
  } catch {
    /* absent, unreadable or malformed — all mean "unmarked" */
  }

  return 'directory'
}

/** Symlinks are followed, so a linked-in project still lists; MAX_DEPTH is what
 *  keeps a cycle from running away. */
async function kindOf(entry, abs) {
  if (entry.isDirectory()) return 'directory'
  if (entry.isFile()) return 'file'
  if (!entry.isSymbolicLink()) return null

  try {
    return (await stat(abs)).isDirectory() ? 'directory' : 'file'
  } catch {
    return null
  }
}

/** Everything that holds things sorts above the files, then by name. */
const directoriesFirst = (a, b) => {
  const holding = (node) => (node.type === 'file' ? 1 : 0)

  return (
    holding(a) - holding(b) ||
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )
}

/**
 * Non-recursive, so an existing name raises EEXIST rather than being adopted —
 * that failure *is* the collision check, which no separate existence test could
 * make race-free.
 */
async function mkdirTyped(abs, type) {
  await mkdir(abs)
  await writeFile(path.join(abs, TYPE_FILE), `${JSON.stringify({ type }, null, 2)}\n`)
}

/**
 * Fills a freshly made project directory. The location is only ever recorded —
 * it names a directory on the user's machine that this service cannot see and
 * has no business creating or reading.
 */
async function scaffoldProject(abs, { name, location, description }) {
  await writeFile(
    path.join(abs, PROJECT_FILE),
    `${JSON.stringify({ dir_on_host: location }, null, 2)}\n`,
  )
  await writeFile(
    path.join(abs, README_FILE),
    `# ${name}\n\n${description}\n\n# Location on host\n${location}\n`,
  )

  for (const child of PROJECT_SUBDIRECTORIES) await mkdir(path.join(abs, child))
}

/**
 * Writes (or rewrites) a workflow's `workflow.json`. Used both to fill a
 * freshly made workflow directory and, from `updateEntry`, to save edits to an
 * existing one — the "wrap the client's columns with the fixed ones" rule
 * lives here exactly once so create and edit can never drift apart on it.
 */
async function scaffoldWorkflow(abs, { description, columns }) {
  const full = [{ name: FIXED_LEADING_COLUMN }, ...columns, { name: FIXED_TRAILING_COLUMN }]
  const { cards, archived } = await existingCardData(abs)

  await writeFile(
    path.join(abs, WORKFLOW_FILE),
    `${JSON.stringify({ description, columns: full, cards, archived }, null, 2)}\n`,
  )
}

/**
 * Reads whatever cards/archived data an existing workflow.json already holds,
 * so scaffoldWorkflow — a full-file rewrite — can carry them through a
 * description/column edit instead of dropping them. Absent, unreadable or
 * malformed all mean "nothing to preserve", the same rule directoryType uses
 * for its own marker.
 */
async function existingCardData(abs) {
  try {
    const parsed = JSON.parse(await readFile(path.join(abs, WORKFLOW_FILE), 'utf8'))
    return {
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      archived: Array.isArray(parsed.archived) ? parsed.archived : [],
    }
  } catch {
    return { cards: [], archived: [] }
  }
}

/**
 * Writes (or rewrites) an agent's `agent.json`. Used both to fill a freshly
 * made agent directory and, from `updateEntry`, to save edits to an existing
 * one — unlike a workflow, an agent has nothing that needs assembling
 * server-side, so this is just the description.
 */
async function scaffoldAgent(abs, { description }) {
  await writeFile(path.join(abs, AGENT_FILE), `${JSON.stringify({ description }, null, 2)}\n`)
}

// ---- workflow cards ----

/**
 * Reads an existing workflow.json for a real mutation, unlike the forgiving
 * `existingCardData` — here a malformed file is a genuine error, not a
 * silent "nothing to preserve".
 */
async function readWorkflowJson(abs) {
  const raw = await readFile(path.join(abs, WORKFLOW_FILE), 'utf8')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpError(500, 'workflow.json is not valid JSON')
  }

  return {
    description: typeof parsed.description === 'string' ? parsed.description : '',
    columns: Array.isArray(parsed.columns) ? parsed.columns : [],
    cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    archived: Array.isArray(parsed.archived) ? parsed.archived : [],
  }
}

/** The one predicate that decides bot-vs-human — covers Ready, Doing and any
 *  custom bot column identically; Backlog/Done never carry a `bot` key at all. */
const isBotColumn = (column) => column?.bot === true

/**
 * Applies one card action, validated against the card's *current* column —
 * found by position (Backlog is index 0, Done is the last index), the same
 * rule scaffoldWorkflow's assembly and validColumn already rely on.
 */
function applyCardAction(data, cardId, action) {
  const { columns, cards } = data
  const index = cards.findIndex((card) => card.id === cardId)
  if (index === -1) throw new HttpError(404, `No such card: ${cardId}`)

  const card = cards[index]
  const columnIdx = columns.findIndex((column) => column.name === card.column)
  if (columnIdx === -1) {
    // The card's column was renamed or removed out from under it — the
    // accepted gap documented in CLAUDE.md. No action can be legal against a
    // column that no longer exists.
    throw new HttpError(400, `Card's column "${card.column}" no longer exists`)
  }

  switch (action) {
    case 'move-up':
      return { ...data, cards: swapWithNeighbor(cards, index, 'up', card.column) }
    case 'move-down':
      return { ...data, cards: swapWithNeighbor(cards, index, 'down', card.column) }
    case 'move-right':
      return { ...data, cards: moveRight(cards, index, columns, columnIdx) }
    case 'delete':
      if (columnIdx !== 0) throw new HttpError(400, 'Only a Backlog card can be deleted')
      return { ...data, cards: cards.filter((_, i) => i !== index) }
    case 'archive':
      if (columnIdx !== columns.length - 1) throw new HttpError(400, 'Only a Done card can be archived')
      return {
        ...data,
        cards: cards.filter((_, i) => i !== index),
        archived: [...data.archived, card],
      }
  }
}

/** The nearest card sharing `columnName`, scanning up or down the full array
 *  — within-column order is purely relative position among same-column
 *  cards, since cards live in one flat array rather than nested per column. */
function sameColumnNeighborIndex(cards, index, columnName, direction) {
  const step = direction === 'up' ? -1 : 1
  for (let i = index + step; i >= 0 && i < cards.length; i += step) {
    if (cards[i].column === columnName) return i
  }
  return -1
}

function swapWithNeighbor(cards, index, direction, columnName) {
  const neighbor = sameColumnNeighborIndex(cards, index, columnName, direction)
  if (neighbor === -1) {
    throw new HttpError(400, `No card ${direction === 'up' ? 'above' : 'below'} this one in its column`)
  }

  const next = [...cards]
  ;[next[index], next[neighbor]] = [next[neighbor], next[index]]
  return next
}

/** Moves a card into the next column by position, landing it at that
 *  column's bottom — after its last existing card, or at the array's end if
 *  the target has none yet. */
function moveRight(cards, index, columns, columnIdx) {
  if (isBotColumn(columns[columnIdx])) throw new HttpError(400, "A bot column's cards cannot be moved")

  const target = columns[columnIdx + 1]
  if (!target) throw new HttpError(400, 'There is no column to the right')

  const card = { ...cards[index], column: target.name, last_activity: `moved to ${target.name} by user` }
  const withoutCard = cards.filter((_, i) => i !== index)

  let insertAt = withoutCard.length
  for (let i = withoutCard.length - 1; i >= 0; i--) {
    if (withoutCard[i].column === target.name) {
      insertAt = i + 1
      break
    }
  }

  const next = [...withoutCard]
  next.splice(insertAt, 0, card)
  return next
}

// ---- validation ----

function relativePath(input, { allowRoot = false } = {}) {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) {
    if (allowRoot) return ''
    throw new HttpError(400, '"path" is required')
  }
  if (/[\\\0]/.test(value)) throw new HttpError(400, `Invalid path: ${value}`)

  const segments = value.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new HttpError(400, `Invalid path: ${value}`)
  }

  const rel = segments.join('/')
  const abs = path.resolve(ROOT, rel)
  if (!abs.startsWith(ROOT + path.sep)) {
    throw new HttpError(400, `Path leaves the projects root: ${value}`)
  }

  return rel
}

/**
 * A path held to the same visibility rule the tree renders by: `readTree` skips
 * dotfiles, so nothing may read one either — serving what the browser cannot see
 * would make the marker reachable and the two halves disagree about what exists.
 *
 * Note this is a *read* rule. `validName` refuses to create a dotted name, but
 * `relativePath` deliberately says nothing about them.
 */
function visiblePath(rel) {
  if (rel.split('/').some((segment) => segment.startsWith('.'))) {
    throw new HttpError(404, `No such file: ${rel}`)
  }

  return rel
}

function validType(input) {
  if (!CREATABLE_TYPES.includes(input)) {
    throw new HttpError(400, `"type" must be one of: ${CREATABLE_TYPES.join(', ')}`)
  }

  return input
}

function validName(input) {
  const name = typeof input === 'string' ? input.trim() : ''

  if (!name) throw new HttpError(400, 'A name is required')
  if (name.length > MAX_NAME_LENGTH) throw new HttpError(400, 'That name is too long')
  if (/[/\\\0]/.test(name)) throw new HttpError(400, 'A name cannot contain a slash')
  if (name.startsWith('.')) throw new HttpError(400, 'A name cannot start with a dot')

  return name
}

/**
 * A directory on the user's machine, which this service never resolves — so it
 * is checked for shape only, and absoluteness is the one thing that makes it
 * mean the same thing from wherever it is later read.
 */
function hostPath(input) {
  const value = requiredText(input, 'location')

  if (!value.startsWith('/')) throw new HttpError(400, 'The location must be an absolute path')

  return value
}

/**
 * The client's own columns only — the fixed leading/trailing ones are never
 * sent over the wire, since `scaffoldWorkflow` adds them unconditionally.
 */
function validColumns(input) {
  if (!Array.isArray(input)) throw new HttpError(400, '"columns" must be an array')
  if (input.length > MAX_WORKFLOW_COLUMNS) {
    throw new HttpError(400, `A workflow can have at most ${MAX_WORKFLOW_COLUMNS} columns`)
  }

  return input.map(validColumn)
}

/**
 * A column's bot/human-ness is stored as its own explicit `bot` key — see
 * `isBotColumn`.
 */
function validColumn(entry) {
  const name = requiredText(entry?.name, 'column name')
  if (name.length > MAX_COLUMN_NAME_LENGTH) throw new HttpError(400, 'That column name is too long')

  return { name, bot: entry?.bot === true }
}

function validCardAction(input) {
  if (!CARD_ACTIONS.includes(input)) {
    throw new HttpError(400, `"action" must be one of: ${CARD_ACTIONS.join(', ')}`)
  }

  return input
}

function validCardId(input) {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) throw new HttpError(400, '"cardId" is required')
  if (value.length > MAX_NAME_LENGTH) throw new HttpError(400, 'That cardId is too long')

  return value
}

function requiredText(input, field) {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) throw new HttpError(400, `A ${field} is required`)
  if (value.length > MAX_TEXT_LENGTH) throw new HttpError(400, `That ${field} is too long`)
  if (value.includes('\0')) throw new HttpError(400, `Invalid ${field}`)

  return value
}

// ---- filesystem helpers ----

const join = (parent, name) => (parent ? `${parent}/${name}` : name)

/**
 * A directory that is not there reads as empty rather than failing: the store
 * itself need not exist until something is put in it, and a nested one can be
 * removed from outside while we are walking it.
 */
async function readDirectory(abs) {
  try {
    return await readdir(abs, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw mapFsError(error)
  }
}

/** The store is created on first write, so a fresh checkout carries no empty
 *  directory and a wiped one heals itself. */
async function ensureRoot() {
  try {
    await mkdir(ROOT, { recursive: true })
  } catch (error) {
    throw mapFsError(error)
  }
}

const isDirectory = async (abs) => {
  try {
    return (await stat(abs)).isDirectory()
  } catch {
    return false
  }
}

const exists = async (abs) => {
  try {
    await stat(abs)
    return true
  } catch {
    return false
  }
}

async function guardFs(action, notFoundMessage) {
  try {
    return await action()
  } catch (error) {
    throw mapFsError(error, notFoundMessage)
  }
}

function mapFsError(error, notFoundMessage) {
  switch (error?.code) {
    case 'ENOENT':
      return new HttpError(404, notFoundMessage ?? 'Not found')
    case 'ENOTDIR':
      return new HttpError(400, 'That path is not a folder')
    case 'EISDIR':
      return new HttpError(400, 'That path is not a file')
    case 'ENOTEMPTY':
      return new HttpError(409, 'That folder is not empty')
    case 'EACCES':
    case 'EPERM':
      return new HttpError(403, `Permission denied by the filesystem (${error.code})`)
    default:
      return error
  }
}

// ---- transport ----

async function readJson(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large')
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}

  let parsed
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Body must be JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Body must be a JSON object')
  }

  return parsed
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status).end()
    return
  }

  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // The tree changes underneath the client, so a cached read is a wrong read.
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const route = `${req.method} ${url.pathname}`

  let status = 500
  try {
    const handler = routes[route]
    if (!handler) throw new HttpError(404, `No route for ${route}`)

    const result = await handler(req, url)
    status = result.status
    send(res, result.status, result.body)
  } catch (error) {
    status = error instanceof HttpError ? error.status : 500
    if (status === 500) console.error(error)
    send(res, status, { error: error.message ?? 'Unexpected error' })
  } finally {
    console.log(`${route} -> ${status}`)
  }
})

// Best effort only. A missing store reads as empty and is created on first
// write, so not being able to make it up front must not stop us from serving.
await mkdir(ROOT, { recursive: true }).catch((error) =>
  console.warn(`could not create ${ROOT} at startup: ${error.message}`),
)

server.listen(PORT, () => console.log(`projects API on :${PORT}, serving ${ROOT}`))
