import { useCallback, useState } from 'react'

/**
 * Runs one user-triggered async action, holding its pending flag and its
 * failure message so the control that started it can report both in place.
 * Resolves to whether it succeeded, which is what callers branch on — a failed
 * dialog or draft row stays open with its error showing.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<void>) => {
    setPending(true)
    setError(null)

    try {
      await action()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  return { pending, error, run }
}
