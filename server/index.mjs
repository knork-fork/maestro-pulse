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
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 20445)
const ROOT = path.resolve(process.env.PROJECTS_ROOT ?? '/resources/projects')

/**
 * Tools available to every project by default — baked into the image (see
 * the Dockerfile's `api` stage), not part of the user's own project store, so
 * a fresh install has them without anything being dropped into `resources/`.
 * Read-only from this server's point of view: nothing ever writes here.
 */
const COMMON_TOOLS_ROOT = path.resolve(
  process.env.COMMON_TOOLS_ROOT ?? path.join(fileURLToPath(import.meta.url), '../../common-tools'),
)

/**
 * Absolute path to this maestro-pulse checkout on the host machine — distinct
 * from a project's own `codebase_dir_on_host` (the actual codebase being worked on).
 * The container has no other way to trace either `common-tools/` (baked into
 * the image) or a project's own `tools/` (bind-mounted, but the mount's
 * host-side path is otherwise unknown in here) back to a host path. Optional:
 * when unset, the run-manually skill still works, it just can't name a real
 * host path for any tool.
 */
const MAESTRO_PULSE_HOST_DIR = process.env.MAESTRO_PULSE_HOST_DIR || null

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
const PROJECT_FILE_TEMPLATE = `${PROJECT_FILE}.dist`
const GITIGNORE_FILE = '.gitignore'
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
 * cap to enforce here. `move-to` and `set-status` are the two actions the UI
 * never sends: `move-to` names an arbitrary destination column and skips
 * every restriction the other moves enforce (adjacency, bot-column lock,
 * Backlog/Done position); `set-status` sets or clears a card's own `status`
 * with no column gating at all. Both are meant for a tool/agent driving the
 * board directly, not a person clicking through it.
 */
const CARD_ACTIONS = ['move-up', 'move-down', 'move-right', 'move-to', 'set-status', 'delete', 'archive']

/**
 * The closed set of values `set-status` accepts. `'blocked'` is a real value
 * the board already renders (see styles.css's `card--status-blocked`) but
 * nothing writes it yet — deliberately excluded here until that's built.
 */
const CARD_STATUSES = ['in_session']

/**
 * Where a card's md/url attachments live — one folder shared by every
 * workflow/card in a project, not per-workflow. Deliberately not in
 * PROJECT_SUBDIRECTORIES: an existing project has no need to be migrated for
 * it, so `createAttachmentFile` creates it on demand instead, the same
 * tolerance `ensureRoot` already has for the projects root itself.
 *
 * Content never crosses this API: `createAttachmentFile` only ever writes an
 * *empty* file, and `listCardAttachments` only ever hands back a path, never
 * a file's contents. The `manage-card-attachments` common tool resolves a
 * real host path (via MAESTRO_PULSE_HOST_DIR) for both, so a harness edits
 * the file directly with its own file tools. That split is also why there is
 * no "edit" endpoint here: editing is just editing a file on disk, and the
 * one thing worth keeping deterministic is `workflow.json`'s own
 * `attachments` array — `attachToCard`/`detachFromCard` are the only ways it
 * grows or shrinks.
 */
const ATTACHMENTS_SUBDIR = 'attachments'
const MAX_ATTACHMENT_NAME_LENGTH = 100

/** What a new agent is given — a single file, same as a workflow, with no
 *  fields that need server-side assembly. */
const AGENT_FILE = 'agent.json'

/**
 * An agent's system/personalization prompt, as raw markdown — a second file
 * alongside AGENT_FILE, scaffolded once on creation and edited independently
 * of it thereafter (see `updateAgentInstructions`), so an `agent.json` edit
 * (description/title/mission/sliders) never touches it.
 */
const AGENT_INSTRUCTIONS_FILE = 'agent.md'
const MAX_INSTRUCTIONS_LENGTH = 20000
const DEFAULT_AGENT_INSTRUCTIONS =
  '# Instructions\n\n' +
  'Please fill system and personalization instructions for this agent — its ' +
  'role, responsibilities, tone, and any constraints it should follow.\n'

/**
 * A workflow's own instructions, as raw markdown — a second file alongside
 * WORKFLOW_FILE, scaffolded once on creation and edited independently of it
 * thereafter (see `updateWorkflowInstructions`), so a `workflow.json` edit
 * (description/columns) never touches it. Also handed to an external agent
 * via the add-to-backlog skill (see `getAddToBacklogSkill`).
 *
 * Deliberately scoped to what's specific to *this* workflow — what "good
 * work" means for it and what artifacts/evidence should exist by the time
 * it's done — not generic card-movement mechanics (who may pick up a card,
 * a one-stage handoff, human override, blocked status), which are the same
 * for every workflow and already enforced by `applyCardAction`/`validColumn`
 * below; see [src/data/workflowTemplates.ts](../src/data/workflowTemplates.ts)
 * for the same split applied to the starter templates.
 */
const WORKFLOW_INSTRUCTIONS_FILE = 'workflow.md'
const DEFAULT_WORKFLOW_INSTRUCTIONS =
  '# Instructions\n\n' +
  'Describe what "good work" means for this workflow: what artifacts or ' +
  'evidence should exist on a card by the time it\'s done (e.g. a handoff ' +
  'document, exploration notes, a screenshot or short recording), and any ' +
  'workflow-specific conditions or exceptions for a card to move forward. ' +
  'Generic rules — who may pick up a card, handoffs, manual overrides — are ' +
  'already handled by Pulse itself and don\'t need to be repeated here.\n'

/**
 * An agent's numeric settings' bounds and defaults. Mirrors
 * src/data/agent.ts exactly — the client's sliders can't produce an
 * out-of-range value, but a hand-crafted request could, so both sides need
 * to agree on the same bounds.
 */
