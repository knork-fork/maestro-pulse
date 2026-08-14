/**
 * The tree mixes two worlds, split at the project boundary:
 *
 * - `folder` is organizational — it exists only to group things, and is the one
 *   node type new folders and projects can be created inside.
 * - `project` is a leaf of that organization. It renders like a folder and
 *   expands like one, but nothing can be created inside it.
 * - `directory` / `file` are a project's own contents.
 */
export type TreeNode =
  | { type: 'folder'; name: string; children: TreeNode[] }
  | { type: 'project'; name: string; children: TreeNode[] }
  | { type: 'directory'; name: string; children: TreeNode[] }
  | { type: 'file'; name: string }

/** Only organizational folders accept new children. */
export const acceptsNewChildren = (node: TreeNode) => node.type === 'folder'

export const childrenOf = (node: TreeNode): TreeNode[] =>
  node.type === 'file' ? [] : node.children

const folder = (name: string, children: TreeNode[] = []): TreeNode => ({
  type: 'folder',
  name,
  children,
})

const project = (name: string, children: TreeNode[] = []): TreeNode => ({
  type: 'project',
  name,
  children,
})

const directory = (name: string, children: TreeNode[] = []): TreeNode => ({
  type: 'directory',
  name,
  children,
})

const file = (name: string): TreeNode => ({ type: 'file', name })

/** Placeholder tree — swap for real project data once a source exists. */
export const projects: TreeNode[] = [
  project('work', [directory('agents'), directory('workflows')]),
  folder('projects'),
  folder('maestro-family', [
    project('maestro'),
    project('maestro-atlas'),
    project('maestro-deck'),
    project('maestro-pulse', [
      directory('agents'),
      directory('workflows'),
      file('CLAUDE.md'),
      file('README.md'),
    ]),
  ]),
]
