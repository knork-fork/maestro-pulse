import { createContext, useContext, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { BranchNode, CreatableType, TreeNode } from '../data/tree'
import { ROOT_PATH } from '../data/api'
import {
  acceptsNewChildren,
  childrenOf,
  isExpandable,
  isOrganizational,
  isWorkflowsFolder,
  workflowBoardPath,
} from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { fileContext, viewFor } from '../views/registry'
import { classes } from './classes'
import { ChevronIcon, FileIcon, FolderIcon, WorkflowIcon } from './icons'
import { Menu, anchorFromPoint } from './Menu'
import type { MenuAnchor, MenuItem } from './Menu'
import { NewMenu, createItems } from './NewMenu'

/**
 * A row for a folder that does not exist yet: named in the tree, then created.
 * Only folders are drafted — a project is described in a dialog instead.
 */
export type Draft = { parentPath: string }

const DRAFT_NAME = 'New folder'

const INDENT = 14
const INDENT_OFFSET = 6

type Actions = {
  onToggle: (path: string) => void
  /** Opens a file in the main pane. Only offered where a view claims it. */
  onSelect: (path: string) => void
  /** Asks for a new entry — nothing is created until it has been described. */
  onCreate: (parentPath: string, type: CreatableType) => void
  onCommitDraft: (name: string) => Promise<void>
  onCancelDraft: () => void
  onRequestRename: (node: TreeNode) => void
  onRequestDelete: (node: TreeNode) => void
  /** Asks for a new workflow inside a project's `workflows` folder. */
  onAddWorkflow: (parentPath: string) => void
  /** Opens the workflow modal filled with an existing workflow's data. */
  onEditWorkflow: (node: TreeNode) => void
}

type Props = Actions & {
  nodes: TreeNode[]
  expanded: Set<string>
  selectedPath: string | null
  draft: Draft | null
}

export function ProjectTree({ nodes, expanded, selectedPath, draft, ...actions }: Props) {
  const [menu, setMenu] = useState<{ node: TreeNode; parent: BranchNode | null; anchor: MenuAnchor } | null>(
    null,
  )

  const openMenu = (node: TreeNode, parent: BranchNode | null, event: MouseEvent) => {
    // The tree's own menu stands in for the browser's.
    event.preventDefault()
    setMenu({ node, parent, anchor: anchorFromPoint(event.clientX, event.clientY) })
  }

  return (
    <TreeContext.Provider
      value={{
        ...actions,
        expanded,
        selectedPath,
        draft,
        openMenu,
        activePath: menu?.node.path ?? null,
      }}
    >
      <TreeList nodes={nodes} parent={null} depth={0} role="tree" />

      {menu && (
        <Menu
          anchor={menu.anchor}
          items={menuItems(menu.node, menu.parent, actions)}
          onDismiss={() => setMenu(null)}
        />
      )}
    </TreeContext.Provider>
  )
}

/**
 * Always the same four entries, greyed where the rules refuse them — a menu that
 * changes shape from row to row reads as having forgotten something.
 *
 * What that leaves enabled is the difference between the organization and its
 * contents: only a `folder` takes new children, and only a `folder` or a `project`
 * is ours to rename or delete. What is inside a project is the user's own.
 *
 * Two node shapes get a menu of their own instead, short-circuited before any
 * of that: a project's `workflows` folder only offers "Add new workflow", and
 * a `workflow` only offers Edit/Delete — both a different shape entirely, not
 * this one with items merely disabled.
 */
const menuItems = (node: TreeNode, parent: BranchNode | null, actions: Actions): MenuItem[] => {
  if (isWorkflowsFolder(node, parent)) {
    return [{ label: 'Add new workflow', onSelect: () => actions.onAddWorkflow(node.path) }]
  }

  if (node.type === 'workflow') {
    return [
      { label: 'Edit', onSelect: () => actions.onEditWorkflow(node) },
      { label: 'Delete', danger: true, onSelect: () => actions.onRequestDelete(node) },
    ]
  }

  const editable = isOrganizational(node)

  return [
    ...createItems((type) => actions.onCreate(node.path, type), !acceptsNewChildren(node)),
    { label: 'Rename', disabled: !editable, onSelect: () => actions.onRequestRename(node) },
    {
      label: 'Delete',
      danger: true,
      disabled: !editable,
      onSelect: () => actions.onRequestDelete(node),
    },
  ]
}

// ---- rows ----

type ListProps = {
  nodes: TreeNode[]
  /**
   * Whose children these are — the node itself, not just its path, because a row
   * needs it to decide whether a file inside it can be opened. Null at the root,
   * which is a directory on disk but not a node.
   */
  parent: BranchNode | null
  depth: number
  role: 'tree' | 'group'
}

function TreeList({ nodes, parent, depth, role }: ListProps) {
  const { draft } = useTreeContext()
  const parentPath = parent?.path ?? ROOT_PATH

  return (
    <ul className="tree__list" role={role}>
      {parent && parent.type === 'workflow' && <BoardItem workflow={parent} depth={depth} />}
      {nodes.map((node) => (
        <TreeItem key={node.path} node={node} parent={parent} depth={depth} />
      ))}
      {draft?.parentPath === parentPath && <DraftItem depth={depth} />}
    </ul>
  )
}

type ItemProps = { node: TreeNode; parent: BranchNode | null; depth: number }

function TreeItem({ node, parent, depth }: ItemProps) {
  const { expanded, selectedPath, draft, activePath, onToggle, onSelect, onCreate, openMenu } =
    useTreeContext()

  const expandable = isExpandable(node)
  const open = expandable && expanded.has(node.path)
  const children = childrenOf(node)
  const holdsDraft = draft?.parentPath === node.path

  // Where the file's parent earns its keep: what a file opens as depends on where
  // it sits, so a row cannot answer "can this be clicked?" on its own.
  const context = fileContext(node, parent)
  const openable = context !== null && viewFor(context) !== null
  const selected = selectedPath === node.path

  return (
    <li
      role="treeitem"
      aria-expanded={expandable ? open : undefined}
      aria-selected={openable ? selected : undefined}
    >
      <div
        className={classes([
          'tree__row',
          activePath === node.path && 'tree__row--active',
          selected && 'tree__row--selected',
        ])}
        style={indentAt(depth)}
        onContextMenu={(event) => openMenu(node, parent, event)}
      >
        <button
          type="button"
          // A row that does nothing must not invite the click: `project.json` and
          // friends are listed, not opened, until some view claims them.
          className={classes(['tree__toggle', !expandable && !openable && 'tree__toggle--inert'])}
          onClick={() => {
            if (expandable) onToggle(node.path)
            else if (openable) onSelect(node.path)
          }}
        >
          <Glyphs node={node} open={open} />
          <span className="tree__label">{node.name}</span>
        </button>

        {acceptsNewChildren(node) && (
          <NewMenu
            className="tree__new"
            size="sm"
            label={`New in ${node.name}`}
            onCreate={(type) => onCreate(node.path, type)}
          />
        )}
      </div>

      {/* `isExpandable` narrows, so `open` is already proof this holds children —
          which is what lets the node itself be handed down as the parent. */}
      {open && (children.length > 0 || holdsDraft) && (
        <TreeList nodes={node.children} parent={node} depth={depth + 1} role="group" />
      )}
    </li>
  )
}

/**
 * The draft row. It carries the default name pre-selected, so typing replaces
 * it, and only reaches the API once committed — Enter or leaving the field.
 */
function DraftItem({ depth }: { depth: number }) {
  const { onCommitDraft, onCancelDraft } = useTreeContext()
  const { pending, error, run } = useAsyncAction()
  const inputRef = useRef<HTMLInputElement>(null)
  /** Enter commits, and the blur that follows must not commit a second time. */
  const settled = useRef(false)

  const commit = async (value: string) => {
    if (settled.current) return
    settled.current = true

    const name = value.trim()
    if (!name) {
      onCancelDraft()
      return
    }

    if (!(await run(() => onCommitDraft(name)))) {
      // Still ours: keep the row, and put the bad name back in front of the user.
      settled.current = false
      inputRef.current?.focus()
    }
  }

  return (
    <li role="treeitem">
      <div className="tree__row tree__row--editing" style={indentAt(depth)}>
        <span className="tree__chevron tree__chevron--placeholder" />
        <FolderIcon className="tree__icon tree__icon--folder" />
        <input
          ref={inputRef}
          className="tree__input"
          defaultValue={DRAFT_NAME}
          autoFocus
          disabled={pending}
          aria-label="Name of the new folder"
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => void commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commit(event.currentTarget.value)
            if (event.key === 'Escape') onCancelDraft()
          }}
        />
      </div>

      {error && <p className="tree__error">{error}</p>}
    </li>
  )
}

