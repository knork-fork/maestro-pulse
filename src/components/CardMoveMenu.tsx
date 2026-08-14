import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { classes } from './classes'
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, MoveIcon } from './icons'

type Props = {
  canMoveUp: boolean
  canMoveDown: boolean
  canMoveRight: boolean
  disabled?: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveRight: () => void
}

/**
 * The joystick: a trigger that expands in place into three arrows. Not
 * `Menu.tsx` — that is built for a portalled, viewport-anchored list of text
 * actions escaping scroll clipping, a poor fit for an icon-only cluster fixed
 * to a card already positioned in view. The outside-pointerdown + Escape
 * dismissal below is the same idiom `Menu.tsx` uses, copied rather than
 * shared since there is no portal here to coordinate.
 *
 * All three arrows always render; an illegal one is disabled rather than
 * hidden, so the control reads the same wherever it is opened — the same
 * reasoning `Menu.tsx`'s own `MenuItem.disabled` documents.
 */
export function CardMoveMenu({
  canMoveUp,
  canMoveDown,
  canMoveRight,
  disabled,
  onMoveUp,
  onMoveDown,
  onMoveRight,
}: Props) {
  const [open, setOpen] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Needs its own position after it renders, same as Menu.tsx's own flip —
  // a card near the bottom of a scrolled column would otherwise open a
  // popover that spills past the viewport (or that column's own scroll
  // clip) and becomes unclickable.
  useLayoutEffect(() => {
    if (!open) return
    const rect = popoverRef.current?.getBoundingClientRect()
    if (rect) setOpenAbove(rect.bottom > window.innerHeight)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className={classes(['card-move', open && 'card-move--open'])}>
      <button
        type="button"
        className="icon-btn icon-btn--sm"
        title="Move card"
        aria-label="Move card"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <MoveIcon />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={classes(['card-move__popover', openAbove && 'card-move__popover--above'])}
          role="group"
          aria-label="Move card"
        >
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="Move up"
            aria-label="Move up"
            disabled={!canMoveUp}
            onClick={() => choose(onMoveUp)}
          >
            <ArrowUpIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title={canMoveRight ? 'Move right' : 'A bot will move this card'}
            aria-label={canMoveRight ? 'Move right' : 'A bot will move this card'}
            disabled={!canMoveRight}
            onClick={() => choose(onMoveRight)}
          >
            <ArrowRightIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            title="Move down"
            aria-label="Move down"
            disabled={!canMoveDown}
            onClick={() => choose(onMoveDown)}
          >
            <ArrowDownIcon />
          </button>
        </div>
      )}
    </div>
  )
}