const HEARTBEAT_MIN = 5
const HEARTBEAT_MAX = 120
const HEARTBEAT_STEP = 5
const MAX_CHILDREN_MIN = 1
const MAX_CHILDREN_MAX = 16
const MAX_CHILDREN_STEP = 1
const HANDHOLDING_MIN = 0
const HANDHOLDING_MAX = 100
const HANDHOLDING_STEP = 25
const VERBOSITY_MIN = 0
const VERBOSITY_MAX = 100
const VERBOSITY_STEP = 25
const DEFAULT_HEARTBEAT = 15
const DEFAULT_MAX_CHILDREN = 4
const DEFAULT_HANDHOLDING = 50
const DEFAULT_VERBOSITY = 50

/**
 * The "add a backlog ticket" skill text handed to an external Claude Code
 * session by `GET /skills/add-to-backlog` — a static template with
 * placeholders filled in per-request. Lives next to this file so the
 * Dockerfile's `COPY server/ ./server/` ships it with no extra step.
 */
const SKILLS_DIR = path.dirname(fileURLToPath(import.meta.url))
const ADD_TO_BACKLOG_TEMPLATE = path.join(SKILLS_DIR, 'add-to-backlog-template.md')
const RUN_MANUALLY_TEMPLATE = path.join(SKILLS_DIR, 'run-manually-template.md')

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
  'GET /api/common-tools': getCommonTools,
  'POST /api/entries': createEntry,
  'PUT /api/entries': updateEntry,
  'PATCH /api/entry': renameEntry,
  'DELETE /api/entry': deleteEntry,
  'PATCH /api/workflow-cards': updateWorkflowCard,
  'POST /api/workflow-cards': createWorkflowCard,
  'POST /api/workflow-attachments': createAttachmentFile,
  'GET /api/workflow-attachments': listCardAttachments,
  'PATCH /api/workflow-attachments': attachToCard,
  'DELETE /api/workflow-attachments': detachFromCard,
  'PUT /api/agent-instructions': updateAgentInstructions,
  'PUT /api/workflow-instructions': updateWorkflowInstructions,
  'GET /skills/add-to-backlog': getAddToBacklogSkill,
  'GET /skills/run-manually': getRunManuallySkill,
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
 * The catalog of tools available to every project by default — one entry
 * per subfolder of COMMON_TOOLS_ROOT that has a `tool.json`. Unlike a
 * project's own `tools/` folder (read client-side off the already-loaded
 * tree, since it lives under ROOT), this folder is outside ROOT entirely, so
 * it needs its own small read here instead. A missing/malformed `tool.json`
 * falls back to the folder's own name, same tolerance `useProjectTools.ts`
 * has for a project tool.
 */
async function getCommonTools() {
  const entries = await readdir(COMMON_TOOLS_ROOT, { withFileTypes: true }).catch(() => [])
  const folders = entries.filter((entry) => entry.isDirectory())

  const tools = await Promise.all(
    folders.map(async (folder) => {
      try {
        const raw = await readFile(path.join(COMMON_TOOLS_ROOT, folder.name, 'tool.json'), 'utf8')
        const parsed = JSON.parse(raw)
        return {
          path: folder.name,
          title: typeof parsed.title === 'string' && parsed.title ? parsed.title : folder.name,
          description: typeof parsed.description === 'string' ? parsed.description : '',
          icon: typeof parsed.icon === 'string' && parsed.icon && parsed.icon !== 'null' ? parsed.icon : null,
        }
      } catch {
        return { path: folder.name, title: folder.name, description: '', icon: null }
      }
    }),
  )

  return { status: 200, body: { tools } }
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
            backlogDescription: requiredText(body.backlogDescription, 'backlog description'),
            doneDescription: requiredText(body.doneDescription, 'done description'),
          }
        : type === 'agent'
          ? validAgentDetails(body)
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
      else if (type === 'workflow') {
        await scaffoldWorkflow(abs, details)
        await writeFile(path.join(abs, WORKFLOW_INSTRUCTIONS_FILE), DEFAULT_WORKFLOW_INSTRUCTIONS)
      } else {
        await scaffoldAgent(abs, details)
        await writeFile(path.join(abs, AGENT_INSTRUCTIONS_FILE), DEFAULT_AGENT_INSTRUCTIONS)
      }
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
            backlogDescription: requiredText(body.backlogDescription, 'backlog description'),
            doneDescription: requiredText(body.doneDescription, 'done description'),
          })
        : scaffoldAgent(abs, validAgentDetails(body)),
    `No such ${type}: ${target}`,
  )

  return { status: 200, body: { path: target } }
}

/**
 * Overwrites an existing agent's `agent.md` — its own narrow route, separate
 * from `updateEntry`, so editing `agent.json` (description/title/mission/
 * sliders) can never clobber this file and vice versa.
 */
async function updateAgentInstructions(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'agent') {
    throw new HttpError(404, `No such agent: ${target}`)
  }

  const instructions = validInstructions(body.instructions)

  await guardFs(
    () => writeFile(path.join(abs, AGENT_INSTRUCTIONS_FILE), instructions ? `${instructions}\n` : ''),
    `No such agent: ${target}`,
  )

  return { status: 200, body: { path: target } }
}

/**
 * Overwrites an existing workflow's `workflow.md` — its own narrow route,
 * separate from `updateEntry`, so editing `workflow.json`
 * (description/columns) can never clobber this file and vice versa.
 */
