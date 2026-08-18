/**
 * Shared line icons. All inherit `currentColor`, so callers set the color via
 * CSS on the wrapping element.
 */

type IconProps = { className?: string }

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.6.8l1 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

export function WorkflowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

export function AgentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

export function MoveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M9 6l3-3 3 3" />
      <path d="M9 18l3 3 3-3" />
      <path d="M6 9l-3 3 3 3" />
      <path d="M18 9l3 3-3 3" />
    </svg>
  )
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  )
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12l7 7 7-7" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a1 1 0 0 1 1 1v3H3V5a1 1 0 0 1 1-1z" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M9 13h6" />
    </svg>
  )
}

/* ---- capability icons, for an agent's toolkit ----
   `WrenchIcon` is the fallback for a tool nothing else matches; see
   TOOL_ICON_LOOKS in ../data/toolIcons.ts. */

export function WrenchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z" />
    </svg>
  )
}

export function BranchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7" cy="5" r="2.5" />
      <circle cx="7" cy="19" r="2.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M7 7.5v9" />
      <path d="M17 11.5a4 4 0 0 1-4 4H9.5" />
    </svg>
  )
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5l12 7.5-12 7.5z" />
    </svg>
  )
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21" />
    </svg>
  )
}

export function TerminalIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6l6 6-6 6" />
      <path d="M13 18h7" />
    </svg>
  )
}

export function CommitIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12h5.5" />
      <path d="M15.5 12H21" />
    </svg>
  )
}

export function DiffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h13" />
    </svg>
  )
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h2" />
      <path d="M4 12h2" />
      <path d="M4 17h2" />
      <path d="M10 7h10" />
      <path d="M10 12h10" />
      <path d="M10 17h10" />
    </svg>
  )
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5a1 1 0 0 1 1-1h4.5A2.5 2.5 0 0 1 12 6.5V20a2 2 0 0 0-2-2H4z" />
      <path d="M20 5a1 1 0 0 0-1-1h-4.5A2.5 2.5 0 0 0 12 6.5V20a2 2 0 0 1 2-2h6z" />
    </svg>
  )
}

export function BoardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M9 4v16" />
      <path d="M15 4v16" />
      <path d="M4.5 9h3" />
      <path d="M4.5 13h3" />
      <path d="M10.5 8h3" />
      <path d="M10.5 12h3" />
      <path d="M16.5 8h3" />
    </svg>
  )
}

/** Unlike every other tool icon, this one renders Trello's actual brand
 *  colors rather than `currentColor`/`--tool-tint` — inline `style` on each
 *  shape wins over the shared `.agent-view__tool-icon` rule (fill: none;
 *  stroke: var(--tool-tint)) that every other icon in this vocabulary relies
 *  on for its outline look. */
export function TrelloIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" style={{ fill: '#0079bf', stroke: 'none' }} />
      <rect x="4.7" y="4.5" width="6" height="14" rx="1.4" style={{ fill: '#fff', stroke: 'none' }} />
      <rect x="13.3" y="4.5" width="6" height="9" rx="1.4" style={{ fill: '#fff', stroke: 'none' }} />
    </svg>
  )
}

/** Same brand-colors-over-outline exception as `TrelloIcon` above. */
export function GoogleDriveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" aria-hidden="true">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        style={{ fill: '#0066da', stroke: 'none' }}
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        style={{ fill: '#00ac47', stroke: 'none' }}
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        style={{ fill: '#ea4335', stroke: 'none' }}
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        style={{ fill: '#00832d', stroke: 'none' }}
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        style={{ fill: '#2684fc', stroke: 'none' }}
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        style={{ fill: '#ffba00', stroke: 'none' }}
      />
    </svg>
  )
}

/** Same brand-colors-over-outline exception as `TrelloIcon`/`GoogleDriveIcon`
 *  above — inline `style` on each shape wins over the shared
 *  `.agent-view__tool-icon` rule. */
export function OutlineIcon({ className }: IconProps) {
  const sheet = { fill: '#fff', stroke: '#000', strokeWidth: 25, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg className={className} viewBox="0 0 448 456" aria-hidden="true">
      <path d="M299 107 L338 98 Q352 95 352 109 L352 340 Q352 352 339 350 L299 343 Z" style={sheet} />
      <path d="M248 76 L282 65 Q300 59 300 77 L300 369 Q300 388 282 382 L248 372 Z" style={sheet} />
      <path
        d="M73 126 L229 36 Q248 25 248 45 L248 402 Q248 420 232 411 L72 320 Q66 317 66 309 L66 137 Q66 130 73 126 Z"
        style={sheet}
      />
      <path d="M106 153 L131 140 L131 277 L106 263 Z" style={{ fill: '#000', stroke: 'none' }} />
    </svg>
  )
}

