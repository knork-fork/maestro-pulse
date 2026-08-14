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

A three-pane UI shell: a left projects sidebar, an empty main area, and a right
sessions sidebar. The sidebar browses and edits a real folder tree on disk —
`resources/projects` — through a small API of its own.

Two services, both in Docker (nothing is installed on the host): a
client-rendered SPA (React + TypeScript, built by Vite, served by nginx), and a
dependency-free Node API that owns the folder tree.

## Layout

| Concern | File |
|---------|------|
| Pane composition — which sidebar sits where | [src/App.tsx](src/App.tsx) |
| React entry point / root mount | [src/main.tsx](src/main.tsx) |
| HTML shell Vite builds from | [index.html](index.html) |
| **Backend** — every filesystem read and write, and the rules for them | [server/index.mjs](server/index.mjs) |
| Left sidebar — composition, plus the draft row and dialogs in flight | [src/components/ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx) |
| Tree state — nodes, expansion, and the mutations | [src/hooks/useProjectTree.ts](src/hooks/useProjectTree.ts) |
| Calling the API, and turning its failures into messages | [src/data/api.ts](src/data/api.ts) |
| `TreeNode` and the predicates the UI branches on | [src/data/tree.ts](src/data/tree.ts) |
| Tree rendering, rows, and the draft row being named | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx) |
| Right-click menu + the "New" button's dropdown | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx), [src/components/NewMenu.tsx](src/components/NewMenu.tsx) |
| Menu positioning, portalling and dismissal (shared by both) | [src/components/Menu.tsx](src/components/Menu.tsx) |
| Dialog shell | [src/components/Modal.tsx](src/components/Modal.tsx) |
| Rename dialog / delete confirmation | [src/components/RenameDialog.tsx](src/components/RenameDialog.tsx), [src/components/ConfirmDialog.tsx](src/components/ConfirmDialog.tsx) |
| Pending + error state for one user action | [src/hooks/useAsyncAction.ts](src/hooks/useAsyncAction.ts) |
| Mirroring a Set to localStorage | [src/hooks/usePersistentSet.ts](src/hooks/usePersistentSet.ts) |
| Right sidebar — title, empty state | [src/components/SessionsSidebar.tsx](src/components/SessionsSidebar.tsx) |
| All SVG icons | [src/components/icons.tsx](src/components/icons.tsx) |
| All styling — theme tokens, pane grid, tree, controls, dialogs | [src/styles.css](src/styles.css) |
| Keeping the project store out of git | [resources/.gitignore](resources/.gitignore) |
| Build tooling + dependencies | [package.json](package.json), [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json) |
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
can address anything outside it. It runs as the host user, not root, because it
writes into the user's own working tree; see the `user:` note in
[docker-compose.yml](docker-compose.yml).

The store is deliberately untracked ([resources/.gitignore](resources/.gitignore)):
it holds whatever the user creates or drops in.

### Frontend state

There is no store. [useProjectTree.ts](src/hooks/useProjectTree.ts) owns the
nodes and the expansion set, and is the only caller of the mutations; every
mutation re-reads the whole tree afterwards, because the filesystem is the source
of truth and can change without us. Expansion is adjusted alongside renames and
deletes there, so reloading — including the refresh button — never collapses what
the user had open. It is persisted by
[usePersistentSet.ts](src/hooks/usePersistentSet.ts), which owns the storage
key's serialized form while its caller declares the key.

Failures are reported by whichever control asked for the work: the mutations
reject, and the draft row and dialogs surface that in place via
[useAsyncAction.ts](src/hooks/useAsyncAction.ts). Only a reload has no such
owner, so it reports through the hook's own error state.

Creating is a two-step the *client* drives: a draft row is added to the tree
first and named there, and only a committed name reaches the API — so a name
that is already taken is refused rather than worked around.
[ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx) owns that draft,
because both the header's "New" button and a folder row's own create into it.

Menus are portalled to `<body>` and positioned from a viewport anchor by
[Menu.tsx](src/components/Menu.tsx), because the tree scrolls and would
otherwise clip them; that is also why they dismiss on scroll rather than
following the anchor.

### Not yet wired

The filter input is an inert placeholder. Nothing reads a project's contents yet
— a `project` is a marked directory and nothing more.

## Data shape

`TreeNode`, defined and exported by [src/data/tree.ts](src/data/tree.ts), is the
discriminated union the tree renders and the API produces. Its variants are
split at the project boundary — organizational `folder`s above it, a `project`
marking it, and `directory`/`file` for contents. Every variant carries a `name`
and a `path`; all but `file` carry `children: TreeNode[]`. That file also owns
the predicates the UI branches on, so the rule lives with the type rather than in
components.

`path` is relative to the projects root and slash-joined, and is a node's
identity on both sides of the wire: it is what expansion is keyed by and what
mutations name.

Which of the three kinds a directory is cannot be read off the filesystem, so
the API records it in a marker file inside the directory — living there rather
than in one manifest at the root means a rename or a move by hand carries it
along. Unmarked directories are reported as plain contents. See `directoryType`
and `TYPE_FILE` in [server/index.mjs](server/index.mjs).

Persisted to `localStorage`: a JSON `string[]` of expanded tree paths, written
and re-validated by [usePersistentSet.ts](src/hooks/usePersistentSet.ts).

## Run / apply changes / verify

> [!IMPORTANT]
> **Do not try to exercise the UI yourself** — no browser drivers, no scripted
> clicking, no hunting for a headless browser. The user tests the app manually.
>
> Your side of "verify" is: type check, rebuild, confirm the containers are up,
> and — where a change has a backend half — `curl` the API. Then **hand the user
> a short list of what to click and what they should see**, ordered so each step
> builds on the last, and stop there. Say plainly which parts you could not check
> yourself.

The SPA is compiled into the image, so **any frontend edit requires a rebuild** —
restarting the container alone serves the previous bundle. The api service is
plain `node` with no build step, but still needs its container recreated to pick
up a change.

```bash
docker compose up -d --build       # start, and apply any change
curl -sI http://localhost:20444/   # verify the app (expect 200)
curl -s http://localhost:20444/api/tree   # verify the API through nginx
docker compose logs web api        # nginx access/error logs, API request log
docker compose down                # stop

# type check (the image build does NOT type-check — vite only transpiles)
docker build --target build -t maestro-pulse-build . && \
  docker run --rm maestro-pulse-build npm run typecheck
```

The app is at `http://localhost:20444`. If folders end up owned by the wrong
user, pass `UID`/`GID` — see [docker-compose.yml](docker-compose.yml).
