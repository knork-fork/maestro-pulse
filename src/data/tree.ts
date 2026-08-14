/**
 * What the sidebar renders: the contents of `resources/projects` as reported by
 * the API. The variants split at the project boundary:
 *
 * - `folder` is organizational — it exists only to group things, and is the one
 *   node type new folders and projects can be created inside.
 * - `project` is a leaf of that organization. It renders and expands like a
 *   folder, but nothing can be created inside it.
 * - `directory` / `file` are contents: a project's own, or anything unmarked
 *   that the user put there by hand.
 *
 * Which of the three a directory is cannot be read off the filesystem, so the
 * API keeps it in a marker inside the directory; see `directoryType` in
 * [server/index.mjs](../../server/index.mjs).
 *
 * `path` is relative to the projects root, slash-joined, and is a node's
 * identity: expansion, renames and deletes are all keyed by it.
 */
export type TreeNode =
  | { type: 'folder'; name: string; path: string; children: TreeNode[] }
  | { type: 'project'; name: string; path: string; children: TreeNode[] }
  | { type: 'directory'; name: string; path: string; children: TreeNode[] }
  | { type: 'file'; name: string; path: string }

/** The two things a `folder` can be asked to create. */
export type CreatableType = 'folder' | 'project'

/** Only organizational folders accept new children. */
export const acceptsNewChildren = (node: TreeNode) => node.type === 'folder'

/** Everything but a file holds children, so everything but a file expands. */
export const isExpandable = (node: TreeNode) => node.type !== 'file'

export const childrenOf = (node: TreeNode): TreeNode[] =>
  node.type === 'file' ? [] : node.children
