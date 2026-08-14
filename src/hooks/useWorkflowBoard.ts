import { useCallback, useEffect, useState } from 'react'
import * as api from '../data/api'
import type { WorkflowCard, WorkflowColumn } from '../data/api'

export type WorkflowBoard = {
  description: string
  columns: WorkflowColumn[]
  cards: WorkflowCard[]
  archived: WorkflowCard[]
}

/**
 * A workflow board's own data: fetch, reload, and the per-card move/delete/
 * archive mutations. Mirrors useProjectTree.ts's convention exactly — every
 * mutation is a callback that calls the api function then re-reads, because
 * the file is the source of truth and the server independently re-validates
 * each action's legality.
 *
 * Not useFileContent: that only re-fetches when its path argument changes,
 * with no exposed reload, so it cannot drive a reload-after-mutation loop
 * where the path (this workflow) stays constant across every card action.
 */
export function useWorkflowBoard(path: string) {
  const [board, setBoard] = useState<WorkflowBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const content = await api.fetchFile(api.workflowFilePath(path))
      const parsed = parseWorkflowBoard(content)
      if (!parsed) throw new Error("This workflow's board could not be read.")
      setBoard(parsed)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  const moveUp = useCallback(
    async (cardId: string) => {
      await api.moveCardUp(path, cardId)
      await reload()
    },
    [path, reload],
  )
  const moveDown = useCallback(
    async (cardId: string) => {
      await api.moveCardDown(path, cardId)
      await reload()
    },
    [path, reload],
  )
  const moveRight = useCallback(
    async (cardId: string) => {
      await api.moveCardRight(path, cardId)
      await reload()
    },
    [path, reload],
  )
  const remove = useCallback(
    async (cardId: string) => {
      await api.deleteCard(path, cardId)
      await reload()
    },
    [path, reload],
  )
  const archive = useCallback(
    async (cardId: string) => {
      await api.archiveCard(path, cardId)
      await reload()
    },
    [path, reload],
  )

  return { board, error, loading, reload, moveUp, moveDown, moveRight, remove, archive }
}

/**
 * `workflow.json`'s full shape, as written by scaffoldWorkflow/
 * updateWorkflowCard. Missing or malformed `cards`/`archived` default to
 * `[]` — the same forgiving read WorkflowDialog.tsx's parseWorkflowFile
 * already applies to columns.
 */
function parseWorkflowBoard(content: string): WorkflowBoard | null {
  try {
    const parsed = JSON.parse(content) as {
      description?: unknown
      columns?: unknown
      cards?: unknown
      archived?: unknown
    }
    if (typeof parsed.description !== 'string' || !Array.isArray(parsed.columns)) return null

    const columns: WorkflowColumn[] = []
    for (const entry of parsed.columns) {
      const column = entry as { name?: unknown; agent?: unknown }
      if (typeof column.name !== 'string') return null
      columns.push({ name: column.name, agent: typeof column.agent === 'string' ? column.agent : null })
    }

    return {
      description: parsed.description,
      columns,
      cards: parseCards(parsed.cards),
      archived: parseCards(parsed.archived),
    }
  } catch {
    return null
  }
}

const parseCards = (value: unknown): WorkflowCard[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const card = entry as { id?: unknown; title?: unknown; description?: unknown; column?: unknown }
        return typeof card.id === 'string' && typeof card.title === 'string' && typeof card.column === 'string'
          ? [
              {
                id: card.id,
                title: card.title,
                description: typeof card.description === 'string' ? card.description : '',
                column: card.column,
              },
            ]
          : []
      })
    : []
