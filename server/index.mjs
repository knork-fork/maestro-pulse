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
const CREATABLE_TYPES = ['folder', 'project']

/**
 * What a new project is given. Unlike TYPE_FILE these are the user's own — they
 * are plain contents, visible in the tree and theirs to edit afterwards.
 */
const PROJECT_FILE = 'project.json'
const README_FILE = 'README.md'
const PROJECT_SUBDIRECTORIES = ['agents', 'workflows', 'tools']

/** Bounds the recursive read against deep nesting and symlink cycles. */
const MAX_DEPTH = 12
const MAX_BODY_BYTES = 64 * 1024
const MAX_NAME_LENGTH = 255
const MAX_TEXT_LENGTH = 4096

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---- routes ----

const routes = {
  'GET /api/tree': getTree,
  'POST /api/entries': createEntry,
  'PATCH /api/entry': renameEntry,
  'DELETE /api/entry': deleteEntry,
}

async function getTree() {
  return { status: 200, body: { nodes: await readTree('', 0) } }
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

  // A project carries details a folder does not. Validating them here, before
  // anything is written, means a bad body never leaves a directory behind.
  const details =
    type === 'project'
      ? {
          name,
          location: hostPath(body.location),
          description: requiredText(body.description, 'description'),
        }
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
      await scaffoldProject(abs, details)
    } catch (error) {
      // Half a project is worse than none, and the directory is ours: undo it.
      await rm(abs, { recursive: true, force: true }).catch(() => {})
      throw mapFsError(error)
    }
  }

  return { status: 201, body: { path: join(parent, name) } }
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
