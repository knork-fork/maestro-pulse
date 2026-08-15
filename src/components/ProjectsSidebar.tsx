import { useMemo, useState } from 'react'
import { ROOT_PATH } from '../data/api'
import type { CreatableType, TreeNode } from '../data/tree'
import { expandablePaths, filterTree, locate } from '../data/tree'
import type { ProjectTreeState } from '../hooks/useProjectTree'
import { AgentDialog } from './AgentDialog'
import { AgentInstructionsModal } from './AgentInstructionsModal'
import { ConfirmDialog } from './ConfirmDialog'
import { NewMenu } from './NewMenu'
import { NewProjectDialog } from './NewProjectDialog'
import { ProjectTree } from './ProjectTree'
import type { Draft } from './ProjectTree'
import { RenameDialog } from './RenameDialog'
import type { AvailableAgent } from './WorkflowDialog'
import { WorkflowDialog } from './WorkflowDialog'
import { RefreshIcon } from './icons'

/**
 * The left pane, and the owner of everything the tree can be in the middle of:
 * the unsaved draft row (which the header's "+" and a folder's own "+" both
 * start) and whichever dialog is open.
 *
 * Both "+" menus and the tree's context menu funnel into `startCreate`, which is
 * where the two kinds part company: a folder is named in the tree, a project is
 * asked about in a dialog.
 *
 * The tree itself is handed in rather than read here, because the main pane shows
 * what is selected in it; see [App.tsx](../App.tsx).
 */
