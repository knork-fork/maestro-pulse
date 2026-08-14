import type { ReactNode } from 'react'
import type { FileViewProps } from './registry'

/**
 * A JSON file, pretty-printed and coloured by what each value *is*.
 *
 * Built as React elements from the parsed value rather than by colourising
 * `JSON.stringify` output with regexes: the structure is already known after
 * parsing, so re-discovering it from text would be guesswork, and nothing here
 * ever needs `dangerouslySetInnerHTML`.
 *
 * A file that does not parse is still shown — as its own text, with the reason.
 * Refusing to display a malformed file is the one thing that makes it hard to fix.
 */
export function JsonView({ content }: FileViewProps) {
  let value: Json
  try {
    value = JSON.parse(content) as Json
  } catch (cause) {
    return (
      <div className="json">
        <p className="json__invalid" role="alert">
          Not valid JSON{cause instanceof Error ? `: ${cause.message}` : ''}
        </p>
        <pre className="json__body">{content}</pre>
      </div>
    )
  }

  return (
    <div className="json">
      <pre className="json__body">
        <Value value={value} depth={0} />
      </pre>
    </div>
  )
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

const INDENT = '  '

function Value({ value, depth }: { value: Json; depth: number }): ReactNode {
  if (value === null) return <span className="json__null">null</span>
  if (typeof value === 'boolean') return <span className="json__boolean">{String(value)}</span>
  if (typeof value === 'number') return <span className="json__number">{String(value)}</span>
  // Back through JSON so escapes and quotes read exactly as they do on disk.
  if (typeof value === 'string') {
    return <span className="json__string">{JSON.stringify(value)}</span>
  }

  const entries: Entry[] = Array.isArray(value)
    ? value.map((item, index) => ({ id: String(index), value: item }))
    : Object.entries(value).map(([key, item]) => ({ id: key, key, value: item }))

  return (
    <Block open={Array.isArray(value) ? '[' : '{'} entries={entries} depth={depth} />
  )
}

type Entry = { id: string; key?: string; value: Json }

const CLOSING = { '[': ']', '{': '}' } as const

/** One `{…}` or `[…]`, laid out over as many lines as it has entries. */
function Block({
  open,
  entries,
  depth,
}: {
  open: '[' | '{'
  entries: Entry[]
  depth: number
}) {
  const close = CLOSING[open]
  // An empty container reads better closed up than spread over three lines.
  if (entries.length === 0) return <span className="json__punctuation">{open + close}</span>

  return (
    <>
      <span className="json__punctuation">{open}</span>
      {entries.map((entry, index) => (
        <span key={entry.id}>
          {'\n' + INDENT.repeat(depth + 1)}
          {entry.key !== undefined && (
            <>
              <span className="json__key">{JSON.stringify(entry.key)}</span>
              <span className="json__punctuation">: </span>
            </>
          )}
          <Value value={entry.value} depth={depth + 1} />
          {index < entries.length - 1 && <span className="json__punctuation">,</span>}
        </span>
      ))}
      {'\n' + INDENT.repeat(depth)}
      <span className="json__punctuation">{close}</span>
    </>
  )
}
