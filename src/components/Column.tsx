import type { WorkflowCard, WorkflowColumn } from '../data/api'
import { Card } from './Card'
import { classes } from './classes'

type Props = {
  column: WorkflowColumn
  /** Backlog, by position. */
  isFirst: boolean
  /** Done, by position. */
  isLast: boolean
  /** Already filtered to this column and in on-disk order. */
  cards: WorkflowCard[]
  onOpen: (card: WorkflowCard) => void
  onDelete: (card: WorkflowCard) => void
  onArchive: (card: WorkflowCard) => Promise<void>
  onMoveUp: (card: WorkflowCard) => Promise<void>
  onMoveDown: (card: WorkflowCard) => Promise<void>
  onMoveRight: (card: WorkflowCard) => Promise<void>
}

/**
 * One column: bot vs. human is the single `agent != null` predicate, which
 * covers the fixed Ready column and any custom bot column identically.
 * Per-card move legality is computed here from this column's own card order
 * — for disabling buttons only; the server independently re-derives and
 * enforces the same rule on every request.
 */
export function Column({
  column,
  isFirst,
  isLast,
  cards,
  onOpen,
  onDelete,
  onArchive,
  onMoveUp,
  onMoveDown,
  onMoveRight,
}: Props) {
  const isBot = column.agent != null
  // An agent's display name is its directory name, which is also the last
  // segment of its path — no separate lookup needed for the card avatar.
  const agentName = column.agent ? column.agent.split('/').pop() || column.agent : null

  return (
    <div className={classes(['column', isBot ? 'column--bot' : 'column--human'])}>
      <div className="column__header">
        {isBot && (
          <span className="column__bot-icon" aria-hidden="true">
            🤖
          </span>
        )}
        <span className="column__name">{column.name}</span>
      </div>

      <ul className="column__cards">
        {cards.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            agentName={agentName}
            isBacklog={isFirst}
            isDone={isLast}
            canMoveUp={index > 0}
            canMoveDown={index < cards.length - 1}
            canMoveRight={!isBot && !isLast}
            onOpen={() => onOpen(card)}
            onDelete={() => onDelete(card)}
            onArchive={() => onArchive(card)}
            onMoveUp={() => onMoveUp(card)}
            onMoveDown={() => onMoveDown(card)}
            onMoveRight={() => onMoveRight(card)}
          />
        ))}
      </ul>
    </div>
  )
}
