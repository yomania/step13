#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RULESET="${RULESET:-classic}"
PORT="${PORT:-3001}"
SKIP_PREPARE="${SKIP_PREPARE:-0}"

if [[ "$SKIP_PREPARE" != "1" ]]; then
    pnpm --filter server run dev:prepare:sqlite
fi

RULESET="$RULESET" PORT="$PORT" pnpm --filter server exec tsx watch src/index.ts
