import { useCallback, useEffect, useState } from 'react'
import * as api from '../data/api'

type State = { content: string | null; error: string | null; loading: boolean }

/**
 * An agent's own `agent.md`: fetch, a quiet reload (driven by the caller's
 * `treeVersion`, same convention `useAgentProfile` uses for `agent.json`),
 * and a `save` for the view's own "Edit" button — writes straight through
 * `api.updateAgentInstructions` and updates local state directly, the same
 * reasoning `useAgentProfile`'s debounced slider `update` already uses:
 * this is the view's own copy, no tree round-trip needed to see its own edit.
 *
 * Not `useFileContent`: that has no exposed reload or write path, so it
 * cannot drive a reload-after-edit here.
 */
export function useAgentInstructions(path: string) {
  const [state, setState] = useState<State>({ content: null, error: null, loading: true })

  const reload = useCallback(
    async (quiet = false) => {
      if (!quiet) setState((prev) => ({ ...prev, loading: true }))
      try {
        const content = await api.fetchFile(api.agentInstructionsPath(path))
        setState({ content, error: null, loading: false })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        // An agent created before `agent.md` existed has none yet — that is
        // not a failure, just nothing written down so far.
        if (api.isMissingFileError(message)) {
          setState({ content: '', error: null, loading: false })
        } else {
          setState({ content: null, error: message, loading: false })
        }
      }
    },
    [path],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    async (next: string) => {
      await api.updateAgentInstructions(path, next)
      setState({ content: next, error: null, loading: false })
    },
    [path],
  )

  return { ...state, reload, save }
}
