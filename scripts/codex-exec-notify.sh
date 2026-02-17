#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY_SCRIPT="${SCRIPT_DIR}/notify-complete.sh"

notify_sound() {
    if [ -x "${NOTIFY_SCRIPT}" ]; then
        "${NOTIFY_SCRIPT}" >/dev/null 2>&1 || true
    else
        printf '\a'
    fi
}

# Run codex exec with JSON events and surface output as-is.
# Emit sound when approval-related events/messages appear, and when a turn ends.
command codex exec --json "$@" | while IFS= read -r line; do
    printf '%s\n' "${line}"

    case "${line}" in
        *'"type":"turn.completed"'*|*'"type":"turn.failed"'*)
            notify_sound
            ;;
        *'"type":"approval.'*|*'"type":"permission.'*|*'"approval"'*|*'"escalat"'*)
            notify_sound
            ;;
        *"approval"*|*"Approval"*|*"escalat"*|*"Escalat"*)
            notify_sound
            ;;
    esac
done
