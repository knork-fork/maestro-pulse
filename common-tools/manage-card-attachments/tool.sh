#!/usr/bin/env bash
#
# Manage Card Attachments — the deterministic layer around a maestro-pulse
# card's `attachments` array, so a harness never hand-edits workflow.json
# itself. Three subcommands, no content ever flows through this tool: a
# harness gets a real path back from `create` and edits that file directly
# with its own file tools, then calls `attach` once it's ready.
#
# Usage:
#   tool.sh create <workflow-path> [original-name]
#   tool.sh list <workflow-path> <card-id>
#   tool.sh attach <workflow-path> <card-id> <attachment-path-or-url>
#
# <workflow-path> is the workflow's own path relative to the maestro-pulse
# projects root, e.g. "giscloud/giscloud-containers-dev/workflows/Menial Backend Work".
#
# `create` writes a brand-new, empty `<timestamp>-name.md` file under the
# project's own `attachments/` folder — not yet on any card — and prints back
# both its maestro-pulse-relative path and (when MAESTRO_PULSE_HOST_DIR is
# configured server-side) a real host path to edit directly.
#
# `attach` is idempotent: an attachment already on the card is a no-op, not
# an error, so it's always safe to call "attach it if it's not attached
# already" without checking first — `list` is there for when you do want to
# check. `<attachment-path-or-url>` is either the relative path `create`
# handed back, or a bare URL (matched by "http://"/"https://") to attach
# as-is, with nothing read from disk.

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
  echo "manage-card-attachments: $*" >&2
  exit 1
}

usage() {
  die "usage: tool.sh create <workflow-path> [original-name] | tool.sh list <workflow-path> <card-id> | tool.sh attach <workflow-path> <card-id> <attachment-path-or-url>"
}

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || die "requires \`$cmd\`, which is not on PATH"
done

[ "$#" -ge 1 ] || usage
SUBCOMMAND="$1"
shift

# Sets API_STATUS/API_BODY rather than failing, so the status is inspected
# separately and reported with a tailored message — shared by every
# subcommand below. Built as an array, not string-interpolated, so a body
# containing spaces/quotes is passed to curl intact.
call_api() {
  local method="$1" query_or_empty="$2" body="$3"
  local -a curl_args=(-sS --request "$method" --header 'Content-Type: application/json')
  if [ -n "$body" ]; then curl_args+=(--data "$body"); fi
  curl_args+=(--write-out $'\n%{http_code}' "$MAESTRO_PULSE_BASE_URL/api/workflow-attachments${query_or_empty}")

  local response
  response="$(curl "${curl_args[@]}" 2>/dev/null)" || {
    die "could not reach maestro-pulse at $MAESTRO_PULSE_BASE_URL"
  }
  API_STATUS="${response##*$'\n'}"
  API_BODY="${response%$'\n'*}"
}

api_error() {
  local message
  message="$(printf '%s' "$API_BODY" | jq -r '.error // empty' 2>/dev/null)"
  die "maestro-pulse rejected the request${message:+: $message}"
}

case "$SUBCOMMAND" in
  create)
    [ "$#" -eq 1 ] || [ "$#" -eq 2 ] || usage
    WORKFLOW_PATH="$1"
    ORIGINAL_NAME="${2:-}"

    BODY="$(jq -n --arg path "$WORKFLOW_PATH" --arg originalName "$ORIGINAL_NAME" \
      '{path: $path} + (if $originalName == "" then {} else {originalName: $originalName} end)')"

    call_api POST "" "$BODY"
    case "$API_STATUS" in
      201) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while creating an attachment file" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  list)
    [ "$#" -eq 2 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"

    QUERY="?path=$(jq -rn --arg v "$WORKFLOW_PATH" '$v|@uri')&cardId=$(jq -rn --arg v "$CARD_ID" '$v|@uri')"
    call_api GET "$QUERY" ""
    case "$API_STATUS" in
      200) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\", or no such card \"$CARD_ID\"" ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while listing attachments" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  attach)
    [ "$#" -eq 3 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"
    ATTACHMENT="$3"

    BODY="$(jq -n --arg path "$WORKFLOW_PATH" --arg cardId "$CARD_ID" --arg attachment "$ATTACHMENT" \
      '{path: $path, cardId: $cardId, attachment: $attachment}')"

    call_api PATCH "" "$BODY"
    case "$API_STATUS" in
      200) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\", no such card \"$CARD_ID\", or no such attachment file \"$ATTACHMENT\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while attaching to card $CARD_ID" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  *)
    usage
    ;;
esac
