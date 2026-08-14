# maestro-pulse

Three-pane single-page app (projects sidebar / main area / sessions sidebar),
built with React + TypeScript + Vite and served by nginx. The build runs inside
Docker, so **nothing is installed on the host** — Docker is the only
requirement.

## Run

```bash
docker compose up -d --build
```

Then open <http://localhost:20444>.

## Stop

```bash
docker compose down
```

## Apply changes

The app is compiled into the image, so rebuild after editing anything in `src/`:

```bash
docker compose up -d --build
```

## Type check

```bash
docker build --target build -t maestro-pulse-build . && \
  docker run --rm maestro-pulse-build npm run typecheck
```
