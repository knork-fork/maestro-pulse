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
import type { AgentEdits } from '../data/api'
import type { TreeNode } from '../data/tree'
import { useAgentInstructions } from '../hooks/useAgentInstructions'
import { useAgentProfile } from '../hooks/useAgentProfile'
import { AgentDialog } from './AgentDialog'
import { AgentInstructionsModal } from './AgentInstructionsModal'
import { FieldLabel, RangeField } from './AgentFields'
import { agentAvatar } from './avatar'
import { Menu, anchorFromRect } from './Menu'
import type { MenuAnchor, MenuItem } from './Menu'
import { SafeMarkdown } from '../views/MarkdownView'
import type { ToolCatalogEntry } from '../hooks/useProjectTools'
import { useCommonTools, useProjectTools } from '../hooks/useProjectTools'
import { AgentToolsModal } from './AgentToolsModal'
import { ToolTile } from './ToolTile'

const STATUS_LABEL = 'Not running'

/** Neither option does anything yet — see the "Not yet wired" note in
 *  ../../CLAUDE.md; this only shapes the entry point into two choices.
 *  Shared with the tree's right-click "Spawn" row (ProjectTree.tsx) so both
 *  entry points offer the identical choice. */
export const SPAWN_ITEMS: MenuItem[] = [
  {
    label: 'Spawn loop',
    title: 'Starts the agent as a recurring loop, running on its own heartbeat.',
    onSelect: () => {},
  },
  {
    label: 'Single instance',
    title: 'Starts a single, non-headless, non-screen run that solves one task and stops.',
    onSelect: () => {},
  },
]

/** `treeVersion` is the tree's own `nodes` array — a fresh reference every
 *  time `useProjectTree` reloads, including right after this agent was
 *  edited from the sidebar's dialog. This view has no other way to learn
 *  that its own agent.json just changed underneath it, since it reads the
 *  file directly through its own `useAgentProfile` rather than through the
 *  tree — mirrors KanbanBoard.tsx's identical `treeVersion` convention.
 *  Unlike that convention elsewhere, this view also reads its *structure* —
 *  see `useProjectTools`, which locates the owning project's `tools/`
 *  folder in it. */
type Props = {
  path: string
  name: string
  node: TreeNode
  treeVersion: TreeNode[]
  onSave: (path: string, edits: AgentEdits) => Promise<void>
}

/**
 * An agent's own profile — `name`, `title`, `description`, `mission`, and the
 * four numeric settings all come from `agent.json` now, and dragging a
 * slider here saves it (debounced) via `useAgentProfile`. The Instructions
 * card below renders `agent.md` (see `useAgentInstructions`), editable here
 * or from the tree's context menu. Spawn opens a menu (loop vs. single
 * instance) but neither option, nor the "Not running" status, nor
 * Logs/Open session, do anything yet. See the "Not yet wired" note in
 * ../../CLAUDE.md.
 */
export function AgentView({ path, name, node, treeVersion, onSave }: Props) {
  const { data, error, loading, reload, update } = useAgentProfile(path)
  const instructions = useAgentInstructions(path)
  const { tools: catalog } = useProjectTools(treeVersion, path)
  const { tools: commonTools } = useCommonTools(treeVersion)
  const [editingInstructions, setEditingInstructions] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingTools, setEditingTools] = useState(false)
  const [spawnAnchor, setSpawnAnchor] = useState<MenuAnchor | null>(null)
  const spawnTriggerRef = useRef<HTMLButtonElement>(null)
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
        <span className="agent-view__status">
          <span className="agent-view__status-dot" aria-hidden="true" />
          {STATUS_LABEL}
        </span>
        <button
          ref={spawnTriggerRef}
          type="button"
          className="btn btn--primary"
          aria-haspopup="menu"
          aria-expanded={spawnAnchor !== null}
          onClick={() =>
            setSpawnAnchor((prev) => {
              if (prev) return null

              const rect = spawnTriggerRef.current?.getBoundingClientRect()
              return rect ? anchorFromRect(rect) : null
            })
          }
        >
          Spawn
        </button>

        {spawnAnchor && (
          <Menu
            anchor={spawnAnchor}
            align="right"
            ignore={spawnTriggerRef}
            items={SPAWN_ITEMS}
            onDismiss={() => setSpawnAnchor(null)}
          />
        )}
      </div>

      <BasicInfoCard name={name} data={data} onChange={update} onEdit={() => setEditingProfile(true)} />
      <InstructionsCard
        content={instructions.content}
        error={instructions.error}
        onEdit={() => setEditingInstructions(true)}
      />
      <ToolkitCard
        tools={data.tools}
        catalog={catalog}
        commonTools={commonTools}
        onEdit={() => setEditingTools(true)}
      />
      <StatsCard />

      {editingTools && (
        <AgentToolsModal
          catalog={catalog}
          commonTools={commonTools}
          selected={data.tools}
          onSave={async (tools) => {
            await onSave(path, { ...data, tools })
            setEditingTools(false)
          }}
          onCancel={() => setEditingTools(false)}
        />
      )}

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

      {editingProfile && (
        <AgentDialog
          mode="edit"
          node={node}
          onSave={async (edits) => {
            await onSave(node.path, edits)
            setEditingProfile(false)
          }}
          onCancel={() => setEditingProfile(false)}
        />
      )}
    </div>
  )
}

