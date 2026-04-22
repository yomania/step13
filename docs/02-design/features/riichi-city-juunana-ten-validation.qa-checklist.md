# QA Evidence Checklist: riichi-city-juunana-ten-validation

## 1. Purpose

이 체크리스트는 자동 검증 결과와 부족한 수동 증거를 분리해, release gate와 Do 단계 재진입 조건을 명확히 만든다.

## 2. Evidence Matrix

| evidenceId | item | current status | evidence | gap / note |
|---|---|---|---|---|
| Q-01 | Juunana external anchor | PASS | `SteamDB` 2025-04-11, `TuxDB` 2025-04-15, `Riichi.Wiki - Juunana Ho` 2025-07-07 | direct in-game capture 없음 |
| Q-02 | ten external anchor | PASS | Steam announcement 2025-03-13/14, `Riichi.Wiki - Two-player rules from Ten` 2026-03-20, YouTube gameplay checked 2026-03-25 | timecoded screenshot 정리 필요 |
| Q-03 | direct UI capture | PARTIAL | 일부 external gameplay anchor 존재 | Juunana direct UI, ten round-end direct capture 부족 |
| Q-04 | visibility capture | PARTIAL | sanitize code anchor 확보 | attacker/defender/observer 동일 시나리오 캡처 부족 |
| Q-05 | round-end / result-flow capture | PARTIAL | internal App overlay anchor 확보 | numeric result, confirm CTA, replay path direct capture 부족 |
| Q-06 | mobile width verification | MISSING | none | narrow-width screenshot / manual note 필요 |
| Q-07 | core unit tests | PASS | `pnpm --filter @step13/core exec vitest run` -> 7 files, 50 tests passed, 38.71s | keep latest rerun on Do |
| Q-08 | scoring tests | PASS | `pnpm --filter @step13/scoring test` -> 1 file, 28 tests passed, 227ms | keep latest rerun on Do |
| Q-09 | web build | PASS WITH WARNING | `pnpm --filter web build` -> build success, chunk-size warning | warning은 release note 수준 |
| Q-10 | server build | PASS | `pnpm --filter server build` -> Prisma client + TS build success | keep latest rerun on Do |
| Q-11 | e2e | PASS | `pnpm test:e2e` -> PASS, including `ten easy: 리치 거부 및 timeout 강제 기리` | runtime blocker 해소, latest packet summary 유지 필요 |
| Q-12 | manual QA notes | PARTIAL | docs only | attacker/defender/observer, mobile, result-flow 실제 note 필요 |

## 3. Automated Validation Snapshot

> Date: 2026-03-26

| command | result | interpretation |
|---|---|---|
| `pnpm --filter @step13/core exec vitest run` | PASS (7 files, 50 tests) | core state-machine regression baseline 최신 통과 |
| `pnpm --filter @step13/scoring test` | PASS (1 file, 28 tests) | scoring baseline 최신 통과 |
| `pnpm --filter web build` | PASS with chunk-size warning | production bundle 생성 가능, warning은 note 수준 |
| `pnpm --filter server build` | PASS | backend compile baseline 최신 통과 |
| `pnpm test:e2e` | PASS | easy mode timeout discard 포함 전체 e2e 통과, release blocker 해소 |

## 4. Manual Evidence Still Required

1. `ten_b_guess` 화면 direct capture
2. `ten_b_assault` 화면 direct capture
3. `ten_round_end` result/confirm/replay capture
4. attacker / defender / observer 동일 시점 visibility 비교 capture
5. mobile width (`<= 430px`)에서 CTA 가독성 확인
6. Juunana/classic hand-build / result-flow 수동 캡처 또는 최소 note

## 5. Release Gate Interpretation

### 5.1 Current Gate

- `core`, `scoring`, `web`, `server`, `e2e`까지 자동 검증 기준으로 현재 빌드/회귀 게이트는 통과했다.
- runtime blocker는 해소됐지만 release-grade evidence packet은 아직 닫히지 않았다.
- direct capture와 manual QA note 부족 때문에 documentation/evidence gate는 계속 열리지 않았다.

### 5.2 Effect of Latest `pnpm test:e2e` Pass

2026-03-26 기준 `pnpm test:e2e` 통과는 기존 runtime blocker를 해소했다.

이유:

1. easy mode timeout discard는 `ten_attack_defense_easy`의 핵심 안전장치였고, 이 경로가 이제 e2e 기준으로 다시 닫혔다.
2. 따라서 현재 남은 핵심 리스크는 runtime bug가 아니라 evidence packet closure와 stale wording이다.
3. D8에서는 이 항목을 active blocker가 아니라 closed blocker history 또는 validation note로 다뤄야 한다.

## 6. Evidence Note Format

- `date`
- `scenario`
- `ruleset`
- `viewer`
- `step`
- `expected`
- `observed`
- `result`
- `source`
- `notes`

## 7. Team Ownership

| Evidence Area | Owner | Required Output |
|---------------|-------|-----------------|
| external rule anchor | Doc / Rules | source + timestamp + mode + scene |
| result numeric proof | Rules / QA | scoreboard or round-end capture with note |
| visibility capture | Runtime / QA | attacker / defender / observer same-step packet |
| mobile readability | UX / QA | `<=430px` screenshot + CTA overlap note |
| automated validation rerun | Rules / Runtime | command + date + pass/fail + blocker note |

