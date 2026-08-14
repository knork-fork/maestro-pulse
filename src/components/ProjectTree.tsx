import { createContext, useContext, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { CreatableType, TreeNode } from '../data/tree'
import { ROOT_PATH } from '../data/api'
import { acceptsNewChildren, childrenOf, isExpandable } from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { classes } from './classes'
import { ChevronIcon, FileIcon, FolderIcon } from './icons'
import { Menu, anchorFromPoint } from './Menu'
import type { MenuAnchor, MenuItem } from './Menu'
import { NewMenu, createItems } from './NewMenu'

/** A row for something that does not exist yet: named in the tree, then created. */
export type Draft = { parentPath: string; type: CreatableType }

const DRAFT_NAMES: Record<CreatableType, string> = {
  folder: 'New folder',
  project: 'New project',
}

const INDENT = 14
const INDENT_OFFSET = 6

type Actions = {
  onToggle: (path: string) => void
  /** Starts a draft — nothing is created until it is named. */
  onCreate: (parentPath: string, type: CreatableType) => void
  onCommitDraft: (name: string) => Promise<void>
  onCancelDraft: () => void
  onRequestRename: (node: TreeNode) => void
  onRequestDelete: (node: TreeNode) => void
}

type Props = Actions & {
  nodes: TreeNode[]
  expanded: Set<string>
  draft: Draft | null
}

export function ProjectTree({ nodes, expanded, draft, ...actions }: Props) {
  const [menu, setMenu] = useState<{ node: TreeNode; anchor: MenuAnchor } | null>(null)

  const openMenu = (node: TreeNode, event: MouseEvent) => {
    // The tree's own menu stands in for the browser's.
    event.preventDefault()
    setMenu({ node, anchor: anchorFromPoint(event.clientX, event.clientY) })
  }

  return (
    <TreeContext.Provider
      value={{ ...actions, expanded, draft, openMenu, activePath: menu?.node.path ?? null }}
    >
      <TreeList nodes={nodes} parentPath={ROOT_PATH} depth={0} role="tree" />

      {menu && (
        <Menu
          anchor={menu.anchor}
          items={menuItems(menu.node, actions)}
          onDismiss={() => setMenu(null)}
        />
      )}
    </TreeContext.Provider>
  )
}

const menuItems = (node: TreeNode, actions: Actions): MenuItem[] => [
  ...(acceptsNewChildren(node)
    ? createItems((type) => actions.onCreate(node.path, type))
    : []),
  { label: 'Rename', onSelect: () => actions.onRequestRename(node) },
  { label: 'Delete', danger: true, onSelect: () => actions.onRequestDelete(node) },
]

// ---- rows ----

type ListProps = {
  nodes: TreeNode[]
  /** Whose children these are, so the draft row lands in the right list. */
  parentPath: string
  depth: number
  role: 'tree' | 'group'
}

function TreeList({ nodes, parentPath, depth, role }: ListProps) {
  const { draft } = useTreeContext()

  return (
    <ul className="tree__list" role={role}>
      {nodes.map((node) => (
        <TreeItem key={node.path} node={node} depth={depth} />
      ))}
      {draft?.parentPath === parentPath && <DraftItem type={draft.type} depth={depth} />}
    </ul>
  )
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const { expanded, draft, activePath, onToggle, onCreate, openMenu } = useTreeContext()

  const expandable = isExpandable(node)
  const open = expandable && expanded.has(node.path)
  const children = childrenOf(node)
  const holdsDraft = draft?.parentPath === node.path

  return (
    <li role="treeitem" aria-expanded={expandable ? open : undefined}>
      <div
        className={classes(['tree__row', activePath === node.path && 'tree__row--active'])}
        style={indentAt(depth)}
        onContextMenu={(event) => openMenu(node, event)}
      >
        <button
          type="button"
          className="tree__toggle"
          onClick={() => expandable && onToggle(node.path)}
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

      {open && (children.length > 0 || holdsDraft) && (
        <TreeList nodes={children} parentPath={node.path} depth={depth + 1} role="group" />
      )}
    </li>
  )
}

/**
 * The draft row. It carries the default name pre-selected, so typing replaces
 * it, and only reaches the API once committed — Enter or leaving the field.
 */
function DraftItem({ type, depth }: { type: CreatableType; depth: number }) {
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
          defaultValue={DRAFT_NAMES[type]}
          autoFocus
          disabled={pending}
          aria-label={`Name of the new ${type}`}
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
  draft: Draft | null
  /** The row whose context menu is open, kept highlighted while it is. */
  activePath: string | null
  openMenu: (node: TreeNode, event: MouseEvent) => void
}

/** Rows are recursive and all read the same state, so it is not threaded down. */
const TreeContext = createContext<TreeContextValue | null>(null)

function useTreeContext() {
  const value = useContext(TreeContext)
  if (!value) throw new Error('Tree rows must render inside ProjectTree')

  return value
}