function BasicInfoCard({
  name,
  data,
  onChange,
  onEdit,
}: {
  name: string
  data: AgentData
  onChange: (changes: Partial<AgentData>) => void
  onEdit: () => void
}) {
  return (
    <div className="agent-view__card">
      <div className="agent-view__card-header">
        <h3 className="agent-view__card-title">Profile</h3>
        <button type="button" className="btn btn--sm" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="agent-view__head">
        <div className="agent-view__rail">
          <img className="agent-view__rail-avatar" src={agentAvatar(name)} alt={name} />

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

        <div className="agent-view__ident">
          <h2 className="agent-view__name">{name}</h2>
          {data.title && <p className="agent-view__title">{data.title}</p>}

          <div className="agent-view__buttons">
            <button type="button" className="btn btn--sm" disabled>
              Logs
            </button>
            <button type="button" className="btn btn--sm" disabled>
              Open session
            </button>
          </div>

          <div className="agent-view__meta">
            <span className="agent-view__meta-label">Description</span>
            <p className="agent-view__meta-text">{data.description}</p>
          </div>

          <div className="agent-view__meta">
            <span className="agent-view__meta-label">Mission</span>
            <p className="agent-view__meta-text">{data.mission}</p>
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
        <button type="button" className="btn btn--sm" onClick={onEdit}>
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
        <div className="agent-view__instructions">
          <SafeMarkdown content={content} />
        </div>
      )}
    </div>
  )
}

/** An agent's toolkit: `commonTools` (every tool in the shared, always-on
 *  catalog — see `useCommonTools`) shown first, unconditionally, followed by
 *  `agent.json`'s own `tools` (project-relative paths) resolved against the
 *  project's own catalog for a title/icon — see `useProjectTools`. A path
 *  with no matching catalog entry (the tool was deleted from disk after
 *  being picked) still shows, using the raw path as its title. Edit opens
 *  `AgentToolsModal`. */
function ToolkitCard({
  tools,
  catalog,
  commonTools,
  onEdit,
}: {
  tools: string[]
  catalog: ToolCatalogEntry[]
  commonTools: ToolCatalogEntry[]
  onEdit: () => void
}) {
  const own = tools.map(
    (path) => catalog.find((entry) => entry.path === path) ?? { path, title: path, description: '', icon: null },
  )

  return (
    <div className="agent-view__card">
      <div className="agent-view__card-header">
        <h3 className="agent-view__card-title">Toolkit</h3>
        <button type="button" className="btn btn--sm" onClick={onEdit}>
          Edit
        </button>
      </div>

      {commonTools.length === 0 && own.length === 0 ? (
        <p className="empty-state">No tools</p>
      ) : (
        <div className="agent-view__toolkit-grid">
          {commonTools.map((tool) => (
            <ToolTile key={tool.path} tool={tool} locked />
          ))}
          {own.map((tool) => (
            <ToolTile key={tool.path} tool={tool} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Reserved for an agent's runtime telemetry — nothing records any yet, so
 *  the section stands empty. See the "Not yet wired" note in ../../CLAUDE.md. */
function StatsCard() {
  return (
    <div className="agent-view__card">
      <div className="agent-view__card-header">
        <h3 className="agent-view__card-title">Stats &amp; usage</h3>
      </div>

      <p className="empty-state">No usage recorded yet</p>
    </div>
  )
}