/** Same brand-colors-over-outline exception as `TrelloIcon`/`GoogleDriveIcon`
 *  above. */
export function GitLabIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 710 690" aria-hidden="true">
      <path
        d="M45 274 122.5 37.5C124.9 30.1 129.4 26 136 26s11.1 4.1 13.5 11.5L227 274Z"
        style={{ fill: '#e24329', stroke: 'none' }}
      />
      <path
        d="M484 274 561.5 37.5C563.9 30.1 568.4 26 575 26s11.1 4.1 13.5 11.5L666 274Z"
        style={{ fill: '#e24329', stroke: 'none' }}
      />
      <path d="M227 274h257L355.5 670Z" style={{ fill: '#e24329', stroke: 'none' }} />
      <path d="M45 274h182l128.5 396Z" style={{ fill: '#fc6d26', stroke: 'none' }} />
      <path d="M484 274h182L355.5 670Z" style={{ fill: '#fc6d26', stroke: 'none' }} />
      <path
        d="M45 274 5.8 394.1c-3.5 10.7.3 22.4 9.3 28.9L355.5 670Z"
        style={{ fill: '#fca326', stroke: 'none' }}
      />
      <path
        d="M666 274 705.2 394.1c3.5 10.7-.3 22.4-9.3 28.9L355.5 670Z"
        style={{ fill: '#fca326', stroke: 'none' }}
      />
    </svg>
  )
}

/** Same brand-colors-over-outline exception as `TrelloIcon`/`GoogleDriveIcon`
 *  above. */
export function JiraIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 752 715" aria-hidden="true">
      <defs>
        <linearGradient id="jira-middle" gradientUnits="userSpaceOnUse" x1="300" y1="249" x2="405" y2="131">
          <stop offset="0" stopColor="#2684FF" />
          <stop offset="1" stopColor="#0052CC" />
        </linearGradient>
        <linearGradient id="jira-bottom" gradientUnits="userSpaceOnUse" x1="140" y1="409" x2="245" y2="291">
          <stop offset="0" stopColor="#2684FF" />
          <stop offset="1" stopColor="#0052CC" />
        </linearGradient>
      </defs>
      <path
        d="M339 28H662A27 27 0 0 1 689 55V376C609.5 376 545 311.5 545 232V174H486C404.8 174 339 108.2 339 28Z"
        style={{ fill: '#2684FF', stroke: 'none' }}
      />
      <path
        d="M180 189H503A27 27 0 0 1 530 216V537C450.5 537 385 472.5 385 393V335H326C244.8 335 180 270.2 180 189Z"
        style={{ fill: 'url(#jira-middle)', stroke: 'none' }}
      />
      <path
        d="M20 349H343A27 27 0 0 1 370 376V697C290.5 697 225 632.5 225 553V496H166C84.8 496 20 430.2 20 349Z"
        style={{ fill: 'url(#jira-bottom)', stroke: 'none' }}
      />
    </svg>
  )
}

/** Same brand-colors-over-outline exception as `TrelloIcon`/`GoogleDriveIcon`
 *  above. The source badge's own white canvas rect is dropped — the tile
 *  already supplies a background, so only the blue circle + mark render. */
export function DiscordIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 1040 927" aria-hidden="true">
      <circle cx="489" cy="463" r="454" style={{ fill: '#5865f2', stroke: 'none' }} />
      <path
        d="M286 279C250 339 219 404 205 470C196 513 195 565 200 612C242 645 293 671 347 688L379 636C362 630 345 622 330 613L341 602C383 624 435 636 489 636C543 636 595 624 637 602L649 613C634 622 617 630 600 636L631 688C685 671 736 645 779 612C784 566 782 514 774 470C760 404 729 339 692 279C654 262 613 251 571 243L556 274C534 271 512 269 489 269C466 269 444 271 423 274L407 243C365 251 324 262 286 279Z"
        style={{ fill: '#ffffff', stroke: 'none' }}
      />
      <circle cx="392" cy="486" r="53" style={{ fill: '#5865f2', stroke: 'none' }} />
      <circle cx="586" cy="486" r="53" style={{ fill: '#5865f2', stroke: 'none' }} />
      <path
        d="M336 607C381 636 433 650 489 650C545 650 597 636 643 607"
        style={{ fill: 'none', stroke: '#5865f2', strokeWidth: 14, strokeLinecap: 'butt' }}
      />
    </svg>
  )
}

/** Marks a toolkit tile from the common, always-on catalog — see ToolTile.tsx. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
