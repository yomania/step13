# Environment Variables

This document defines runtime environment variables for the Step13 monorepo.

## apps/server

Required in production:
- `JWT_SECRET`
  - Must be set. Server will refuse to start if missing in production.
  - Use a long, random string (32+ chars).
- `CORS_ORIGINS`
  - Comma-separated allowlist, example: `https://zealous-growth.up.railway.app,https://admin.example.com`
  - Must not include `*` in production.
- `ROOM_IDLE_TTL_MS`
  - Milliseconds before an empty non-default room is eligible for cleanup.
  - Set to `0` to disable cleanup.
- `ROOM_CLEANUP_INTERVAL_MS`
  - Milliseconds between cleanup sweeps for idle rooms.
  - Set to `0` to disable cleanup.

Common development defaults:
- `DATABASE_URL`
  - Example: `file:./dev.db`
- `JWT_SECRET`
  - Example: `dev-local-please-change`
- `CORS_ORIGINS`
  - Example: `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`
- `ROOM_IDLE_TTL_MS`
  - Example: `0`
- `ROOM_CLEANUP_INTERVAL_MS`
  - Example: `0`

## apps/web

- `VITE_API_URL`
  - Base URL for the server API.
  - Local Example: `http://localhost:3001`
  - Production Example: `https://zealous-growth.up.railway.app`
- `VITE_WS_URL`
  - Full WebSocket endpoint URL for authenticated game connections.
  - Local Example: `ws://localhost:3001/ws`
  - Production Example: `wss://zealous-growth.up.railway.app/ws`
