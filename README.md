# maestro-pulse

Workflow orchestrator for coordinating work between humans, automation, and disposable agents.

## Run

```bash
docker compose up -d --build
```

Then open <http://localhost:20444>.

## Where your projects live

In `resources/projects`, in this repo. You never have to create it — it is made
for you, at the latest when you add your first folder — and it is git-ignored, so
what you put there is yours and stays out of commits.

The API writes there as your own user (uid/gid 1000 by default). If yours differ,
run with them set:

```bash
UID=$(id -u) GID=$(id -g) docker compose up -d --build
```

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