## 8. Evidence Packet Rule

하나의 증거는 아래 4개가 함께 있어야 `packet complete`로 간주한다.

1. source
2. timestamp or checked date
3. scene or step
4. design row linkage (`D2`, `D3`, `D4`, `D5` 중 하나)

## 8.1 Evidence Packet Inventory

| packetId | linked evidence rows | source bundle | current state | why not complete yet |
|----------|----------------------|---------------|---------------|----------------------|
| QP-01 | `Q-01`, D2 Juunana rows | `EB-J-01` | partial | in-game result/UI capture 없음 |
| QP-02 | `Q-02`, `Q-03`, D3 ten rows | `EB-T-01`, `EB-UI-01` | partial | timecoded screenshot, round-end packet 부족 |
| QP-03 | `Q-04`, D5 visibility rows | `EB-V-01` | partial | synchronized multi-viewer capture 없음 |
| QP-04 | `Q-05`, D4 result-related rows | `EB-T-01`, internal App anchors | partial | numeric result scene, confirm/replay direct proof 부족 |
| QP-05 | `Q-06`, `Q-12`, D6 UI rows | web manual QA | missing | `<=430px` screenshot/note 없음 |
| QP-06 | `Q-07`~`Q-11` | `EB-Q-01` | partial | 자동 검증 5종은 모두 PASS, but evidence packet summary/date/report linkage 갱신 필요 |

## 8.2 Manual Scenario Pack

자동 검증이 통과해도 아래 수동 시나리오가 비어 있으면 release-grade evidence로 보지 않는다.

| scenarioId | ruleset | viewer | step | pass condition | evidence artifact |
|------------|---------|--------|------|----------------|-------------------|
| MQ-01 | ten | defender | `ten_b_guess` | 후보 선택, 실패 기록, 남은 횟수가 한 화면에서 읽힘 | screenshot + short note |
| MQ-02 | ten | attacker | `ten_b_assault` | pending draw, 남은 공격, discard decision이 연속적으로 이해됨 | screenshot + short note |
| MQ-03 | ten | observer | `ten_round_end` | 결과 요약은 보이되 비공개 정보는 여전히 숨김 | screenshot + visibility note |
| MQ-04 | classic | self | `classic_hand_build` | 조패 단계 headline과 실조작 영역이 충돌하지 않음 | screenshot + short note |
| MQ-05 | classic | self/opponent | `classic_round_end` | 점수 변화, 확인 상태, 다음 행동이 즉시 읽힘 | screenshot + result note |
| MQ-06 | ten easy | attacker | timeout discard | timeout 후 discard가 강제로 진행되고 최신 e2e 결과와 일치 | PASS test result + optional video/log |

## 8.3 Observability and Log Checklist

이 feature는 단순 화면 검토가 아니라 “재현 가능한 증거”가 중요하므로 로그도 evidence packet에 포함한다.

| logId | signal | why it matters | source |
|-------|--------|----------------|--------|
| LOG-01 | `eventLog` 단계 전이 | step mismatch 재현 | replay / runtime state |
| LOG-02 | `roundEndConfirmedBy` | confirm gate 정체 구간 파악 | `App.tsx` round-end overlay |
| LOG-03 | `guessCandidates` 주입 여부 | defender-only contract 검증 | `GameRoom.ts` sanitize snapshot |
| LOG-04 | `pendingDrawTile` masking 상태 | attacker/defender leakage 검증 | `GameRoom.ts` sanitize snapshot |
| LOG-05 | easy timeout discard path | previously blocked path가 최신 PASS로 닫혔는지 검증 | test log / runtime log |

## 9. Evidence Packet Definition

QA 팀이 한 번의 검증 묶음으로 제출해야 할 최소 패킷은 아래와 같다.

1. 자동 검증 명령 결과 5종
2. 수동 시나리오 스크린샷 최소 6장
3. `observer` visibility 비교 1세트
4. `ten_round_end` 결과 캡처 + confirm 후 상태 변화 note
5. easy timeout discard의 current status note와 latest PASS result

## 9.1 Artifact Closure Mapping

| Artifact | Required Packet IDs | Closure Condition |
|----------|---------------------|------------------|
| D2 | `QP-01` | Juunana result/UI ambiguity 이유가 packet으로 설명됨 |
| D3 | `QP-02`, `QP-04` | ten flow/UI/result packet이 row 단위로 연결됨 |
| D4 | `QP-04`, `QP-06` | numeric/result packet + latest validation PASS note 존재 |
| D5 | `QP-03` | multi-viewer packet이 최소 1세트 존재 |
| D6 | `QP-05` | mobile/narrow-width evidence 존재 |
| D7 | `QP-01`~`QP-06` | inventory에 state와 gap이 모두 기록됨 |

## 10. Exit Questions

1. automated validation은 PASS 상태로 정리됐는가, 그리고 evidence gate와 혼동하지 않았는가.
2. 수동 증거가 없는 `Partial` 항목을 “완료”로 잘못 표기하지 않았는가.
3. 같은 시나리오를 attacker/defender/observer 기준으로 비교할 수 있는가.