async function updateWorkflowInstructions(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const instructions = validInstructions(body.instructions)

  await guardFs(
    () => writeFile(path.join(abs, WORKFLOW_INSTRUCTIONS_FILE), instructions ? `${instructions}\n` : ''),
    `No such workflow: ${target}`,
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
  const targetColumn = action === 'move-to' ? requiredText(body.column, 'column') : undefined
  const statusValue = action === 'set-status' ? validCardStatus(body.status) : undefined

  await guardFs(async () => {
    const data = await readWorkflowJson(abs)
    const updated = applyCardAction(data, cardId, action, targetColumn, statusValue)
    await writeFile(path.join(abs, WORKFLOW_FILE), `${JSON.stringify(updated, null, 2)}\n`)
  }, `No such workflow: ${target}`)

  return { status: 200, body: { path: target } }
}

/**
 * Adds one new card to an existing workflow's Backlog column, at the top.
 * Unlike `updateWorkflowCard`'s actions, this grows `cards` — the one place
 * that does, since every existing action only reorders/relabels/shrinks/
 * transfers to `archived`. Meant to be called by an external agent following
 * the `add-to-backlog` skill (see `getAddToBacklogSkill`), not the browser.
 */
async function createWorkflowCard(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const title = requiredText(body.title, 'title')
  const description = requiredText(body.description, 'description')
  const card = { id: randomUUID(), title, description, column: FIXED_LEADING_COLUMN }

  await guardFs(async () => {
    const data = await readWorkflowJson(abs)
    const updated = { ...data, cards: [card, ...data.cards] }
    await writeFile(path.join(abs, WORKFLOW_FILE), `${JSON.stringify(updated, null, 2)}\n`)
  }, `No such workflow: ${target}`)

  return { status: 201, body: { id: card.id } }
}

/**
 * Creates one brand-new, empty `<timestamp>-<name>.md` file under a
 * project's shared `attachments/` folder (created on demand) — not attached
 * to any card yet, that's `attachToCard`'s job. Meant to be called by the
 * `manage-card-attachments` common tool: it hands the caller back both the
 * project-relative path (what eventually goes in a card's `attachments`) and
 * a real host path (via MAESTRO_PULSE_HOST_DIR, the same resolution
 * `getRunManuallySkill` already does for a project's own tools), so an
 * external harness edits the file directly with its own file tools instead
 * of piping content through this API.
 */
async function createAttachmentFile(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  // Not a separate param — a workflow's path is always
  // `<project>/workflows/<name>`, so the project is fully determined by
  // `path`; same derivation as getAddToBacklogSkill/getRunManuallySkill.
  const project = target.split('/').slice(0, -2).join('/')
  const projectAbs = path.join(ROOT, project)
  if (!(await isDirectory(projectAbs)) || (await directoryType(projectAbs)) !== 'project') {
    throw new HttpError(404, `No such project: ${project}`)
  }

  const originalName = validAttachmentName(body.originalName)
  const filename = `${timestampPrefix()}-${originalName}`
  const relPath = join(ATTACHMENTS_SUBDIR, filename)

  await guardFs(async () => {
    await mkdir(path.join(projectAbs, ATTACHMENTS_SUBDIR), { recursive: true })
    await writeFile(path.join(projectAbs, ATTACHMENTS_SUBDIR, filename), '')
  }, `No such workflow: ${target}`)

  const hostPath = MAESTRO_PULSE_HOST_DIR
    ? path.posix.join(MAESTRO_PULSE_HOST_DIR, 'resources/projects', project, relPath)
    : null

  return { status: 201, body: { path: relPath, hostPath } }
}

/**
 * Reads one card's own `attachments` array — lets a harness check what's
 * already on a card (e.g. before deciding whether to create a new file or
 * reuse one) without it ever having to parse `workflow.json` itself. Each
 * file entry is resolved to a real host path the same way
 * `createAttachmentFile` resolves a brand-new one, since the point of
 * listing is to hand the harness something it can open directly; a URL
 * entry's `hostPath` is `null`, having no file to resolve.
 */
async function listCardAttachments(_req, url) {
  const target = relativePath(url.searchParams.get('path'))
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const project = target.split('/').slice(0, -2).join('/')
  const projectHostDir = MAESTRO_PULSE_HOST_DIR
    ? path.posix.join(MAESTRO_PULSE_HOST_DIR, 'resources/projects', project)
    : null

  const cardId = validCardId(url.searchParams.get('cardId'))
  const { cards } = await readWorkflowJson(abs)
  const card = cards.find((c) => c.id === cardId)
  if (!card) throw new HttpError(404, `No such card: ${cardId}`)

  const rawAttachments = Array.isArray(card.attachments) ? card.attachments : []
  const attachments = rawAttachments.map((attachment) => ({
    attachment,
    hostPath: !isUrlAttachment(attachment) && projectHostDir ? path.posix.join(projectHostDir, attachment) : null,
  }))

  return { status: 200, body: { attachments } }
}

/**
 * Records one file or URL on a card's `attachments` array — idempotently:
 * an attachment already on the card is a no-op, not an error, so a harness
 * can always call this "attach it if it's not attached already" without
 * checking first. This, not `updateEntry`, is the one narrow way
 * `workflow.json`'s `attachments` array ever changes, so a harness driving a
 * card never has to hand-edit that file itself.
 */
async function attachToCard(req) {
  const body = await readJson(req)
  const target = relativePath(body.path)
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const project = target.split('/').slice(0, -2).join('/')
  const cardId = validCardId(body.cardId)
  const attachment = validAttachmentRef(body.attachment)

  if (!isUrlAttachment(attachment)) {
    const attAbs = path.join(ROOT, relativePath(join(project, attachment)))
    if (!(await exists(attAbs))) throw new HttpError(404, `No such attachment file: ${attachment}`)
  }

  const attachments = await guardFs(async () => {
    const data = await readWorkflowJson(abs)
    const index = data.cards.findIndex((c) => c.id === cardId)
    if (index === -1) throw new HttpError(404, `No such card: ${cardId}`)

    const card = data.cards[index]
    const existing = Array.isArray(card.attachments) ? card.attachments : []
    if (existing.includes(attachment)) return existing

    const updated = [...existing, attachment]
    data.cards[index] = { ...card, attachments: updated }
    await writeFile(path.join(abs, WORKFLOW_FILE), `${JSON.stringify(data, null, 2)}\n`)
    return updated
  }, `No such workflow: ${target}`)

  return { status: 200, body: { path: target, attachments } }
}

/**
 * Removes one file or URL from a card's `attachments` array — idempotently,
 * the same reasoning as `attachToCard`: a harness can always call this
 * "remove it if it's there" without checking first. Only the reference is
 * removed; the file itself, if any, is left on disk untouched — this route
 * has no opinion on whether anything else still points at it.
 */
async function detachFromCard(_req, url) {
  const target = relativePath(url.searchParams.get('path'))
  const abs = path.join(ROOT, target)

  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const cardId = validCardId(url.searchParams.get('cardId'))
  const attachment = validAttachmentRef(url.searchParams.get('attachment'))

  const attachments = await guardFs(async () => {
    const data = await readWorkflowJson(abs)
    const index = data.cards.findIndex((c) => c.id === cardId)
    if (index === -1) throw new HttpError(404, `No such card: ${cardId}`)

    const card = data.cards[index]
    const existing = Array.isArray(card.attachments) ? card.attachments : []
    if (!existing.includes(attachment)) return existing

    const updated = existing.filter((a) => a !== attachment)
    data.cards[index] = { ...card, attachments: updated }
    await writeFile(path.join(abs, WORKFLOW_FILE), `${JSON.stringify(data, null, 2)}\n`)
    return updated
  }, `No such workflow: ${target}`)

  return { status: 200, body: { path: target, attachments } }
}

/**
 * Hands an external Claude Code session the "add a backlog ticket" skill:
 * `add-to-backlog-template.md` with its placeholders swapped for the real
 * project/workflow it was asked about. Mirrors getRunManuallySkill's shape:
 * the same three host roots declared once (maestro_pulse_root,
 * project_store_dir, project_codebase_dir), a tool catalog listed as paths
 * relative to those roots, and `workflow.md` content pasted in as a
 * blockquote. Unlike run-manually, there's no card or agent yet at this
 * stage, so the project-tools catalog is every tool under the project's own
 * `tools/`, unfiltered, rather than one agent's selected subset.
 * Returns raw markdown, not JSON, so a plain fetch/WebFetch reads it directly.
 */
async function getAddToBacklogSkill(req, url) {
  const target = relativePath(url.searchParams.get('path'))
  const abs = path.join(ROOT, target)
  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  // Not a separate param: a workflow's path is always
  // `<project>/workflows/<name>` — exactly two fixed segments below its
  // project — so the project is fully determined by `path` and the client
  // repeating it would be redundant. See the client-side comment in
  // AddToBacklogModal.tsx for the same rule.
  const project = target.split('/').slice(0, -2).join('/')
  const projectAbs = path.join(ROOT, project)
  if (!(await isDirectory(projectAbs)) || (await directoryType(projectAbs)) !== 'project') {
    throw new HttpError(404, `No such project: ${project}`)
  }

  // Not a query param: nginx forwards the browser's own Host header
  // (`proxy_set_header Host $host` in nginx.conf), so the server already
  // knows it without the client repeating it. This deployment only ever
  // serves plain http (see nginx.conf), so the scheme is fixed.
  if (!req.headers.host) throw new HttpError(400, 'Missing Host header')
  const host = `http://${req.headers.host}`

  const projectJson = await guardFs(
    () => readFile(path.join(projectAbs, PROJECT_FILE), 'utf8'),
    `No such project: ${project}`,
  )
  let codebaseDirOnHost
  try {
    codebaseDirOnHost = JSON.parse(projectJson).codebase_dir_on_host
  } catch {
    throw new HttpError(500, 'project.json is not valid JSON')
  }

  const workflowInstructions = await readFile(path.join(abs, WORKFLOW_INSTRUCTIONS_FILE), 'utf8').catch(() => '')

  const projectHostDir = MAESTRO_PULSE_HOST_DIR
    ? path.posix.join(MAESTRO_PULSE_HOST_DIR, 'resources/projects', project)
    : null
  const hostDirUnresolved = '(not resolved — MAESTRO_PULSE_HOST_DIR is not set on the api container; relative paths below cannot be resolved to real host paths)'

  const hostRootsList = renderKeyValueList([
    ['maestro_pulse_root', MAESTRO_PULSE_HOST_DIR ?? hostDirUnresolved],
    ['project_store_dir', projectHostDir ?? hostDirUnresolved],
    ['project_codebase_dir', codebaseDirOnHost ?? '(missing from project.json)'],
  ])

  const commonTools = await readToolCatalog(COMMON_TOOLS_ROOT)
  const commonToolsList = commonTools.length
    ? renderKeyValueList(
        commonTools.map((tool) => [path.posix.join('common-tools', tool.name, 'tool.sh'), tool.description]),
      )
    : '_None._'

  // Unlike run-manually, there's no agent yet at this stage to scope a
  // "selected tools" list by — every one of the project's own tools is
  // listed, unfiltered.
  const projectTools = await readToolCatalog(path.join(projectAbs, 'tools'))
  const projectToolsList = projectTools.length
    ? renderKeyValueList(projectTools.map((tool) => [path.posix.join('tools', tool.name, 'tool.sh'), tool.description]))
    : '_None._'

  const template = await readFile(ADD_TO_BACKLOG_TEMPLATE, 'utf8')
  const filled = template
    .replaceAll('{{PROJECT_NAME}}', project)
    .replaceAll('{{HOST_ROOTS_LIST}}', hostRootsList)
    .replaceAll('{{HOST_URL}}', host)
    .replaceAll('{{WORKFLOW_PATH}}', target)
    .replaceAll('{{COMMON_TOOLS_LIST}}', commonToolsList)
    .replaceAll('{{PROJECT_TOOLS_LIST}}', projectToolsList)
    .replaceAll('{{ATTACH_TOOL_ABS_PATH}}', hostAbsoluteToolPath('manage-card-attachments'))
    .replaceAll('{{WORKFLOW_INSTRUCTIONS}}', blockquote(workflowInstructions.trim()))

  return { status: 200, body: filled, raw: true }
}

/**
 * Serves the run-manually skill: everything an external Claude Code session
 * needs to pick up and execute one bot-column card by hand — the agent's own
 * instructions/profile fields (handholding/verbosity as prose, not raw
 * numbers) and the workflow's own instructions. Mirrors
 * getAddToBacklogSkill's validation shape for the project/workflow half.
 * Declares a small set of absolute host roots exactly once
 * (maestro_pulse_root, project_store_dir, project_codebase_dir), then every
 * tool/attachment is listed as a path relative to one of those — never a
 * repeated host-absolute path per entry. The two "meta" tools every card can
 * act through (move-maestro-pulse-card, manage-card-attachments) are the
 * deliberate exception: their absolute paths are resolved once each, purely
 * to hand the harness ready-to-run example commands instead of making it
 * explore their calling convention itself. `agent.md`/`workflow.md` content
 * is pasted in as a blockquote so any heading inside it can't be confused
 * with this template's own section headings.
 */
async function getRunManuallySkill(req, url) {
  const target = relativePath(url.searchParams.get('path'))
  const abs = path.join(ROOT, target)
  if (!(await isDirectory(abs)) || (await directoryType(abs)) !== 'workflow') {
    throw new HttpError(404, `No such workflow: ${target}`)
  }

  const project = target.split('/').slice(0, -2).join('/')
  const projectAbs = path.join(ROOT, project)
  if (!(await isDirectory(projectAbs)) || (await directoryType(projectAbs)) !== 'project') {
    throw new HttpError(404, `No such project: ${project}`)
  }

  const projectJson = await guardFs(
    () => readFile(path.join(projectAbs, PROJECT_FILE), 'utf8'),
    `No such project: ${project}`,
  )
  let codebaseDirOnHost
  try {
    codebaseDirOnHost = JSON.parse(projectJson).codebase_dir_on_host
  } catch {
    throw new HttpError(500, 'project.json is not valid JSON')
  }

  const cardId = validCardId(url.searchParams.get('card'))
  const { columns, cards } = await readWorkflowJson(abs)
  const card = cards.find((c) => c.id === cardId)
  if (!card) throw new HttpError(404, `No such card: ${cardId}`)

  const column = columns.find((c) => c.name === card.column)
  if (!column || !isBotColumn(column)) {
    throw new HttpError(400, `Card "${cardId}" is not in a bot column`)
  }

  const cardIssues = Array.isArray(card.issues)
    ? card.issues.filter((issue) => issue && typeof issue.title === 'string')
    : []
  const cardAttachments = Array.isArray(card.attachments)
    ? card.attachments.filter((a) => typeof a === 'string')
    : []

  const agentRelPath = column.agent
  const agentAbs = path.join(ROOT, agentRelPath)
  if (!(await isDirectory(agentAbs)) || (await directoryType(agentAbs)) !== 'agent') {
    throw new HttpError(404, `No such agent: ${agentRelPath}`)
  }

  const agentJsonRaw = await guardFs(
    () => readFile(path.join(agentAbs, AGENT_FILE), 'utf8'),
    `No such agent: ${agentRelPath}`,
  )
  let agentJson
  try {
    agentJson = JSON.parse(agentJsonRaw)
  } catch {
    throw new HttpError(500, 'agent.json is not valid JSON')
  }
  const agentDescription = typeof agentJson.description === 'string' ? agentJson.description : ''
  const agentMission = typeof agentJson.mission === 'string' ? agentJson.mission : ''
  const agentHandholding = typeof agentJson.handholding === 'number' ? agentJson.handholding : DEFAULT_HANDHOLDING
  const agentVerbosity = typeof agentJson.verbosity === 'number' ? agentJson.verbosity : DEFAULT_VERBOSITY

  const agentInstructions = await readFile(path.join(agentAbs, AGENT_INSTRUCTIONS_FILE), 'utf8').catch(() => '')

  const agentTools = Array.isArray(agentJson.tools) ? agentJson.tools.filter((t) => typeof t === 'string') : []

  const projectHostDir = MAESTRO_PULSE_HOST_DIR
    ? path.posix.join(MAESTRO_PULSE_HOST_DIR, 'resources/projects', project)
    : null
  const hostDirUnresolved = '(not resolved — MAESTRO_PULSE_HOST_DIR is not set on the api container; relative paths below cannot be resolved to real host paths)'

  const hostRootsList = renderKeyValueList([
    ['maestro_pulse_root', MAESTRO_PULSE_HOST_DIR ?? hostDirUnresolved],
    ['project_store_dir', projectHostDir ?? hostDirUnresolved],
    ['project_codebase_dir', codebaseDirOnHost ?? '(missing from project.json)'],
  ])

  const cardAttachmentsList = cardAttachments.length
    ? renderKeyValueList(cardAttachments.map((attachment, i) => [i + 1, attachment]))
    : '_None._'

  const commonTools = await readToolCatalog(COMMON_TOOLS_ROOT)
  const commonToolsList = commonTools.length
    ? renderKeyValueList(
        commonTools.map((tool) => [path.posix.join('common-tools', tool.name, 'tool.sh'), tool.description]),
      )
    : '_None._'

  const projectTools = await Promise.all(
    agentTools.map(async (toolRelPath) => {
      const toolAbs = path.join(projectAbs, toolRelPath)
      const raw = await readFile(path.join(toolAbs, 'tool.json'), 'utf8').catch(() => null)
      let description = ''
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          description = typeof parsed.description === 'string' ? parsed.description : ''
        } catch {
          // malformed tool.json: fall through with an empty description
        }
      }
      return [path.posix.join(toolRelPath, 'tool.sh'), description]
    }),
  )
  const projectToolsList = projectTools.length ? renderKeyValueList(projectTools) : '_None._'

  const workflowInstructions = await readFile(path.join(abs, WORKFLOW_INSTRUCTIONS_FILE), 'utf8').catch(() => '')

  const template = await readFile(RUN_MANUALLY_TEMPLATE, 'utf8')
  const filled = template
    .replaceAll('{{PROJECT_NAME}}', project)
    .replaceAll('{{HOST_ROOTS_LIST}}', hostRootsList)
    .replaceAll('{{WORKFLOW_PATH}}', target)
    .replaceAll('{{CARD_ID}}', cardId)
    .replaceAll('{{CARD_TITLE}}', card.title)
    .replaceAll('{{CARD_DESCRIPTION}}', card.description || '')
    .replaceAll('{{CARD_ISSUES}}', renderIssueList(cardIssues))
    .replaceAll('{{CARD_ATTACHMENTS_LIST}}', cardAttachmentsList)
    .replaceAll('{{AGENT_DESCRIPTION}}', agentDescription)
    .replaceAll('{{AGENT_MISSION}}', agentMission)
    .replaceAll('{{AGENT_HANDHOLDING_PROSE}}', describeSetting(agentHandholding, HANDHOLDING_DESCRIPTIONS))
    .replaceAll('{{AGENT_VERBOSITY_PROSE}}', describeSetting(agentVerbosity, VERBOSITY_DESCRIPTIONS))
    .replaceAll('{{AGENT_INSTRUCTIONS}}', blockquote(agentInstructions.trim()))
    .replaceAll('{{WORKFLOW_INSTRUCTIONS}}', blockquote(workflowInstructions.trim()))
    .replaceAll('{{COMMON_TOOLS_LIST}}', commonToolsList)
    .replaceAll('{{PROJECT_TOOLS_LIST}}', projectToolsList)
    .replaceAll('{{MOVE_CARD_TOOL_ABS_PATH}}', hostAbsoluteToolPath('move-maestro-pulse-card'))
    .replaceAll('{{ATTACH_TOOL_ABS_PATH}}', hostAbsoluteToolPath('manage-card-attachments'))
    .replaceAll('{{CARD_STATUS_TOOL_ABS_PATH}}', hostAbsoluteToolPath('manage-card-status'))

  return { status: 200, body: filled, raw: true }
}

