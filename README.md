# maestro-pulse

Workflow orchestrator for coordinating work between humans, automation, and disposable agents.

## Run

Set this checkout's absolute path on the host into `.env.local`:

```bash
echo "MAESTRO_PULSE_HOST_DIR=/absolute/path/to/this/checkout" > .env.local
```
Then run:

```bash
docker compose up -d --build
```

```bash
docker compose up -d --build
```

Then open <http://localhost:20444>.

The API writes into `resources/projects` as your own user (uid/gid 1000 by
default). If yours differ, run with them set:

```bash
UID=$(id -u) GID=$(id -g) docker compose up -d --build
```

## Usage

Create a project from the sidebar's "New" button. It's scaffolded on disk
under `resources/projects/<name>`, which is git-ignored in this repo — so to
keep your own project's files under version control, `cd` into it and
`git init` there:

```bash
cd resources/projects/<name>
git init
```

`project.json` (which records the project's location on your host machine) is
gitignored inside that new repo too; `project.json.dist` is committed instead,
as a template.

## Stop

```bash
docker compose down
```

## Apply changes

The app is compiled into the image, so rebuild after editing anything in `src/`
or `server/`:

```bash
docker compose up -d --build
```

## Type check

```bash
docker build --target build -t maestro-pulse-build . && \
  docker run --rm maestro-pulse-build npm run typecheck
```
