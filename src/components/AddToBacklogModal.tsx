import { useState } from 'react'
import { Modal } from './Modal'

type Props = {
  /** The workflow's own path, e.g. `<project>/workflows/<name>`. */
  path: string
  onCancel: () => void
}

/**
 * Purely instructional: this never talks to the API itself. It builds the
 * `add-to-backlog` skill URL for the workflow currently open and hands the
 * user a block of text to paste into an external AI harness (e.g. Claude
 * Code), which is what actually fetches the skill and creates the card.
 */
export function AddToBacklogModal({ path, onCancel }: Props) {
  const [copied, setCopied] = useState(false)

  // A workflow's path is always `<projectPath>/workflows/<name>` — exactly
  // two fixed segments below its project, however deep that project itself
  // sits under organizational folders — see `isWorkflowsFolder` in
  // `src/data/tree.ts`. That means the project is fully determined by
  // `path`, so the server derives it the same way instead of being told —
  // see `getAddToBacklogSkill` in server/index.mjs.
  const origin = window.location.origin
  const skillUrl = `${origin}/skills/add-to-backlog?path=${encodeURIComponent(path)}`

  // Naming curl heads off a wasted web-fetch attempt against a localhost URL;
  // "or equivalent" keeps it correct where curl isn't installed.
  const instructions = `curl (or equivalent): ${skillUrl}`

  const copy = async () => {
    await navigator.clipboard.writeText(instructions)
    setCopied(true)
  }

  return (
    <Modal title="Add a backlog ticket" onCancel={onCancel}>
      <p className="modal__message">
        Paste the block below into a running AI harness (e.g. Claude Code). It will
        fetch its instructions and ask you what the ticket should say before creating it.
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
