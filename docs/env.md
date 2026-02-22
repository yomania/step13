# Environment Variables

This document defines runtime environment variables for the Step13 monorepo.

## apps/server

Required in production:
- `JWT_SECRET`
  - Must be set. Server will refuse to start if missing in production.
  - Use a long, random string (32+ chars).
- `CORS_ORIGINS`
  - Comma-separated allowlist, example: `https://example.com,https://admin.example.com`
  - Must not include `*` in production.

Common development defaults:
- `DATABASE_URL`
  - Example: `file:./dev.db`
- `JWT_SECRET`
  - Example: `dev-local-please-change`
- `CORS_ORIGINS`
  - Example: `http://localhost:5173,http://127.0.0.1:5173`

## apps/web

- `VITE_API_URL`
  - Base URL for the server API.
  - Example: `http://localhost:3001`
