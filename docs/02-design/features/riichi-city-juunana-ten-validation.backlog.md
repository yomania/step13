# Backlog Registry: riichi-city-juunana-ten-validation

## 1. Purpose

이 문서는 blocker / major / minor를 다시 정리하고, 코드 재진입이 필요한 항목과 evidence packet closure가 우선인 항목을 분리한다.

## 2. Now vs Later

### 2.1 지금 바로 닫을 것

| backlogId | type | summary | severity | owner | sourceArtifact | targetFiles |
|---|---|---|---|---|---|---|
| RCJT-B07 | `qa-gap` | Juunana direct UI / result-flow capture 확보 후 parity UI 판단 재개 | `major` | QA | D2, D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md` |
| RCJT-B08 | `qa-gap` | ten detailed score table과 result numeric evidence 확보 | `major` | QA | D4, D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md` |
| RCJT-B09 | `qa-gap` | observer visibility direct capture 확보 | `major` | QA | D5, D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md` |
| RCJT-B13 | `qa-gap` | mobile width note/screenshot 추가 | `minor` | QA | D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md` |
| RCJT-B17 | `doc-fix` | D1 artifact completeness audit와 D7 packet inventory를 기준으로 미완료 packet closure 상태를 주기적으로 갱신 | `minor` | Docs/CTO | D1, D7, D8 | `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md` |

### 2.2 코드 재진입이 필요하면 그 다음에 볼 것

| backlogId | type | summary | severity | owner | sourceArtifact | targetFiles |
|---|---|---|---|---|---|---|
| RCJT-B01 | `flow-fix` | easy mode timeout discard e2e failure 수정 항목은 2026-03-26 기준 PASS로 닫혔다. 현재는 regression watch only로 유지한다 | `resolved` | Rules | D7 | `packages/core/src/machine.ts`, `apps/server/src/GameRoom.ts`, `scripts/test-e2e-flows.ts` |
| RCJT-B02 | `ui-fix` | `ten_b_guess`의 선택/확정/실패 피드백 전달력을 강화한다 | `major` | UX | D3, D6 | `apps/web/src/components/AttackDefensePanels.tsx` |
| RCJT-B03 | `ui-fix` | `ten_b_assault`의 pending draw / remaining / result feedback 연결을 강화한다 | `major` | UX | D3, D6 | `apps/web/src/components/AttackDefensePanels.tsx`, `apps/web/src/components/GameBoard.tsx` |
| RCJT-B04 | `flow-fix` | `classic_round_end` / `ten_round_end` confirm CTA와 replay 경로를 명확히 한다 | `major` | UX | D6, D7 | `apps/web/src/App.tsx` |
| RCJT-B05 | `doc-fix` | `classic`이 `Juunana Ho` parity target처럼 읽히지 않도록 wording을 정리한다 | `major` | Doc | D1, D2, D6 | `apps/web/src/components/GameBoard.tsx`, `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md` |
| RCJT-B06 | `runtime-fix` | attacker / defender / observer sanitize contract를 D5 wording과 맞춘다 | `major` | Runtime | D5 | `apps/server/src/GameRoom.ts` |
| RCJT-B10 | `scoring-fix` | external evidence 없는 ten score 숫자를 코드에 반영할지 판단 | `major` | Scoring | D4 | `packages/scoring/src/points.ts`, `docs/prd.yaml` |
| RCJT-B11 | `decision` | Juunana 전용 variant를 실제로 신설할지 CTO 결정 트랙으로 분리 | `blocker` | CTO | D1, D2, D4 | `docs/02-design/features/riichi-city-juunana-ten-validation.design.md` |
| RCJT-B15 | `rule-fix` | Juunana local yaku / kan restriction / noten handling을 신규 variant로 구현할지 rules 기준안을 작성 | `blocker` | Rules | D2, D4 | `packages/core/src/rules.ts`, `packages/core/src/machine.ts`, `packages/scoring/src/points.ts` |
| RCJT-B16 | `scoring-fix` | Juunana/ten 차이를 shared scoring baseline에서 분리할지 scoring 영향도 문서를 작성 | `major` | Scoring | D4 | `packages/scoring/src/points.ts`, `docs/prd.yaml` |

