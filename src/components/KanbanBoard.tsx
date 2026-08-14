import { useCallback, useRef, useState } from 'react'
import type { WorkflowCard } from '../data/api'
import { useWorkflowBoard } from '../hooks/useWorkflowBoard'
import { CardDetailModal } from './CardDetailModal'
import { Column } from './Column'
import { ConfirmDialog } from './ConfirmDialog'

type Props = { path: string; name: string }

/**
 * A workflow's board: one Column per entry in workflow.json's `columns`, in
 * order. Owns the two dialogs a card's own controls can open (the detail
 * modal, and Backlog's delete confirmation) — everything else is a direct
 * call into `useWorkflowBoard`'s mutate-then-reload callbacks.
 */
export function KanbanBoard({ path, name }: Props) {
  const state = useWorkflowBoard(path)
  const [openCard, setOpenCard] = useState<WorkflowCard | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WorkflowCard | null>(null)
  /** Detaches the previous element's listener before attaching to a new one
   *  (or on unmount) — a callback ref, not `useEffect`, because the board's
   *  loading/error branches mean `.board__columns` doesn't exist on mount;
   *  a callback ref fires exactly when it actually appears. */
  const detachWheel = useRef<() => void>(() => {})

  /**
   * A plain vertical wheel scrolls the board horizontally, the same way a
   * touchpad's shift-scroll would — unless it's over a column whose cards
   * actually overflow, in which case it scrolls that column's list instead.
   * A column with nothing to scroll never claims the wheel, so it falls
   * straight through to the board.
   *
   * Not `onWheel` in JSX: React attaches wheel listeners as passive by
   * default, which silently drops `preventDefault`. A native listener is
   * the only reliable way to redirect the scroll axis.
   */
  const setColumnsRef = useCallback((el: HTMLDivElement | null) => {
    detachWheel.current()
    detachWheel.current = () => {}
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement
      const columnEl = target.closest('.column')
      const cardsEl = columnEl?.querySelector<HTMLElement>('.column__cards')
      const overflowing = cardsEl && cardsEl.scrollHeight > cardsEl.clientHeight

      event.preventDefault()
      if (overflowing) cardsEl.scrollTop += event.deltaY
      else el.scrollLeft += event.deltaY
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    detachWheel.current = () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (state.loading) {
    return (
      <div className="board">
        <p className="empty-state">Loading…</p>
      </div>
    )
  }

  if (!state.board) {
    return (
      <div className="board">
        <p className="viewer__error" role="alert">
          {state.error ?? "This workflow's board could not be read."}
        </p>
      </div>
    )
  }

  const { columns, cards } = state.board
  const lastIndex = columns.length - 1

  return (
    <div className="board">
      <h1 className="board__title">{name}</h1>

      <div className="board__columns" ref={setColumnsRef}>
        {columns.map((column, index) => (
          <Column
            key={column.name}
            column={column}
            isFirst={index === 0}
            isLast={index === lastIndex}
            cards={cards.filter((card) => card.column === column.name)}
            onOpen={setOpenCard}
            onDelete={setConfirmDelete}
            onArchive={(card) => state.archive(card.id)}
            onMoveUp={(card) => state.moveUp(card.id)}
            onMoveDown={(card) => state.moveDown(card.id)}
            onMoveRight={(card) => state.moveRight(card.id)}
          />
        ))}
      </div>

      {openCard && <CardDetailModal card={openCard} onCancel={() => setOpenCard(null)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete card"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            await state.remove(confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
