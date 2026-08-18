#!/usr/bin/env bash
#
# Move Maestro Pulse Card — move a card to any column on a maestro-pulse
# workflow board, unconditionally. Unlike the UI's own move controls, this
# calls an endpoint that does not resist the target column: no adjacency
# check, no bot-column lock, no Backlog/Done position rule.
#
# Usage: tool.sh <workflow-path> <card-id> <target-column>
#
# <workflow-path> is the workflow's own path relative to the maestro-pulse
# projects root, e.g. "giscloud/giscloud-containers-dev/workflows/Menial Backend Work".

set -euo pipefail

TOOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# .env holds the variable names with placeholder values and is committed;
# .env.local holds the real ones, is gitignored, and is loaded second so it
# wins. Both are read from this tool's own folder, never the caller's cwd.
set -a
if [ -f "$TOOL_DIR/.env" ]; then . "$TOOL_DIR/.env"; fi
if [ -f "$TOOL_DIR/.env.local" ]; then . "$TOOL_DIR/.env.local"; fi
set +a

# Not a credential — maestro-pulse's own API is unauthenticated, reached over
# the docker network / the host port nginx publishes. This just needs a
# working default, which is why there is no require_credential guard on it.
MAESTRO_PULSE_BASE_URL="${MAESTRO_PULSE_BASE_URL:-http://localhost:20444}"

die() {
  echo "move-maestro-pulse-card: $*" >&2
  exit 1
}

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || die "requires \`$cmd\`, which is not on PATH"
done

if [ "$#" -ne 3 ]; then
  die "usage: tool.sh <workflow-path> <card-id> <target-column>"
fi

WORKFLOW_PATH="$1"
CARD_ID="$2"
TARGET_COLUMN="$3"

BODY="$(jq -n \
  --arg path "$WORKFLOW_PATH" \
  --arg cardId "$CARD_ID" \
  --arg column "$TARGET_COLUMN" \
  '{path: $path, cardId: $cardId, action: "move-to", column: $column}')"

# Sets API_STATUS/API_BODY rather than failing, so the status is inspected
# separately and reported with a tailored message.
API_STATUS=""
API_BODY=""
response="$(curl -sS \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --data "$BODY" \
  --write-out $'\n%{http_code}' \
  "$MAESTRO_PULSE_BASE_URL/api/workflow-cards" 2>/dev/null)" || {
  die "could not reach maestro-pulse at $MAESTRO_PULSE_BASE_URL"
}
API_STATUS="${response##*$'\n'}"
API_BODY="${response%$'\n'*}"

case "$API_STATUS" in
  200) ;;
  404) die "no such workflow at \"$WORKFLOW_PATH\", or no such card \"$CARD_ID\"" ;;
  400)
    message="$(printf '%s' "$API_BODY" | jq -r '.error // empty' 2>/dev/null)"
    die "maestro-pulse rejected the move${message:+: $message}"
    ;;
  *) die "maestro-pulse returned HTTP $API_STATUS while moving card $CARD_ID" ;;
esac

jq -n --arg path "$WORKFLOW_PATH" --arg cardId "$CARD_ID" --arg column "$TARGET_COLUMN" \
  '{path: $path, card_id: $cardId, column: $column}'
