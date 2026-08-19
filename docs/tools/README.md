# Creating a tool

This is the reference for building a tool folder — for a human and for an AI
agent alike. A tool is one thing an agent can run: a shell script with
credentials attached. The point of a tool is that a workflow can name the
*step* ("read from Trello") rather than describe a raw command, and that each
tool's API keys live in exactly one place.

## Where a tool lives

A tool is a folder named in kebab-case (`read-from-trello`,
`move-maestro-pulse-card`), in one of two places:

- **Project-scoped** — under a project's own `tools/` folder
  (`<project>/tools/<tool>/`). Read straight off the already-loaded tree by
  `useProjectTools` in `src/hooks/useProjectTools.ts`, so it's picked up
  immediately — no rebuild needed.
- **Common** — under this repo's own `common-tools/` folder
  (`common-tools/<tool>/`), for a tool that isn't specific to any one
  project. It ships baked into the api image (see `getCommonTools` in
  `server/index.mjs` and `useCommonTools` in `src/hooks/useProjectTools.ts`),
  so a new or edited common tool needs `docker-compose up -d --build` before
  it shows up.

A tool's real, absolute path on the host is never something a `workflow.md`
or a tool author constructs — maestro-pulse resolves it automatically and
hands it to whichever external agent picks up a card (see the run-manually
and add-to-backlog skills in `server/index.mjs`). That path is always rooted
at `MAESTRO_PULSE_HOST_DIR`, the maestro-pulse checkout's own absolute path
on the host — never at a project's `codebase_dir_on_host`, which is a
different, unrelated path (the actual codebase's own git checkout; see
`project.json`). A project-scoped tool resolves under this checkout's own
`resources/projects/<project>/tools/<tool>/tool.sh`; a common tool resolves
under `common-tools/<tool>/tool.sh`. A `workflow.md` only needs to name which
tool to use — not build its path.

## The required folder shape

Exactly four files:

| File | What it is |
|---|---|
| `tool.sh` | The tool itself. Executable, `755`. |
| `tool.json` | `{ "title", "description", "icon" }` |
| `.env` | Every variable the script reads, with placeholder values. Committed. |
| `.env.local` | The real values. Gitignored — never commit it. |

`tool.sh` loads `.env` and then `.env.local`, both from **its own folder**,
never the caller's working directory, so the tool behaves the same wherever
it's invoked from. `.env.local` loads second and wins. A real-world
convention worth following: ship every credential in `.env` as the literal
placeholder `dummy`, and have `tool.sh` refuse to run while one still says
`dummy` — an unconfigured tool then fails with a clear explanation instead of
a confusing API error. Filling one in means editing `.env.local`, never
`.env`.

The contract for `tool.sh`: arguments in, structured output (usually JSON) on
stdout, a human-readable message on stderr, and a non-zero exit on any
failure. See `common-tools/move-maestro-pulse-card/tool.sh` for a worked
example of the env-loading preamble and this contract.

`tool.json` is parsed by `src/data/tool.ts`. A missing/wrong-typed `title` or
`description` falls back gracefully (the folder's own name, an empty
description) rather than making the tool unreadable — but write them anyway,
since that fallback is a last resort, not a style choice.

`description` carries more weight than it looks like it should: the
run-manually skill hands an external harness a flat index of every tool
(common plus the agent's own project ones) and tells it to pick what's
relevant from that index rather than opening each one — so this is the one
line the harness judges relevance from, without ever seeing `tool.sh`
itself. Write it specific enough to decide on its own. A common tool's
description should also make clear it isn't scoped to one project, since
the harness is told to prefer a common tool over a project tool that could
do the same job.

## The icon vocabulary

`tool.json`'s `icon` field is one key from the fixed vocabulary defined in
`src/data/toolIcons.ts` (all available icons are listed  there).

Two special cases, not to be confused with each other:

- **Unrecognized key** (a typo, or a key not in the list above) falls back to
  `wrench`.
- **No icon at all** — `icon` is `null`, missing, or the literal string
  `"null"` (an easy authoring slip) — renders as reserved empty space, not
  `wrench`.

If nothing in the vocabulary fits, use `wrench` deliberately (it reads as
"generic tool") rather than reaching for an unrecognized string that happens
to fall back to the same thing.

## Adding a tool, step by step

1. Copy an existing tool's folder and rename it (kebab-case).
2. Rewrite `tool.sh`, keeping the env-loading preamble at the top. It's
   duplicated in every tool on purpose, so a tool folder is self-contained
   and can be copied elsewhere without dragging a shared library along.
3. Declare every variable the script reads in `.env` with a placeholder
   value, and put the real ones in `.env.local`.
4. Write `tool.json` — title, description, and a pick from the icon
   vocabulary above.
5. Name the tool in whichever `workflow.md` should reach for it — a tool
   nothing references will not get used.

If the tool belongs under `common-tools/` instead of a project's `tools/`,
run `docker-compose up -d --build` afterwards so the api image picks it up.

## Source of truth

This doc describes a convention; the code below is what actually enforces or
renders it — when they disagree, the code wins:

- `src/data/toolIcons.ts` — the icon vocabulary and its fallback.
- `src/data/tool.ts` — `tool.json`'s shape and parser.
- `src/hooks/useProjectTools.ts` — how a project's `tools/` catalog and the
  shared `common-tools/` catalog are read.
- `server/index.mjs` — `PROJECT_SUBDIRECTORIES` (where `tools/` comes from)
  and `getCommonTools` (the common-tools read path).
