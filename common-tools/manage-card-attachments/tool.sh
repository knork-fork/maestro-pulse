#!/usr/bin/env bash
#
# Manage Card Attachments — the deterministic layer around a maestro-pulse
# card's `attachments` array, so a harness never hand-edits workflow.json
# itself. No content ever flows through this tool: `create` hands back a
# real path and the harness edits that file directly with its own file
# tools — there is no `edit` subcommand.
#
# Usage:
#   tool.sh create <workflow-path> <card-id> [original-name]
#   tool.sh list <workflow-path> <card-id>
#   tool.sh add <workflow-path> <card-id> <url>
#   tool.sh remove <workflow-path> <card-id> <attachment>
#
# <workflow-path> is the workflow's own path relative to the maestro-pulse
# projects root, e.g. "giscloud/giscloud-containers-dev/workflows/Menial Backend Work".
#
# `create` writes a brand-new, empty `<timestamp>-name.md` file under the
# project's own `attachments/` folder, attaches it to <card-id> in the same
# command, and prints where to edit it — a real host path, when
# MAESTRO_PULSE_HOST_DIR is configured server-side.
#
# `list` prints every attachment on the card; a file entry's `hostPath` is
# the same kind of real, directly-editable path `create` prints — nothing
# else reads or writes the file's contents.
#
# `add` records a bare URL (matched by "http://"/"https://") on the card —
# for a file, use `create` instead, never `add`. `remove` is idempotent:
# removing an attachment that isn't on the card is a no-op, not an error, so
# it's always safe to call "remove it if it's there" without checking first.
# `remove`'s <attachment> is the exact value `list` printed; it only detaches
# the reference — a file attachment's own file is left on disk untouched.

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
  die "usage: tool.sh create <workflow-path> <card-id> [original-name] | tool.sh list <workflow-path> <card-id> | tool.sh add <workflow-path> <card-id> <url> | tool.sh remove <workflow-path> <card-id> <attachment>"
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

uri_encode() {
  jq -rn --arg v "$1" '$v|@uri'
}

case "$SUBCOMMAND" in
  create)
    [ "$#" -eq 2 ] || [ "$#" -eq 3 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"
    ORIGINAL_NAME="${3:-}"

    BODY="$(jq -n --arg path "$WORKFLOW_PATH" --arg originalName "$ORIGINAL_NAME" \
      '{path: $path} + (if $originalName == "" then {} else {originalName: $originalName} end)')"

    call_api POST "" "$BODY"
    case "$API_STATUS" in
      201) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while creating an attachment file" ;;
    esac

    REL_PATH="$(printf '%s' "$API_BODY" | jq -r '.path')"
    HOST_PATH="$(printf '%s' "$API_BODY" | jq -r '.hostPath // empty')"

    ATTACH_BODY="$(jq -n --arg path "$WORKFLOW_PATH" --arg cardId "$CARD_ID" --arg attachment "$REL_PATH" \
      '{path: $path, cardId: $cardId, attachment: $attachment}')"

    call_api PATCH "" "$ATTACH_BODY"
    case "$API_STATUS" in
      200) ;;
      404) die "created \"$REL_PATH\" but could not attach it: no such card \"$CARD_ID\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while attaching \"$REL_PATH\" to card $CARD_ID" ;;
    esac

    if [ -n "$HOST_PATH" ]; then
      echo "edit the file at $HOST_PATH"
    else
      echo "edit the file at $REL_PATH (host path not configured — set MAESTRO_PULSE_HOST_DIR)"
    fi
    ;;

  list)
    [ "$#" -eq 2 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"

    QUERY="?path=$(uri_encode "$WORKFLOW_PATH")&cardId=$(uri_encode "$CARD_ID")"
    call_api GET "$QUERY" ""
    case "$API_STATUS" in
      200) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\", or no such card \"$CARD_ID\"" ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while listing attachments" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  add)
    [ "$#" -eq 3 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"
    URL="$3"

    case "$URL" in
      http://*|https://*) ;;
      *) die "\"$URL\" is not a URL — use \`tool.sh create\` to attach a file" ;;
    esac

    BODY="$(jq -n --arg path "$WORKFLOW_PATH" --arg cardId "$CARD_ID" --arg attachment "$URL" \
      '{path: $path, cardId: $cardId, attachment: $attachment}')"

    call_api PATCH "" "$BODY"
    case "$API_STATUS" in
      200) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\", or no such card \"$CARD_ID\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while adding \"$URL\" to card $CARD_ID" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  remove)
    [ "$#" -eq 3 ] || usage
    WORKFLOW_PATH="$1"
    CARD_ID="$2"
    ATTACHMENT="$3"

    QUERY="?path=$(uri_encode "$WORKFLOW_PATH")&cardId=$(uri_encode "$CARD_ID")&attachment=$(uri_encode "$ATTACHMENT")"
    call_api DELETE "$QUERY" ""
    case "$API_STATUS" in
      200) ;;
      404) die "no such workflow at \"$WORKFLOW_PATH\", or no such card \"$CARD_ID\"" ;;
      400) api_error ;;
      *) die "maestro-pulse returned HTTP $API_STATUS while removing \"$ATTACHMENT\" from card $CARD_ID" ;;
    esac

    printf '%s\n' "$API_BODY"
    ;;

  *)
    usage
    ;;
esac
