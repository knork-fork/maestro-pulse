import { useEffect, useState } from 'react'

/**
 * A Set of strings mirrored to localStorage, so the value survives reloads.
 * Storage access is guarded: private-mode / disabled-storage browsers throw on
 * read or write, and there the set simply behaves as in-memory state.
 */
export function usePersistentSet(storageKey: string) {
  const [value, setValue] = useState<Set<string>>(() => read(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...value]))
    } catch {
      /* storage unavailable or full — keep working in memory */
    }
  }, [storageKey, value])

  return [value, setValue] as const
}

function read(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return new Set()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    return new Set()
  }
}
