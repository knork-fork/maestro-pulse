import { useCallback, useEffect, useState } from 'react'
import type { TreeNode } from '../data/tree'
import * as api from '../data/api'
import type { AgentEdits, NewAgentDetails, NewWorkflowDetails, ProjectDetails, WorkflowEdits } from '../data/api'
import { usePersistentSet } from './usePersistentSet'

const EXPANDED_STORAGE_KEY = 'maestro-pulse:tree-expanded'

/**
 * Owns the tree both panes read: the nodes from the API, which rows are expanded,
 * and which file is selected.
 *
 * Every mutation re-reads the tree rather than patching the local copy — the
 * filesystem is the source of truth, and it can change without us. Expansion and
 * the selection are kept in step by hand (a rename moves a subtree's paths, a
 * delete retires them), so a reload never silently collapses what the user had
 * open or blanks the file they were reading.
 *
 * Only changes made *through here* need that upkeep. For anything else — an edit
 * on disk, or the refresh button — a selected path that has gone simply stops
 * resolving against `nodes`, and the pane falls back to its empty state on its
 * own. That is why there is no cleanup effect to be found.
 *
 * The mutations reject on failure, deliberately: the control that started one
 * reports it in place (see `useAsyncAction`). Only `reload` reports through
 * `error`, since no one control asked for it.
 */
export function useProjectTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = usePersistentSet(EXPANDED_STORAGE_KEY)
  /**
   * Deliberately not persisted: reopening the app onto a file the user did not
   * ask for is worse than reopening onto nothing.
   */
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Distinguishes "nothing read yet" from "nothing there", for the empty state. */
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setNodes(await api.fetchTree())
    setLoaded(true)
  }, [])

  const reload = useCallback(async () => {
    setBusy(true)
    try {
      await load()
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [load])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggle = useCallback(
    (path: string) =>
      setExpanded((prev) => {
        const next = new Set(prev)
        if (!next.delete(path)) next.add(path)
        return next
      }),
    [setExpanded],
  )

  /** Opens the way down to a path, so a row inside it can be seen. */
  const reveal = useCallback(
    (path: string) => setExpanded((prev) => new Set([...prev, ...selfAndAncestors(path)])),
    [setExpanded],
  )

  const createFolder = useCallback(
    async (parentPath: string, name: string) => {
      await api.createFolder(parentPath, name)
      await load()
    },
    [load],
  )

  const createProject = useCallback(
    async (parentPath: string, details: ProjectDetails) => {
      await api.createProject(parentPath, details)
      // Named in a dialog rather than in the tree, so the parent may still be
      // shut — open it, or the project the user just made is nowhere to be seen.
      reveal(parentPath)
      await load()
    },
    [load, reveal],
  )

  const createWorkflow = useCallback(
    async (parentPath: string, details: NewWorkflowDetails) => {
      await api.createWorkflow(parentPath, details)
      // Named in a dialog rather than in the tree, so the parent may still be
      // shut — open it, or the workflow the user just made is nowhere to be seen.
      reveal(parentPath)
      await load()
    },
    [load, reveal],
  )

  const updateWorkflow = useCallback(
    async (path: string, edits: WorkflowEdits) => {
      await api.updateWorkflow(path, edits)
      // Unlike rename, a workflow's path never changes here — its name is
      // fixed after creation, so expansion/selection need no bookkeeping.
      await load()
    },
    [load],
  )

  const createAgent = useCallback(
    async (parentPath: string, details: NewAgentDetails) => {
      await api.createAgent(parentPath, details)
      // Named in a dialog rather than in the tree, so the parent may still be
      // shut — open it, or the agent the user just made is nowhere to be seen.
      reveal(parentPath)
      await load()
    },
    [load, reveal],
  )

  const updateAgent = useCallback(
    async (path: string, edits: AgentEdits) => {
      await api.updateAgent(path, edits)
      // Unlike rename, an agent's path never changes here — its name is
      // fixed after creation, so expansion/selection need no bookkeeping.
      await load()
    },
    [load],
  )

  const rename = useCallback(
    async (path: string, name: string) => {
      const next = await api.renameEntry(path, name)
      setExpanded((prev) => reparent(prev, path, next))
      // Renaming a folder moves everything under it, the open file included.
      setSelectedPath((prev) => (prev && isWithin(prev, path) ? next + prev.slice(path.length) : prev))
      await load()
    },
    [load, setExpanded],
  )

  const remove = useCallback(
    async (path: string) => {
      await api.deleteEntry(path)
      setExpanded((prev) => forget(prev, path))
      setSelectedPath((prev) => (prev && isWithin(prev, path) ? null : prev))
      await load()
    },
    [load, setExpanded],
  )

  return {
    nodes,
    expanded,
    selectedPath,
    error,
    busy,
    loaded,
    reload,
    toggle,
    select: setSelectedPath,
    reveal,
    createFolder,
    createProject,
    createWorkflow,
    updateWorkflow,
    createAgent,
    updateAgent,
    rename,
    remove,
  }
}

/** What the panes share, for whoever is handed it rather than calling the hook. */
export type ProjectTreeState = ReturnType<typeof useProjectTree>

/** `a/b/c` → `a`, `a/b`, `a/b/c`; the root (empty path) has no ancestors. */
const selfAndAncestors = (path: string): string[] => {
  if (!path) return []

  const segments = path.split('/')
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}

const isWithin = (candidate: string, path: string) =>
  candidate === path || candidate.startsWith(`${path}/`)

const reparent = (paths: Set<string>, from: string, to: string) =>
  new Set([...paths].map((path) => (isWithin(path, from) ? to + path.slice(from.length) : path)))

const forget = (paths: Set<string>, path: string) =>
  new Set([...paths].filter((candidate) => !isWithin(candidate, path)))
