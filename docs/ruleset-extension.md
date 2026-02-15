# Ruleset Extension Guide

## Goal

Add new game variants without increasing conditional branching in `machine.ts`.

## Entry Points

1. Implement policy behavior in engine layer:
   - `packages/core/src/engine/defaultEngine.ts` (reference)
   - or add a new engine module
2. Register it in:
   - `packages/core/src/engine/rulesets.ts`
3. Select it at machine creation:
   - `createGameMachine({ ruleset: '...' })`

## Minimal Steps

1. Add a new ruleset name in `RulesetName`.
2. Create engine instance for that ruleset in `createEngineForRuleset`.
3. Keep machine graph unchanged unless phase pipeline itself differs.

## Runtime Selection

Server boot:

- `apps/server/src/index.ts` reads `RULESET` environment variable
- creates room with `new GameRoom(roomId, ruleset)`

Example:

```bash
RULESET=classic pnpm --filter server dev
```

## Design Rule

- Put **how** to compute in engine policies.
- Keep **when** to transition in machine states.
