# maestro-pulse — orientation

> [!IMPORTANT]
> **MANDATORY: keep this file current.** Whenever you make a change that
> invalidates anything below — a new file that matters, a changed data shape, a
> new dependency/service, a different run/verify step, or a structural change to
> how concerns are split across files — **update this CLAUDE.md in the same
> change, without being asked.** This is part of "done."
>
> **What belongs here (and what doesn't) — READ BEFORE EDITING THIS FILE.** This
> file is a *map*, not a spec. Its one job: when someone says "clicking X doesn't
> save to the db," a reader finds the frontend half and the backend half from
> this file alone, without grepping. So keep it strictly at the altitude of
> **WHERE a concern lives and WHY** — which file owns it, how data flows between
> services, the shape of that data, how to run/verify.
>
> **Never document WHAT the code does or HOW it does it.** Do not add: specific
> copy, CSS class names or styling, color/glyph/emoji choices, DOM selectors,
> per-function step-by-step behavior, magic numbers and the constants holding
> them, line numbers, or individual mock records. Name the concept and point at
> the owning file/function — the code is the single source of truth for every
> detail, so this file never churns on a tweak. **When in doubt, leave it out**;
> a short map that stays correct beats a thorough one that goes stale. If an edit
> you're about to make adds a WHAT or a HOW, it belongs in a code comment, not
> here.

## What this is

A three-pane UI shell: a left projects sidebar, a main area showing whichever
file is selected, and a right sessions sidebar. The sidebar browses and edits a
real folder tree on disk — `resources/projects` — through a small API of its own.

Two services, both in Docker (nothing is installed on the host): a
client-rendered SPA (React + TypeScript, built by Vite, served by nginx), and a
dependency-free Node API that owns the folder tree.

## Layout

| Concern | File |
|---------|------|
| Pane composition, and the tree state the panes share | [src/App.tsx](src/App.tsx) |
| React entry point / root mount | [src/main.tsx](src/main.tsx) |
| HTML shell Vite builds from | [index.html](index.html) |
| **Backend** — every filesystem read and write, and the rules for them | [server/index.mjs](server/index.mjs) |
| Left sidebar — composition, plus the draft row and dialogs in flight | [src/components/ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx) |
| Tree state — nodes, expansion, selection, and the mutations | [src/hooks/useProjectTree.ts](src/hooks/useProjectTree.ts) |
| Main pane — the states of showing a file | [src/components/MainPane.tsx](src/components/MainPane.tsx) |
| Which files can be opened, and what renders each | [src/views/registry.ts](src/views/registry.ts) |
| The rendered-markdown view (README.md only), its link/image policy, and `SafeMarkdown` — the renderer reused for non-file markdown like an agent's instructions | [src/views/MarkdownView.tsx](src/views/MarkdownView.tsx) |
| The JSON view — pretty-printing and colouring | [src/views/JsonView.tsx](src/views/JsonView.tsx) |
| The raw-text view — any other markdown (e.g. `agent.md`), shown unrendered | [src/views/RawTextView.tsx](src/views/RawTextView.tsx) |
| Reading one file's text, and the races that come with it | [src/hooks/useFileContent.ts](src/hooks/useFileContent.ts) |
| Calling the API, and turning its failures into messages | [src/data/api.ts](src/data/api.ts) |
| `TreeNode` and the predicates the UI branches on | [src/data/tree.ts](src/data/tree.ts) |
| Tree rendering, rows, and the draft row being named | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx) |
| Right-click menu + the "New" button's dropdown | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx), [src/components/NewMenu.tsx](src/components/NewMenu.tsx) |
| Menu positioning, portalling and dismissal (shared by both) | [src/components/Menu.tsx](src/components/Menu.tsx) |
| Dialog shell | [src/components/Modal.tsx](src/components/Modal.tsx) |
| What a new project is asked for | [src/components/NewProjectDialog.tsx](src/components/NewProjectDialog.tsx) |
| What a workflow is created/edited with, columns and its own `workflow.md` instructions (with template picker) included | [src/components/WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) |
| The workflow instruction templates (Development, QA, Potentials & Leads/Sales, R&D, Management, Review/Audit) the dialog's template picker offers | [src/data/workflowTemplates.ts](src/data/workflowTemplates.ts) |
| What an agent is created/edited with | [src/components/AgentDialog.tsx](src/components/AgentDialog.tsx) |
| What an agent's own view renders — real profile fields, its rendered `agent.md` instructions, the placeholder toolkit and empty stats sections, and the no-op Spawn/disabled Logs/Open session controls | [src/components/AgentView.tsx](src/components/AgentView.tsx) |
| An agent's data shape, numeric bounds/defaults, and the shared `agent.json` parser | [src/data/agent.ts](src/data/agent.ts) |
| The shared toolkit icon-type vocabulary — the classified set a Toolkit tile (and a tool's own `tool.json`) picks an icon from | [src/data/toolIcons.ts](src/data/toolIcons.ts) |
| The slider/label controls shared by an agent's view and its dialog | [src/components/AgentFields.tsx](src/components/AgentFields.tsx) |
| An agent view's own `agent.json` — fetch, quiet reload driven by the tree, and the debounced per-slider save | [src/hooks/useAgentProfile.ts](src/hooks/useAgentProfile.ts) |
| An agent's own `agent.md` — fetch, quiet reload driven by the tree, and `save` for the view's own Edit button | [src/hooks/useAgentInstructions.ts](src/hooks/useAgentInstructions.ts) |
| The raw-markdown editor for `agent.md`, with tips and a role-template picker — reachable from the view's Instructions card and the tree's "Edit instructions" row | [src/components/AgentInstructionsModal.tsx](src/components/AgentInstructionsModal.tsx) |
| The role templates (coder, reviewer, security specialist, researcher, QA, salesperson, PM, product manager) the instructions editor's template picker offers | [src/data/agentTemplates.ts](src/data/agentTemplates.ts) |
| A workflow's kanban board — columns, bot/human column styling, per-card move/delete/archive controls, the read-only card detail modal, and the Backlog-only "add a ticket" button | [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx), [src/components/Column.tsx](src/components/Column.tsx), [src/components/Card.tsx](src/components/Card.tsx), [src/components/CardMoveMenu.tsx](src/components/CardMoveMenu.tsx), [src/components/CardDetailModal.tsx](src/components/CardDetailModal.tsx) |
| The instructional modal a Backlog "+" click opens — builds the add-to-backlog skill URL for an external agent to fetch, never calls the API itself | [src/components/AddToBacklogModal.tsx](src/components/AddToBacklogModal.tsx) |
| A workflow board's own data — fetch, quiet 60s poll, an immediate quiet reload whenever the tree reloads, and the per-card move/delete/archive mutations (moves guarded against a stale column) | [src/hooks/useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts) |
| Rename dialog / delete confirmation | [src/components/RenameDialog.tsx](src/components/RenameDialog.tsx), [src/components/ConfirmDialog.tsx](src/components/ConfirmDialog.tsx) |
| Pending + error state for one user action | [src/hooks/useAsyncAction.ts](src/hooks/useAsyncAction.ts) |
| Mirroring a Set to localStorage | [src/hooks/usePersistentSet.ts](src/hooks/usePersistentSet.ts) |
| Right sidebar — title, empty state | [src/components/SessionsSidebar.tsx](src/components/SessionsSidebar.tsx) |
| All SVG icons | [src/components/icons.tsx](src/components/icons.tsx) |
| All styling — theme tokens, pane grid, tree, controls, dialogs, rendered markdown | [src/styles.css](src/styles.css) |
| Keeping the project store out of git | [resources/.gitignore](resources/.gitignore) |
| Build tooling + dependencies | [package.json](package.json), [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json) |
| CI check (typecheck) | [scripts/ci.sh](scripts/ci.sh) |
| Three-stage image (SPA build → api → nginx serve) | [Dockerfile](Dockerfile) |
| nginx server, listen port, the API proxy, and the skills proxy | [nginx.conf](nginx.conf) |
| The add-to-backlog skill template, filled in per-request and handed to an external Claude Code session | [server/add-to-backlog-template.md](server/add-to-backlog-template.md) |
| Both services, host port, and the store's bind mount | [docker-compose.yml](docker-compose.yml) |
| User-facing run instructions | [README.md](README.md) |

## Architecture / data flow

```
browser ──▶ web (nginx :20444) ──▶ api (node :20445) ──▶ ./resources/projects
             static bundle          /api/*                (bind-mounted)
```

The browser only ever talks to nginx, which serves the built SPA and proxies the
`/api` prefix to the api service — so the frontend has no cross-origin concern
and the API is not published to the host. `/skills` is proxied the same way,
but is not part of the SPA's own API surface — it exists to be fetched
directly by an external Claude Code session (see the add-to-backlog flow
below), not by the browser. Unknown paths fall back to
`index.html`, so a client-side router can be added without touching the server
config. All three rules live in [nginx.conf](nginx.conf).

The api service is the only thing that touches the filesystem. Its root is
`resources/projects`, bind-mounted from the working tree, and every path in a
request is relative to that root — validated in one place
(`relativePath`/`validName` in [server/index.mjs](server/index.mjs)) so nothing
can address anything outside it. Reading a file's text goes through that same
gate and one more, `visiblePath`: what the tree does not show, nothing may read,
so the two halves cannot disagree about what exists. It runs as the host user,
not root, because it writes into the user's own working tree; see the `user:` note
in [docker-compose.yml](docker-compose.yml).

The store is deliberately untracked ([resources/.gitignore](resources/.gitignore)):
it holds whatever the user creates or drops in.

### Frontend state

There is no store. [useProjectTree.ts](src/hooks/useProjectTree.ts) owns the
nodes, the expansion set and which file is selected, and is the only caller of the
mutations; every mutation re-reads the whole tree afterwards, because the
filesystem is the source of truth and can change without us. Expansion and the
selection are both adjusted alongside renames and deletes there, so reloading —
including the refresh button — never collapses what the user had open or blanks
the file they were reading. Both expansion and the selected path are persisted
— by [usePersistentSet.ts](src/hooks/usePersistentSet.ts) and
[usePersistentPath.ts](src/hooks/usePersistentPath.ts) respectively, each
owning its storage key's serialized form while its caller (`useProjectTree.ts`)
declares the key — so a page refresh reopens whatever was last selected
instead of the empty pane; a persisted path that no longer resolves falls back
to the empty state the same as any other stale selection.

The hook is called in [App.tsx](src/App.tsx) rather than in a pane, because two
panes read it: the sidebar browses and mutates the tree, and the main pane shows
whatever is selected in it. The selection is a *path*, resolved against the current
nodes on every render, which is what makes a stale one harmless — a path that stops
resolving falls back to the empty state without anyone clearing it.

Which files can be opened at all, and what renders each, is decided in one place:
[views/registry.ts](src/views/registry.ts). A view is a matcher plus a renderer,
matching on the file *and the directory holding it*, so adding a file type is an
entry in a list. A row consults it to know whether a click means anything, which is
why [ProjectTree.tsx](src/components/ProjectTree.tsx) threads each node's parent
down the recursion.

Failures are reported by whichever control asked for the work: the mutations
reject, and the draft row and dialogs surface that in place via
[useAsyncAction.ts](src/hooks/useAsyncAction.ts). Only a reload has no such
owner, so it reports through the hook's own error state.

Creating is a two-step the *client* drives: nothing reaches the API until the
user has finished describing it, so a name that is already taken is refused
rather than worked around. The two kinds are asked about differently — a folder
is named by a draft row in the tree, while a project needs more than a name and
so is described in a dialog. [ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx)
owns both, because the header's "New" button, a folder row's own, and the
context menu all create through it.

Menus are portalled to `<body>` and positioned from a viewport anchor by
[Menu.tsx](src/components/Menu.tsx), because the tree scrolls and would
otherwise clip them; that is also why they dismiss on scroll rather than
following the anchor.

The sidebar's filter is local UI state in
[ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx), not part of the tree
hook: it narrows the already-loaded `nodes` client-side via `filterTree` in
[tree.ts](src/data/tree.ts) rather than reloading. Its scope is organizational
only — a `folder`'s contents are matched and can be filtered out, but a
matching `project`'s own contents always come along whole, never individually
tested. While a filter is active, [ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx)
hands [ProjectTree.tsx](src/components/ProjectTree.tsx) a computed expanded set
— every expandable path the filter kept, minus whatever the user has manually
collapsed in that filtering session — rather than the tree hook's own
`expanded`, so a match defaults to visible without anyone having expanded its
folders, but a row can still be collapsed like normal. `ProjectTree.tsx` itself
stays unaware any of this is happening; it just renders whatever `nodes` and
`expanded` it is handed, same as always. Clearing the filter reverts to
`tree.expanded` untouched.

### Not yet wired

Only files a view claims can be opened at all — every other file row is inert. Markdown other than README.md
is claimed but shown unrendered (see [RawTextView.tsx](src/views/RawTextView.tsx)) rather than being inert, since
`agent.md` is meant to be read/edited as source. Nothing serves a project's raw bytes, so
relative images and links inside a rendered file cannot resolve and are shown as
unresolved rather than followed. Nothing re-reads a file that changes on disk
under an open view, except a workflow's board, which polls (see
[useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts)), and an agent's own
view, which quiet-reloads whenever the tree does (see
[useAgentProfile.ts](src/hooks/useAgentProfile.ts)) and additionally saves a
slider's own drag straight back to `agent.json`, debounced. A project's
details cannot be edited after the fact, and
renaming one does not revisit what was written into it. A workflow's own
description/columns *are* editable after creation (unlike a project) — only
its name is fixed; the same is true of an agent's description. Opening a
workflow's board now renders its cards (see
[KanbanBoard.tsx](src/components/KanbanBoard.tsx)). The Backlog column's "+"
button does not create a card through the UI either — it only opens
[AddToBacklogModal.tsx](src/components/AddToBacklogModal.tsx), which hands the
user text to paste into an external Claude Code session; that session is what
actually calls the API (see the data-shape section below). There is still no
way for the browser itself to create a card. Any editable column (Ready, Doing, or a custom one)
renamed via [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) after it
has cards orphans them rather than migrating them, the same class of gap as a
renamed project not revisiting what was written into it.
Opening an agent's view shows a full profile card — name, title, description,
mission, and the four numeric settings (heartbeat, max children, handholding,
verbosity) all come from `agent.json`, editable via
[AgentDialog.tsx](src/components/AgentDialog.tsx) — reachable both from the
tree's "Edit" context-menu row (through `ProjectsSidebar.tsx`'s own
`editingAgent` state) and from the profile card's own "Edit" button in
[AgentView.tsx](src/components/AgentView.tsx), which opens the identical
dialog and saves through the same `tree.updateAgent`, threaded down through
`MainPane.tsx`; the "Not running"
status and the Logs/Open session controls are still UI-only sample values
with no session model, no persistence, and no server support behind them.
Spawn opens a menu — "Spawn loop" vs. "Single instance", each with an
explanatory tooltip — built the same trigger+`Menu.tsx` way as
[NewMenu.tsx](src/components/NewMenu.tsx), but neither entry is wired to
anything either. The Toolkit section is a hardcoded list with a no-op Edit, and the
Stats & usage section below it is deliberately empty — nothing records an
agent's runtime telemetry yet; see [AgentView.tsx](src/components/AgentView.tsx).
The numeric sliders stay interactive in the view itself, and dragging one
there saves it too — both the view's sliders and the modal write to the same
`agent.json`, through `useAgentProfile.ts`'s debounced `update` and
`AgentDialog.tsx`'s `updateAgent` respectively. The shape, its bounds/
defaults, and the shared parser live in
[src/data/agent.ts](src/data/agent.ts); the slider/label controls both
`AgentView.tsx` and `AgentDialog.tsx` render with are shared from
[src/components/AgentFields.tsx](src/components/AgentFields.tsx).
The view's Instructions card replaces what used to be a hardcoded sample
list: it renders the agent's real `agent.md` (via `SafeMarkdown`, loaded and
quiet-reloaded by [useAgentInstructions.ts](src/hooks/useAgentInstructions.ts)
the same way `agent.json` is), and its own "Edit" button opens
[AgentInstructionsModal.tsx](src/components/AgentInstructionsModal.tsx) — a
raw-markdown editor (not a preview) with tips and a "Templates" button
autofilling one of [agentTemplates.ts](src/data/agentTemplates.ts)'s role
skeletons. The same modal is also reachable from the tree's "Edit
instructions" context-menu row on an agent node
([ProjectTree.tsx](src/components/ProjectTree.tsx)), which saves through
`tree.updateAgentInstructions` in
[useProjectTree.ts](src/hooks/useProjectTree.ts) instead — deliberately
separate write paths, same dual-path shape `agent.json` itself already has
between the view's sliders and the sidebar's dialog. `agent.md` is
scaffolded with a placeholder on creation and is never touched by an
`agent.json` edit (description/title/mission/sliders), or vice versa — see
`updateAgentInstructions` in [server/index.mjs](server/index.mjs).

