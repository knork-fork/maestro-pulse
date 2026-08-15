import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { CustomWorkflowColumn, NewWorkflowDetails, WorkflowEdits } from '../data/api'
import { workflowFilePath, workflowInstructionsPath } from '../data/api'
import type { TreeNode } from '../data/tree'
import { WORKFLOW_TEMPLATES } from '../data/workflowTemplates'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useFileContent } from '../hooks/useFileContent'
import { Menu, anchorFromRect } from './Menu'
import type { MenuAnchor } from './Menu'
import { Modal } from './Modal'

/** Shown as plain UI copy for the pinned rows — the server adds the same
 *  two, unconditionally, in `scaffoldWorkflow`. */
const FIXED_LEADING_LABEL = 'Backlog'
const FIXED_TRAILING_LABEL = 'Done'

/** A column being edited. `key` is independent of `name` so dragging and
 *  deleting stay stable while a name is blank or mid-edit. Bot vs. human is
 *  the explicit `bot` field, the same one the board applies everywhere (see
 *  `isBotColumn` in server/index.mjs) — a bot column must also carry the
 *  agent that runs it. `description` explains what the column is for, shown
 *  as a hover tooltip on the board, and is required before the form can
 *  save. */
type DraftColumn = { key: string; name: string; bot: boolean; agent: string | null; description: string }

/** An agent a bot column can be assigned to — scoped by the caller to those
 *  living under the same project as the workflow being edited. */
export type AvailableAgent = { name: string; path: string }

type Props =
  | {
      mode: 'create'
      availableAgents: AvailableAgent[]
      onCreate: (details: NewWorkflowDetails & { instructions: string }) => Promise<void>
      onCancel: () => void
    }
  | {
      mode: 'edit'
      node: TreeNode
      availableAgents: AvailableAgent[]
      onSave: (edits: WorkflowEdits & { instructions: string }) => Promise<void>
      onCancel: () => void
    }

/**
 * Asks for what a workflow is made from. Create and edit share one form
 * (`WorkflowForm`) — edit only additionally has to load the workflow's current
 * `description`/`columns` first, and fixes the name so it can't be typed over.
 */
export function WorkflowDialog(props: Props) {
  if (props.mode === 'edit') {
    return (
      <EditWorkflowDialog
        node={props.node}
        availableAgents={props.availableAgents}
        onSave={props.onSave}
        onCancel={props.onCancel}
      />
    )
  }

  return (
    <WorkflowForm
      title="New workflow"
      nameEditable
      initialName=""
      initialDescription=""
      initialColumns={defaultColumns()}
      initialBacklogDescription={DEFAULT_BACKLOG_DESCRIPTION}
      initialDoneDescription={DEFAULT_DONE_DESCRIPTION}
      initialInstructions=""
      availableAgents={props.availableAgents}
      onCancel={props.onCancel}
      onSubmit={(values) => props.onCreate(values)}
    />
  )
}

/** Prefilled descriptions for the fixed Backlog/Done rows, editable like any
 *  other column's — the user is free to type over them. */
const DEFAULT_BACKLOG_DESCRIPTION =
  'Everything that has been requested but not yet reviewed or scheduled. New tickets land here first.'
const DEFAULT_DONE_DESCRIPTION =
  'Finished and verified — nothing left to do. Cards stop moving once they land here.'

/** A fresh workflow starts with Ready and Doing already seeded — both
 *  bot-column by default — since both are ordinary, editable columns rather
 *  than anything the server assumes. Each still needs its agent chosen
 *  before the form can be saved. */
function defaultColumns(): DraftColumn[] {
  return [
    {
      key: crypto.randomUUID(),
      name: 'Ready',
      bot: true,
      agent: null,
      description: 'Reviewed, prioritized, and waiting to be picked up next by this column’s agent.',
    },
    {
      key: crypto.randomUUID(),
      name: 'Doing',
      bot: true,
      agent: null,
      description: 'Currently being worked on by this column’s agent, one card at a time.',
    },
  ]
}

