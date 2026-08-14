import { useId, useState } from 'react'
import type { AgentEdits, NewAgentDetails } from '../data/api'
import { agentFilePath } from '../data/api'
import type { TreeNode } from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useFileContent } from '../hooks/useFileContent'
import { Modal } from './Modal'

type Props =
  | { mode: 'create'; onCreate: (details: NewAgentDetails) => Promise<void>; onCancel: () => void }
  | { mode: 'edit'; node: TreeNode; onSave: (edits: AgentEdits) => Promise<void>; onCancel: () => void }

/**
 * Asks for what an agent is made from. Create and edit share one form
 * (`AgentForm`) — edit only additionally has to load the agent's current
 * `description` first, and fixes the name so it can't be typed over.
 */
export function AgentDialog(props: Props) {
  if (props.mode === 'edit') {
    return <EditAgentDialog node={props.node} onSave={props.onSave} onCancel={props.onCancel} />
  }

  return (
    <AgentForm
      title="New agent"
      nameEditable
      initialName=""
      initialDescription=""
      onCancel={props.onCancel}
      onSubmit={(values) => props.onCreate(values)}
    />
  )
}

function EditAgentDialog({
  node,
  onSave,
  onCancel,
}: {
  node: TreeNode
  onSave: (edits: AgentEdits) => Promise<void>
  onCancel: () => void
}) {
  const { content, error, loading } = useFileContent(agentFilePath(node.path))
  const title = `Edit ${node.name}`

  if (loading) {
    return (
      <Modal title={title} wide onCancel={onCancel}>
        <p className="empty-state">Loading…</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Modal>
    )
  }

  const parsed = error ? null : parseAgentFile(content ?? '')

  if (!parsed) {
    return (
      <Modal title={title} wide onCancel={onCancel}>
        <p className="modal__error">{error ?? "This agent's data could not be read."}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <AgentForm
      title={title}
      nameEditable={false}
      initialName={node.name}
      initialDescription={parsed.description}
      onCancel={onCancel}
      onSubmit={(values) => onSave({ description: values.description })}
    />
  )
}

/**
 * `agent.json` holds just a description — anything short of that shape
 * (hand-edited, or from a future format) is treated as unreadable rather
 * than guessed at, same as `parseWorkflowFile` in `WorkflowDialog.tsx`.
 */
function parseAgentFile(content: string): { description: string } | null {
  try {
    const parsed = JSON.parse(content) as { description?: unknown }
    if (typeof parsed.description !== 'string') return null

    return { description: parsed.description }
  } catch {
    return null
  }
}

type FormProps = {
  title: string
  /** False in edit mode: the name is fixed once an agent is created. */
  nameEditable: boolean
  initialName: string
  initialDescription: string
  onCancel: () => void
  onSubmit: (values: { name: string; description: string }) => Promise<void>
}

function AgentForm({ title, nameEditable, initialName, initialDescription, onCancel, onSubmit }: FormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const { pending, error, run } = useAsyncAction()
  const fieldId = useId()

  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  const complete = trimmedDescription.length > 0 && (!nameEditable || trimmedName.length > 0)

  const submit = async () => {
    if (!complete) return

    await run(() => onSubmit({ name: trimmedName, description: trimmedDescription }))
  }

  return (
    <Modal title={title} wide onCancel={onCancel}>
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
            autoFocus={nameEditable}
            disabled={pending || !nameEditable}
            onChange={(event) => setName(event.target.value)}
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