### 2.3 Minor / Polish

| backlogId | type | summary | severity | owner | sourceArtifact | targetFiles |
|---|---|---|---|---|---|---|
| RCJT-B12 | `ui-fix` | GameBoard headline과 phase timeline wording 정리 | `minor` | UX | D6 | `apps/web/src/components/GameBoard.tsx` |
| RCJT-B14 | `doc-fix` | YouTube gameplay의 timecode mapping 정리 | `minor` | Doc | D3, D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.ten-matrix.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md` |

## 3. Exit Rule

1. automated validation PASS와 evidence gate closure를 같은 것으로 취급하지 않는다.
2. 현재 최우선은 `RCJT-B07`, `RCJT-B08`, `RCJT-B09`, `RCJT-B13`, `RCJT-B17`의 evidence packet closure다.
3. `RCJT-B02`~`RCJT-B06`, `RCJT-B10`~`RCJT-B16`은 evidence 부족 상태에서 구현 확정 금지다.
4. `RCJT-B01`은 resolved 상태로 남기되, 새 회귀가 생기면 즉시 blocker로 되돌린다.
5. report 직전에는 D7/D8 wording이 latest validation date와 일치해야 한다.

## 4. CTO Team Allocation Board

이번 백로그는 아래 전문팀으로 분산 집행한다.

| Team | Active Backlog | Deliverable | Gate |
|------|----------------|-------------|------|
| Rules Team | `RCJT-B01`, `RCJT-B11` | closed timeout path 회귀 감시, Juunana divergence decision | regression watch or explicit hold |
| UX Team | `RCJT-B02`, `RCJT-B03`, `RCJT-B04`, `RCJT-B12` | Stage B guess/assault readability, round-end CTA 정리 | mobile/narrow-width acceptance |
| Runtime Team | `RCJT-B06` | sanitize contract and visibility wording alignment | D5 invariants satisfied |
| QA Team | `RCJT-B07`, `RCJT-B08`, `RCJT-B09`, `RCJT-B13` | screenshot/log evidence packet | D7 evidence packet complete |
| Docs/CTO Team | `RCJT-B05`, `RCJT-B14`, `RCJT-B17` | wording split, timecode mapping, stale report sync | D1~D8 review closure |

## 5. Definition of Done by Type

| type | done means |
|------|------------|
| `flow-fix` | step 전이가 설계 문구, runtime, QA 시나리오에서 같은 의미로 읽힌다 |
| `ui-fix` | headline, CTA, feedback, next action이 충돌 없이 한 시야에서 읽힌다 |
| `runtime-fix` | sanitize contract가 D5 wording과 1:1로 대응되고 observer leakage가 없다 |
| `doc-fix` | `Changed`/`Ambiguous` 판정 이유와 nextAction이 빠지지 않는다 |
| `qa-gap` | screenshot/log/date/source가 묶인 evidence packet이 존재한다 |
| `scoring-fix` | 외부 숫자 근거 없이 내부 점수 체계를 단정 변경하지 않는다 |
| `rule-fix` | variant 복제인지 divergence 유지인지 명시적 결정이 내려진다 |

## 6. Immediate Command Room

CTO 관점에서 지금 가장 먼저 닫아야 할 질문은 아래 3개다.

1. Juunana direct UI/result capture, ten numeric result packet, multi-viewer visibility packet, mobile-width evidence를 어떤 순서로 닫을 것인가.
2. `RCJT-B02`~`B04`: ten Stage B와 round-end에서 사용자가 다음 행동을 바로 읽는가.
3. `RCJT-B06`: observer 포함 sanitize contract가 D5 문구와 충돌하지 않는가.
