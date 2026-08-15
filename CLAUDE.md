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
| The markdown view, and its link/image policy | [src/views/MarkdownView.tsx](src/views/MarkdownView.tsx) |
| The JSON view — pretty-printing and colouring | [src/views/JsonView.tsx](src/views/JsonView.tsx) |
| Reading one file's text, and the races that come with it | [src/hooks/useFileContent.ts](src/hooks/useFileContent.ts) |
| Calling the API, and turning its failures into messages | [src/data/api.ts](src/data/api.ts) |
| `TreeNode` and the predicates the UI branches on | [src/data/tree.ts](src/data/tree.ts) |
| Tree rendering, rows, and the draft row being named | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx) |
| Right-click menu + the "New" button's dropdown | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx), [src/components/NewMenu.tsx](src/components/NewMenu.tsx) |
| Menu positioning, portalling and dismissal (shared by both) | [src/components/Menu.tsx](src/components/Menu.tsx) |
| Dialog shell | [src/components/Modal.tsx](src/components/Modal.tsx) |
| What a new project is asked for | [src/components/NewProjectDialog.tsx](src/components/NewProjectDialog.tsx) |
| What a workflow is created/edited with, columns included | [src/components/WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) |
| What an agent is created/edited with | [src/components/AgentDialog.tsx](src/components/AgentDialog.tsx) |
| What an agent's own view renders — profile, dummy heartbeat/max-children/mission, sample pulse actions, and the no-op Spawn/disabled Logs/Open session controls | [src/components/AgentView.tsx](src/components/AgentView.tsx) |
| A workflow's kanban board — columns, bot/human column styling, per-card move/delete/archive controls, and the read-only card detail modal | [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx), [src/components/Column.tsx](src/components/Column.tsx), [src/components/Card.tsx](src/components/Card.tsx), [src/components/CardMoveMenu.tsx](src/components/CardMoveMenu.tsx), [src/components/CardDetailModal.tsx](src/components/CardDetailModal.tsx) |
| A workflow board's own data — fetch, quiet 60s poll, and the per-card move/delete/archive mutations (moves guarded against a stale column) | [src/hooks/useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts) |
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
| nginx server, listen port, and the API proxy | [nginx.conf](nginx.conf) |
| Both services, host port, and the store's bind mount | [docker-compose.yml](docker-compose.yml) |
| User-facing run instructions | [README.md](README.md) |

## Architecture / data flow

```
browser ──▶ web (nginx :20444) ──▶ api (node :20445) ──▶ ./resources/projects
             static bundle          /api/*                (bind-mounted)
```

The browser only ever talks to nginx, which serves the built SPA and proxies the
`/api` prefix to the api service — so the frontend has no cross-origin concern
and the API is not published to the host. Unknown paths fall back to
`index.html`, so a client-side router can be added without touching the server
config. Both rules live in [nginx.conf](nginx.conf).

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

Only files a view claims can be opened at all — every other file row is inert. Nothing serves a project's raw bytes, so
relative images and links inside a rendered file cannot resolve and are shown as
unresolved rather than followed. Nothing re-reads a file that changes on disk
under an open view, except a workflow's board, which polls (see
[useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts)). A project's details cannot be edited after the fact, and
renaming one does not revisit what was written into it. A workflow's own
description/columns *are* editable after creation (unlike a project) — only
its name is fixed; the same is true of an agent's description. Opening a
workflow's board now renders its cards (see
[KanbanBoard.tsx](src/components/KanbanBoard.tsx)), but there is still no way
to create a card through the UI at all - the only way to add one is a direct
edit to `workflow.json`. Any editable column (Ready, Doing, or a custom one)
renamed via [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx) after it
has cards orphans them rather than migrating them, the same class of gap as a
renamed project not revisiting what was written into it.
Opening an agent's view shows a full profile card — its real `description`
from `agent.json` alongside a heartbeat interval, a max-children limit, a
mission statement, and a sample list of per-pulse actions — but only the name
and description are real; the rest, plus the "Not running" status and the
Spawn/Logs/Open session controls, are UI-only sample values with no session
model, no persistence, and no server support behind them; see
[AgentView.tsx](src/components/AgentView.tsx).

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
marker, what it writes is ordinary content: visible in the tree, and the user's
to edit afterwards.

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
yet (see below for where that agent list comes from). Unlike a project, a workflow's own
content (`workflow.json`) can be overwritten after creation, through the same
type-checked entry point that creates it; see `updateEntry`. Its name cannot —
see [WorkflowDialog.tsx](src/components/WorkflowDialog.tsx). Opening a
workflow's board is a synthetic selection, not a real file — see
`workflowBoardPath`/`parseBoardPath` in [tree.ts](src/data/tree.ts) and where
[MainPane.tsx](src/components/MainPane.tsx) checks for it before falling
through to the file-view logic below.

A workflow's `workflow.json` additionally holds `cards` and `archived`, each a
flat array of `{ id, title, description, column }`, where `column` names a
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
`updateWorkflowCard` in [server/index.mjs](server/index.mjs). There is no
endpoint that creates a card - seeding one requires editing `workflow.json`
directly. Before sending a move, the client separately re-fetches and refuses
to proceed if the card has already left the column it was in when the user
acted — a client-side guard only, since the server already independently
re-validates the same action; see `moveUp`/`moveDown`/`moveRight` in
[useWorkflowBoard.ts](src/hooks/useWorkflowBoard.ts).

An `agent` is marked and created the same way, one level down inside a
project's `agents` folder instead — see `scaffoldAgent` in
[server/index.mjs](server/index.mjs) and
[AgentDialog.tsx](src/components/AgentDialog.tsx). It has nothing analogous to
a workflow's columns, so its own content (`agent.json`) is just a description,
editable the same narrow way through `updateEntry`; its name is likewise
fixed. Opening an agent's view is a synthetic selection mirroring a workflow's
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
