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
sessions sidebar. It is a client-rendered SPA (React + TypeScript, built by
Vite, served by nginx). There is no backend — the project tree is hard-coded
placeholder data, and the only persistence is browser-local UI state. Both the
build and the serving happen in Docker; nothing is installed on the host.

## Layout

| Concern | File |
|---------|------|
| Pane composition — which sidebar sits where | [src/App.tsx](src/App.tsx) |
| React entry point / root mount | [src/main.tsx](src/main.tsx) |
| HTML shell Vite builds from | [index.html](index.html) |
| Left sidebar — title, action buttons, filter input | [src/components/ProjectsSidebar.tsx](src/components/ProjectsSidebar.tsx) |
| "New" button + its dropdown, positioning and dismissal | [src/components/NewMenu.tsx](src/components/NewMenu.tsx) |
| Tree rendering, expand/collapse state, empty state | [src/components/ProjectTree.tsx](src/components/ProjectTree.tsx) |
| Mirroring a Set to localStorage | [src/hooks/usePersistentSet.ts](src/hooks/usePersistentSet.ts) |
| Placeholder project tree data | [src/data/projects.ts](src/data/projects.ts) |
| Right sidebar — title, empty state | [src/components/SessionsSidebar.tsx](src/components/SessionsSidebar.tsx) |
| All SVG icons | [src/components/icons.tsx](src/components/icons.tsx) |
| All styling — theme tokens, pane grid, tree, controls | [src/styles.css](src/styles.css) |
| Build tooling + dependencies | [package.json](package.json), [vite.config.ts](vite.config.ts), [tsconfig.json](tsconfig.json) |
| Two-stage image (node build → nginx serve) | [Dockerfile](Dockerfile) |
| nginx server + listen port | [nginx.conf](nginx.conf) |
| Service definition + host port mapping | [docker-compose.yml](docker-compose.yml) |
| User-facing run instructions | [README.md](README.md) |

## Architecture / data flow

Single service, no network data flow. The Dockerfile's first stage compiles the
SPA with Vite; the second stage serves the resulting bundle from nginx. The
container listens on 20444 and is published to the same port on the host, so the
app is at `http://localhost:20444`.

Unknown paths fall back to `index.html` (the `try_files` rule in
[nginx.conf](nginx.conf)), so a client-side router can be added without touching
the server config.

State is local component state only — there is no store. Tree expansion lives in
[ProjectTree.tsx](src/components/ProjectTree.tsx), keyed by each node's
slash-joined ancestor path, and is persisted to `localStorage` by
[usePersistentSet.ts](src/hooks/usePersistentSet.ts) so it survives reloads. That
hook owns the storage key's serialized form; the key itself is declared by its
caller.

The two sidebars and the main pane are distinguished by background tokens at the
top of [src/styles.css](src/styles.css); pane widths are tokens on the same
block, and the panes themselves are one CSS grid on `.app`.

[NewMenu.tsx](src/components/NewMenu.tsx) is shared by the sidebar header and by
each eligible tree row. Its dropdown is portalled to `<body>` and positioned from
the trigger's rect, because the tree scrolls and would otherwise clip an
in-flow menu; that is also why it dismisses on scroll.

### Not yet wired

The refresh button and the filter input are inert placeholders. The "New" button
opens its menu, but the menu's entries only dismiss it — neither creates
anything yet.

## Data shape

`TreeNode`, defined and exported by [src/data/projects.ts](src/data/projects.ts),
is the discriminated union the tree renders. Its variants are split at the
project boundary — organizational `folder`s above it, a `project` marking it, and
`directory`/`file` for a project's own contents. Every variant carries a `name`;
all but `file` carry `children: TreeNode[]`. That file also owns the predicates
the UI branches on, so the rule lives with the type rather than in components.
This is the shape a real project source would need to produce.

Persisted to `localStorage`: a JSON `string[]` of expanded tree paths, written
and re-validated by [usePersistentSet.ts](src/hooks/usePersistentSet.ts).

## Run / apply changes / verify

The app is compiled into the image, so **any edit requires a rebuild** —
restarting the container alone serves the previous bundle.

```bash
docker compose up -d --build     # start, and apply any change
curl -sI http://localhost:20444/ # verify (expect 200)
docker compose logs web          # nginx access/error logs
docker compose down              # stop

# type check (the image build does NOT type-check — vite only transpiles)
docker build --target build -t maestro-pulse-build . && \
  docker run --rm maestro-pulse-build npm run typecheck
```
