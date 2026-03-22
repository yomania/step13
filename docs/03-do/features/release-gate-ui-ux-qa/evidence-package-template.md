# release-gate-ui-ux-qa - Evidence Package Template

> Purpose: copy-pasteable operating template for baseline lock, scenario execution, issue tracking, waiver handling, and final sign-off.
> Source of truth: `docs/02-design/features/release-gate-ui-ux-qa.design.md`

---

## 1. Usage Rules

- Use this file as the canonical template pack for gate evidence.
- Create one evidence package per gate run.
- Keep scenario records append-only. Do not rewrite earlier baseline rows; add rerun rows instead.
- Link every issue, waiver, and sign-off record back to at least one scenario ID.
- Keep evidence references stable and human-readable.

## 2. Evidence Package Header

```md
## Evidence Package Header

- Feature: release-gate-ui-ux-qa
- Gate Date:
- Baseline Ref:
- Branch / Working Tree Note:
- Release Captain:
- Product UX Lead:
- Gameplay QA Lead:
- Realtime / Platform Lead:
- Automation Lead:
- Evidence Package Owner:
- Package Status: draft | active | locked | signed
```

## 3. Baseline Commands

```md
## Baseline Commands

| Command | Purpose | Result | Log Ref | Summary |
|---------|---------|--------|---------|---------|
| pnpm --filter @step13/core exec vitest run | Core logic regression | PASS/FAIL |  |  |
| pnpm test:e2e | Primary user flow regression | PASS/FAIL |  |  |
| pnpm run sim:ai | AI simulation flow check | PASS/FAIL |  |  |
| pnpm test:auth-ws:smoke | Auth and WebSocket smoke check | PASS/FAIL |  |  |
```

## 4. Scenario Run Record Format

### 4.1 Standard Record Table

```md
## Scenario Runs

| Scenario ID | Ruleset | Owner | Run Type | Status | Severity On Fail | Evidence Ref | Issue IDs | Executed By | Executed At | Notes |
|-------------|---------|-------|----------|--------|------------------|--------------|-----------|-------------|-------------|-------|
| COM-AUTH-01 | common | Product UX + Realtime | baseline | pass | blocker | evidence/2026-03-22/baseline/COM-AUTH-01/ |  |  |  |  |
| COM-ROOM-02 | common | Product UX + Realtime | baseline | fail | blocker | evidence/2026-03-22/baseline/COM-ROOM-02/ | RG-101 |  |  | creation flow blocked |
| TG-STAGEB-02 | tengong | Gameplay QA + Realtime | rerun | pass | blocker | evidence/2026-03-22/rerun/RG-101/TG-STAGEB-02/ | RG-101 |  |  | rerun after masking fix |
| TE-GUIDE-02 | tengong-easy | Product UX | waiver-review | waived | major | evidence/2026-03-22/waiver/RG-204/TE-GUIDE-02/ | RG-204 |  |  | accepted-risk approved |
```

### 4.2 Record Field Rules

- `Scenario ID`: must match the approved scenario matrix exactly.
- `Ruleset`: use `common`, `17bo`, `tengong`, `tengong-easy`, or `cross`.
- `Owner`: use the owner named in the design-approved scenario matrix.
- `Run Type`: use `baseline`, `rerun`, or `waiver-review`.
- `Status`: use `pending`, `running`, `pass`, `fail`, `waived`, or `blocked`.
- `Severity On Fail`: keep the default scenario severity unless triage explicitly changes it.
- `Evidence Ref`: point to the package folder, not an ad hoc note.
- `Issue IDs`: list comma-separated tracker IDs when multiple issues share the run.
- `Notes`: record one-line operator observation only.

## 5. Issue Register Template

```md
## Issue Register

| Issue ID | Title | Severity | Affected Surface | Impacted Scenario IDs | Owner | Due Date | Status | Rerun Required | Escalation Level | Exception Rationale |
|----------|-------|----------|------------------|-----------------------|-------|----------|--------|----------------|-------------------|---------------------|
| RG-101 | Hidden info mismatch on Stage B | blocker | ruleset-ui | TG-STAGEB-02, XRV-MASK-01 | Realtime / Platform Lead | 2026-03-24 | open | yes | release-captain |  |
| RG-102 | EASY guide copy is unclear | minor | common-ui | TE-GUIDE-01, TE-GUIDE-02 | Product UX Lead | 2026-03-27 | open | no | owner |  |
| RG-103 | Replay path is unstable | major | replay | COM-REPLAY-01, XRV-REPLAY-01 | Release Captain | 2026-03-25 | accepted-risk | yes | cto | Release approved with follow-up backlog item |
```

