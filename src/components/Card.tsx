import type { WorkflowCard } from '../data/api'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { CardMoveMenu } from './CardMoveMenu'
import { classes } from './classes'
import { ArchiveIcon, TrashIcon } from './icons'

type Props = {
  card: WorkflowCard
  /** The bot column's agent name, or `null` for a human column — the
   *  avatar's only input; there is no per-card assignee. */
  agentName: string | null
  isBacklog: boolean
  isDone: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canMoveRight: boolean
  onOpen: () => void
  /** Opens the delete confirmation — the actual removal lives with the
   *  dialog that asks for it, one level up. */
  onDelete: () => void
  onArchive: () => Promise<void>
  onMoveUp: () => Promise<void>
  onMoveDown: () => Promise<void>
  onMoveRight: () => Promise<void>
}

/**
 * One card's face: title, an avatar slot filled only when its column is a
 * bot column, and a hover-revealed actions row. Delete only shows in
 * Backlog, archive only in Done, and the joystick everywhere except Done —
 * all three hardcoded by the column's position, not its name.
 */
export function Card({
  card,
  agentName,
  isBacklog,
  isDone,
  canMoveUp,
  canMoveDown,
  canMoveRight,
  onOpen,
  onDelete,
  onArchive,
  onMoveUp,
  onMoveDown,
  onMoveRight,
}: Props) {
  const { pending, error, run } = useAsyncAction()

  return (
    <li className="card">
      <div className={classes(['card__avatar', agentName && 'card__avatar--bot'])}>
        {agentName && <span className="card__avatar-initials">{initials(agentName)}</span>}
      </div>

      <button type="button" className="card__title" onClick={onOpen}>
        {card.title}
      </button>

      <div className="card__actions">
        {!isDone && (
          <CardMoveMenu
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            canMoveRight={canMoveRight}
            disabled={pending}
            onMoveUp={() => void run(onMoveUp)}
            onMoveDown={() => void run(onMoveDown)}
            onMoveRight={() => void run(onMoveRight)}
          />
        )}

        {isBacklog && (
          <button
            type="button"
            className="icon-btn icon-btn--sm card__delete"
            title="Delete card"
            aria-label="Delete card"
            disabled={pending}
            onClick={onDelete}
          >
            <TrashIcon />
          </button>
        )}

        {isDone && (
          <button
            type="button"
            className="icon-btn icon-btn--sm card__archive"
            title="Archive card"
            aria-label="Archive card"
            disabled={pending}
            onClick={() => void run(onArchive)}
          >
            <ArchiveIcon />
          </button>
        )}
      </div>

      {error && (
        <p className="card__error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

/** A Trello-style avatar: the agent's initials, not an icon — one letter
 *  per the first two words, or the first two letters of a single word. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