## Data shape

`TreeNode`, defined and exported by [src/data/tree.ts](src/data/tree.ts), is the
discriminated union the tree renders and the API produces. Its variants are
split at the project boundary — organizational `folder`s above it, a `project`
marking it, a `workflow` inside one, and `directory`/`file` for everything else.
Every variant carries a `name` and a `path`; all but `file` carry
`children: TreeNode[]`. That file also owns the predicates the UI branches on,
so the rule lives with the type rather than in components.

`path` is relative to the projects root and slash-joined, and is a node's
identity on both sides of the wire: it is what expansion is keyed by and what
mutations name.

Which of the three kinds a directory is cannot be read off the filesystem, so
the API records it in a marker file inside the directory — living there rather
than in one manifest at the root means a rename or a move by hand carries it
along. Unmarked directories are reported as plain contents. See `directoryType`
and `TYPE_FILE` in [server/index.mjs](server/index.mjs).

A `project` is more than that marker: the API also gives it a starting structure
and records the details the dialog collected, one of which is an absolute path to
a directory on the *user's own machine*. That path is only ever written down —
the api container cannot see it, and deliberately never resolves or touches it.
Scaffolding is the API's job, not the client's, so what a project *is* has one
answer on the side that owns the filesystem; see `scaffoldProject`. Unlike the
marker, most of what it writes is ordinary content: visible in the tree, and
the user's to edit afterwards. The one exception is `project.json` itself —
since it holds that host path, it's gitignored (a scaffolded `.gitignore`,
invisible in the tree the same way the marker is), alongside a
`project.json.dist` sibling that documents the same shape with a placeholder
in place of the real path, for the user's repo to actually track.