function EditWorkflowDialog({
  node,
  availableAgents,
  onSave,
  onCancel,
}: {
  node: TreeNode
  availableAgents: AvailableAgent[]
  onSave: (edits: WorkflowEdits & { instructions: string }) => Promise<void>
  onCancel: () => void
}) {
  const { content, error, loading } = useFileContent(workflowFilePath(node.path))
  // A workflow created before `workflow.md` existed has none yet — that's
  // treated as empty rather than blocking the dialog, the same way a broken
  // `workflow.json` does.
  const { content: instructionsContent, loading: instructionsLoading } = useFileContent(
    workflowInstructionsPath(node.path),
  )
  const title = `Edit ${node.name}`

  if (loading || instructionsLoading) {
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

  // Any instructions-load failure (missing file or otherwise) falls back to
  // an empty editor rather than blocking the dialog — only a broken
  // `workflow.json` does that, checked above.
  const initialInstructions = instructionsContent ?? ''

  return (
    <WorkflowForm
      title={title}
      nameEditable={false}
      initialName={node.name}
      initialDescription={parsed.description}
      initialColumns={parsed.columns}
      initialBacklogDescription={parsed.backlogDescription}
      initialDoneDescription={parsed.doneDescription}
      initialInstructions={initialInstructions}
      availableAgents={availableAgents}
      onCancel={onCancel}
      onSubmit={(values) =>
        onSave({
          description: values.description,
          columns: values.columns,
          backlogDescription: values.backlogDescription,
          doneDescription: values.doneDescription,
          instructions: values.instructions,
        })
      }
    />
  )
}

/**
 * `workflow.json` always stores the fixed Backlog/Done alongside every
 * ordinary column (see `scaffoldWorkflow` in server/index.mjs) — stripping
 * the first and last recovers just what this dialog lets you edit. Anything
 * short of that shape (hand-edited, or from a future format) is treated as
 * unreadable rather than guessed at.
 */
function parseWorkflowFile(
  content: string,
): { description: string; columns: DraftColumn[]; backlogDescription: string; doneDescription: string } | null {
  try {
    const parsed = JSON.parse(content) as { description?: unknown; columns?: unknown }
    if (typeof parsed.description !== 'string' || !Array.isArray(parsed.columns) || parsed.columns.length < 2) {
      return null
    }

    type RawColumn = { name?: unknown; bot?: unknown; agent?: unknown; description?: unknown }
    const rawColumns = parsed.columns as RawColumn[]
    const columnDescription = (column: RawColumn) => (typeof column.description === 'string' ? column.description : '')

    const editable = rawColumns.slice(1, -1)
    const columns: DraftColumn[] = editable.map((column) => ({
      key: crypto.randomUUID(),
      name: typeof column.name === 'string' ? column.name : '',
      bot: column.bot === true,
      agent: typeof column.agent === 'string' ? column.agent : null,
      description: columnDescription(column),
    }))

    return {
      description: parsed.description,
      columns,
      backlogDescription: columnDescription(rawColumns[0]),
      doneDescription: columnDescription(rawColumns[rawColumns.length - 1]),
    }
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
  initialBacklogDescription: string
  initialDoneDescription: string
  initialInstructions: string
  availableAgents: AvailableAgent[]
  onCancel: () => void
  onSubmit: (values: {
    name: string
    description: string
    columns: CustomWorkflowColumn[]
    backlogDescription: string
    doneDescription: string
    instructions: string
  }) => Promise<void>
}

function WorkflowForm({
  title,
  nameEditable,
  initialName,
  initialDescription,
  initialColumns,
  initialBacklogDescription,
  initialDoneDescription,
  initialInstructions,
  availableAgents,
  onCancel,
  onSubmit,
}: FormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [columns, setColumns] = useState<DraftColumn[]>(initialColumns)
  const [backlogDescription, setBacklogDescription] = useState(initialBacklogDescription)
  const [doneDescription, setDoneDescription] = useState(initialDoneDescription)
  const [instructions, setInstructions] = useState(initialInstructions)
  const [templatesAnchor, setTemplatesAnchor] = useState<MenuAnchor | null>(null)
  const templatesRef = useRef<HTMLButtonElement>(null)
  const { pending, error, run } = useAsyncAction()
  const fieldId = useId()
  /** Which card is mid-drag — a ref, since it drives no render of its own. */
  const draggingKey = useRef<string | null>(null)
  /** Name inputs, keyed by card, so Enter can focus the one just added. */
  const nameInputs = useRef(new Map<string, HTMLInputElement>())

  const toggleTemplates = () =>
    setTemplatesAnchor((prev) => {
      if (prev) return null
      const rect = templatesRef.current?.getBoundingClientRect()
      return rect ? anchorFromRect(rect) : null
    })

  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  /** Every bot column must have an agent chosen — a bot column with no
   *  agent is not a state the server accepts either (see `validColumn`). */
  const missingAgent = columns.some((column) => column.bot && column.agent === null)
  const complete =
    trimmedDescription.length > 0 &&
    (!nameEditable || trimmedName.length > 0) &&
    columns.every((column) => column.name.trim().length > 0 && column.description.trim().length > 0) &&
    backlogDescription.trim().length > 0 &&
    doneDescription.trim().length > 0 &&
    instructions.trim().length > 0 &&
    !missingAgent

  const updateColumn = (key: string, patch: Partial<DraftColumn>) =>
    setColumns((prev) => prev.map((column) => (column.key === key ? { ...column, ...patch } : column)))

  /**
   * Focuses the new card's name field, so pressing Enter to add one lets you
   * keep typing straight through several cards without reaching for the mouse.
   * `flushSync` forces the row to actually exist in the DOM before we look up
   * its input by key — without it, the input isn't there yet to focus.
   */
  const addColumn = () => {
    const key = crypto.randomUUID()
    flushSync(() => {
      setColumns((prev) => [...prev, { key, name: '', bot: false, agent: null, description: '' }])
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
          bot: column.bot,
          agent: column.agent,
          description: column.description.trim(),
        })),
        backlogDescription: backlogDescription.trim(),
        doneDescription: doneDescription.trim(),
        instructions: instructions.trim(),
      }),
    )
  }

  return (
    <Modal title={title} wide className="modal__panel--workflow" onCancel={onCancel}>
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
            <li className="column-card column-card--fixed">
              <span className="column-card__name-label">{FIXED_LEADING_LABEL}</span>
              <span />
              <textarea
                className="modal__input column-card__description"
                value={backlogDescription}
                placeholder="Describe what the column is for"
                disabled={pending}
                aria-label="Backlog column description"
                onChange={(event) => setBacklogDescription(event.target.value)}
              />
              <span />
            </li>

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

                <div className="column-card__meta">
                  <label className="column-card__bot">
                    <input
                      type="checkbox"
                      disabled={pending}
                      checked={column.bot}
                      onChange={(event) =>
                        updateColumn(column.key, {
                          bot: event.target.checked,
                          agent: event.target.checked ? column.agent : null,
                        })
                      }
                    />
                    Bot column
                  </label>

                  <select
                    className="modal__input column-card__agent"
                    aria-label="Agent"
                    disabled={pending || !column.bot}
                    value={column.agent ?? ''}
                    onChange={(event) => updateColumn(column.key, { agent: event.target.value || null })}
                  >
                    <option value="" disabled>
                      {availableAgents.length > 0 ? 'Choose an agent' : 'No agents yet'}
                    </option>
                    {availableAgents.map((agent) => (
                      <option key={agent.path} value={agent.path}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  className="modal__input column-card__description"
                  value={column.description}
                  placeholder="Describe what the column is for"
                  disabled={pending}
                  aria-label="Column description"
                  onChange={(event) => updateColumn(column.key, { description: event.target.value })}
                />

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

            <li className="column-card column-card--fixed">
              <span className="column-card__name-label">{FIXED_TRAILING_LABEL}</span>
              <span />
              <textarea
                className="modal__input column-card__description"
                value={doneDescription}
                placeholder="Describe what the column is for"
                disabled={pending}
                aria-label="Done column description"
                onChange={(event) => setDoneDescription(event.target.value)}
              />
              <span />
            </li>
          </ul>

          <button type="button" className="btn" disabled={pending} onClick={addColumn}>
            Add card
          </button>

          {missingAgent && availableAgents.length === 0 && (
            <p className="modal__error">Create an agent for this project first, then choose it here.</p>
          )}
        </div>

        <div className="modal__field">
          <span className="modal__label">Instructions</span>
          <p className="modal__message">
            What makes this workflow different: what "good work" means here,
            and what should exist on a card (a handoff document, exploration
            notes, a screenshot or short video…) by the time it's done.
          </p>
          <p className="modal__message">
            Tip: generic rules — who may pick up a card, handoffs, manual
            overrides — don't belong here; Pulse already handles those the
            same way for every workflow.
          </p>

          <textarea
            className="modal__input modal__input--multiline modal__input--code"
            rows={10}
            value={instructions}
            placeholder="What does 'good work' mean for this workflow? What should a card carry (a handoff document, exploration notes, a screenshot…) by the time it's done?"
            disabled={pending}
            onChange={(event) => setInstructions(event.target.value)}
          />

          <div className="agent-instructions__toolbar">
            <button
              ref={templatesRef}
              type="button"
              className="btn"
              disabled={pending}
              onClick={toggleTemplates}
            >
              Templates
            </button>

            {templatesAnchor && (
              <Menu
                anchor={templatesAnchor}
                ignore={templatesRef}
                items={WORKFLOW_TEMPLATES.map((template) => ({
                  label: template.label,
                  onSelect: () => setInstructions(template.content),
                }))}
                onDismiss={() => setTemplatesAnchor(null)}
              />
            )}
          </div>
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