/**
 * Absolute host path to a named common tool's tool.sh, for the ready-to-run
 * example commands both skill templates' "Card actions" sections give —
 * the one deliberate exception to every other tool/attachment being listed
 * as a relative path (see getRunManuallySkill / getAddToBacklogSkill).
 */
function hostAbsoluteToolPath(toolName) {
  return MAESTRO_PULSE_HOST_DIR
    ? path.posix.join(MAESTRO_PULSE_HOST_DIR, 'common-tools', toolName, 'tool.sh')
    : `<MAESTRO_PULSE_HOST_DIR not configured on the api container — can't build a runnable path for ${toolName}>`
}

/**
 * A tool's own name + description, read from its tool.json. Shared by both
 * skill endpoints for every catalog they list (common tools, and either an
 * agent's selected project tools or, for add-to-backlog, every project tool
 * unfiltered). Callers build the relative path themselves — common tools and
 * project tools join under different roots (see getRunManuallySkill /
 * getAddToBacklogSkill).
 */
async function readToolCatalog(toolsRoot) {
  const entries = await readdir(toolsRoot, { withFileTypes: true }).catch(() => [])
  const folders = entries.filter((entry) => entry.isDirectory())
  return Promise.all(
    folders.map(async (folder) => {
      const raw = await readFile(path.join(toolsRoot, folder.name, 'tool.json'), 'utf8').catch(() => null)
      let description = ''
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          description = typeof parsed.description === 'string' ? parsed.description : ''
        } catch {
          // malformed tool.json: fall through with an empty description
        }
      }
      return { description, name: folder.name }
    }),
  )
}

