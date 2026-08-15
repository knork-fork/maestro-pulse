import type { TreeNode } from '../data/tree'
import { locate, parseAgentViewPath, parseBoardPath } from '../data/tree'
import { useFileContent } from '../hooks/useFileContent'
import type { FileContext, FileView } from '../views/registry'
import { fileContext, viewFor } from '../views/registry'
import { AgentView } from './AgentView'
import { KanbanBoard } from './KanbanBoard'

type Props = {
  nodes: TreeNode[]
  selectedPath: string | null
}

/**
 * The middle pane: whichever file is selected, shown by whichever view claims it.
 *
 * The selection is a path, so the node is resolved against the current tree on
 * every render rather than remembered. That is what keeps this pane honest — after
 * a mutation re-reads the tree, a path that no longer resolves simply falls back
 * to the empty state, and no one has to remember to clear anything.
 */
export function MainPane({ nodes, selectedPath }: Props) {
  // The board is not a file, so it is checked for before `locate` even runs
  // against the file-view machinery below — see `workflowBoardPath` in
  // ../data/tree.
  const boardPath = selectedPath === null ? null : parseBoardPath(selectedPath)
  if (boardPath !== null) {
    const board = locate(nodes, boardPath)
    if (board && board.node.type === 'workflow') {
      return (
        <main className="main">
          <KanbanBoard key={board.node.path} path={board.node.path} name={board.node.name} treeVersion={nodes} />
        </main>
      )
    }
    // A stale board path (the workflow was deleted) is as harmless as a stale
    // file path — just nothing to show.
    return <main className="main" />
  }

  // Same trick for an agent's own view — see `agentViewPath` in ../data/tree.
  const agentViewSourcePath = selectedPath === null ? null : parseAgentViewPath(selectedPath)
  if (agentViewSourcePath !== null) {
    const found = locate(nodes, agentViewSourcePath)
    if (found && found.node.type === 'agent') {
      return (
        <main className="main">
          <AgentView key={found.node.path} path={found.node.path} name={found.node.name} treeVersion={nodes} />
        </main>
      )
    }
    // A stale agent path (the agent was deleted) is as harmless as a stale
    // board or file path — just nothing to show.
    return <main className="main" />
  }

  const found = selectedPath === null ? null : locate(nodes, selectedPath)
  const context = found && fileContext(found.node, found.parent)
  const view = context && viewFor(context)

  // Nothing to show is shown as nothing: the tree is where a file is picked, so a
  // prompt here would only say what the sidebar already makes obvious.
  if (!view || !context) return <main className="main" />

  return (
    <main className="main">
      <div className="viewer">
        <FileContents key={context.node.path} view={view} context={context} />
      </div>
    </main>
  )
}

/**
 * Split out because the read is a hook, and whether there is anything to read is
 * decided above. Keyed by path, so switching files starts from nothing rather than
 * showing the previous file's text for a frame.
 */
function FileContents({ view, context }: { view: FileView; context: FileContext }) {
  const { content, error, loading } = useFileContent(context.node.path)

  if (loading) return <p className="empty-state">Loading…</p>
  if (error) {
    return (
      <p className="viewer__error" role="alert">
        {error}
      </p>
    )
  }
  if (content === null) return null

  return <view.render content={content} context={context} />
}
