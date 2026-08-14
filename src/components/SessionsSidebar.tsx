export function SessionsSidebar() {
  const sessions: string[] = []

  return (
    <aside className="sidebar sidebar--right">
      <header className="sidebar__header">
        <h2 className="sidebar__title">Sessions</h2>
      </header>

      <div className="sidebar__filter">
        <input
          type="search"
          className="filter-input"
          placeholder="Filter sessions…"
          aria-label="Filter sessions"
        />
      </div>

      <div className="sessions">
        {sessions.length === 0 && (
          <p className="empty-state">
            No active sessions. Right-click an agent in the left sidebar and choose Spawn to start one.
          </p>
        )}
      </div>
    </aside>
  )
}