A `workflow` is marked the same way a `project` is, one level down: right-clicking
a project's `workflows` folder is how one is created, and the fixed leading/
trailing columns (Backlog … Done) a board always has are added by the API
rather than sent by the client — see `scaffoldWorkflow` and `validColumns` in
[server/index.mjs](server/index.mjs). Only Backlog (first) and Done (last)
are fixed; Ready and Doing are ordinary columns like any custom one, just
seeded by [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) as a new
workflow's starting defaults (both bot-column by default) — all three can be
renamed, reordered, or deleted like any other middle column. A column's
bot/human-ness is its own explicit `bot` boolean — every column, fixed or not,
is a bot column exactly when `bot` is `true` (`isBotColumn`). A bot column also
carries `agent`, naming which agent under the project's `agents` folder runs
it; the server rejects a column where `bot` is `true` and `agent` is `null`,
and forces `agent` back to `null` whenever `bot` is `false` (`validColumn` in
[server/index.mjs](server/index.mjs)) — so [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx)
also refuses to submit until every checked bot column has an agent picked,
showing "Create an agent for this project first…" when the project has none
yet (see below for where that agent list comes from). Every column, including
the fixed Backlog/Done, also carries a required `description` explaining what
it's for — validated server-side the same way a column name is
(`requiredText` in `validColumn`) — shown as a hover tooltip on the board's
column header (`Column.tsx`) and collected, for Backlog/Done too, by
[WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) even though their
name stays fixed; the dialog also won't submit until every column has one.
Unlike a project, a workflow's own
content (`workflow.json`) can be overwritten after creation, through the same
type-checked entry point that creates it; see `updateEntry`. Its name cannot —
see [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx). Opening a
workflow's board is a synthetic selection, not a real file — see
`workflowBoardPath`/`parseBoardPath` in [tree.ts](src/data/tree.ts) and where
[MainPane.tsx](src/components/MainPane.tsx) checks for it before falling
through to the file-view logic below. A board reads `workflow.json` through
its own [useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts) rather than
through the tree, so editing a workflow's description/columns from
[WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) (which only reloads
the tree) would otherwise leave an already-open board stale until its next
60s poll; [MainPane.tsx](src/components/MainPane.tsx) passes the tree's
`nodes` down to `KanbanBoard` as `treeVersion` so it can quiet-reload the
instant the tree does.