/**
 * Renders resolved key/value pairs as plain bullet lines — always the
 * already-resolved value itself (a real path, or a self-explaining fallback
 * string), never a placeholder the reader would have to go verify elsewhere.
 */
function renderKeyValueList(pairs) {
  return pairs.map(([key, value]) => `- ${key}: ${value}`).join('\n')
}

/**
 * Renders a card's issues into the markdown bullet form the run-manually
 * template embeds — solved issues are struck through and marked rather than
 * dropped, mirroring how CardDetailModal.tsx renders the same field.
 */
function renderIssueList(issues) {
  if (issues.length === 0) return '_None._'
  return issues
    .map((issue) => {
      const title = issue.is_solved ? `~~${issue.title}~~ (solved)` : issue.title
      return issue.description ? `- ${title}: ${issue.description}` : `- ${title}`
    })
    .join('\n')
}

/**
 * Quotes a block of markdown (an agent's/workflow's own free-text
 * instructions) with `>` so any heading inside it renders visually and
 * structurally apart from the enclosing skill template's own section
 * headings, rather than blending into the same heading scheme. Shared by
 * both getRunManuallySkill and getAddToBacklogSkill.
 */
function blockquote(text) {
  if (!text) return '_None._'
  return text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')
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
 * has no business creating or reading. project.json holds that real path, so
 * it's gitignored; project.json.dist documents its shape with a placeholder
 * instead, so the file the user's repo actually tracks has nothing host-local
 * in it.
 */
async function scaffoldProject(abs, { name, location, description }) {
  await writeFile(
    path.join(abs, PROJECT_FILE),
    `${JSON.stringify({ codebase_dir_on_host: location }, null, 2)}\n`,
  )
  await writeFile(
    path.join(abs, PROJECT_FILE_TEMPLATE),
    `${JSON.stringify({ codebase_dir_on_host: '/path/to/project/on/host' }, null, 2)}\n`,
  )
  await writeFile(path.join(abs, GITIGNORE_FILE), `${PROJECT_FILE}\n`)
  await writeFile(path.join(abs, README_FILE), `# ${name}\n\n${description}\n`)

  for (const child of PROJECT_SUBDIRECTORIES) await mkdir(path.join(abs, child))
}

/**
 * Writes (or rewrites) a workflow's `workflow.json`. Used both to fill a
 * freshly made workflow directory and, from `updateEntry`, to save edits to an
 * existing one — the "wrap the client's columns with the fixed ones" rule
 * lives here exactly once so create and edit can never drift apart on it.
 */
async function scaffoldWorkflow(abs, { description, columns, backlogDescription, doneDescription }) {
  const full = [
    { name: FIXED_LEADING_COLUMN, bot: false, agent: null, description: backlogDescription },
    ...columns,
    { name: FIXED_TRAILING_COLUMN, bot: false, agent: null, description: doneDescription },
  ]
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
 * server-side, so this is just what `validAgentDetails` already validated.
 */
async function scaffoldAgent(abs, details) {
  await writeFile(path.join(abs, AGENT_FILE), `${JSON.stringify(details, null, 2)}\n`)
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

// Mirrors HANDHOLDING_DESCRIPTIONS/VERBOSITY_DESCRIPTIONS in
// src/data/agent.ts (server code can't import that .ts module) — keep in
// sync if that file's prose ever changes.
const HANDHOLDING_DESCRIPTIONS = {
  0: 'Agent decides everything itself.',
  25: 'Escalate architecture/design decisions only.',
  50: 'Escalate significant ambiguity and tradeoffs.',
  75: 'Ask on most non-trivial decisions.',
  100: 'Ask whenever there is meaningful ambiguity.',
}

const VERBOSITY_DESCRIPTIONS = {
  0: 'Caveman',
  25: 'Concise',
  50: 'Normal',
  75: 'Detailed',
  100: 'Scholar',
}

/**
 * Renders a 0-100 setting as the prose an external harness should follow,
 * snapping to the nearest documented step. 50 is called out explicitly as
 * the default so it reads as "behave normally", not as an instruction to
 * follow — matching HANDHOLDING_TOOLTIP/VERBOSITY_TOOLTIP's own "50% is the
 * baseline value" framing client-side.
 */
function describeSetting(value, descriptions) {
  const steps = [0, 25, 50, 75, 100]
  const nearest = steps.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a))
  const prose = descriptions[nearest]
  return nearest === 50 ? `${prose} (this is the default — no special adjustment needed)` : prose
}

/**
 * Applies one card action, validated against the card's *current* column —
 * found by position (Backlog is index 0, Done is the last index), the same
 * rule scaffoldWorkflow's assembly and validColumn already rely on.
 */
function applyCardAction(data, cardId, action, targetColumnName, statusValue) {
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
    case 'move-to': {
      const target = columns.find((column) => column.name === targetColumnName)
      if (!target) throw new HttpError(400, `No such column: ${targetColumnName}`)
      const moved = { ...card, column: target.name, last_activity: `Agent moved the card to ${target.name} column` }
      return { ...data, cards: cards.map((c, i) => (i === index ? moved : c)) }
    }
    case 'set-status': {
      const { status: _status, ...withoutStatus } = card
      const updated = statusValue
        ? { ...card, status: statusValue, last_activity: `Agent marked the card as ${statusValue}` }
        : { ...withoutStatus, last_activity: 'Agent cleared the card status' }
      return { ...data, cards: cards.map((c, i) => (i === index ? updated : c)) }
    }
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

  const card = { ...cards[index], column: target.name, last_activity: `User moved the card to ${target.name} column` }
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
 * `isBotColumn`. A bot column must also name the agent that runs it; a human
 * column never carries one, even if the client sent one anyway.
 */
function validColumn(entry) {
  const name = requiredText(entry?.name, 'column name')
  if (name.length > MAX_COLUMN_NAME_LENGTH) throw new HttpError(400, 'That column name is too long')

  const bot = entry?.bot === true
  const agent = validAgentRef(entry?.agent)
  if (bot && agent === null) throw new HttpError(400, `Column "${name}" needs an agent`)

  const description = requiredText(entry?.description, 'column description')

  return { name, bot, agent: bot ? agent : null, description }
}

/** An agent reference: absent or explicit `null` both mean "none". */
function validAgentRef(input) {
  const value = input ?? null
  if (value !== null && typeof value !== 'string') {
    throw new HttpError(400, '"agent" must be a string or null')
  }

  return value
}

/**
 * Validates and returns an agent's full `agent.json` shape, for both
 * `createEntry` and `updateEntry`. `description` keeps the existing
 * required-text rule; `title`/`mission` are optional free text; the numeric
 * fields fall back to their defaults when absent, so a body from before
 * these fields existed still validates. `tools` likewise defaults to `[]`
 * for the same reason.
 */
function validAgentDetails(body) {
  return {
    description: requiredText(body.description, 'description'),
    title: optionalText(body.title, 'title'),
    mission: optionalText(body.mission, 'mission'),
    heartbeat: validRange(body.heartbeat, 'heartbeat', {
      min: HEARTBEAT_MIN,
      max: HEARTBEAT_MAX,
      step: HEARTBEAT_STEP,
      fallback: DEFAULT_HEARTBEAT,
    }),
    maxChildren: validRange(body.maxChildren, 'maxChildren', {
      min: MAX_CHILDREN_MIN,
      max: MAX_CHILDREN_MAX,
      step: MAX_CHILDREN_STEP,
      fallback: DEFAULT_MAX_CHILDREN,
    }),
    handholding: validRange(body.handholding, 'handholding', {
      min: HANDHOLDING_MIN,
      max: HANDHOLDING_MAX,
      step: HANDHOLDING_STEP,
      fallback: DEFAULT_HANDHOLDING,
    }),
    verbosity: validRange(body.verbosity, 'verbosity', {
      min: VERBOSITY_MIN,
      max: VERBOSITY_MAX,
      step: VERBOSITY_STEP,
      fallback: DEFAULT_VERBOSITY,
    }),
    tools: validTools(body.tools),
  }
}

/**
 * An agent's toolkit — project-relative paths (e.g. `"tools/read-from-trello"`)
 * into its project's `tools/` folder. No other metadata travels with them; a
 * tool's own name/description/icon live in that folder's `tool.json`. Absent
 * means "no tools" rather than an error, for the same before-this-field-existed
 * reason every other agent.json field defaults. Deliberately shallow — this
 * does not check the referenced folder exists, matching the app's existing
 * tolerance for a stale reference (e.g. a renamed workflow column orphaning
 * its cards).
 */
function validTools(input) {
  if (input === undefined) return []
  if (!Array.isArray(input)) throw new HttpError(400, '"tools" must be an array')

  return input.map((entry, i) => {
    if (typeof entry !== 'string') throw new HttpError(400, `"tools[${i}]" must be a string`)
    const value = entry.trim()
    if (!value) throw new HttpError(400, `"tools[${i}]" cannot be empty`)
    if (value.length > MAX_TEXT_LENGTH) throw new HttpError(400, `"tools[${i}]" is too long`)
    if (value.includes('\0')) throw new HttpError(400, `"tools[${i}]" is invalid`)

    return value
  })
}

/** Like `requiredText`, but empty is allowed rather than rejected. */
function optionalText(input, field) {
  const value = typeof input === 'string' ? input.trim() : ''
  if (value.length > MAX_TEXT_LENGTH) throw new HttpError(400, `That ${field} is too long`)
  if (value.includes('\0')) throw new HttpError(400, `Invalid ${field}`)

  return value
}

/**
 * An agent's `agent.md` or a workflow's `workflow.md` body — far longer than
 * any other free text field (`MAX_TEXT_LENGTH`), since it is prose rather
 * than a label, and empty is valid: nothing forces either to keep non-blank
 * instructions.
 */
function validInstructions(input) {
  const value = typeof input === 'string' ? input.trim() : ''
  if (value.length > MAX_INSTRUCTIONS_LENGTH) throw new HttpError(400, 'Instructions are too long')
  if (value.includes('\0')) throw new HttpError(400, 'Invalid instructions')

  return value
}

/**
 * A numeric setting within `[min, max]` and aligned to `step`, defaulting to
 * `fallback` when absent — a slider can't produce an invalid value, but a
 * hand-crafted request could, and an older body simply won't have sent one.
 */
function validRange(input, field, { min, max, step, fallback }) {
  if (input === undefined) return fallback
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new HttpError(400, `"${field}" must be a number`)
  }
  if (input < min || input > max) {
    throw new HttpError(400, `"${field}" must be between ${min} and ${max}`)
  }
  if ((input - min) % step !== 0) {
    throw new HttpError(400, `"${field}" must be a multiple of ${step} starting from ${min}`)
  }

  return input
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

/** `undefined`/`null` both mean "clear the status" — a caller may omit the
 *  key entirely rather than send it explicitly. */
function validCardStatus(input) {
  if (input === null || input === undefined) return null
  if (!CARD_STATUSES.includes(input)) {
    throw new HttpError(400, `"status" must be one of: ${CARD_STATUSES.join(', ')}`)
  }

  return input
}

/** The one predicate that decides which kind an `attachments` entry is —
 *  nothing else in `workflow.json` records it separately. Mirrored in
 *  `src/components/CardDetailModal.tsx` since the server code can't import
 *  that .ts module. */
const isUrlAttachment = (value) => /^https?:\/\//i.test(value)

/**
 * What `attachToCard` records on a card: either a bare URL, taken as-is, or
 * a project-relative path — the caller's job to have gotten that path from
 * `createAttachmentFile` in the first place, checked to actually exist by
 * `attachToCard` itself before it's ever written into `workflow.json`.
 */
function validAttachmentRef(input) {
  const value = requiredText(input, 'attachment')
  if (isUrlAttachment(value)) return value
  if (!value.startsWith(`${ATTACHMENTS_SUBDIR}/`)) {
    throw new HttpError(400, `"attachment" must be a URL or a path under ${ATTACHMENTS_SUBDIR}/`)
  }

  return value
}

/** Basename-only, `.md`-only — this becomes the tail of a file actually
 *  written to disk, so it's held to the same shape `validName` holds any
 *  other created name to. Absent falls back to a generic name, same
 *  before-this-field-existed-style tolerance other optional fields get. */
function validAttachmentName(input) {
  const raw = typeof input === 'string' && input.trim() ? input.trim() : 'attachment.md'
  const name = path.posix.basename(raw)

  if (!name || name.startsWith('.')) throw new HttpError(400, 'Invalid attachment name')
  if (/[/\\\0]/.test(name)) throw new HttpError(400, 'Invalid attachment name')
  if (name.length > MAX_ATTACHMENT_NAME_LENGTH) throw new HttpError(400, 'That attachment name is too long')
  if (!name.toLowerCase().endsWith('.md')) throw new HttpError(400, 'The attachment must be a .md file')

  return name
}

/** `YYYYMMDDHHMMSS`, generated server-side (one clock, one format) rather
 *  than trusting the caller's own — same reasoning `randomUUID()` for a new
 *  card's id is already server-side. */
function timestampPrefix() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
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

/** Same no-store rule as `send`, but for a handler that answers with plain
 *  text instead of JSON — see `getAddToBacklogSkill`. */
function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  res.end(text)
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
    if (result.raw) sendText(res, result.status, result.body)
    else send(res, result.status, result.body)
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
