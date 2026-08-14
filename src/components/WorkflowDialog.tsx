import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { CustomWorkflowColumn, NewWorkflowDetails, WorkflowEdits } from '../data/api'
import { workflowFilePath } from '../data/api'
import type { TreeNode } from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useFileContent } from '../hooks/useFileContent'
import { classes } from './classes'
import { Modal } from './Modal'

/** Shown as plain UI copy for the pinned rows — the server adds the same
 *  three, unconditionally, in `scaffoldWorkflow`. */
const FIXED_LEADING_LABELS = ['Backlog', 'Ready']
const FIXED_TRAILING_LABEL = 'Done'

/** A card being edited. `key` is independent of `name` so dragging and
 *  deleting stay stable while a name is blank or mid-edit. */
type DraftColumn = { key: string; name: string; actor: 'bot' | 'human'; agent: string | null }

type Props =
  | { mode: 'create'; onCreate: (details: NewWorkflowDetails) => Promise<void>; onCancel: () => void }
  | { mode: 'edit'; node: TreeNode; onSave: (edits: WorkflowEdits) => Promise<void>; onCancel: () => void }

/**
 * Asks for what a workflow is made from. Create and edit share one form
 * (`WorkflowForm`) — edit only additionally has to load the workflow's current
 * `description`/`columns` first, and fixes the name so it can't be typed over.
 */
export function WorkflowDialog(props: Props) {
  if (props.mode === 'edit') {
    return <EditWorkflowDialog node={props.node} onSave={props.onSave} onCancel={props.onCancel} />
  }

  return (
    <WorkflowForm
      title="New workflow"
      nameEditable
      initialName=""
      initialDescription=""
      initialColumns={[]}
      onCancel={props.onCancel}
      onSubmit={(values) => props.onCreate(values)}
    />
  )
}

