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

<!-- Fill this in as soon as the project's purpose and shape are decided: one
short paragraph — what the project is for, and the top-level split (services,
packages, entry points). Replace this comment; do not leave a placeholder
sentence behind. -->

## Layout

<!-- One table of Concern → File, added incrementally as real files appear. One
row per thing a reader might need to find; drop rows whose file is deleted or
whose concern moves. Split into multiple tables (per service/package) only once
there is more than one. -->

| Concern | File |
|---------|------|
| | |

## Architecture / data flow

<!-- How the pieces talk to each other: entry points, ports/URLs, request or
data flow, external services. Add sub-sections per non-obvious mechanism, each
naming the files on both ends. -->

## Data shape

<!-- The shapes exchanged across boundaries (API payloads, persisted files, DB
tables), each attributed to the file that owns it. Field names and types only —
not what consumers do with them. -->

## Run / apply changes / verify

<!-- The exact commands to start, apply a change, and check it — including any
step that is easy to forget (restarts with no hot reload, wrappers that must be
used instead of the raw tool, lint/test entry points). -->

```bash
```
