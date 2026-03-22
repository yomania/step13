# release-gate-ui-ux-qa - Scenario Control Matrix

> Feature: `release-gate-ui-ux-qa`
> Source of truth: `docs/02-design/features/release-gate-ui-ux-qa.design.md`
> Scope: scenario ID validation, coverage control, owner/severity/evidence consistency, rerun linkage

## 1. Purpose

This matrix verifies that the scenario ID system defined in design is complete, non-overlapping, and operationally traceable across:

- `common`
- `17bo`
- `tengong`
- `tengong-easy`
- `cross`

It is a control document for gate operations. It does not change implementation, public APIs, runtime behavior, or test framework choice.

## 2. ID System Rules

### 2.1 Canonical ID Format

All scenario IDs must use the design-approved pattern:

`PREFIX-AREA-SEQ`

- `PREFIX` identifies the scenario family.
- `AREA` identifies the operational group.
- `SEQ` is a two-digit sequence number.

Allowed prefixes from design:

- `COM` for common scenarios
- `JB` for `17bo`
- `TG` for `tengong`
- `TE` for `tengong-easy`
- `XRV` for cross-ruleset verification

### 2.2 Uniqueness Rules

- Each scenario ID must appear exactly once in the control matrix.
- No ID may be reused across families, owners, or rerun records.
- A duplicated ID is a blocking documentation error until the matrix is corrected.
- A missing ID is also a blocking documentation error if the design lists it as must-cover.

### 2.3 Coverage Rule

The matrix is complete only when every scenario listed in the design document appears in one and only one row below.

## 3. Coverage Matrix

### 3.1 Common Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence | Coverage Check |
|-------------|----------|-------|--------------------------|-------------------|----------------|
| `COM-AUTH-01` | Member signup and initial entry | Product UX + Realtime | blocker | Screen capture, auth/ws smoke log | present |
| `COM-AUTH-02` | Login success and session restoration | Product UX + Realtime | blocker | Screen capture, session reuse log | present |
| `COM-LOBBY-01` | Ruleset selection screen and label separation | Product UX | major | Screen capture, manual check | present |
| `COM-ROOM-01` | Room list query and state reflection | Product UX + Realtime | major | Screen capture, server log or e2e record | present |
| `COM-ROOM-02` | Room creation and joinable state confirmation | Product UX + Realtime | blocker | Screen capture, create/join record | present |
| `COM-MATCH-01` | Match start and initial turn entry | Gameplay QA + Realtime | blocker | Game log, start screen capture | present |
| `COM-MATCH-02` | Forfeit / leave and end-state reflection | Gameplay QA | major | End-state capture, result log | present |
| `COM-REJOIN-01` | Reconnect / rejoin and state restoration | Realtime/Platform | blocker | Server log, screen capture | present |
| `COM-REPLAY-01` | Replay entry and basic playback | Product UX + Realtime | major | Replay capture, log link | present |
| `COM-RESP-01` | Mobile / desktop readability retention | Product UX | major | Device-specific captures | present |

### 3.2 `17bo` Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence | Coverage Check |
|-------------|----------|-------|--------------------------|-------------------|----------------|
| `JB-CORE-01` | Core loop entry and start of play | Gameplay QA | blocker | Turn-start capture, play log | present |
| `JB-CORE-02` | Action selection and state reflection during turn flow | Gameplay QA | blocker | Action before/after log, screen capture | present |
| `JB-CORE-03` | Mid-flow status consistency | Gameplay QA + Product UX | major | Status panel capture | present |
| `JB-RESULT-01` | Settlement / result screen accuracy | Gameplay QA | blocker | Result screen capture, settlement log | present |
| `JB-RESULT-02` | Post-end rejoin / replay path integrity | Gameplay QA + Realtime | major | End-to-end transition capture, log | present |

### 3.3 `tengong` Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence | Coverage Check |
|-------------|----------|-------|--------------------------|-------------------|----------------|
| `TG-STAGEA-01` | Stage A declaration entry and action exposure correctness | Gameplay QA + Product UX | blocker | Declaration UI capture | present |
| `TG-STAGEA-02` | Stage A declaration transitions to the next state correctly | Gameplay QA + Realtime | blocker | State transition log | present |
| `TG-STAGEB-01` | Stage B guess input validation | Gameplay QA | blocker | Input attempt capture, validation log | present |
| `TG-STAGEB-02` | Stage B information exposure policy compliance | Gameplay QA + Realtime | blocker | Masking comparison capture | present |
| `TG-STAGEB-03` | Stage B attack flow, turn progression, and sync | Gameplay QA + Realtime | blocker | Before/after state log | present |
| `TG-RIICHI-01` | Riichi action exposure when conditions are met | Gameplay QA + Product UX | major | Riichi-available state capture | present |
| `TG-RIICHI-02` | Riichi result reflected in judgment and display | Gameplay QA | major | Result capture, log | present |
| `TG-RESULT-01` | Settlement / result display consistency | Gameplay QA | blocker | Result screen, settlement log | present |