function EditWorkflowDialog({
  node,
  onSave,
  onCancel,
}: {
  node: TreeNode
  onSave: (edits: WorkflowEdits) => Promise<void>
  onCancel: () => void
}) {
  const { content, error, loading } = useFileContent(workflowFilePath(node.path))
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

  const parsed = error ? null : parseWorkflowFile(content ?? '')

  if (!parsed) {
    return (
      <Modal title={title} wide onCancel={onCancel}>
        <p className="modal__error">{error ?? "This workflow's data could not be read."}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <WorkflowForm
      title={title}
      nameEditable={false}
      initialName={node.name}
      initialDescription={parsed.description}
      initialColumns={parsed.columns}
      onCancel={onCancel}
      onSubmit={(values) => onSave({ description: values.description, columns: values.columns })}
    />
  )
}

/**
 * `workflow.json` always stores the fixed columns alongside the custom ones
 * (see `scaffoldWorkflow` in server/index.mjs) — stripping the first two and
 * the last recovers just what this dialog lets you edit. Anything short of
 * that shape (hand-edited, or from a future format) is treated as unreadable
 * rather than guessed at.
 */
function parseWorkflowFile(content: string): { description: string; columns: DraftColumn[] } | null {
  try {
    const parsed = JSON.parse(content) as { description?: unknown; columns?: unknown }
    if (typeof parsed.description !== 'string' || !Array.isArray(parsed.columns) || parsed.columns.length < 3) {
      return null
    }

    const custom = parsed.columns.slice(2, -1) as Array<{ name?: unknown; actor?: unknown; agent?: unknown }>
    const columns: DraftColumn[] = custom.map((column) => ({
      key: crypto.randomUUID(),
      name: typeof column.name === 'string' ? column.name : '',
      actor: column.actor === 'bot' ? 'bot' : 'human',
      agent: typeof column.agent === 'string' ? column.agent : null,
    }))

    return { description: parsed.description, columns }
  } catch {
    return null
  }
}

type FormProps = {
  title: string
  /** False in edit mode: the name is fixed once a workflow is created. */
  nameEditable: boolean
  initialName: string
  initialDescription: string
  initialColumns: DraftColumn[]
  onCancel: () => void
  onSubmit: (values: { name: string; description: string; columns: CustomWorkflowColumn[] }) => Promise<void>
}

function WorkflowForm({
  title,
  nameEditable,
  initialName,
  initialDescription,
  initialColumns,
  onCancel,
  onSubmit,
}: FormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [columns, setColumns] = useState<DraftColumn[]>(initialColumns)
  const { pending, error, run } = useAsyncAction()
  const fieldId = useId()
  /** Which card is mid-drag — a ref, since it drives no render of its own. */
  const draggingKey = useRef<string | null>(null)
  /** Name inputs, keyed by card, so Enter can focus the one just added. */
  const nameInputs = useRef(new Map<string, HTMLInputElement>())

  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  const complete =
    trimmedDescription.length > 0 &&
    (!nameEditable || trimmedName.length > 0) &&
    columns.every((column) => column.name.trim().length > 0)

  const updateColumn = (key: string, patch: Partial<DraftColumn>) =>
    setColumns((prev) => prev.map((column) => (column.key === key ? { ...column, ...patch } : column)))

  const setActor = (key: string, actor: DraftColumn['actor']) =>
    // Leaving a bot card clears its agent immediately, not just at submit.
    updateColumn(key, actor === 'human' ? { actor, agent: null } : { actor })

  /**
   * Focuses the new card's name field, so pressing Enter to add one lets you
   * keep typing straight through several cards without reaching for the mouse.
   * `flushSync` forces the row to actually exist in the DOM before we look up
   * its input by key — without it, the input isn't there yet to focus.
   */
  const addColumn = () => {
    const key = crypto.randomUUID()
    flushSync(() => {
      setColumns((prev) => [...prev, { key, name: '', actor: 'human', agent: null }])
    })
    nameInputs.current.get(key)?.focus()
  }

  const removeColumn = (key: string) => setColumns((prev) => prev.filter((column) => column.key !== key))

  const reorder = (draggedKey: string, overKey: string) => {
    if (draggedKey === overKey) return

    setColumns((prev) => {
      const from = prev.findIndex((column) => column.key === draggedKey)
      const to = prev.findIndex((column) => column.key === overKey)
      if (from === -1 || to === -1) return prev

      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const submit = async () => {
    if (!complete) return

    await run(() =>
      onSubmit({
        name: trimmedName,
        description: trimmedDescription,
        columns: columns.map((column) => ({
          name: column.name.trim(),
          actor: column.actor,
          agent: column.actor === 'bot' ? column.agent : null,
        })),
      }),
    )
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

        <div className="modal__field">
          <span className="modal__label">Columns</span>

          <ul className="columns">
            <li className="column-card column-card--fixed">{FIXED_LEADING_LABELS[0]}</li>
            <li className="column-card column-card--fixed">{FIXED_LEADING_LABELS[1]}</li>

            {columns.map((column) => (
              <li
                key={column.key}
                className="column-card"
                draggable
                onDragStart={() => {
                  draggingKey.current = column.key
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (draggingKey.current) reorder(draggingKey.current, column.key)
                }}
                onDrop={(event) => event.preventDefault()}
                onDragEnd={() => {
                  draggingKey.current = null
                }}
              >
                <input
                  ref={(el) => {
                    if (el) nameInputs.current.set(column.key, el)
                    else nameInputs.current.delete(column.key)
                  }}
                  className="modal__input column-card__name"
                  value={column.name}
                  placeholder="Column name"
                  disabled={pending}
                  aria-label="Column name"
                  onChange={(event) => updateColumn(column.key, { name: event.target.value })}
                  onKeyDown={(event) => {
                    // Enter adds the next card instead of submitting the form.
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addColumn()
                    }
                  }}
                />

                <button
                  type="button"
                  role="switch"
                  aria-checked={column.actor === 'bot'}
                  aria-label={`${column.name || 'Column'} is ${column.actor}`}
                  className={classes(['column-card__switch', column.actor === 'bot' && 'column-card__switch--bot'])}
                  disabled={pending}
                  onClick={() => setActor(column.key, column.actor === 'bot' ? 'human' : 'bot')}
                >
                  <span>Human</span>
                  <span>Bot</span>
                </button>

                {column.actor === 'bot' && (
                  <select
                    className="modal__input column-card__agent"
                    aria-label="Agent"
                    disabled={pending}
                    value={column.agent ?? ''}
                    onChange={(event) => updateColumn(column.key, { agent: event.target.value || null })}
                  >
                    <option value="" disabled>
                      No agents yet
                    </option>
                  </select>
                )}

                <button
                  type="button"
                  className="column-card__remove"
                  title="Remove column"
                  aria-label="Remove column"
                  disabled={pending}
                  onClick={() => removeColumn(column.key)}
                >
                  ×
                </button>
              </li>
            ))}

            <li className="column-card column-card--fixed">{FIXED_TRAILING_LABEL}</li>
          </ul>

          <button type="button" className="btn" disabled={pending} onClick={addColumn}>
            Add card
          </button>
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