export function ProjectsSidebar({ tree }: { tree: ProjectTreeState }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The parent a project is being described for, if one is. */
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<TreeNode | null>(null)
  const [deleting, setDeleting] = useState<TreeNode | null>(null)
  /** The `workflows` folder a new workflow is being described for, if one is. */
  const [creatingWorkflowIn, setCreatingWorkflowIn] = useState<string | null>(null)
  const [editingWorkflow, setEditingWorkflow] = useState<TreeNode | null>(null)
  /** The `agents` folder a new agent is being described for, if one is. */
  const [creatingAgentIn, setCreatingAgentIn] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<TreeNode | null>(null)
  const [editingAgentInstructions, setEditingAgentInstructions] = useState<TreeNode | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  /**
   * Paths the user has manually collapsed while a filter is active. A filter
   * defaults every match open, since nothing else could reveal one nested under
   * a folder that was never expanded — this is what lets that default be undone
   * per-row without touching the real, persisted `expanded` set underneath.
   */
  const [filterCollapsed, setFilterCollapsed] = useState<Set<string>>(new Set())

  const filteredNodes = useMemo(() => filterTree(tree.nodes, filterQuery), [tree.nodes, filterQuery])
  const filtering = filterQuery.trim() !== ''

  // Only ever consulted while filtering, so clearing the filter falls straight
  // back to `tree.expanded` exactly as the user left it.
  const effectiveExpanded = useMemo(
    () =>
      filtering
        ? new Set(expandablePaths(filteredNodes).filter((path) => !filterCollapsed.has(path)))
        : tree.expanded,
    [filtering, filteredNodes, filterCollapsed, tree.expanded],
  )

  const handleFilterChange = (value: string) => {
    setFilterQuery(value)
    // A cleared filter starts its next session fresh, open by default again.
    if (value.trim() === '') setFilterCollapsed(new Set())
  }

  const handleToggle = (path: string) => {
    if (!filtering) {
      tree.toggle(path)
      return
    }

    setFilterCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const startCreate = (parentPath: string, type: CreatableType) => {
    if (type === 'project') {
      setCreatingIn(parentPath)
      return
    }

    // The draft has to be visible to be typed into.
    tree.reveal(parentPath)
    setDraft({ parentPath })
  }

  const commitDraft = async (name: string) => {
    if (!draft) return
    const committed = draft

    await tree.createFolder(committed.parentPath, name)
    // Leaving the field commits, so another "+" may have started a second draft
    // while this one was saving — that one is not ours to close.
    setDraft((current) => (current === committed ? null : current))
  }

  /**
   * The agents a workflow's bot columns may be assigned to, scoped to the
   * project that owns `workflowsFolderPath` (its `agents` sibling folder) —
   * not every agent in the whole tree.
   */
  const agentsFor = (workflowsFolderPath: string): AvailableAgent[] => {
    const projectPath = workflowsFolderPath.split('/').slice(0, -1).join('/')
    const found = locate(tree.nodes, `${projectPath}/agents`)
    if (!found || found.node.type === 'file') return []

    return found.node.children
      .filter((child): child is Extract<TreeNode, { type: 'agent' }> => child.type === 'agent')
      .map((agent) => ({ name: agent.name, path: agent.path }))
  }

  return (
    <aside className="sidebar sidebar--left">
      <header className="sidebar__header">
        <h1 className="sidebar__title">Projects</h1>
        <div className="sidebar__actions">
          <button
            type="button"
            className="icon-btn"
            title="Refresh"
            aria-label="Refresh"
            disabled={tree.busy}
            onClick={() => void tree.reload()}
          >
            <RefreshIcon />
          </button>
          <NewMenu onCreate={(type) => startCreate(ROOT_PATH, type)} />
        </div>
      </header>

      <div className="sidebar__filter">
        <input
          type="search"
          className="filter-input"
          placeholder="Filter projects…"
          aria-label="Filter projects"
          value={filterQuery}
          onChange={(event) => handleFilterChange(event.target.value)}
        />
      </div>

      <nav className="tree" aria-label="Project tree">
        {tree.error && <p className="tree__error" role="alert">{tree.error}</p>}

        {filteredNodes.length > 0 || draft ? (
          <ProjectTree
            nodes={filteredNodes}
            expanded={effectiveExpanded}
            selectedPath={tree.selectedPath}
            draft={draft}
            onToggle={handleToggle}
            onSelect={tree.select}
            onCreate={startCreate}
            onCommitDraft={commitDraft}
            onCancelDraft={() => setDraft(null)}
            onRequestRename={setRenaming}
            onRequestDelete={setDeleting}
            onAddWorkflow={setCreatingWorkflowIn}
            onEditWorkflow={setEditingWorkflow}
            onAddAgent={setCreatingAgentIn}
            onEditAgent={setEditingAgent}
            onEditAgentInstructions={setEditingAgentInstructions}
          />
        ) : (
          !tree.error && (
            <p className="empty-state">
              {!tree.loaded
                ? 'Loading…'
                : tree.nodes.length === 0
                  ? 'No projects added'
                  : 'No projects match your filter'}
            </p>
          )
        )}
      </nav>

      {creatingIn !== null && (
        <NewProjectDialog
          onCreate={async (details) => {
            await tree.createProject(creatingIn, details)
            setCreatingIn(null)
          }}
          onCancel={() => setCreatingIn(null)}
        />
      )}

      {renaming && (
        <RenameDialog
          node={renaming}
          onRename={async (name) => {
            await tree.rename(renaming.path, name)
            setRenaming(null)
          }}
          onCancel={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          // Folders, projects and workflows can all get here, and all hold things.
          message={`"${deleting.name}" and everything inside it will be deleted from disk.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            await tree.remove(deleting.path)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {creatingWorkflowIn !== null && (
        <WorkflowDialog
          mode="create"
          availableAgents={agentsFor(creatingWorkflowIn)}
          onCreate={async (details) => {
            await tree.createWorkflow(creatingWorkflowIn, details)
            setCreatingWorkflowIn(null)
          }}
          onCancel={() => setCreatingWorkflowIn(null)}
        />
      )}

      {editingWorkflow && (
        <WorkflowDialog
          mode="edit"
          node={editingWorkflow}
          availableAgents={agentsFor(editingWorkflow.path.split('/').slice(0, -1).join('/'))}
          onSave={async (edits) => {
            await tree.updateWorkflow(editingWorkflow.path, edits)
            setEditingWorkflow(null)
          }}
          onCancel={() => setEditingWorkflow(null)}
        />
      )}

      {creatingAgentIn !== null && (
        <AgentDialog
          mode="create"
          onCreate={async (details) => {
            await tree.createAgent(creatingAgentIn, details)
            setCreatingAgentIn(null)
          }}
          onCancel={() => setCreatingAgentIn(null)}
        />
      )}

      {editingAgent && (
        <AgentDialog
          mode="edit"
          node={editingAgent}
          onSave={async (edits) => {
            await tree.updateAgent(editingAgent.path, edits)
            setEditingAgent(null)
          }}
          onCancel={() => setEditingAgent(null)}
        />
      )}

      {editingAgentInstructions && (
        <AgentInstructionsModal
          path={editingAgentInstructions.path}
          onSave={async (instructions) => {
            await tree.updateAgentInstructions(editingAgentInstructions.path, instructions)
            setEditingAgentInstructions(null)
          }}
          onCancel={() => setEditingAgentInstructions(null)}
        />
      )}
    </aside>
  )
}
