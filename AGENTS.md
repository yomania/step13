# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` + Turborepo monorepo.
- `apps/web`: React + Vite frontend (`src/` for UI, `dist/` build output).
- `apps/server`: Fastify + WebSocket backend (`src/` source, `dist/` compiled JS).
- `packages/core`: shared game state machines and logic (`src/`, with `replayMachine.test.ts`).
- `packages/proto`: shared types/contracts.
- `packages/scoring`: scoring and shanten logic.
- `docs/prd.yaml`: product requirements.
- `scripts/`: ad-hoc local test clients.

Prefer placing reusable domain logic in `packages/*` and keeping app-specific wiring inside `apps/*`.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run all `dev` tasks via Turbo.
- `pnpm build`: run workspace builds in dependency order.
- `pnpm --filter web dev`: run only the frontend locally.
- `pnpm --filter server dev`: run only the backend locally.
- `pnpm --filter @step13/core exec vitest run`: run current unit tests.
- `node scripts/test-client.js`: basic WebSocket smoke test against local server.

## Coding Style & Naming Conventions
- Language: TypeScript across apps and packages.
- Indentation: 4 spaces; keep consistent with existing files.
- Naming: `PascalCase` for React components and classes, `camelCase` for variables/functions, kebab-case for non-component filenames.
- Exports: keep package public APIs centralized in `src/index.ts`.
- Prefer strict typing; avoid adding `any` unless unavoidable and short-lived.

## Testing Guidelines
- Framework in use: Vitest (currently in `packages/core`).
- Test files: `*.test.ts`, colocated with source (example: `packages/core/src/replayMachine.test.ts`).
- Focus tests on deterministic state transitions, event flows, and scoring edge cases.
- Run tests before opening a PR, especially when touching shared packages.

## Commit & Pull Request Guidelines
- Commit messages should be short, imperative, and scoped (example: `Fix replay step bounds in core machine`).
- Keep commits focused; avoid mixing refactors and behavior changes.
- PRs should include:
  - What changed and why.
  - Affected packages/apps (`apps/web`, `apps/server`, etc.).
  - How it was validated (commands run, test results).
  - UI screenshots or short recordings for frontend-visible changes.
