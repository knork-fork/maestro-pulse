import type { FileViewProps } from './registry'

/**
 * A file shown as its own text, unrendered — for markdown that isn't README.md
 * (e.g. `agent.md`, a system prompt meant to be read/edited as source, not
 * previewed). `MarkdownView` stays the one renderer of *rendered* markdown.
 */
export function RawTextView({ content }: FileViewProps) {
  return (
    <pre className="raw-text">{content}</pre>
  )
}
