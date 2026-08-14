import { useState } from 'react'
import { ROOT_PATH } from '../data/api'
import type { CreatableType, TreeNode } from '../data/tree'
import { useProjectTree } from '../hooks/useProjectTree'
import { ConfirmDialog } from './ConfirmDialog'
import { NewMenu } from './NewMenu'
import { ProjectTree } from './ProjectTree'
import type { Draft } from './ProjectTree'
import { RenameDialog } from './RenameDialog'
import { RefreshIcon } from './icons'

/**
 * The left pane, and the owner of everything the tree can be in the middle of:
 * the unsaved draft row (which the header's "+" and a folder's own "+" both
 * start) and whichever dialog is open.
 */
export function ProjectsSidebar() {
  const tree = useProjectTree()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [renaming, setRenaming] = useState<TreeNode | null>(null)
  const [deleting, setDeleting] = useState<TreeNode | null>(null)

  const startDraft = (parentPath: string, type: CreatableType) => {
    // The draft has to be visible to be typed into.
    tree.reveal(parentPath)
    setDraft({ parentPath, type })
  }

  const commitDraft = async (name: string) => {
    if (!draft) return
    const committed = draft

    await tree.create(committed.parentPath, committed.type, name)
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
          <NewMenu onCreate={(type) => startDraft(ROOT_PATH, type)} />
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
            draft={draft}
            onToggle={tree.toggle}
            onCreate={startDraft}
            onCommitDraft={commitDraft}
            onCancelDraft={() => setDraft(null)}
            onRequestRename={setRenaming}
            onRequestDelete={setDeleting}
          />
        ) : (
          !tree.error && <p className="empty-state">{tree.loaded ? 'No projects added' : 'Loading…'}</p>
        )}
      </nav>

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
          message={
            deleting.type === 'file'
              ? `"${deleting.name}" will be deleted from disk.`
              : `"${deleting.name}" and everything inside it will be deleted from disk.`
          }
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
