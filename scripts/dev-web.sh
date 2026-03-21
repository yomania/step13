#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WEB_PORT="${WEB_PORT:-3000}"

export VITE_CLASSIC_API_URL="${VITE_CLASSIC_API_URL:-http://localhost:3001}"
export VITE_CLASSIC_WS_URL="${VITE_CLASSIC_WS_URL:-ws://localhost:3001/ws}"
export VITE_TEN_API_URL="${VITE_TEN_API_URL:-http://localhost:3002}"
export VITE_TEN_WS_URL="${VITE_TEN_WS_URL:-ws://localhost:3002/ws}"
export VITE_TEN_EASY_API_URL="${VITE_TEN_EASY_API_URL:-$VITE_TEN_API_URL}"
export VITE_TEN_EASY_WS_URL="${VITE_TEN_EASY_WS_URL:-$VITE_TEN_WS_URL}"

pnpm --filter web exec vite --port "$WEB_PORT" --strictPort