A workflow additionally gets `workflow.md` alongside `workflow.json` — its own
free-text instructions, the same split an agent's `agent.md`/`agent.json`
pair already has. Scoped deliberately narrow: what "good work" means for
*this* workflow, and what artifacts/evidence a card should carry by the time
it's done (a handoff document, exploration notes, a screenshot…) — not
generic card-movement mechanics (who may pick up a card, a one-stage
handoff, human override, blocked status), which are the same for every
workflow and already enforced by `applyCardAction`/`validColumn`, so a
template repeating them would just drift out of sync with the engine; see
the doc comment on `WORKFLOW_TEMPLATES` in
[workflowTemplates.ts](src/data/workflowTemplates.ts) for the same split.
Scaffolded with a placeholder (`DEFAULT_WORKFLOW_INSTRUCTIONS`) only on
creation, and edited through its own route, `PUT /api/workflow-instructions`
(`updateWorkflowInstructions`), entirely separate from `updateEntry` so
neither file's edits touch the other. Unlike `agent.md` — which has a
dedicated modal reachable from two places since an agent has a full-page view
— a workflow has no such view, so its instructions are edited inline in
[WorkflowDialog.tsx](src/components/WorkflowDialog.tsx), below the columns
form, with the same "Templates" picker mechanic (see
[workflowTemplates.ts](src/data/workflowTemplates.ts)); the dialog's single
Save button issues two writes in sequence (`updateWorkflow` then
`updateWorkflowInstructions`), reported as a distinct error if the second
fails since the first has already landed. Reading it doesn't gate the edit
dialog the way a broken `workflow.json` does — a workflow created before this
file existed just opens with an empty instructions field.