/**
 * The one row a workflow folder gets that isn't backed by anything on disk —
 * opening it shows the workflow's board (for now, just its name). Right-clicking
 * it hands the *real* workflow node to `openMenu`, the same one the folder row
 * itself would, so either row produces the identical Edit/Delete menu.
 */
function BoardItem({ workflow, depth }: { workflow: Extract<TreeNode, { type: 'workflow' }>; depth: number }) {
  const { selectedPath, activePath, onSelect, openMenu } = useTreeContext()
  const boardPath = workflowBoardPath(workflow.path)
  const selected = selectedPath === boardPath

  return (
    <li role="treeitem" aria-selected={selected}>
      <div
        className={classes([
          'tree__row',
          activePath === workflow.path && 'tree__row--active',
          selected && 'tree__row--selected',
        ])}
        style={indentAt(depth)}
        onContextMenu={(event) => openMenu(workflow, null, event)}
      >
        <button type="button" className="tree__toggle" onClick={() => onSelect(boardPath)}>
          <span className="tree__chevron tree__chevron--placeholder" />
          <WorkflowIcon className="tree__icon tree__icon--workflow" />
          <span className="tree__label">{workflow.name}</span>
        </button>
      </div>
    </li>
  )
}

function Glyphs({ node, open }: { node: TreeNode; open: boolean }) {
  return (
    <>
      {isExpandable(node) ? (
        <ChevronIcon className={classes(['tree__chevron', open && 'tree__chevron--open'])} />
      ) : (
        <span className="tree__chevron tree__chevron--placeholder" />
      )}
      {node.type === 'file' ? (
        <FileIcon className="tree__icon" />
      ) : (
        <FolderIcon className="tree__icon tree__icon--folder" />
      )}
    </>
  )
}

const indentAt = (depth: number) => ({ paddingLeft: `${depth * INDENT + INDENT_OFFSET}px` })

// ---- shared row state ----

type TreeContextValue = Actions & {
  expanded: Set<string>
  /** The file the main pane is showing. Persistent, unlike `activePath`. */
  selectedPath: string | null
  draft: Draft | null
  /** The row whose context menu is open, kept highlighted while it is. */
  activePath: string | null
  openMenu: (node: TreeNode, parent: BranchNode | null, event: MouseEvent) => void
}

/** Rows are recursive and all read the same state, so it is not threaded down. */
const TreeContext = createContext<TreeContextValue | null>(null)

function useTreeContext() {
  const value = useContext(TreeContext)
  if (!value) throw new Error('Tree rows must render inside ProjectTree')

  return value
}
