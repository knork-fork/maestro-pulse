import { useEffect, useState } from 'react'
import * as api from '../data/api'
import { SafeMarkdown } from '../views/MarkdownView'
import { Modal } from './Modal'

type Props = {
  /** Project-relative path, e.g. `"<project>/attachments/<timestamp>-name.md"`. */
  path: string
  onCancel: () => void
}

/**
 * A card's md attachment, rendered — fetched the same way any tree file is
 * (`api.fetchFile`), through the same `SafeMarkdown` the card's own
 * Description already renders with. "Copy raw to clipboard" copies the
 * fetched text as-is, not the rendered DOM, mirroring
 * AddToBacklogModal/RunManuallyModal's copy-button + "Copied" toggle.
 */
export function AttachmentViewModal({ path, onCancel }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(null)
    api.fetchFile(path).then(
      (text) => {
        if (!cancelled) setContent(text)
      },
      (cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      },
    )
    return () => {
      cancelled = true
    }
  }, [path])

  const copy = async () => {
    if (content === null) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
  }

  return (
    <Modal title={path.split('/').pop() ?? path} wide className="modal__panel--attachment" onCancel={onCancel}>
      {error && (
        <p className="modal__message" role="alert">
          {error}
        </p>
      )}
      {content === null && !error && <p className="modal__message">Loading…</p>}
      {content !== null && (
        <div className="markdown">
          <SafeMarkdown content={content} />
        </div>
      )}

      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Close
        </button>
        <button type="button" className="btn btn--primary" disabled={content === null} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy raw to clipboard'}
        </button>
      </div>
    </Modal>
  )
}