A workflow's `workflow.json` additionally holds `cards` and `archived`, each a
flat array of `{ id, title, description, column, status, last_activity, issues }`,
where `column` names a
column by its `name` rather than an id - the same no-id convention columns
themselves already follow (so a custom column renamed after it has cards
orphans them; see "Not yet wired" above). A card's avatar comes from its own
column's `agent`, not anything stored on the card — see how
[Column.tsx](src/components/Column.tsx) resolves `agentName` from the column
and hands it down to [Card.tsx](src/components/Card.tsx). Because `scaffoldWorkflow` fully
rewrites the file on every description/columns edit, it reads and carries
these two arrays through rather than assuming a brand-new workflow; see
`existingCardData`. Every move/delete/archive is validated server-side
against a column's fixed position (Backlog/Done are always index 0/last) and
its `bot` flag by `applyCardAction`, behind the narrow, type-checked
`PATCH /api/workflow-cards` route; see
`updateWorkflowCard` in [server/index.mjs](server/index.mjs). Before sending a
move, the client separately re-fetches and refuses to proceed if the card has
already left the column it was in when the user acted — a client-side guard
only, since the server already independently re-validates the same action;
see `moveUp`/`moveDown`/`moveRight` in
[useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts).

Creating a card is the one action that grows `cards` rather than
reordering/relabelling/shrinking it, so it is its own route,
`POST /api/workflow-cards` (`createWorkflowCard`), always landing the new card
at the front of the array — i.e. the top of Backlog, since column order is
purely relative position within the flat array (see above). Nothing in this
repo's own frontend calls it; it exists for an external Claude Code session to
call, per the instructions handed out by `GET /skills/add-to-backlog`
(`getAddToBacklogSkill`). That route's only param is the workflow `path` — a
workflow's path is always its project's path plus the fixed two-segment
`workflows/<name>` suffix, so the project is fully determined by `path` and
the server derives it (rather than being told it, which would just be the
same value twice); [AddToBacklogModal.tsx](src/components/AddToBacklogModal.tsx)
never computes it at all. The browser's own host is likewise not a param —
the server reads it off the proxied request's own `Host` header instead (see
nginx's `proxy_set_header Host $host`). The route
returns [add-to-backlog-template.md](server/add-to-backlog-template.md) with
its placeholders swapped for that project's real name, its `dir_on_host`
(from `project.json`), that host, and the workflow's own `workflow.md`
content (empty/missing renders as nothing, so the template reads cleanly
either way) — as raw markdown, not JSON, the one route in this API that isn't.

