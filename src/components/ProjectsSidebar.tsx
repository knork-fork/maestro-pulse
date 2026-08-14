import { projects } from '../data/projects'
import { NewMenu } from './NewMenu'
import { ProjectTree } from './ProjectTree'
import { RefreshIcon } from './icons'

export function ProjectsSidebar() {
  return (
    <aside className="sidebar sidebar--left">
      <header className="sidebar__header">
        <h1 className="sidebar__title">Projects</h1>
        <div className="sidebar__actions">
          <button type="button" className="icon-btn" title="Refresh" aria-label="Refresh">
            <RefreshIcon />
          </button>
          <NewMenu />
        </div>
      </header>

      <div className="sidebar__filter">
        <input
          type="search"
          className="filter-input"
          placeholder="Filter projects…"
          aria-label="Filter projects"
        />
      </div>

      <nav className="tree" aria-label="Project tree">
        <ProjectTree nodes={projects} />
      </nav>
    </aside>
  )
}
