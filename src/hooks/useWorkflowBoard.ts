import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../data/api'
import type { WorkflowCard, WorkflowColumn } from '../data/api'

export type WorkflowBoard = {
  description: string
  columns: WorkflowColumn[]
  cards: WorkflowCard[]
  archived: WorkflowCard[]
}

const POLL_INTERVAL_MS = 60_000

const boardsEqual = (a: WorkflowBoard, b: WorkflowBoard): boolean => JSON.stringify(a) === JSON.stringify(b)

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
  const boardRef = useRef<WorkflowBoard | null>(null)

  const reload = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const content = await api.fetchFile(api.workflowFilePath(path))
        const parsed = parseWorkflowBoard(content)
        if (!parsed) throw new Error("This workflow's board could not be read.")
        if (!quiet || !boardRef.current || !boardsEqual(boardRef.current, parsed)) {
          boardRef.current = parsed
          setBoard(parsed)
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

  /** Keeps the board in sync with changes made elsewhere (another actor, a
   *  bot column) while the view sits open — quiet, so it never flashes
   *  "Loading…", and it only re-renders when something actually moved. */
  useEffect(() => {
    const id = setInterval(() => void reload(true), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [reload])

  /** Guards a move against a card that's moved out from under the user since
   *  they saw `expectedColumn` — the server would otherwise happily validate
   *  the action against whatever column the card is actually in now. */
  const guardColumn = useCallback(
    async (cardId: string, expectedColumn: string) => {
      const content = await api.fetchFile(api.workflowFilePath(path))
      const parsed = parseWorkflowBoard(content)
      const card = parsed?.cards.find((entry) => entry.id === cardId)
      if (!card || card.column !== expectedColumn) {
        throw new Error('This card has moved — refresh and try again.')
      }
    },
    [path],
  )

  const moveUp = useCallback(
    async (cardId: string, expectedColumn: string) => {
      await guardColumn(cardId, expectedColumn)
      await api.moveCardUp(path, cardId)
      await reload()
    },
    [path, reload, guardColumn],
  )
  const moveDown = useCallback(
    async (cardId: string, expectedColumn: string) => {
      await guardColumn(cardId, expectedColumn)
      await api.moveCardDown(path, cardId)
      await reload()
    },
    [path, reload, guardColumn],
  )
  const moveRight = useCallback(
    async (cardId: string, expectedColumn: string) => {
      await guardColumn(cardId, expectedColumn)
      await api.moveCardRight(path, cardId)
      await reload()
    },
    [path, reload, guardColumn],
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
      const column = entry as { name?: unknown; bot?: unknown }
      if (typeof column.name !== 'string') return null
      columns.push({ name: column.name, bot: column.bot === true })
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
        const card = entry as {
          id?: unknown
          title?: unknown
          description?: unknown
          column?: unknown
          assigned?: unknown
          status?: unknown
          last_activity?: unknown
        }
        return typeof card.id === 'string' && typeof card.title === 'string' && typeof card.column === 'string'
          ? [
              {
                id: card.id,
                title: card.title,
                description: typeof card.description === 'string' ? card.description : '',
                column: card.column,
                assigned: typeof card.assigned === 'string' ? card.assigned : null,
                status: card.status === 'in_session' || card.status === 'blocked' ? card.status : null,
                last_activity: typeof card.last_activity === 'string' ? card.last_activity : null,
              },
            ]
          : []
      })
    : []
