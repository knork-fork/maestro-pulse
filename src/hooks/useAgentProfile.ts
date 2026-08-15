import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../data/api'
import type { AgentData } from '../data/agent'
import { parseAgentFile } from '../data/agent'

const SAVE_DEBOUNCE_MS = 400

/**
 * An agent's own `agent.json`: fetch, a quiet reload driven by the caller's
 * `treeVersion` (the same convention useWorkflowBoard/KanbanBoard use, since
 * editing an agent from the sidebar's dialog only reloads the tree, not this
 * view — see KanbanBoard.tsx's own doc comment), and a debounced save for the
 * sliders dragged directly in the view.
 *
 * Not useFileContent: that only re-fetches when its path argument changes,
 * with no exposed reload or write path, so it cannot drive a reload-after-
 * edit or a save-as-you-drag loop where the path (this agent) stays constant.
 */
export function useAgentProfile(path: string) {
  const [data, setData] = useState<AgentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const dataRef = useRef<AgentData | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** True between a slider moving and its debounced save actually firing —
   *  checked by `reload` (so a background tree reload can't clobber an edit
   *  still mid-drag) and by the unmount cleanup below (so switching files
   *  right after dragging doesn't just drop it). */
  const pendingSave = useRef(false)

  const reload = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const content = await api.fetchFile(api.agentFilePath(path))
        const parsed = parseAgentFile(content)
        if (!parsed) throw new Error("This agent's data could not be read.")
        if (!quiet || !pendingSave.current) {
          dataRef.current = parsed
          setData(parsed)
        }
        setError(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [path],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * Flushes rather than drops a pending save when this view goes away (e.g.
   * the user picks another file right after dragging a slider) — debouncing
   * is meant to cut down requests while dragging, not to lose the last one.
   */
  const flush = useCallback(() => {
    if (!pendingSave.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    pendingSave.current = false
    const current = dataRef.current
    if (current) void api.updateAgent(path, current)
  }, [path])

  useEffect(() => flush, [flush])

  /**
   * Applies a partial change (one slider moving) immediately so the control
   * feels responsive, and persists it debounced so dragging doesn't fire a
   * request per pixel — only once dragging pauses for a beat.
   */
  const update = useCallback(
    (changes: Partial<AgentData>) => {
      setData((current) => {
        if (!current) return current
        const next = { ...current, ...changes }
        dataRef.current = next
        return next
      })

      pendingSave.current = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        pendingSave.current = false
        const current = dataRef.current
        if (current) void api.updateAgent(path, current)
      }, SAVE_DEBOUNCE_MS)
    },
    [path],
  )

  return { data, error, loading, reload, update }
}
