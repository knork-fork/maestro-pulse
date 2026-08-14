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
  | { type: 'workflow'; name: string; path: string; children: TreeNode[] }
  | { type: 'directory'; name: string; path: string; children: TreeNode[] }
  | { type: 'file'; name: string; path: string }

/** The two things a `folder` can be asked to create. */
export type CreatableType = 'folder' | 'project'

/** The variants that hold children — everything a file can sit in. */
export type BranchNode = Extract<TreeNode, { children: TreeNode[] }>
export type FileNode = Extract<TreeNode, { type: 'file' }>

/** Only organizational folders accept new children. */
export const acceptsNewChildren = (node: TreeNode) => node.type === 'folder'

/**
 * `folder` and `project` are the organization, and only the organization is ours
 * to reshape. What is inside a project is the user's own content: it can be read,
 * but not renamed or deleted from here.
 */
export const isOrganizational = (node: TreeNode) =>
  node.type === 'folder' || node.type === 'project'

/**
 * The one `directory` a project owns that isn't just content: right-clicking
 * it offers "Add new workflow" instead of the usual create/rename/delete set.
 * A `workflow` itself gets its own Edit/Delete menu, handled separately in
 * `ProjectTree.tsx` rather than through `isOrganizational`.
 */
export const isWorkflowsFolder = (node: TreeNode, parent: TreeNode | null) =>
  node.type === 'directory' && node.name === 'workflows' && parent?.type === 'project'

/** Everything but a file holds children, so everything but a file expands. */
export const isExpandable = (node: TreeNode) => node.type !== 'file'

export const childrenOf = (node: TreeNode): TreeNode[] =>
  node.type === 'file' ? [] : node.children

/**
 * Finds the node at `path`, and the one holding it. Segments are names and names
 * are unique within a directory, so the walk is exact.
 *
 * Returns null when the path is not in the tree — which is how a caller holding a
 * path across a reload (the selected file, say) learns that it is gone.
 */
export const locate = (
  nodes: TreeNode[],
  path: string,
): { node: TreeNode; parent: BranchNode | null } | null => {
  let siblings = nodes
  let parent: BranchNode | null = null
  let found: TreeNode | null = null

  for (const segment of path.split('/')) {
    // Each segment must resolve against the previous one's children.
    if (found && found.type === 'file') return null
    if (found) {
      parent = found
      siblings = found.children
    }

    found = siblings.find((node) => node.name === segment) ?? null
    if (!found) return null
  }

  return found ? { node: found, parent } : null
}

/**
 * The board is not a file, so it needs a path of its own to be a `selectedPath`
 * without one ever pointing at a real node. A leading dot makes that safe:
 * `validName` refuses to create one, and the server skips dotfiles when
 * building the tree, so this can never collide with something real.
 */
const BOARD_SUFFIX = '/.board'

export const workflowBoardPath = (workflowPath: string) => `${workflowPath}${BOARD_SUFFIX}`

export const parseBoardPath = (path: string): string | null =>
  path.endsWith(BOARD_SUFFIX) ? path.slice(0, -BOARD_SUFFIX.length) : null

/**
 * Keeps only the nodes that match `query` by name, or lead to one that does.
 *
 * Only a `folder`'s children are organization — the same scope
 * `acceptsNewChildren` draws the line at. Recursion follows that line exactly:
 * a `folder` is searched into, but a `project` or a plain `directory`/`file` a
 * user dropped in by hand is judged by its own name alone, and if it matches,
 * everything under it is carried through untouched. That's what keeps
 * `README.md` and friends showing under a matching project, and is also why a
 * non-matching plain subdirectory's own contents are never individually
 * re-tested — they are content, not organization, one level past the folder
 * that holds them.
 */
export const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
  const q = query.trim().toLowerCase()
  return q ? filterChildren(nodes, q) : nodes
}

const filterChildren = (nodes: TreeNode[], q: string): TreeNode[] =>
  nodes.flatMap((node): TreeNode[] => {
    const matches = node.name.toLowerCase().includes(q)
    if (node.type !== 'folder') return matches ? [node] : []

    const children = filterChildren(node.children, q)
    return matches || children.length > 0 ? [{ ...node, children }] : []
  })

/**
 * Every path in `nodes` that can be expanded, so a filtered tree can default to
 * showing its matches without anyone having manually expanded the folders
 * leading to them.
 */
export const expandablePaths = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((node) => (isExpandable(node) ? [node.path, ...expandablePaths(childrenOf(node))] : []))
