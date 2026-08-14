import type { TreeNode } from '../data/projects'
import { acceptsNewChildren, childrenOf } from '../data/projects'
import { usePersistentSet } from '../hooks/usePersistentSet'
import { ChevronIcon, FileIcon, FolderIcon } from './icons'
import { NewMenu } from './NewMenu'

const EXPANDED_STORAGE_KEY = 'maestro-pulse:tree-expanded'

type Props = { nodes: TreeNode[] }

export function ProjectTree({ nodes }: Props) {
  /** Open folders, by slash-joined path; collapsed unless a past visit opened it. */
  const [expanded, setExpanded] = usePersistentSet(EXPANDED_STORAGE_KEY)

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(path)) next.add(path)
      return next
    })

  if (nodes.length === 0) {
    return <p className="empty-state">No projects added</p>
  }

  return (
    <ul className="tree__list" role="tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.name}
          node={node}
          path={node.name}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </ul>
  )
}

type ItemProps = {
  node: TreeNode
  path: string
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
}

function TreeItem({ node, path, depth, expanded, onToggle }: ItemProps) {
  const children = childrenOf(node)
  const hasChildren = children.length > 0
  const isOpen = hasChildren && expanded.has(path)

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      <div className="tree__row">
        <button
          type="button"
          className="tree__toggle"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => hasChildren && onToggle(path)}
        >
          {hasChildren ? (
            <ChevronIcon className={`tree__chevron${isOpen ? ' tree__chevron--open' : ''}`} />
          ) : (
            <span className="tree__chevron tree__chevron--placeholder" />
          )}
          {node.type === 'file' ? (
            <FileIcon className="tree__icon" />
          ) : (
            <FolderIcon className="tree__icon tree__icon--folder" />
          )}
          <span className="tree__label">{node.name}</span>
        </button>

        {acceptsNewChildren(node) && (
          <NewMenu className="tree__new" size="sm" label={`New in ${node.name}`} />
        )}
      </div>

      {isOpen && (
        <ul className="tree__list" role="group">
          {children.map((child) => (
            <TreeItem
              key={child.name}
              node={child}
              path={`${path}/${child.name}`}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