An `agent` is marked and created the same way, one level down inside a
project's `agents` folder instead — see `scaffoldAgent` in
[server/index.mjs](server/index.mjs) and
[AgentDialog.tsx](src/components/AgentDialog.tsx). It has nothing analogous to
a workflow's columns, so its own content (`agent.json`) is just its
`AgentData` shape — description, title, mission, and the four numeric
settings, see [src/data/agent.ts](src/data/agent.ts) — editable the same
narrow way through `updateEntry`, which validates it server-side against the
same bounds `agent.ts` declares; its name is likewise
fixed. An agent additionally gets `agent.md` alongside `agent.json` — its
system/personalization instructions as raw markdown, scaffolded with a
placeholder (`DEFAULT_AGENT_INSTRUCTIONS`) only on creation, and edited
through its own route, `PUT /api/agent-instructions`
(`updateAgentInstructions`), entirely separate from `updateEntry` so neither
file's edits touch the other. Opening an agent's view is a synthetic selection mirroring a workflow's
board — see `agentViewPath`/`parseAgentViewPath` in
[tree.ts](src/data/tree.ts). A workflow's bot columns can be assigned one of
the agents living under the same project; [ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx)
computes that list from the already-loaded tree (there is no dedicated list
endpoint) and hands it to [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx).

A file's contents cross the wire as text wrapped in JSON, because the API has no
non-JSON response path. The read is capped and refuses anything that is not a
file; see `getFile` and `MAX_READ_BYTES` in [server/index.mjs](server/index.mjs).
Which files are worth reading is the client's call, not the endpoint's — see
`viewFor` in [src/views/registry.ts](src/views/registry.ts).

