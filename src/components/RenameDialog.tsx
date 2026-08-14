import { useState } from 'react'
import type { TreeNode } from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { Modal } from './Modal'

type Props = {
  node: TreeNode
  /** Rejects with a reportable message, e.g. when the name is taken. */
  onRename: (name: string) => Promise<void>
  onCancel: () => void
}

export function RenameDialog({ node, onRename, onCancel }: Props) {
  const [name, setName] = useState(node.name)
  const { pending, error, run } = useAsyncAction()

  const submit = async () => {
    const next = name.trim()
    if (!next || next === node.name) {
      onCancel()
      return
    }

    await run(() => onRename(next))
    // A failure leaves the dialog up with its error, so the name can be fixed.
  }

  return (
    <Modal title={`Rename ${node.name}`} onCancel={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <input
          className="modal__input"
          value={name}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
          aria-label="Name"
          disabled={pending}
        />

        {error && <p className="modal__error">{error}</p>}

        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
