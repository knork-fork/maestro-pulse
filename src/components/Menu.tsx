import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { createPortal } from 'react-dom'

export type MenuItem = {
  label: string
  onSelect: () => void
  /** Destructive, and coloured as such. */
  danger?: boolean
}

/** The box a menu opens against: a trigger's rect, or a zero-size click point. */
export type MenuAnchor = { top: number; bottom: number; left: number; right: number }

export const anchorFromRect = (rect: DOMRect): MenuAnchor => ({
  top: rect.top,
  bottom: rect.bottom,
  left: rect.left,
  right: rect.right,
})

export const anchorFromPoint = (x: number, y: number): MenuAnchor => ({
  top: y,
  bottom: y,
  left: x,
  right: x,
})

const GAP = 4

type Props = {
  /** Must be stable between renders — it drives the positioning pass. */
  anchor: MenuAnchor
  /** Which anchor edge the menu lines its own up with. */
  align?: 'left' | 'right'
  items: MenuItem[]
  onDismiss: () => void
  /** A trigger that toggles this menu, whose own clicks are not "outside". */
  ignore?: RefObject<HTMLElement | null>
}

/**
 * A dropdown portalled to `<body>` and positioned from a viewport anchor, so a
 * scrolling container cannot clip it — which is also why it dismisses on scroll
 * rather than trying to follow the anchor.
 */
export function Menu({ anchor, align = 'left', items, onDismiss, ignore }: Props) {
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Needs its own size, so it positions on the frame after it renders.
  useLayoutEffect(() => {
    const menu = menuRef.current?.getBoundingClientRect()
    if (!menu) return

    const below = anchor.bottom + GAP
    const fitsBelow = below + menu.height <= window.innerHeight
    const left = align === 'right' ? anchor.right - menu.width : anchor.left

    setPosition({
      top: fitsBelow ? below : Math.max(GAP, anchor.top - GAP - menu.height),
      left: clamp(left, GAP, Math.max(GAP, window.innerWidth - menu.width - GAP)),
    })
  }, [anchor, align])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // Portalled, so the menu is not inside the trigger — check both.
      if (!menuRef.current?.contains(target) && !ignore?.current?.contains(target)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onDismiss)
    // Capture phase, so scrolling any ancestor (the tree included) dismisses it.
    document.addEventListener('scroll', onDismiss, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onDismiss)
      document.removeEventListener('scroll', onDismiss, true)
    }
  }, [onDismiss, ignore])

  return createPortal(
    <div
      ref={menuRef}
      className="menu"
      role="menu"
      // Hidden for the single frame before its size, and so its place, is known.
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`menu__item${item.danger ? ' menu__item--danger' : ''}`}
          role="menuitem"
          onClick={() => {
            item.onSelect()
            onDismiss()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
