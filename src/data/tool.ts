/**
 * `tool.json`'s shape and its parser — one per `tools/<name>/` subfolder in a
 * project (see the project store's own CLAUDE.md for the full tool-folder
 * convention: `tool.sh`, `.env`/`.env.local` alongside it). Mirrors
 * `agent.ts`'s shape-plus-parser convention.
 */
export type ToolData = {
  title: string
  description: string
  /** A `ToolIconType` key from ../data/toolIcons.ts, resolved by `toolLook`
   *  there — kept as a bare string here since this is untrusted external
   *  input; an unrecognized key falls back to the wrench look. `null` means
   *  no icon at all, rendered as reserved empty space. */
  icon: string | null
}

function normalizeIcon(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  // A real-world authoring slip — the literal string "null" instead of the
  // JSON value — means the same thing as an absent icon.
  return trimmed && trimmed !== 'null' ? trimmed : null
}

/**
 * Returns `null` only when the file isn't valid JSON at all — a missing or
 * wrong-typed `title`/`description` falls back to an empty string rather than
 * making the whole tool unreadable, since the caller (`useProjectTools`)
 * already has a better fallback (the folder's own name) for that case.
 */
export function parseToolFile(content: string): ToolData | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      icon: normalizeIcon(parsed.icon),
    }
  } catch {
    return null
  }
}

/**
 * A tile's hover tooltip: the full title first (a tile's own name can be
 * ellipsis-truncated to fit the grid), then the description below it — for
 * both `ToolkitCard`'s tiles and `AgentToolsModal`'s.
 */
export function toolTooltip({ title, description }: Pick<ToolData, 'title' | 'description'>): string {
  return description ? `${title}\n\n${description}` : title
}
