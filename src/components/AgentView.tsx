import { useEffect, useRef, useState } from 'react'
import {
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
} from '../data/agent'
import type { AgentData } from '../data/agent'
import { useAgentInstructions } from '../hooks/useAgentInstructions'
import { useAgentProfile } from '../hooks/useAgentProfile'
import { AgentInstructionsModal } from './AgentInstructionsModal'
import { FieldLabel, RangeField } from './AgentFields'
import { agentAvatar } from './avatar'
import { SafeMarkdown } from '../views/MarkdownView'

const STATUS_LABEL = 'Not running'

/** `treeVersion` is the tree's own `nodes` array — a fresh reference every
 *  time `useProjectTree` reloads, including right after this agent was
 *  edited from the sidebar's dialog. This view has no other way to learn
 *  that its own agent.json just changed underneath it, since it reads the
 *  file directly through its own `useAgentProfile` rather than through the
 *  tree — mirrors KanbanBoard.tsx's identical `treeVersion` convention. */
type Props = { path: string; name: string; treeVersion: unknown }

/**
 * An agent's own profile — `name`, `title`, `description`, `mission`, and the
 * four numeric settings all come from `agent.json` now, and dragging a
 * slider here saves it (debounced) via `useAgentProfile`. The Instructions
 * card below renders `agent.md` (see `useAgentInstructions`), editable here
 * or from the tree's context menu. Only the "Not running" status and the
 * Spawn/Logs/Open session controls remain sample UI data with nothing behind
 * them yet. See the "Not yet wired" note in ../../CLAUDE.md.
 */
export function AgentView({ path, name, treeVersion }: Props) {
  const { data, error, loading, reload, update } = useAgentProfile(path)
  const instructions = useAgentInstructions(path)
  const [editingInstructions, setEditingInstructions] = useState(false)
  /** Skips the redundant reload on mount — `useAgentProfile`/
   *  `useAgentInstructions` already load themselves then; this effect only
   *  needs to fire on a *later* tree reload. */
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) {
      void reload(true)
      void instructions.reload(true)
    } else {
      mounted.current = true
    }
  }, [treeVersion, reload, instructions.reload])

  if (loading) {
    return (
      <div className="viewer agent-view">
        <p className="empty-state">Loading…</p>
      </div>
    )
  }

  if (!data) {
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

      <BasicInfoCard name={name} data={data} onChange={update} />
      <InstructionsCard
        content={instructions.content}
        error={instructions.error}
        onEdit={() => setEditingInstructions(true)}
      />

      {editingInstructions && (
        <AgentInstructionsModal
          path={path}
          onSave={async (text) => {
            await instructions.save(text)
            setEditingInstructions(false)
          }}
          onCancel={() => setEditingInstructions(false)}
        />
      )}
    </div>
  )
}

function BasicInfoCard({
  name,
  data,
  onChange,
}: {
  name: string
  data: AgentData
  onChange: (changes: Partial<AgentData>) => void
}) {
  return (
    <div className="agent-view__card">
      <div className="agent-view__basics">
        <div className="agent-view__basics-left">
          <img className="agent-view__avatar" src={agentAvatar(name)} alt={name} />

          <div className="modal__field">
            <FieldLabel htmlFor="agent-view-heartbeat" tooltip={HEARTBEAT_TOOLTIP}>
              Heartbeat
            </FieldLabel>
            <RangeField
              id="agent-view-heartbeat"
              min={HEARTBEAT_MIN}
              max={HEARTBEAT_MAX}
              step={HEARTBEAT_STEP}
              unit="m"
              value={data.heartbeat}
              onChange={(heartbeat) => onChange({ heartbeat })}
            />
          </div>

          <div className="modal__field">
            <FieldLabel htmlFor="agent-view-max-children" tooltip={MAX_CHILDREN_TOOLTIP}>
              Max children
            </FieldLabel>
            <RangeField
              id="agent-view-max-children"
              min={MAX_CHILDREN_MIN}
              max={MAX_CHILDREN_MAX}
              step={MAX_CHILDREN_STEP}
              unit=""
              value={data.maxChildren}
              onChange={(maxChildren) => onChange({ maxChildren })}
            />
          </div>

          <div className="modal__field">
            <FieldLabel htmlFor="agent-view-handholding" tooltip={HANDHOLDING_TOOLTIP}>
              Handholding
            </FieldLabel>
            <RangeField
              id="agent-view-handholding"
              min={HANDHOLDING_MIN}
              max={HANDHOLDING_MAX}
              step={HANDHOLDING_STEP}
              unit="%"
              value={data.handholding}
              onChange={(handholding) => onChange({ handholding })}
            />
            <p className="agent-view__range-hint">
              ({HANDHOLDING_DESCRIPTIONS[data.handholding]})
            </p>
          </div>

          <div className="modal__field">
            <FieldLabel htmlFor="agent-view-verbosity" tooltip={VERBOSITY_TOOLTIP}>
              Verbosity
            </FieldLabel>
            <RangeField
              id="agent-view-verbosity"
              min={VERBOSITY_MIN}
              max={VERBOSITY_MAX}
              step={VERBOSITY_STEP}
              unit="%"
              value={data.verbosity}
              onChange={(verbosity) => onChange({ verbosity })}
            />
            <p className="agent-view__range-hint">
              ({VERBOSITY_DESCRIPTIONS[data.verbosity]})
            </p>
          </div>
        </div>

        <div className="agent-view__basics-right">
          <h2 className="agent-view__name">{name}</h2>
          {data.title && <p className="agent-view__title">{data.title}</p>}

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
            <p className="agent-view__field-text">{data.description}</p>
          </div>

          <div className="agent-view__field">
            <span className="modal__label">Mission</span>
            <p className="agent-view__field-text">{data.mission}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Renders `agent.md` — the agent's real system/personalization prompt —
 *  with an Edit button that opens `AgentInstructionsModal`. Editing is also
 *  reachable from the tree's "Edit instructions" context menu row. */
function InstructionsCard({
  content,
  error,
  onEdit,
}: {
  content: string | null
  error: string | null
  onEdit: () => void
}) {
  return (
    <div className="agent-view__card">
      <div className="agent-view__card-header">
        <h3 className="agent-view__card-title">Instructions</h3>
        <button type="button" className="btn" onClick={onEdit}>
          Edit
        </button>
      </div>

      {content === null ? (
        <p className="viewer__error" role="alert">
          {error ?? "This agent's instructions could not be read."}
        </p>
      ) : content.trim() === '' ? (
        <p className="empty-state">No instructions set</p>
      ) : (
        <SafeMarkdown content={content} />
      )}
    </div>
  )
}
