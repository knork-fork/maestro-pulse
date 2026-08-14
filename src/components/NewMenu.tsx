import { useRef, useState } from 'react'
import type { CreatableType } from '../data/tree'
import { classes } from './classes'
import { PlusIcon } from './icons'
import { Menu, anchorFromRect } from './Menu'
import type { MenuAnchor } from './Menu'

type Props = {
  /** Extra classes for the anchor, e.g. to control hover reveal in the tree. */
  className?: string
  size?: 'md' | 'sm'
  label?: string
  onCreate: (type: CreatableType) => void
}

/** The "+" trigger and its menu, shared by the sidebar header and folder rows. */
export function NewMenu({ className, size = 'md', label = 'New', onCreate }: Props) {
  // The anchor is captured when it opens, which is also what "open" means here.
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const toggle = () =>
    setAnchor((prev) => {
      if (prev) return null

      const rect = triggerRef.current?.getBoundingClientRect()
      return rect ? anchorFromRect(rect) : null
    })

  const anchorClasses = ['menu-anchor', anchor && 'menu-anchor--open', className]
  const triggerClasses = ['icon-btn', size === 'sm' && 'icon-btn--sm', anchor && 'icon-btn--active']

  return (
    <div className={classes(anchorClasses)}>
      <button
        ref={triggerRef}
        type="button"
        className={classes(triggerClasses)}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={toggle}
      >
        <PlusIcon />
      </button>

      {anchor && (
        <Menu
          anchor={anchor}
          align="right"
          ignore={triggerRef}
          items={createItems(onCreate)}
          onDismiss={() => setAnchor(null)}
        />
      )}
    </div>
  )
}

/** The create entries, shared with the tree's context menu. */
export const createItems = (onCreate: (type: CreatableType) => void) => [
  { label: 'New project', onSelect: () => onCreate('project') },
  { label: 'New folder', onSelect: () => onCreate('folder') },
]
