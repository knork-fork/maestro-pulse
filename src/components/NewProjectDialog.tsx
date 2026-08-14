import { useId, useState } from 'react'
import type { ProjectDetails } from '../data/api'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { Modal } from './Modal'

type Props = {
  /** Rejects with a reportable message, e.g. when the name is taken. */
  onCreate: (details: ProjectDetails) => Promise<void>
  onCancel: () => void
}

/**
 * Asks for everything a project is made from. A folder is still named in the
 * tree itself, but three fields do not fit a row — and the location in
 * particular is not something the tree could ever show.
 */
export function NewProjectDialog({ onCreate, onCancel }: Props) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const { pending, error, run } = useAsyncAction()
  const fieldId = useId()

  const details = {
    name: name.trim(),
    location: location.trim(),
    description: description.trim(),
  }
  const complete = Object.values(details).every(Boolean)

  const submit = async () => {
    if (!complete) return

    await run(() => onCreate(details))
    // A failure leaves the dialog up with its error and what was typed intact.
  }

  return (
    <Modal title="New project" wide onCancel={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="modal__field">
          <label className="modal__label" htmlFor={`${fieldId}-name`}>
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            className="modal__input"
            value={name}
            autoFocus
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="modal__field">
          <label className="modal__label" htmlFor={`${fieldId}-location`}>
            Location on host
          </label>
          <input
            id={`${fieldId}-location`}
            className="modal__input"
            value={location}
            placeholder="/home/you/Projects/thing"
            spellCheck={false}
            disabled={pending}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <div className="modal__field">
          <label className="modal__label" htmlFor={`${fieldId}-description`}>
            Description
          </label>
          <textarea
            id={`${fieldId}-description`}
            className="modal__input modal__input--multiline"
            value={description}
            rows={3}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {error && <p className="modal__error">{error}</p>}

        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending || !complete}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
