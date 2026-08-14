import { useState } from 'react'
import { ROOT_PATH } from '../data/api'
import type { CreatableType, TreeNode } from '../data/tree'
import type { ProjectTreeState } from '../hooks/useProjectTree'
import { ConfirmDialog } from './ConfirmDialog'
import { NewMenu } from './NewMenu'
import { NewProjectDialog } from './NewProjectDialog'
import { ProjectTree } from './ProjectTree'
import type { Draft } from './ProjectTree'
import { RenameDialog } from './RenameDialog'
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
        />
      </div>

      <nav className="tree" aria-label="Project tree">
        {tree.error && <p className="tree__error" role="alert">{tree.error}</p>}

        {tree.nodes.length > 0 || draft ? (
          <ProjectTree
            nodes={tree.nodes}
            expanded={tree.expanded}
            selectedPath={tree.selectedPath}
            draft={draft}
            onToggle={tree.toggle}
            onSelect={tree.select}
            onCreate={startCreate}
            onCommitDraft={commitDraft}
            onCancelDraft={() => setDraft(null)}
            onRequestRename={setRenaming}
            onRequestDelete={setDeleting}
          />
        ) : (
          !tree.error && <p className="empty-state">{tree.loaded ? 'No projects added' : 'Loading…'}</p>
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
          // Only folders and projects can get here, and both hold things.
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
    </aside>
  )
}
