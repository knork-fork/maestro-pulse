import type { CSSProperties } from 'react'
import type { ToolCatalogEntry } from '../hooks/useProjectTools'
import { toolLook } from '../data/toolIcons'
import { toolTooltip } from '../data/tool'
import { LockIcon } from './icons'

/**
 * One read-only toolkit tile, shared by `AgentView.tsx`'s `ToolkitCard` and
 * `AgentToolsModal.tsx`'s "Selected" grid. `locked` marks a tool from the
 * always-on common catalog (`useCommonTools`) — available to every agent by
 * default and never toggleable, so it renders with a lock glyph instead of
 * the interactive tile's arrow/click handler.
 */
export function ToolTile({ tool, locked }: { tool: ToolCatalogEntry; locked?: boolean }) {
  const { Icon, tint } = toolLook(tool.icon)
  const tooltip = locked ? `${toolTooltip(tool)}\n\nAlways available to every agent.` : toolTooltip(tool)

  return (
    <div
      className={`agent-view__tool${locked ? ' agent-view__tool--locked' : ''}`}
      title={tooltip}
      style={{ '--tool-tint': tint } as CSSProperties}
    >
      {tool.icon === null ? <span className="agent-view__tool-icon" /> : <Icon className="agent-view__tool-icon" />}
      <span className="agent-view__tool-name">{tool.title}</span>
      {locked && <LockIcon className="agent-view__tool-lock" />}
    </div>
  )
}
