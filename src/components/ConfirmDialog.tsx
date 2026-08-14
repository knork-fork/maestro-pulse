import type { ReactNode } from 'react'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { Modal } from './Modal'

type Props = {
  title: string
  message: ReactNode
  confirmLabel: string
  /** Colours the confirming button as destructive. */
  danger?: boolean
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  const { pending, error, run } = useAsyncAction()

  return (
    <Modal title={title} onCancel={onCancel}>
      <p className="modal__message">{message}</p>

      {error && <p className="modal__error">{error}</p>}

      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
          disabled={pending}
          autoFocus
          onClick={() => void run(onConfirm)}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
