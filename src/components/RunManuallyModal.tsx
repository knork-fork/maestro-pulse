import { useState } from 'react'
import { Modal } from './Modal'

type Props = {
  path: string
  cardId: string
  onCancel: () => void
}

/**
 * Purely instructional, same as AddToBacklogModal: builds the run-manually
 * skill URL for the card currently open and hands the user a block of text
 * to paste into an external AI harness (e.g. Claude Code), which is what
 * actually fetches the skill and does the work.
 */
export function RunManuallyModal({ path, cardId, onCancel }: Props) {
  const [copied, setCopied] = useState(false)

  const origin = window.location.origin
  const skillUrl = `${origin}/skills/run-manually?path=${encodeURIComponent(path)}&card=${encodeURIComponent(cardId)}`
  const instructions = `curl (or equivalent): ${skillUrl}`

  const copy = async () => {
    await navigator.clipboard.writeText(instructions)
    setCopied(true)
  }

  return (
    <Modal title="Run this card manually" onCancel={onCancel}>
      <p className="modal__message">
        Paste the block below into a running AI harness (e.g. Claude Code). It will
        fetch everything it needs to pick up and execute this card's work.
      </p>
      <pre className="modal__code">{instructions}</pre>
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Close
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
      </div>
    </Modal>
  )
}
