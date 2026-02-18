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
- When making code changes, run the tests that cover the directly affected logic and adjacent integration paths; do not skip impacted test scopes.
- If no existing test covers the changed behavior, add or update tests first, then run them.
- In every code-change report/PR, include the exact test commands executed and their results (pass/fail).
- Enforce non-watch test runs in automation/CI/local verification (use `vitest run`, not `vitest`).
- Required validation matrix by change scope:
  - `apps/web` 변경: `pnpm --filter web build` + 관련 로직 테스트 (`pnpm --filter @step13/core exec vitest run`).
  - `apps/server` 변경: `pnpm --filter server build` + `pnpm test:e2e`.
  - `packages/core` 변경: `pnpm --filter @step13/core exec vitest run`.
  - `packages/scoring` 변경: `pnpm --filter @step13/scoring test`.
  - `packages/bot` 변경: `pnpm --filter @step13/bot test`.
- Side-effect 방지 체크리스트 (수정 전/후 확인 필수):
  - 비동기 요청/응답은 `queryId` 등 상관관계 키로 매칭하고, 다른 요청 응답을 소비하지 않도록 할 것.
  - UI 상태 초기화는 참조 변경(reference change)만으로 트리거하지 말고, 실제 데이터 변경 여부를 확인할 것.
  - 타이머/소켓/구독/워커는 cleanup 경로를 테스트로 검증할 것.

## Commit & Pull Request Guidelines
- Commit messages should be short, imperative, and scoped (example: `Fix replay step bounds in core machine`).
- Keep commits focused; avoid mixing refactors and behavior changes.
- PRs should include:
  - What changed and why.
  - Affected packages/apps (`apps/web`, `apps/server`, etc.).
  - How it was validated (commands run, test results).
  - UI screenshots or short recordings for frontend-visible changes.