### 5.1 Issue Field Rules

- `Severity` must be `blocker`, `major`, or `minor`.
- `Affected Surface` must be one of `common-ui`, `ruleset-ui`, `server`, `socket`, `replay`, or `automation`.
- `Impacted Scenario IDs` must list every scenario affected by the same root cause.
- `Due Date` is required for `blocker` and `major`.
- `Rerun Required` should be `yes` whenever a fix may change the observed outcome.
- `Escalation Level` must reflect the highest active decision owner.

## 6. Accepted Risk / Waiver Template

```md
## Accepted Risks / Waivers

| Issue ID | Type | Approved By | Approved At | Scope | Rationale | Follow-up Ref |
|----------|------|-------------|-------------|-------|-----------|---------------|
| RG-103 | accepted-risk | Release Captain / Area Owner | 2026-03-22 18:30 KST | COM-REPLAY-01 | Replay issue is bounded, user impact is documented, and follow-up is scheduled | backlog/RG-103 |
| RG-104 | waiver | Release Captain | 2026-03-22 19:05 KST | TE-TILEID-02 | Copy and hint polish is below release threshold | backlog/TE-TILEID-02 |
```

### 6.1 Waiver Rules

- `accepted-risk` is only valid for `major` issues.
- `waiver` records a documented non-blocking exception already accepted in the gate package.
- Every waiver must include a follow-up reference.
- Never use a waiver to bypass a blocker.

## 7. Sign-off Sheet Template

```md
## Sign-off Sheet

| Area | Owner | Status | Blocker Count | Open Major Count | Evidence Ref | Signed At | Note |
|------|-------|--------|---------------|------------------|--------------|-----------|------|
| Common UX | Product UX Lead | pending | 0 | 0 |  |  |  |
| Gameplay | Gameplay QA Lead | pending | 0 | 0 |  |  |  |
| Realtime | Realtime / Platform Lead | pending | 0 | 0 |  |  |  |
| Automation | Automation Lead | pending | 0 | 0 |  |  |  |
| Final Gate | Release Captain / CTO Lead | pending | 0 | 0 |  |  |  |
```

### 7.1 Sign-off Rules

- `pending` means the area has not been reviewed or is still under execution.
- `blocked` means the area still has unresolved blockers, missing evidence, or unresolved major items.
- `signed` means the area meets its must-scenario and evidence requirements.
- Final Gate sign-off is only allowed when all four area rows are `signed`.

## 8. Final Notes Template

```md
## Final Notes

- Cross-ruleset regression summary:
- Outstanding majors:
- Outstanding minors moved to backlog:
```

## 9. Evidence Package Directory Naming

### 9.1 Recommended Package Layout

```text
evidence/
  2026-03-22/
    baseline/
      package.md
      commands/
      scenarios/
      issues/
      waivers/
      sign-off/
    rerun/
      RG-101/
        package.md
        scenarios/
        logs/
    waiver/
      RG-103/
        package.md
```

### 9.2 Naming Rules

- Use `YYYY-MM-DD` as the top-level date folder.
- Use `baseline`, `rerun`, or `waiver` as the run family folder.
- Use the scenario ID or issue ID as the child folder name.
- Use lowercase folder names and uppercase scenario/issue IDs exactly as defined.
- Keep file names short and deterministic, such as `package.md`, `summary.md`, `raw-log.txt`, `capture-01.png`.

## 10. Evidence Linking Rules

- Every scenario row must point to one folder or document anchor that contains the supporting log or capture.
- Every issue row must point to the impacted scenario IDs.
- Every waiver row must point to the issue ID and the follow-up reference.
- Every sign-off row must point to the exact evidence package that justified the sign-off.
- Do not reuse an evidence ref for a different gate date unless it is an explicit rerun of the same issue or scenario.
- If a rerun invalidates an earlier baseline row, keep the baseline row and add a new rerun row; never overwrite the baseline history.

## 11. Operator Workflow

```md
## Operator Workflow

1. Create the evidence package header.
2. Fill the baseline command table.
3. Record baseline scenario runs.
4. Register issues immediately after triage.
5. Record any waiver or accepted-risk decision.
6. Attach rerun rows under the impacted issue ID.
7. Update sign-off rows only after evidence is complete.
8. Lock the package after Final Gate sign-off.
```

