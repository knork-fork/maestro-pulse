import type { TreeNode } from './tree'

/** nginx proxies this prefix to the API service; see nginx.conf. */
const BASE = '/api'

/** The projects root itself — the parent to create in at the top level. */
export const ROOT_PATH = ''

/** What a project is created with, beyond the name every entry has. */
export type ProjectDetails = {
  name: string
  /** An absolute path on the user's machine, recorded and never touched. */
  location: string
  description: string
}

/** One column a workflow's own creator added — the fixed Backlog/Done are
 *  never part of this: the server adds them unconditionally. Ready and Doing
 *  are ordinary columns like any other, just seeded by default. A bot column
 *  must also name the agent that runs it; a human column's `agent` is
 *  always `null`. `description` explains what the column is for — shown as
 *  a hover tooltip on the board — and is required for every column. */
export type CustomWorkflowColumn = {
  name: string
  bot: boolean
  agent: string | null
  description: string
}

export type NewWorkflowDetails = {
  name: string
  description: string
  columns: CustomWorkflowColumn[]
  /** Descriptions for the fixed Backlog/Done columns, which aren't part of
   *  `columns` — the server assembles them, but the client still collects
   *  and validates their description like any other column's. */
  backlogDescription: string
  doneDescription: string
}

/** What editing a workflow can change. Its name is fixed after creation. */
export type WorkflowEdits = {
  description: string
  columns: CustomWorkflowColumn[]
  backlogDescription: string
  doneDescription: string
}

export type NewAgentDetails = {
  name: string
  description: string
  title: string
  mission: string
  heartbeat: number
  maxChildren: number
  handholding: number
  verbosity: number
  tools: string[]
}

/** What editing an agent can change. Its name is fixed after creation. */
export type AgentEdits = {
  description: string
  title: string
  mission: string
  heartbeat: number
  maxChildren: number
  handholding: number
  verbosity: number
  tools: string[]
}

export const fetchTree = () =>
  request<{ nodes: TreeNode[] }>('GET', '/tree').then((body) => body.nodes)

/** The tools available to every project by default — baked into the image,
 *  not part of the user's own project store; see COMMON_TOOLS_ROOT in
 *  server/index.mjs. */
export type CommonTool = { path: string; title: string; description: string; icon: string | null }

export const fetchCommonTools = () =>
  request<{ tools: CommonTool[] }>('GET', '/common-tools').then((body) => body.tools)

/** One file's text. Rejects if it is missing, not a file, or too large to show. */
export const fetchFile = (path: string) =>
  request<{ path: string; content: string }>(
    'GET',
    `/file?path=${encodeURIComponent(path)}`,
  ).then((body) => body.content)

/** Whether a `fetchFile` rejection means "does not exist yet" rather than a
 *  real failure — matches `getFile`'s own message in server/index.mjs. Used
 *  where a missing file is expected and has a sensible empty fallback, e.g.
 *  an agent created before `agent.md` existed. */
export const isMissingFileError = (message: string) => message.startsWith('No such file')

/** Rejects if `name` is taken, which is what the draft row reports. */
export const createFolder = (parent: string, name: string) =>
  request<{ path: string }>('POST', '/entries', { parent, type: 'folder', name }).then(
    (body) => body.path,
  )

/** Rejects if the name is taken, which is what the dialog reports. */
export const createProject = (parent: string, details: ProjectDetails) =>
  request<{ path: string }>('POST', '/entries', { parent, type: 'project', ...details }).then(
    (body) => body.path,
  )

/** Rejects if the name is taken, which is what the dialog reports. */
export const createWorkflow = (parent: string, details: NewWorkflowDetails) =>
  request<{ path: string }>('POST', '/entries', { parent, type: 'workflow', ...details }).then(
    (body) => body.path,
  )

/** Overwrites an existing workflow's description/columns. Its path never
 *  changes, since the name is fixed after creation. */
export const updateWorkflow = (path: string, edits: WorkflowEdits) =>
  request<{ path: string }>('PUT', '/entries', { path, type: 'workflow', ...edits }).then(
    (body) => body.path,
  )

/** Where a workflow's saved data lives, for `fetchFile` to read when
 *  prefilling the edit dialog, or loading its board. */
export const workflowFilePath = (workflowPath: string) => `${workflowPath}/workflow.json`

/** Where a workflow's own instructions live — a separate file from
 *  `workflow.json`, written independently of it. */