Persisted to `localStorage`: a JSON `string[]` of expanded tree paths, written
and re-validated by [usePersistentSet.ts](src/hooks/usePersistentSet.ts); and
the selected path itself, written and re-validated the same way by
[usePersistentPath.ts](src/hooks/usePersistentPath.ts).

## Run / apply changes / verify

> [!IMPORTANT]
> **Do not try to exercise the UI yourself** — no browser drivers, no scripted
> clicking, no hunting for a headless browser, no `curl`ing the running app.
> The user tests the app manually.
>
> Your side of "verify" is: rebuild via `docker-compose up -d --build` and
> typecheck via [scripts/ci.sh](scripts/ci.sh). Then **hand the user a short
> list of what to click and what they should see**, ordered so each step
> builds on the last, and stop there. Say plainly which parts you could not
> check yourself.

The SPA is compiled into the image, so **any frontend edit requires a rebuild** —
restarting the container alone serves the previous bundle. The api service is
plain `node` with no build step, but still needs its container recreated to pick
up a change.

```bash
docker-compose up -d --build       # start, and apply any change
docker-compose logs web api        # nginx access/error logs, API request log
docker-compose down                # stop
```

Type checking (the image build does NOT type-check, vite only transpiles) is
one command, not reassembled each session: [scripts/ci.sh](scripts/ci.sh)
builds the `build` stage and runs `npm run typecheck` inside it.

```bash
./scripts/ci.sh
```

The app is at `http://localhost:20444`. If folders end up owned by the wrong
user, pass `UID`/`GID` — see [docker-compose.yml](docker-compose.yml).
