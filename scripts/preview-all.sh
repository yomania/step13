#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pnpm --filter server dev &
SERVER_PID=$!

pnpm --filter web exec vite preview --port 3000 --strictPort &
WEB_PID=$!

cleanup() {
    kill "$SERVER_PID" "$WEB_PID" 2>/dev/null || true
    wait "$SERVER_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup EXIT

wait "$SERVER_PID" "$WEB_PID"
