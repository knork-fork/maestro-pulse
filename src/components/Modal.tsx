import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { classes } from './classes'

type Props = {
  title: string
  /** For a panel with more than one field in it to ask about. */
  wide?: boolean
  /** For a caller needing a panel width of its own, beyond `wide`'s step. */
  className?: string
  /** Rendered above the title — e.g. a "back" control for a modal opened from
   *  within another, so it reads as a step back rather than a new dismissal. */
  beforeTitle?: ReactNode
  onCancel: () => void
  children: ReactNode
}

/**
 * The shell every dialog shares: a backdrop that dismisses, a titled panel, and
 * Escape to cancel. Its content — including the action buttons, which belong to
 * whatever the dialog is asking — is the caller's.
 */
export function Modal({ title, wide = false, className, beforeTitle, onCancel, children }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return createPortal(
    <div className="modal" onPointerDown={onCancel}>
      {/* The panel keeps its own clicks from reaching the dismissing backdrop. */}
      <div
        className={classes(['modal__panel', wide && 'modal__panel--wide', className])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {beforeTitle}
        <h2 className="modal__title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
