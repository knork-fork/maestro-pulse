import type { ComponentType } from 'react'
import {
  ArrowUpIcon,
  BoardIcon,
  BookIcon,
  BranchIcon,
  CommitIcon,
  DiffIcon,
  DiscordIcon,
  FileIcon,
  GitLabIcon,
  GoogleDriveIcon,
  JiraIcon,
  ListIcon,
  MaestroIcon,
  MoveIcon,
  OutlineIcon,
  PencilIcon,
  PlayIcon,
  SearchIcon,
  TerminalIcon,
  TrelloIcon,
  WrenchIcon,
} from '../components/icons'

/** The fixed, classified set an agent's Toolkit tile (or a tool.json `icon`
 *  field) picks from — new entries go here, not as a bespoke pairing on
 *  whatever is consuming them. */
export type ToolIconType =
  | 'branch'
  | 'commit'
  | 'diff'
  | 'terminal'
  | 'search'
  | 'file'
  | 'edit'
  | 'play'
  | 'book'
  | 'list'
  | 'move'
  | 'push'
  | 'board'
  | 'trello'
  | 'google'
  | 'outline'
  | 'gitlab'
  | 'jira'
  | 'discord'
  | 'maestro'
  | 'wrench'

export type ToolLook = { Icon: ComponentType<{ className?: string }>; tint: string }

/** Tints are existing theme tokens only — see :root in ../styles.css. */
export const TOOL_ICON_LOOKS: Record<ToolIconType, ToolLook> = {
  branch: { Icon: BranchIcon, tint: 'var(--workflow)' },
  commit: { Icon: CommitIcon, tint: 'var(--danger)' },
  diff: { Icon: DiffIcon, tint: 'var(--workflow)' },
  terminal: { Icon: TerminalIcon, tint: 'var(--syntax-string)' },
  search: { Icon: SearchIcon, tint: 'var(--syntax-boolean)' },
  file: { Icon: FileIcon, tint: 'var(--syntax-key)' },
  edit: { Icon: PencilIcon, tint: 'var(--agent)' },
  play: { Icon: PlayIcon, tint: 'var(--syntax-string)' },
  book: { Icon: BookIcon, tint: 'var(--accent-hover)' },
  list: { Icon: ListIcon, tint: 'var(--syntax-boolean)' },
  move: { Icon: MoveIcon, tint: 'var(--workflow)' },
  push: { Icon: ArrowUpIcon, tint: 'var(--syntax-string)' },
  board: { Icon: BoardIcon, tint: 'var(--accent-hover)' },
  trello: { Icon: TrelloIcon, tint: 'var(--accent)' },
  google: { Icon: GoogleDriveIcon, tint: 'var(--accent)' },
  outline: { Icon: OutlineIcon, tint: 'var(--icon)' },
  gitlab: { Icon: GitLabIcon, tint: 'var(--danger)' },
  jira: { Icon: JiraIcon, tint: 'var(--accent)' },
  discord: { Icon: DiscordIcon, tint: 'var(--accent)' },
  maestro: { Icon: MaestroIcon, tint: 'var(--accent)' },
  wrench: { Icon: WrenchIcon, tint: 'var(--icon)' },
}

export const DEFAULT_TOOL_ICON_TYPE: ToolIconType = 'wrench'

/** Resolves a possibly-unknown/missing type string (e.g. straight off a
 *  tool.json `icon` field) to a look, falling back to `wrench`. */
export function toolLook(type: string | null | undefined): ToolLook {
  if (type && type in TOOL_ICON_LOOKS) return TOOL_ICON_LOOKS[type as ToolIconType]
  return TOOL_ICON_LOOKS[DEFAULT_TOOL_ICON_TYPE]
}
