#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pnpm --filter server run dev:prepare:sqlite

CLASSIC_PORT="${CLASSIC_PORT:-3001}"
TEN_PORT="${TEN_PORT:-3002}"
WEB_PORT="${WEB_PORT:-3000}"

RULESET=classic PORT="$CLASSIC_PORT" SKIP_PREPARE=1 ./scripts/dev-server.sh &
CLASSIC_PID=$!

RULESET=ten_attack_defense PORT="$TEN_PORT" SKIP_PREPARE=1 ./scripts/dev-server.sh &
TEN_PID=$!

WEB_PORT="$WEB_PORT" ./scripts/dev-web.sh &
WEB_PID=$!

cleanup() {
    kill "$CLASSIC_PID" "$TEN_PID" "$WEB_PID" 2>/dev/null || true
    wait "$CLASSIC_PID" "$TEN_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait "$CLASSIC_PID" "$TEN_PID" "$WEB_PID"
