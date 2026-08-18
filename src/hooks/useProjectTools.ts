import { useEffect, useState } from 'react'
import * as api from '../data/api'
import type { ToolData } from '../data/tool'
import { parseToolFile } from '../data/tool'
import type { TreeNode } from '../data/tree'
import { locate } from '../data/tree'

export type ToolCatalogEntry = ToolData & {
  /** Project-relative — the same form `agent.json`'s own `tools` array
   *  stores, e.g. `"tools/read-from-trello"`. */
  path: string
}

/**
 * The full catalog of tools defined in an agent's own project — every
 * subfolder of that project's `tools/` directory that has a `tool.json`,
 * read straight off the already-loaded tree rather than a dedicated
 * endpoint (the same pattern `ProjectsSidebar.tsx`'s `agentsFor` uses for a
 * workflow's assignable agents). Used both to resolve an agent's already-
 * selected tools (`AgentData.tools`) to their name/icon, and to list what
 * else is available to pick in `AgentToolsModal`.
 *
 * A project created before `tools/` existed, or with nothing in it yet,
 * resolves to an empty catalog rather than an error — the tree just won't
 * have that folder, or it'll have no children.
 */
export function useProjectTools(nodes: TreeNode[], agentPath: string) {
  const [tools, setTools] = useState<ToolCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      // An agent's path is always `<project>/agents/<name>`.
      const projectPath = agentPath.split('/').slice(0, -2).join('/')
      const found = locate(nodes, `${projectPath}/tools`)
      const toolsFolder = found && found.node.type !== 'file' ? found.node : null
      const children = toolsFolder ? toolsFolder.children.filter((child) => child.type !== 'file') : []

      const entries = await Promise.all(
        children.map(async (child): Promise<ToolCatalogEntry> => {
          const relativePath = child.path.slice(projectPath.length + 1)
          try {
            const content = await api.fetchFile(`${child.path}/tool.json`)
            const parsed = parseToolFile(content)
            // A missing/wrong-typed `title` still falls back to the folder's
            // own name, same as a missing tool.json entirely.
            if (parsed) return { ...parsed, title: parsed.title || child.name, path: relativePath }
          } catch {
            /* missing/unreadable tool.json — fall through to the fallback */
          }

          return { path: relativePath, title: child.name, description: '', icon: null }
        }),
      )

      if (!cancelled) {
        setTools(entries)
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [nodes, agentPath])

  return { tools, loading }
}

/**
 * The catalog of tools available to every project by default — read from a
 * dedicated endpoint rather than the tree, since these live outside
 * `resources/projects` entirely (see COMMON_TOOLS_ROOT in
 * `server/index.mjs`). Always rendered forced-on wherever an agent's own
 * `catalog` (above) is rendered — never selected/deselected, never stored in
 * `agent.json`'s `tools`. `nodes` is only a reload trigger (e.g. the
 * sidebar's refresh button), the same role it plays for `useProjectTools`.
 */
export function useCommonTools(nodes: TreeNode[]) {
  const [tools, setTools] = useState<ToolCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    api
      .fetchCommonTools()
      .then((entries) => {
        if (!cancelled) setTools(entries)
      })
      .catch(() => {
        if (!cancelled) setTools([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nodes])

  return { tools, loading }
}
