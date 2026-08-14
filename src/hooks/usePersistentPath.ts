import { useEffect, useState } from 'react'

/**
 * A single nullable string mirrored to localStorage, so the value survives
 * reloads. Storage access is guarded: private-mode / disabled-storage
 * browsers throw on read or write, and there the value simply behaves as
 * in-memory state.
 */
export function usePersistentPath(storageKey: string) {
  const [value, setValue] = useState<string | null>(() => read(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* storage unavailable or full — keep working in memory */
    }
  }, [storageKey, value])

  return [value, setValue] as const
}

function read(storageKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}