## 12. Copy-Paste Example Package

```md
# Evidence Package

## Evidence Package Header

- Feature: release-gate-ui-ux-qa
- Gate Date: 2026-03-22
- Baseline Ref: baseline-2026-03-22-a
- Branch / Working Tree Note: dirty worktree snapshot recorded
- Release Captain: TBD
- Product UX Lead: TBD
- Gameplay QA Lead: TBD
- Realtime / Platform Lead: TBD
- Automation Lead: TBD
- Evidence Package Owner: TBD
- Package Status: draft

## Baseline Commands

| Command | Purpose | Result | Log Ref | Summary |
|---------|---------|--------|---------|---------|
| pnpm --filter @step13/core exec vitest run | Core logic regression | pass | commands/core-vitest.log | all pass |
| pnpm test:e2e | Primary user flow regression | fail | commands/e2e.log | COM-ROOM-02 blocked |
| pnpm run sim:ai | AI simulation flow check | pass | commands/sim-ai.log | no anomalies |
| pnpm test:auth-ws:smoke | Auth and WebSocket smoke check | pass | commands/auth-ws.log | handshake stable |

## Scenario Runs

| Scenario ID | Ruleset | Owner | Run Type | Status | Severity On Fail | Evidence Ref | Issue IDs | Executed By | Executed At | Notes |
|-------------|---------|-------|----------|--------|------------------|--------------|-----------|-------------|-------------|-------|
| COM-AUTH-01 | common | Product UX + Realtime | baseline | pass | blocker | scenarios/COM-AUTH-01/ |  | QA-01 | 2026-03-22 09:10 KST |  |
| COM-ROOM-02 | common | Product UX + Realtime | baseline | fail | blocker | scenarios/COM-ROOM-02/ | RG-101 | QA-02 | 2026-03-22 09:25 KST | room create flow blocked |
| TE-GUIDE-02 | tengong-easy | Product UX | waiver-review | waived | major | waiver/RG-103/TE-GUIDE-02/ | RG-103 | QA-03 | 2026-03-22 11:40 KST | accepted-risk approved |

## Issue Register

| Issue ID | Title | Severity | Affected Surface | Impacted Scenario IDs | Owner | Due Date | Status | Rerun Required | Escalation Level | Exception Rationale |
|----------|-------|----------|------------------|-----------------------|-------|----------|--------|----------------|-------------------|---------------------|
| RG-101 | Room creation blocked on common flow | blocker | common-ui | COM-ROOM-02, TG-STAGEB-02 | Realtime / Platform Lead | 2026-03-23 | resolved | yes | release-captain |  |

## Accepted Risks / Waivers

| Issue ID | Type | Approved By | Approved At | Scope | Rationale | Follow-up Ref |
|----------|------|-------------|-------------|-------|-----------|---------------|

## Sign-off Sheet

| Area | Owner | Status | Blocker Count | Open Major Count | Evidence Ref | Signed At | Note |
|------|-------|--------|---------------|------------------|--------------|-----------|------|
| Common UX | Product UX Lead | signed | 0 | 0 | sign-off/common-ux.md | 2026-03-22 18:10 KST |  |
| Gameplay | Gameplay QA Lead | signed | 0 | 0 | sign-off/gameplay.md | 2026-03-22 18:20 KST |  |
| Realtime | Realtime / Platform Lead | signed | 0 | 0 | sign-off/realtime.md | 2026-03-22 18:30 KST |  |
| Automation | Automation Lead | signed | 0 | 0 | sign-off/automation.md | 2026-03-22 18:35 KST |  |
| Final Gate | Release Captain / CTO Lead | signed | 0 | 0 | sign-off/final-gate.md | 2026-03-22 18:40 KST | go/no-go approved |

## Final Notes

- Cross-ruleset regression summary: no additional cross-ruleset regressions observed after rerun.
- Outstanding majors: none.
- Outstanding minors moved to backlog: TE guide copy polish.
```

## 13. Ambiguity Notes

- The exact tracker prefix for issue IDs is not defined in the design document, so `RG-*` is used as a local example only.
- The exact folder hierarchy for evidence storage is not mandated, so the recommended layout above is an operator convention, not a contract.
- The sign-off evidence file names are intentionally generic because the design document requires the link, not the transport format.