### 3.4 `tengong-easy` Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence | Coverage Check |
|-------------|----------|-------|--------------------------|-------------------|----------------|
| `TE-ENTRY-01` | EASY entry and clear distinction from the standard ruleset | Product UX | major | Entry screen capture | present |
| `TE-RIICHI-01` | Riichi remains unavailable in EASY | Gameplay QA | blocker | Action area capture | present |
| `TE-TILEID-01` | `tileId`-based declaration UI is visible and selectable | Gameplay QA + Product UX | major | Declaration screen capture | present |
| `TE-TILEID-02` | `tileId` selection error-prevention affordance works | Product UX | major | Error prevention / guidance capture | present |
| `TE-GUIDE-01` | Beginner guidance helps users understand the core flow | Product UX | major | Guidance capture, manual notes | present |
| `TE-GUIDE-02` | Labels and copy are not confused with standard `tengong` | Product UX | major | EASY vs standard comparison capture | present |
| `TE-RESULT-01` | End / result display matches EASY expectations | Gameplay QA | major | Result capture | present |

### 3.5 Cross-Ruleset Verification

| Scenario ID | Check Item | Owner | Default Severity On Fail | Required Evidence | Coverage Check |
|-------------|------------|-------|--------------------------|-------------------|----------------|
| `XRV-TIMER-01` | Timer / time-bank consistency | Realtime/Platform | blocker | Timer log, screen capture | present |
| `XRV-MASK-01` | Fog-of-war masking policy compliance | Gameplay QA + Realtime | blocker | Per-player comparison capture | present |
| `XRV-SYNC-01` | `queryId` response matching integrity | Realtime/Platform | blocker | Server log, client log | present |
| `XRV-BOT-01` | Bot-included start flow stability | Gameplay QA + Realtime | major | Start log, screen capture | present |
| `XRV-REPLAY-01` | Replay and raw log consistency | Realtime/Platform | blocker | Replay capture, raw log comparison | present |

## 4. Consistency Rules

### 4.1 Owner Rules

- Every scenario row must have at least one owner.
- Owner naming must match the design vocabulary:
  - `Product UX`
  - `Gameplay QA`
  - `Realtime/Platform`
  - `Automation`
  - `Release Captain / CTO Lead` for final gate control
- A scenario is inconsistent if the owner field is blank, vague, or replaced by an ad hoc role name.

### 4.2 Severity Rules

- The `Default Severity On Fail` field must match the design document unless an explicit documented exception exists.
- `blocker` scenarios cannot be downgraded informally during gate execution.
- `major` scenarios may only be accepted as risk with owner and release-captain review.
- `minor` is not used as the default severity in the design tables above; if a row is recorded as `minor`, it must be justified in the issue register and sign-off sheet.

### 4.3 Evidence Rules

- Every scenario row must name the evidence type expected by design.
- Evidence must be traceable by scenario ID.
- A scenario is inconsistent if the evidence type is generic, missing, or not attachable to the scenario record.
- Replay, masking, and `queryId` scenarios require both log evidence and visual or comparison evidence where the design calls for it.

### 4.4 Record Completeness Rules

- The control matrix is incomplete if any scenario family has fewer rows than the design document.
- The matrix is inconsistent if the same scenario appears in more than one family.
- The matrix is inconsistent if the owner, severity, or evidence rule contradicts the design document.

## 5. Rerun Linkage Rules

### 5.1 Rerun Identity

- Reruns must reference the original scenario ID.
- Reruns must not create a new scenario ID unless the design itself adds a new scenario.
- A rerun record must carry `runType=rerun` and a link back to the baseline record.

### 5.2 Rerun Scope Rules

- A rerun may cover one scenario or multiple impacted scenarios, but each impacted scenario must be listed explicitly.
- If a single issue affects multiple scenarios, the issue register must list all impacted scenario IDs.
- A rerun is incomplete until every impacted scenario has a matching record update.

### 5.3 Evidence Linkage Rules

- Rerun evidence must not overwrite baseline evidence.
- Rerun evidence must be appended or linked as a separate evidence item.
- Each rerun entry must include:
  - scenario ID
  - issue ID or change reference
  - run type
  - evidence reference
  - result
  - rerun owner

### 5.4 Cross-Scenario Linkage Rules

- If one defect reproduces across multiple scenario families, the issue record must name every impacted ID.
- Cross-ruleset failures must be treated as shared evidence, not duplicated independent root causes.
- When a rerun spans `common` and rule-specific scenarios, the common scenario must be recorded first.

## 6. Operator Confirmation Boundaries

Use this matrix to confirm design-defined coverage only. Do not reinterpret must-scenario status, accepted-risk timing, or evidence sufficiency beyond what the design already states.

The only valid confirmation points here are:

- every design scenario is present exactly once
- owner, default severity, and required evidence match the design wording
- rerun linkage points back to the original scenario ID
- any unresolved ambiguity is recorded separately in the check analysis document before final sign-off

## 7. Operational Check Summary

Use this matrix before baseline lock and before any rerun:

- Confirm every scenario family has complete coverage.
- Confirm no scenario ID is duplicated.
- Confirm owner, severity, and evidence fields match the design.
- Confirm each rerun points back to the original scenario ID.
- Confirm any unresolved ambiguity is recorded in the check analysis document before final sign-off.

## 8. Result Interpretation

- `pass`: the scenario is present, uniquely identified, and linked to the expected evidence type.
- `fail`: the scenario exists but does not meet the design-defined control rule.
- `missing`: the design scenario has no corresponding row or record.
- `duplicate`: the same scenario ID appears more than once.
- `manual-confirmation-needed`: the scenario is structurally valid but an operational choice must be recorded before gate closure.
