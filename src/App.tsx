import { ProjectsSidebar } from './components/ProjectsSidebar'
import { SessionsSidebar } from './components/SessionsSidebar'

export default function App() {
  return (
    <div className="app">
      <ProjectsSidebar />
      <main className="main" />
      <SessionsSidebar />
    </div>
  )
}
