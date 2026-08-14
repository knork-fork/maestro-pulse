import { useCallback, useEffect, useState } from 'react'
import type { TreeNode } from '../data/tree'
import * as api from '../data/api'
import type { ProjectDetails } from '../data/api'
import { usePersistentSet } from './usePersistentSet'

const EXPANDED_STORAGE_KEY = 'maestro-pulse:tree-expanded'

/**
 * Owns the sidebar's tree: the nodes read from the API, and which rows are
 * expanded.
 *
 * Every mutation re-reads the tree rather than patching the local copy — the
 * filesystem is the source of truth, and it can change without us. Expansion is
 * kept in step by hand (a rename moves a subtree's paths, a delete retires
 * them), so a reload never silently collapses what the user had open.
 *
 * The mutations reject on failure, deliberately: the control that started one
 * reports it in place (see `useAsyncAction`). Only `reload` reports through
 * `error`, since no one control asked for it.
 */
export function useProjectTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = usePersistentSet(EXPANDED_STORAGE_KEY)
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

  const rename = useCallback(
    async (path: string, name: string) => {
      const next = await api.renameEntry(path, name)
      setExpanded((prev) => reparent(prev, path, next))
      await load()
    },
    [load, setExpanded],
  )

  const remove = useCallback(
    async (path: string) => {
      await api.deleteEntry(path)
      setExpanded((prev) => forget(prev, path))
      await load()
    },
    [load, setExpanded],
  )

  return {
    nodes,
    expanded,
    error,
    busy,
    loaded,
    reload,
    toggle,
    reveal,
    createFolder,
    createProject,
    rename,
    remove,
  }
}

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
