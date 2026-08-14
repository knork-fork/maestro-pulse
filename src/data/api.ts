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

export const fetchTree = () =>
  request<{ nodes: TreeNode[] }>('GET', '/tree').then((body) => body.nodes)

/** One file's text. Rejects if it is missing, not a file, or too large to show. */
export const fetchFile = (path: string) =>
  request<{ path: string; content: string }>(
    'GET',
    `/file?path=${encodeURIComponent(path)}`,
  ).then((body) => body.content)

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
