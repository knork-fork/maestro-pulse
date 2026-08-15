import { useEffect, useRef, useState } from 'react'
import { agentInstructionsPath, isMissingFileError } from '../data/api'
import { AGENT_TEMPLATES } from '../data/agentTemplates'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useFileContent } from '../hooks/useFileContent'
import { Menu, anchorFromRect } from './Menu'
import type { MenuAnchor } from './Menu'
import { Modal } from './Modal'

type Props = {
  path: string
  onSave: (instructions: string) => Promise<void>
  onCancel: () => void
}

/**
 * Edits an agent's `agent.md` — raw markdown, not rendered while editing.
 * Self-loads the current content the same way `AgentDialog`'s edit path
 * loads `agent.json`, so either entry point (the agent view's own "Edit"
 * button, or the tree's "Edit instructions" row) can open this with just a
 * path.
 */
export function AgentInstructionsModal({ path, onSave, onCancel }: Props) {
  const { content, error, loading } = useFileContent(agentInstructionsPath(path))
  const [text, setText] = useState<string | null>(null)
  const [templatesAnchor, setTemplatesAnchor] = useState<MenuAnchor | null>(null)
  const templatesRef = useRef<HTMLButtonElement>(null)
  const { pending, error: saveError, run } = useAsyncAction()

  // An agent created before `agent.md` existed has none yet — that opens the
  // editor empty rather than as an error; saving creates the file.
  const missing = error !== null && isMissingFileError(error)

  useEffect(() => {
    if (content !== null) setText(content)
    else if (missing) setText('')
  }, [content, missing])

  const toggleTemplates = () =>
    setTemplatesAnchor((prev) => {
      if (prev) return null
      const rect = templatesRef.current?.getBoundingClientRect()
      return rect ? anchorFromRect(rect) : null
    })

  if (loading) {
    return (
      <Modal title="Edit instructions" wide className="modal__panel--instructions" onCancel={onCancel}>
        <p className="empty-state">Loading…</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Modal>
    )
  }

  if ((error && !missing) || text === null) {
    return (
      <Modal title="Edit instructions" wide className="modal__panel--instructions" onCancel={onCancel}>
        <p className="modal__error">{error ?? "This agent's instructions could not be read."}</p>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Edit instructions" wide className="modal__panel--instructions" onCancel={onCancel}>
      <p className="modal__message">
        This becomes the agent's system and personalization prompt — its role,
        responsibilities, and any constraints it should follow. Pick a
        template below as a starting point, then adjust it for this agent.
      </p>
      <p className="modal__message">
        Tip: tone, verbosity, and autonomy don't belong here — they're already
        covered by this agent's Verbosity and Handholding sliders.
      </p>

      <div className="agent-instructions__toolbar">
        <button
          ref={templatesRef}
          type="button"
          className="btn"
          disabled={pending}
          onClick={toggleTemplates}
        >
          Templates
        </button>

        {templatesAnchor && (
          <Menu
            anchor={templatesAnchor}
            ignore={templatesRef}
            items={AGENT_TEMPLATES.map((template) => ({
              label: template.label,
              onSelect: () => setText(template.content),
            }))}
            onDismiss={() => setTemplatesAnchor(null)}
          />
        )}
      </div>

      <textarea
        className="modal__input modal__input--multiline modal__input--code"
        rows={16}
        value={text}
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
      />

      {saveError && <p className="modal__error">{saveError}</p>}

      <div className="modal__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending}
          onClick={() => void run(() => onSave(text))}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
