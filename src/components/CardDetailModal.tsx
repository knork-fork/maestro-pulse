import type { WorkflowCard } from '../data/api'
import { SafeMarkdown } from '../views/MarkdownView'
import { Modal } from './Modal'

type Props = { card: WorkflowCard; onCancel: () => void }

/**
 * Read-only: cards can't be edited from the board, so this is just a bigger
 * look at one. "Last activity" and "Attached" share the same unboxed,
 * dashed-pill treatment: a single-line fact rather than the bordered prose
 * block Description gets. "Issues" is a plain list instead — a pill per row
 * reads as too much whitespace for what's often several short lines; a
 * solved issue is struck through rather than removed, so the history stays
 * visible. "Attached" is a list, not prose — it will hold attached URLs once
 * something produces them; there is no schema field for that yet, so it
 * renders as a list with nothing in it rather than a sentence about it.
 */
export function CardDetailModal({ card, onCancel }: Props) {
  return (
    <Modal title={card.title} wide onCancel={onCancel}>
      <p className="card-detail__meta">In {card.column}</p>

      <div className="card-detail__section">
        <h3 className="card-detail__section-title">Description</h3>
        <div className="markdown">
          <SafeMarkdown content={card.description} />
        </div>
      </div>

      <div className="card-detail__unboxed">
        <h3 className="card-detail__section-title">Issues</h3>
        {card.issues.length === 0 ? (
          <p className="card-detail__issues-empty">No issues yet.</p>
        ) : (
          <ul className="card-detail__issues">
            {card.issues.map((issue, i) => (
              <li
                key={i}
                title={issue.description || undefined}
                style={issue.is_solved ? { textDecoration: 'line-through' } : undefined}
              >
                {issue.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-detail__unboxed">
        <h3 className="card-detail__section-title">Last activity</h3>
        <p className="card-detail__pill">{card.last_activity ?? 'No activity yet.'}</p>
      </div>

      <div className="card-detail__unboxed">
        <h3 className="card-detail__section-title">Attached</h3>
        <ul className="card-detail__attachments">
          <li className="card-detail__pill">No links attached yet.</li>
        </ul>
      </div>

      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Close
        </button>
      </div>
    </Modal>
  )
}
