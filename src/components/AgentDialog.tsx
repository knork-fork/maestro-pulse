import { useId, useState } from 'react'
import type { AgentEdits, NewAgentDetails } from '../data/api'
import { agentFilePath } from '../data/api'
import type { AgentData } from '../data/agent'
import {
  DEFAULT_HANDHOLDING,
  DEFAULT_HEARTBEAT,
  DEFAULT_MAX_CHILDREN,
  DEFAULT_VERBOSITY,
  HANDHOLDING_DESCRIPTIONS,
  HANDHOLDING_MAX,
  HANDHOLDING_MIN,
  HANDHOLDING_STEP,
  HANDHOLDING_TOOLTIP,
  HEARTBEAT_MAX,
  HEARTBEAT_MIN,
  HEARTBEAT_STEP,
  HEARTBEAT_TOOLTIP,
  MAX_CHILDREN_MAX,
  MAX_CHILDREN_MIN,
  MAX_CHILDREN_STEP,
  MAX_CHILDREN_TOOLTIP,
  VERBOSITY_DESCRIPTIONS,
  VERBOSITY_MAX,
  VERBOSITY_MIN,
  VERBOSITY_STEP,
  VERBOSITY_TOOLTIP,
  parseAgentFile,
} from '../data/agent'
import type { TreeNode } from '../data/tree'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useFileContent } from '../hooks/useFileContent'
import { FieldLabel, RangeField } from './AgentFields'
import { agentAvatar } from './avatar'
import { Modal } from './Modal'

type Props =
  | { mode: 'create'; onCreate: (details: NewAgentDetails) => Promise<void>; onCancel: () => void }
  | { mode: 'edit'; node: TreeNode; onSave: (edits: AgentEdits) => Promise<void>; onCancel: () => void }

const EMPTY_AGENT: AgentData = {
  description: '',
  title: '',
  mission: '',
  heartbeat: DEFAULT_HEARTBEAT,
  maxChildren: DEFAULT_MAX_CHILDREN,
  handholding: DEFAULT_HANDHOLDING,
  verbosity: DEFAULT_VERBOSITY,
  tools: [],
}

/**
 * Asks for what an agent is made from. Create and edit share one form
 * (`AgentForm`) — edit only additionally has to load the agent's current
 * data first, and fixes the name so it can't be typed over.
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
      initial={EMPTY_AGENT}
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
      initial={parsed}
      onCancel={onCancel}
      onSubmit={(values) => onSave(values)}
    />
  )
}

type FormProps = {
  title: string
  /** False in edit mode: the name is fixed once an agent is created. */
  nameEditable: boolean
  initialName: string
  initial: AgentData
  onCancel: () => void
  onSubmit: (values: NewAgentDetails) => Promise<void>
}

/**
 * Mirrors `AgentView`'s `agent-view__basics` profile card so filling one in
 * looks like the view it produces — same left/right split, same slider
 * control, same field layout, just editable.
 */
function AgentForm({ title, nameEditable, initialName, initial, onCancel, onSubmit }: FormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initial.description)
  const [agentTitle, setAgentTitle] = useState(initial.title)
  const [mission, setMission] = useState(initial.mission)
  const [heartbeat, setHeartbeat] = useState(initial.heartbeat)
  const [maxChildren, setMaxChildren] = useState(initial.maxChildren)
  const [handholding, setHandholding] = useState(initial.handholding)
  const [verbosity, setVerbosity] = useState(initial.verbosity)
  const { pending, error, run } = useAsyncAction()
  const fieldId = useId()

  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  const complete = trimmedDescription.length > 0 && (!nameEditable || trimmedName.length > 0)

  const submit = async () => {
    if (!complete) return

    await run(() =>
      onSubmit({
        name: trimmedName,
        description: trimmedDescription,
        title: agentTitle.trim(),
        mission: mission.trim(),
        heartbeat,
        maxChildren,
        handholding,
        verbosity,
        // Not edited by this form — the Toolkit modal owns it; carry
        // whatever was loaded through unchanged.
        tools: initial.tools,
      }),
    )
  }

  return (
    <Modal title={title} wide className="modal__panel--agent" onCancel={onCancel}>
      <form
        className="agent-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="agent-view__basics">
          <div className="agent-view__basics-left">
            <img className="agent-view__avatar" src={agentAvatar(name || 'agent')} alt="" />

            <div className="modal__field">
              <FieldLabel htmlFor={`${fieldId}-heartbeat`} tooltip={HEARTBEAT_TOOLTIP}>
                Heartbeat
              </FieldLabel>
              <RangeField
                id={`${fieldId}-heartbeat`}
                min={HEARTBEAT_MIN}
                max={HEARTBEAT_MAX}
                step={HEARTBEAT_STEP}
                unit="m"
                value={heartbeat}
                onChange={setHeartbeat}
              />
            </div>

            <div className="modal__field">
              <FieldLabel htmlFor={`${fieldId}-max-children`} tooltip={MAX_CHILDREN_TOOLTIP}>
                Max children
              </FieldLabel>
              <RangeField
                id={`${fieldId}-max-children`}
                min={MAX_CHILDREN_MIN}
                max={MAX_CHILDREN_MAX}
                step={MAX_CHILDREN_STEP}
                unit=""
                value={maxChildren}
                onChange={setMaxChildren}
              />
            </div>

            <div className="modal__field">
              <FieldLabel htmlFor={`${fieldId}-handholding`} tooltip={HANDHOLDING_TOOLTIP}>
                Handholding
              </FieldLabel>
              <RangeField
                id={`${fieldId}-handholding`}
                min={HANDHOLDING_MIN}
                max={HANDHOLDING_MAX}
                step={HANDHOLDING_STEP}
                unit="%"
                value={handholding}
                onChange={setHandholding}
              />
              <p className="agent-view__range-hint">({HANDHOLDING_DESCRIPTIONS[handholding]})</p>
            </div>

            <div className="modal__field">
              <FieldLabel htmlFor={`${fieldId}-verbosity`} tooltip={VERBOSITY_TOOLTIP}>
                Verbosity
              </FieldLabel>
              <RangeField
                id={`${fieldId}-verbosity`}
                min={VERBOSITY_MIN}
                max={VERBOSITY_MAX}
                step={VERBOSITY_STEP}
                unit="%"
                value={verbosity}
                onChange={setVerbosity}
              />
              <p className="agent-view__range-hint">({VERBOSITY_DESCRIPTIONS[verbosity]})</p>
            </div>
          </div>

          <div className="agent-view__basics-right">
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
              <label className="modal__label" htmlFor={`${fieldId}-title`}>
                Title
              </label>
              <input
                id={`${fieldId}-title`}
                className="modal__input"
                placeholder="e.g. Coder, QA"
                value={agentTitle}
                disabled={pending}
                onChange={(event) => setAgentTitle(event.target.value)}
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
              <label className="modal__label" htmlFor={`${fieldId}-mission`}>
                Mission
              </label>
              <textarea
                id={`${fieldId}-mission`}
                className="modal__input modal__input--multiline"
                value={mission}
                rows={3}
                disabled={pending}
                onChange={(event) => setMission(event.target.value)}
              />
            </div>
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
