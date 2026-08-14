import { useEffect, useState } from 'react'
import * as api from '../data/api'

type State = { content: string | null; error: string | null; loading: boolean }

const IDLE: State = { content: null, error: null, loading: false }

/**
 * Reads the file at `path`, or nothing when there is none.
 *
 * Not `useAsyncAction`: that runs one action a control started and reports it in
 * place, and cannot carry a value out. This is a read keyed by a path, which
 * brings the one thing the rest of the app never had to think about — two reads
 * in flight at once. Clicking a second file while the first is still loading must
 * not paint the first one's text under the second one's name, so a resolution
 * that has been superseded is dropped.
 *
 * It re-reads only when the path changes. A file edited on disk under an open
 * view therefore keeps showing what it said when it was opened.
 */
export function useFileContent(path: string | null): State {
  const [state, setState] = useState<State>(IDLE)

  useEffect(() => {
    if (path === null) {
      setState(IDLE)
      return
    }

    let current = true
    setState({ content: null, error: null, loading: true })

    api.fetchFile(path).then(
      (content) => current && setState({ content, error: null, loading: false }),
      (cause: unknown) =>
        current &&
        setState({
          content: null,
          error: cause instanceof Error ? cause.message : String(cause),
          loading: false,
        }),
    )

    return () => {
      current = false
    }
  }, [path])

  return state
}
