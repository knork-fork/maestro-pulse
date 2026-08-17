import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { ToolCatalogEntry } from '../hooks/useProjectTools'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { toolLook } from '../data/toolIcons'
import { toolTooltip } from '../data/tool'
import { ArrowDownIcon, ArrowUpIcon } from './icons'
import { Modal } from './Modal'

type Props = {
  catalog: ToolCatalogEntry[]
  selected: string[]
  onSave: (tools: string[]) => Promise<void>
  onCancel: () => void
}

/** A catalog entry resolved for display, falling back to the bare path for
 *  an orphaned selection — a tool picked earlier and since deleted from the
 *  project's `tools/` folder. */
function resolve(path: string, catalog: ToolCatalogEntry[]): ToolCatalogEntry {
  return catalog.find((tool) => tool.path === path) ?? { path, title: path, description: '', icon: null }
}

/**
 * The Toolkit card's Edit modal: an upper grid of already-selected tools and
 * a lower, searchable grid of everything else in the project's `tools/`
 * folder — the same tile look as the Toolkit card itself. Clicking any tile
 * moves it to the other grid; nothing is persisted until Save. See
 * `useProjectTools` for how `catalog` is built.
 */
export function AgentToolsModal({ catalog, selected, onSave, onCancel }: Props) {
  const [chosen, setChosen] = useState(selected)
  const [query, setQuery] = useState('')
  const { pending, error, run } = useAsyncAction()

  const chosenTools = chosen.map((path) => resolve(path, catalog))
  const available = catalog
    .filter((tool) => !chosen.includes(tool.path))
    .filter((tool) => tool.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title))

  const select = (path: string) => setChosen((current) => [...current, path])
  const deselect = (path: string) => setChosen((current) => current.filter((p) => p !== path))

  return (
    <Modal title="Edit tools" wide className="modal__panel--tools" onCancel={onCancel}>
      <div className="tools-picker">
        <div className="tools-picker__section">
          <div className="tools-picker__section-header">
            <h3 className="tools-picker__section-title">Selected</h3>
          </div>
          {chosenTools.length === 0 ? (
            <p className="empty-state">No tools selected</p>
          ) : (
            <div className="tools-picker__grid">
              {chosenTools.map((tool) => (
                <ToolTile key={tool.path} tool={tool} arrow="down" onClick={() => deselect(tool.path)} />
              ))}
            </div>
          )}
        </div>

        <div className="tools-picker__section">
          <div className="tools-picker__section-header">
            <h3 className="tools-picker__section-title">Available</h3>
            <input
              className="filter-input tools-picker__filter"
              placeholder="Filter tools…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {available.length === 0 ? (
            <p className="empty-state">
              {catalog.length === 0 ? 'No tools in this project yet' : 'No matching tools'}
            </p>
          ) : (
            <div className="tools-picker__grid">
              {available.map((tool) => (
                <ToolTile key={tool.path} tool={tool} arrow="up" onClick={() => select(tool.path)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="modal__error">{error}</p>}

      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending}
          onClick={() => void run(() => onSave(chosen))}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}

function ToolTile({
  tool,
  arrow,
  onClick,
}: {
  tool: ToolCatalogEntry
  arrow: 'up' | 'down'
  onClick: () => void
}) {
  const { Icon, tint } = toolLook(tool.icon)
  const ArrowIcon = arrow === 'up' ? ArrowUpIcon : ArrowDownIcon

  return (
    <button
      type="button"
      className="agent-view__tool tools-picker__tile"
      onClick={onClick}
      title={toolTooltip(tool)}
      style={{ '--tool-tint': tint } as CSSProperties}
    >
      {tool.icon === null ? (
        <span className="agent-view__tool-icon" />
      ) : (
        <Icon className="agent-view__tool-icon" />
      )}
      <span className="agent-view__tool-name">{tool.title}</span>
      <ArrowIcon className="tools-picker__arrow" />
    </button>
  )
}
