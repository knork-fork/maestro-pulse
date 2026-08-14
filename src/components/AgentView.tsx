import { useState } from 'react'
import { agentFilePath } from '../data/api'
import { useFileContent } from '../hooks/useFileContent'
import { agentAvatar } from './avatar'

const STATUS_LABEL = 'Not running'

const MISSION =
  "Keep an eye on the work assigned to it, pick up anything new that falls " +
  'within its scope, and make steady progress between check-ins. When ' +
  'something is ambiguous or looks risky, it should pause and flag it ' +
  'rather than guess.'

const PULSE_ACTIONS = [
  'Check the shared task queue for anything new or reassigned.',
  'Re-read items already in progress and note what changed since the last pulse.',
  'Run any pending tool calls needed to move blocked work forward.',
  'Summarize progress and post a short status update.',
  'Flag anything that looks stuck or needs a human decision.',
]

const DEFAULT_HEARTBEAT = 15
const DEFAULT_MAX_CHILDREN = 4
const DEFAULT_HANDHOLDING = 50
const DEFAULT_VERBOSITY = 50

const HANDHOLDING_DESCRIPTIONS: Record<number, string> = {
  0: 'Agent decides everything itself.',
  25: 'Escalate architecture/design decisions only.',
  50: 'Escalate significant ambiguity and tradeoffs.',
  75: 'Ask on most non-trivial decisions.',
  100: 'Ask whenever there is meaningful ambiguity.',
}

const VERBOSITY_DESCRIPTIONS: Record<number, string> = {
  0: 'Caveman',
  25: 'Concise',
  50: 'Normal',
  75: 'Detailed',
  100: 'Scholar',
}

type Props = { path: string; name: string }

/**
 * An agent's own profile — real `name`/`description`, everything else (the
 * sliders, mission, pulse actions, status and top-bar controls) is sample UI
 * data with nothing behind it yet. See the "Not yet wired" note in
 * ../../CLAUDE.md.
 */
export function AgentView({ path, name }: Props) {
  const { content, error, loading } = useFileContent(agentFilePath(path))

  if (loading) {
    return (
      <div className="viewer agent-view">
        <p className="empty-state">Loading…</p>
      </div>
    )
  }

  const parsed = error ? null : parseAgentFile(content ?? '')
  if (!parsed) {
    return (
      <div className="viewer agent-view">
        <p className="viewer__error" role="alert">
          {error ?? "This agent's data could not be read."}
        </p>
      </div>
    )
  }

  return (
    <div className="viewer agent-view">
      <div className="agent-view__topbar">
        <span className="agent-view__status">{STATUS_LABEL}</span>
        <button type="button" className="btn btn--primary" onClick={() => {}}>
          Spawn
        </button>
      </div>

      <BasicInfoCard name={name} description={parsed.description} />
      <PulseActionsCard />
    </div>
  )
}

/**
 * `agent.json` holds just a description — anything short of that shape is
 * treated as unreadable rather than guessed at. Duplicated locally rather
 * than shared, same as `parseAgentFile` in AgentDialog.tsx.
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

function BasicInfoCard({ name, description }: { name: string; description: string }) {
  const [heartbeat, setHeartbeat] = useState(DEFAULT_HEARTBEAT)
  const [maxChildren, setMaxChildren] = useState(DEFAULT_MAX_CHILDREN)
  const [handholding, setHandholding] = useState(DEFAULT_HANDHOLDING)
  const [verbosity, setVerbosity] = useState(DEFAULT_VERBOSITY)

  return (
    <div className="agent-view__card">
      <div className="agent-view__basics">
        <div className="agent-view__basics-left">
          <img className="agent-view__avatar" src={agentAvatar(name)} alt={name} />

          <div className="modal__field">
            <label className="modal__label" htmlFor="agent-view-heartbeat">
              Heartbeat
            </label>
            <RangeField
              id="agent-view-heartbeat"
              min={5}
              max={120}
              step={5}
              unit="m"
              value={heartbeat}
              onChange={setHeartbeat}
            />
          </div>

          <div className="modal__field">
            <label className="modal__label" htmlFor="agent-view-max-children">
              Max children
            </label>
            <RangeField
              id="agent-view-max-children"
              min={1}
              max={16}
              step={1}
              unit=""
              value={maxChildren}
              onChange={setMaxChildren}
            />
          </div>

          <div className="modal__field">
            <label className="modal__label" htmlFor="agent-view-handholding">
              Handholding
            </label>
            <RangeField
              id="agent-view-handholding"
              min={0}
              max={100}
              step={25}
              unit="%"
              value={handholding}
              onChange={setHandholding}
            />
            <p className="agent-view__range-hint">
              ({HANDHOLDING_DESCRIPTIONS[handholding]})
            </p>
          </div>

          <div className="modal__field">
            <label className="modal__label" htmlFor="agent-view-verbosity">
              Verbosity
            </label>
            <RangeField
              id="agent-view-verbosity"
              min={0}
              max={100}
              step={25}
              unit="%"
              value={verbosity}
              onChange={setVerbosity}
            />
            <p className="agent-view__range-hint">
              ({VERBOSITY_DESCRIPTIONS[verbosity]})
            </p>
          </div>
        </div>

        <div className="agent-view__basics-right">
          <h2 className="agent-view__name">{name}</h2>

          <div className="agent-view__buttons">
            <button type="button" className="btn" disabled>
              Logs
            </button>
            <button type="button" className="btn" disabled>
              Open session
            </button>
          </div>

          <div className="agent-view__field">
            <span className="modal__label">Description</span>
            <p className="agent-view__field-text">{description}</p>
          </div>

          <div className="agent-view__field">
            <span className="modal__label">Mission</span>
            <p className="agent-view__field-text">{MISSION}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PulseActionsCard() {
  return (
    <div className="agent-view__card">
      <h3 className="agent-view__card-title">Pulse Actions</h3>
      <ul className="agent-view__pulse-list">
        {PULSE_ACTIONS.map((step, index) => (
          <li key={step} className="agent-view__pulse-item">
            <span className="agent-view__pulse-index">{index + 1}</span>
            <span className="agent-view__pulse-text">{step}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type RangeFieldProps = {
  id: string
  min: number
  max: number
  step: number
  unit: string
  value: number
  onChange: (value: number) => void
}

function RangeField({ id, min, max, step, unit, value, onChange }: RangeFieldProps) {
  return (
    <div className="agent-view__range">
      <input
        id={id}
        type="range"
        className="agent-view__range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="agent-view__range-value">
        {value}
        {unit}
      </span>
    </div>
  )
}