export const workflowInstructionsPath = (workflowPath: string) => `${workflowPath}/workflow.md`

/** Overwrites an existing workflow's `workflow.md`. Never touches `workflow.json`. */
export const updateWorkflowInstructions = (path: string, instructions: string) =>
  request<{ path: string }>('PUT', '/workflow-instructions', { path, instructions }).then(() => undefined)

/** One column as the board sees it — `bot` is the one field that decides
 *  bot-vs-human styling, for Backlog/Done and any ordinary column alike;
 *  `agent` names which agent runs it, non-null exactly when `bot` is. */
export type WorkflowColumn = {
  name: string
  bot: boolean
  agent: string | null
  /** What the column is for — shown as a hover tooltip; see `Column.tsx`. */
  description: string
}

/** A card references its column by name, not id — the same no-id convention
 *  columns themselves already follow. Renaming the column out from under it
 *  is an accepted gap; see CLAUDE.md. A card's avatar comes from its
 *  column's `agent`, not anything stored on the card itself. `status` is
 *  cosmetic — it only drives the card's outline; `null`/absent/any other
 *  value shows no outline. `last_activity` is a free-text description of
 *  the card's most recent event (e.g. a column move); `null`/absent means
 *  none yet. `issues` is a flat list of problems flagged on the card;
 *  `is_solved` renders as struck-through rather than removing the entry, and
 *  an issue's `description` shows as a hover tooltip on its `title` rather
 *  than inline. */
export type WorkflowCard = {
  id: string
  title: string
  description: string
  column: string
  status: 'in_session' | 'blocked' | null
  last_activity: string | null
  issues: { title: string; is_solved: boolean; description: string }[]
}

export type CardAction = 'move-up' | 'move-down' | 'move-right' | 'delete' | 'archive'

const patchCard = (path: string, cardId: string, action: CardAction) =>
  request<{ path: string }>('PATCH', '/workflow-cards', { path, cardId, action }).then(() => undefined)

export const moveCardUp = (path: string, cardId: string) => patchCard(path, cardId, 'move-up')
export const moveCardDown = (path: string, cardId: string) => patchCard(path, cardId, 'move-down')
export const moveCardRight = (path: string, cardId: string) => patchCard(path, cardId, 'move-right')
export const deleteCard = (path: string, cardId: string) => patchCard(path, cardId, 'delete')
export const archiveCard = (path: string, cardId: string) => patchCard(path, cardId, 'archive')

/** Rejects if the name is taken, which is what the dialog reports. */
export const createAgent = (parent: string, details: NewAgentDetails) =>
  request<{ path: string }>('POST', '/entries', { parent, type: 'agent', ...details }).then(
    (body) => body.path,
  )

/** Overwrites an existing agent's full agent.json. Its path never changes,
 *  since the name is fixed after creation. */
export const updateAgent = (path: string, edits: AgentEdits) =>
  request<{ path: string }>('PUT', '/entries', { path, type: 'agent', ...edits }).then(
    (body) => body.path,
  )

/** Where an agent's saved data lives, for `fetchFile` to read when
 *  prefilling the edit dialog. */
export const agentFilePath = (agentPath: string) => `${agentPath}/agent.json`

/** Where an agent's system/personalization instructions live — a separate
 *  file from `agent.json`, written independently of it. */
export const agentInstructionsPath = (agentPath: string) => `${agentPath}/agent.md`

/** Overwrites an existing agent's `agent.md`. Never touches `agent.json`. */
export const updateAgentInstructions = (path: string, instructions: string) =>
  request<{ path: string }>('PUT', '/agent-instructions', { path, instructions }).then(() => undefined)

/** Resolves to the entry's new path, which differs from the old one. */
export const renameEntry = (path: string, name: string) =>
  request<{ path: string }>('PATCH', '/entry', { path, name }).then((body) => body.path)

export const deleteEntry = (path: string) =>
  request<void>('DELETE', `/entry?path=${encodeURIComponent(path)}`)

async function request<T>(method: string, route: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await readBody(response)
  if (!response.ok) {
    throw new Error(errorIn(payload) ?? `${method} ${route} failed (${response.status})`)
  }

  return payload as T
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** The API reports failures as `{ error }`; anything else is not worth showing. */
function errorIn(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { error } = payload as { error?: unknown }
  return typeof error === 'string' && error ? error : null
}
