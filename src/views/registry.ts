import type { ComponentType } from 'react'
import type { FileNode, TreeNode } from '../data/tree'
import { JsonView } from './JsonView'
import { MarkdownView } from './MarkdownView'

/**
 * Which files the main pane can show, and what shows them.
 *
 * This is the one place a file type is plugged in. A view is a matcher plus a
 * renderer, and it matches on the file *and the directory holding it*, because a
 * file's meaning often comes from where it sits rather than from its name — the
 * same `notes.md` can be one thing inside a project and another inside a folder.
 */

/** A file, and what holds it. `parent` is null for a file at the projects root. */
export type FileContext = { node: FileNode; parent: TreeNode | null }

export type FileViewProps = { content: string; context: FileContext }

export type FileView = {
  /** Names the entry. Not shown anywhere; it is here so the list reads. */
  id: string
  matches: (context: FileContext) => boolean
  /**
   * Rendered as an element rather than called, so a view may hold hooks of its
   * own. The pane keys it by path, so switching files remounts it.
   */
  render: ComponentType<FileViewProps>
}

type Matcher = FileView['matches']

// ---- matchers ----
//
// These keep an entry down to one line. Not all of them are used yet; they are
// here because they are the axes a view is allowed to match on, and discovering
// them by reading this file is the point.

/** The whole file name. Case-insensitive: `readme.md` is the same intent. */
export const named =
  (...names: string[]): Matcher =>
  ({ node }) =>
    names.some((name) => name.toLowerCase() === node.name.toLowerCase())

export const extension =
  (...suffixes: string[]): Matcher =>
  ({ node }) =>
    suffixes.some((suffix) => node.name.toLowerCase().endsWith(suffix.toLowerCase()))

/** Which kind of directory the file sits in. A root-level file matches none. */
export const inside =
  (...types: TreeNode['type'][]): Matcher =>
  ({ parent }) =>
    parent !== null && types.includes(parent.type)

/** The name of the directory the file sits in. */
export const withinNamed =
  (...names: string[]): Matcher =>
  ({ parent }) =>
    parent !== null && names.some((name) => name.toLowerCase() === parent.name.toLowerCase())

export const every =
  (...matchers: Matcher[]): Matcher =>
  (context) =>
    matchers.every((matches) => matches(context))

// ---- the registry ----
//
// First match wins, so order these most specific first. That order is the whole
// conflict rule: scores or priorities would be one more thing to reason about
// than reading the list top to bottom.

const VIEWS: FileView[] = [
  { id: 'readme', matches: named('README.md'), render: MarkdownView },
  { id: 'json', matches: extension('.json'), render: JsonView },
]

export const viewFor = (context: FileContext): FileView | null =>
  VIEWS.find((view) => view.matches(context)) ?? null

/** Only a file has a view — and only a file narrows to what a view is given. */
export const fileContext = (node: TreeNode, parent: TreeNode | null): FileContext | null =>
  node.type === 'file' ? { node, parent } : null
