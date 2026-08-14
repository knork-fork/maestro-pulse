#!/usr/bin/env bash
set -euo pipefail

docker build --target build -t maestro-pulse-build .
docker run --rm maestro-pulse-build npm run typecheck
