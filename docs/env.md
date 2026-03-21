# Environment Variables

This document defines runtime environment variables for the Step13 monorepo.

## apps/server

Required in production:
- `JWT_SECRET`
  - Must be set. Server will refuse to start if missing in production.
  - Use a long, random string (32+ chars).
- `CORS_ORIGINS`
  - Comma-separated allowlist, example: `https://step13-production.up.railway.app,https://admin.example.com`
  - Must not include `*` in production.
- `ROOM_IDLE_TTL_MS`
  - Milliseconds before an empty non-default room is eligible for cleanup.
  - Set to `0` to disable cleanup.
- `ROOM_CLEANUP_INTERVAL_MS`
  - Milliseconds between cleanup sweeps for idle rooms.
  - Set to `0` to disable cleanup.

Common development defaults (local SQLite):
- `DATABASE_URL`
  - Example: `file:./dev.db`
- `RULESET`
  - Server deployment ruleset. Example: `classic`, `ten_attack_defense`, `ten_attack_defense_easy`
- `JWT_SECRET`
  - Example: `dev-local-please-change`
- `CORS_ORIGINS`
  - Example: `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`
- `ROOM_IDLE_TTL_MS`
  - Example: `0`
- `ROOM_CLEANUP_INTERVAL_MS`
  - Example: `0`

Deployment defaults (PostgreSQL):
- `DATABASE_URL`
  - Example: `postgresql://<user>:<password>@<host>:5432/<db>?schema=public`

## apps/web

- `VITE_API_URL`
  - Classic ruleset fallback API URL.
  - Local Example: `http://localhost:3001`
  - Production Example: `https://step13-production.up.railway.app`
- `VITE_WS_URL`
  - Classic ruleset fallback WebSocket endpoint URL.
  - Local Example: `ws://localhost:3001/ws`
  - Production Example: `wss://step13-production.up.railway.app/ws`
- `VITE_CLASSIC_API_URL`
  - Explicit classic ruleset API URL. If omitted, `VITE_API_URL` is used.
- `VITE_CLASSIC_WS_URL`
  - Explicit classic ruleset WS URL. If omitted, `VITE_WS_URL` is used.
- `VITE_TEN_API_URL`
  - `ten_attack_defense` API URL.
- `VITE_TEN_WS_URL`
  - `ten_attack_defense` WS URL.
- `VITE_TEN_EASY_API_URL`
  - `ten_attack_defense_easy` API URL. If omitted, `VITE_TEN_API_URL` is reused.
- `VITE_TEN_EASY_WS_URL`
  - `ten_attack_defense_easy` WS URL. If omitted, `VITE_TEN_WS_URL` is reused.

## Local `dev:all` defaults

- `pnpm dev:all` starts three processes by default:
  - classic server: `http://localhost:3001`
  - ten server: `http://localhost:3002`
  - web: `http://localhost:3000`
- The web dev process injects local ruleset endpoints automatically unless they are already set in the shell:
  - `VITE_CLASSIC_API_URL=http://localhost:3001`
  - `VITE_CLASSIC_WS_URL=ws://localhost:3001/ws`
  - `VITE_TEN_API_URL=http://localhost:3002`
  - `VITE_TEN_WS_URL=ws://localhost:3002/ws`
  - `VITE_TEN_EASY_API_URL=http://localhost:3002`
  - `VITE_TEN_EASY_WS_URL=ws://localhost:3002/ws`
- `ten_attack_defense_easy` reuses the ten local server by default; `dev:all` does not start a separate easy server.
- Optional local overrides:
  - `CLASSIC_PORT`
  - `TEN_PORT`
  - `WEB_PORT`
