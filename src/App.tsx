import { useEffect } from 'react'
import { MainPane } from './components/MainPane'
import { ProjectsSidebar } from './components/ProjectsSidebar'
import { SessionsSidebar } from './components/SessionsSidebar'
import { projectNameForPath } from './data/tree'
import { useProjectTree } from './hooks/useProjectTree'

/**
 * The three panes, and the one thing two of them share: the tree. The sidebar
 * browses and mutates it, the main pane shows whichever file is selected in it,
 * so the hook is called here — the nearest place both can see.
 */
export default function App() {
  const tree = useProjectTree()

  useEffect(() => {
    const projectName = tree.selectedPath ? projectNameForPath(tree.nodes, tree.selectedPath) : null
    document.title = projectName ? `${projectName} — MaestroPulse` : 'MaestroPulse'
  }, [tree.nodes, tree.selectedPath])

  return (
    <div className="app">
      <ProjectsSidebar tree={tree} />
      <MainPane nodes={tree.nodes} selectedPath={tree.selectedPath} updateAgent={tree.updateAgent} />
      <SessionsSidebar />
    </div>
  )
}
