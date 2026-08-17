/**
 * `agent.json`'s shape, its bounds/defaults, and the one parser both
 * AgentView.tsx and AgentDialog.tsx read it with — kept in one place because
 * the numeric fields need matching bounds wherever they're edited or shown.
 */
export type AgentData = {
  description: string
  title: string
  mission: string
  heartbeat: number
  maxChildren: number
  handholding: number
  verbosity: number
  /** Project-relative paths into this agent's project's `tools/` folder
   *  (e.g. `"tools/read-from-trello"`) — no other metadata; a tool's own
   *  name/description/icon live in that folder's `tool.json`, read via
   *  `useProjectTools`. */
  tools: string[]
}

export const HEARTBEAT_MIN = 5
export const HEARTBEAT_MAX = 120
export const HEARTBEAT_STEP = 5

export const MAX_CHILDREN_MIN = 1
export const MAX_CHILDREN_MAX = 16
export const MAX_CHILDREN_STEP = 1

export const HANDHOLDING_MIN = 0
export const HANDHOLDING_MAX = 100
export const HANDHOLDING_STEP = 25

export const VERBOSITY_MIN = 0
export const VERBOSITY_MAX = 100
export const VERBOSITY_STEP = 25

export const DEFAULT_HEARTBEAT = 15
export const DEFAULT_MAX_CHILDREN = 4
export const DEFAULT_HANDHOLDING = 50
export const DEFAULT_VERBOSITY = 50

export const HANDHOLDING_DESCRIPTIONS: Record<number, string> = {
  0: 'Agent decides everything itself.',
  25: 'Escalate architecture/design decisions only.',
  50: 'Escalate significant ambiguity and tradeoffs.',
  75: 'Ask on most non-trivial decisions.',
  100: 'Ask whenever there is meaningful ambiguity.',
}

export const VERBOSITY_DESCRIPTIONS: Record<number, string> = {
  0: 'Caveman',
  25: 'Concise',
  50: 'Normal',
  75: 'Detailed',
  100: 'Scholar',
}

export const HEARTBEAT_TOOLTIP =
  'How often the agent checks in for new work. Checking in less often uses fewer tokens overall.'

export const MAX_CHILDREN_TOOLTIP =
  'How many subagents can run at once. A lower limit is cheaper overall, but slower for work that could otherwise run in parallel.'

export const HANDHOLDING_TOOLTIP =
  'At high values, subagents will often stop and wait for human input before continuing. This combines poorly with a high Max children, since many subagents can end up blocked waiting on you at the same time. 50% is the baseline value.'

export const VERBOSITY_TOOLTIP =
  'Lower verbosity is fine for internal, agent-to-agent use where no one is reading every message closely. 50% is the baseline value.'

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : fallback
}

/**
 * `description` must be a string or the whole file is unreadable, same rule
 * as before this shape grew. Every other field falls back to its default
 * when absent/wrong-typed, since agent.json files written before these
 * fields existed shouldn't become unreadable.
 */
export function parseAgentFile(content: string): AgentData | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    if (typeof parsed.description !== 'string') return null

    return {
      description: parsed.description,
      title: stringOr(parsed.title, ''),
      mission: stringOr(parsed.mission, ''),
      heartbeat: numberOr(parsed.heartbeat, DEFAULT_HEARTBEAT),
      maxChildren: numberOr(parsed.maxChildren, DEFAULT_MAX_CHILDREN),
      handholding: numberOr(parsed.handholding, DEFAULT_HANDHOLDING),
      verbosity: numberOr(parsed.verbosity, DEFAULT_VERBOSITY),
      tools: stringArrayOr(parsed.tools, []),
    }
  } catch {
    return null
  }
}
