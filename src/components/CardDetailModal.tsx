import { useState } from 'react'
import type { WorkflowCard } from '../data/api'
import { SafeMarkdown } from '../views/MarkdownView'
import { AttachmentViewModal } from './AttachmentViewModal'
import { Modal } from './Modal'

type Props = {
  card: WorkflowCard
  bot: boolean
  /** The board's own workflow path — `attachments` entries are stored
   *  project-relative, not workflow-relative, so this is what recovers the
   *  project prefix `api.fetchFile` needs (see `projectPathOf`). */
  workflowPath: string
  onCancel: () => void
  onRunManually: () => void
}

/** Which kind an `attachments` entry is is never stored separately — only
 *  inferred from its own text, the same predicate `isUrlAttachment` in
 *  server/index.mjs uses server-side. */
const isUrlAttachment = (value: string) => /^https?:\/\//i.test(value)

/** A workflow's path is always `<project>/workflows/<name>` — exactly two
 *  fixed segments below its project, the same rule
 *  AddToBacklogModal/RunManuallyModal already rely on for their own skill
 *  URLs, and `server/index.mjs` uses server-side to derive the same thing. */
const projectPathOf = (workflowPath: string) => workflowPath.split('/').slice(0, -2).join('/')

/**
 * Read-only: cards can't be edited from the board, so this is just a bigger
 * look at one. "Last activity" and "Attached"'s empty state share the same
 * unboxed, dashed-pill treatment: a single-line fact rather than the bordered
 * prose block Description gets. "Issues" is a plain list instead — a pill per
 * row reads as too much whitespace for what's often several short lines; a
 * solved issue is struck through rather than removed, so the history stays
 * visible. "Attached" is a list, not prose: a URL entry is a plain external
 * link, a file entry opens `AttachmentViewModal` for a rendered look plus a
 * raw-copy button — the array is grown only by the `manage-card-attachments`
 * common tool's `attach` subcommand, and an attachment file's own content is
 * only ever edited directly on disk by whatever harness created it; the
 * browser never writes either.
 */
export function CardDetailModal({ card, bot, workflowPath, onCancel, onRunManually }: Props) {
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null)
  const projectPath = projectPathOf(workflowPath)

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
        {card.attachments.length === 0 ? (
          <p className="card-detail__pill">No attachments yet.</p>
        ) : (
          <ul className="card-detail__attachments">
            {card.attachments.map((attachment) => (
              <li key={attachment}>
                {isUrlAttachment(attachment) ? (
                  <a
                    className="card-detail__attachment"
                    href={attachment}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {attachment}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="card-detail__attachment"
                    onClick={() => setViewingAttachment(`${projectPath}/${attachment}`)}
                  >
                    {attachment.split('/').pop()}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal__actions">
        <button
          type="button"
          className="btn"
          disabled={!bot}
          title={bot ? undefined : 'Only available for cards in a bot column'}
          onClick={onRunManually}
        >
          Run manually
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Close
        </button>
      </div>

      {viewingAttachment && (
        <AttachmentViewModal path={viewingAttachment} onCancel={() => setViewingAttachment(null)} />
      )}
    </Modal>
  )
}
