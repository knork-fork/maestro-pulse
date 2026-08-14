import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon } from './icons'

/** Menu entries are inert placeholders until there is something to create. */
const ITEMS = ['New project', 'New folder']

const GAP = 4

type Props = {
  /** Extra classes for the anchor, e.g. to control hover reveal in the tree. */
  className?: string
  size?: 'md' | 'sm'
  label?: string
}

export function NewMenu({ className, size = 'md', label = 'New' }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Positioned against the trigger and portalled to <body>, so the scrolling
  // tree cannot clip it. Flips above the trigger when it would overflow.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const trigger = anchorRef.current?.getBoundingClientRect()
    const menu = menuRef.current?.getBoundingClientRect()
    if (!trigger || !menu) return

    const below = trigger.bottom + GAP
    const fitsBelow = below + menu.height <= window.innerHeight

    setPosition({
      top: fitsBelow ? below : Math.max(GAP, trigger.top - GAP - menu.height),
      right: Math.max(GAP, window.innerWidth - trigger.right),
    })
  }, [open])

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // The menu is portalled, so it is not inside the anchor — check both.
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    // Capture phase, so scrolling any ancestor (the tree included) dismisses it.
    document.addEventListener('scroll', close, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const anchorClasses = ['menu-anchor', open && 'menu-anchor--open', className]
  const triggerClasses = ['icon-btn', size === 'sm' && 'icon-btn--sm', open && 'icon-btn--active']

  return (
    <div className={classes(anchorClasses)} ref={anchorRef}>
      <button
        type="button"
        className={classes(triggerClasses)}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <PlusIcon />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            // Hidden for the single frame before its size is known.
            style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
          >
            {ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className="menu__item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

const classes = (values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
