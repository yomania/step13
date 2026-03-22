# Gap Analysis: ten-attack-defense-rules-validation

> Date: 2026-03-22 | Design: docs/02-design/features/ten-attack-defense-rules-validation.design.md

---

## Match Rate: 73%

Calculation basis:
- Total analyzed design items: 15
- Implemented/aligned items: 11
- Match rate: 11 / 15 = 73%

## Summary

이번 check 단계에서는 `docs/02-design/features/ten-attack-defense-rules-validation.design.md`를 기준으로 `packages/core`, `apps/web`, `apps/server` 구현을 대조했다.

이번 do 단계에서 실제로 반영된 핵심 성과는 다음과 같다.

- Stage B 추측 후보 계산이 상대 버림패 기반 금지 규칙까지 반영되도록 helper가 추가됐다.
- Stage B 추측 UI가 더 큰 타일, X 처리, 금지 사유, 최근 실패 강조를 사용하도록 개선됐다.
- 상태머신의 `B_GUESS -> B_ASSAULT` 전이와 5회 공격 종료 규칙에 대한 core 회귀 테스트가 추가됐다.
- 기존 이벤트 계약은 유지됐다.

반면 설계 문서가 요구한 범위 전체와 비교하면, Stage A 전용 패널 재설계, Assault 전용 HUD/진행 표시, `App.tsx` projection 보강, `DiscardPile` 연계 표현, server/bot 후속 정렬, 수동 QA와 server build 검증은 아직 남아 있다.

따라서 현재 상태는 “핵심 blocker 일부 해결 + 설계 대비 부분 구현”이며, 다음 단계는 report가 아니라 iterate가 적절하다.

## Implemented Items

- [x] `getGuessCandidateStates(context, viewerId)` helper가 추가되어 Stage B 후보 상태 계산을 공통 규칙으로 정리했다.
  - 근거: `packages/core/src/ten-attack-defense.ts`
- [x] 추측 후보가 `selectable`, `blocked_by_opponent_discard`, `exhausted` 상태를 구분한다.
  - 근거: `packages/core/src/ten-attack-defense.ts`
- [x] Stage B 추측 UI가 상대 버림패 금지 상태를 빨간 X와 이유 텍스트로 표시한다.
  - 근거: `apps/web/src/components/AttackDefensePanels.tsx`
- [x] Stage B 추측 UI의 후보 타일 크기가 `xs`에서 `sm`으로 상향됐다.
  - 근거: `apps/web/src/components/AttackDefensePanels.tsx`
- [x] 직전 실패한 추측 타일을 별도 시각 상태로 강조한다.
  - 근거: `apps/web/src/components/AttackDefensePanels.tsx`
- [x] 기존 공개 이벤트 계약은 유지됐다.
  - 근거: `packages/core/src/messages.ts`
- [x] 상태머신이 2회 실패 후 `B_ASSAULT`로 전이하고 `assaultRemaining = 5`를 설정한다.
  - 근거: `packages/core/src/machine.ts`
- [x] 상태머신이 공격 draw hit 시 즉시 라운드를 종료하도록 유지된다.
  - 근거: `packages/core/src/machine.ts`
- [x] 상태머신이 공격 5회 소진 시 `DRAW`로 종료하도록 유지된다.
  - 근거: `packages/core/src/machine.ts`
- [x] core 회귀 테스트에 추측 후보 금지 규칙, 2회 실패 전이, 5회 공격 종료가 추가됐다.
  - 근거: `packages/core/src/machine.test.ts`
- [x] web 빌드와 core 테스트 검증이 수행됐다.
  - 근거: `pnpm --filter @step13/core exec vitest run src/machine.test.ts`, `pnpm --filter web build`

## Missing Items

- [ ] `getTenAttackDefenseStageSummary(context, viewerId)` helper는 구현되지 않았다.
  - 설계 위치: 6.2 Proposed Additions / Derived Helpers
- [ ] `shouldEnterAssault(context, guessEvent)` helper는 별도 helper로 분리되지 않았다.
  - 현재는 상태머신 guard로만 존재한다.
- [ ] Assault 전용 HUD가 추측 HUD와 분리되어 draw 상태와 남은 공격 흐름을 명확히 보여주도록 재구성되지는 않았다.
  - 현재는 stat card와 kan tray 중심 표현에 머문다.
- [ ] `App.tsx`의 Stage B Assault projection이 “진행되지 않는 것처럼 보이는” 문제를 해소할 만큼 보강되지는 않았다.
  - 설계 위치: 8.2 App State Projection
- [ ] `DiscardPile`와 추측 금지 상태의 시각적 연결 강화는 구현되지 않았다.
  - 설계 위치: 8.3 Tile / Discard Rendering
- [ ] server masking과 attacker/defender 시야 정책에 대한 별도 검증 또는 수정은 수행되지 않았다.
  - `GameRoom.ts`는 기존 구현 유지
- [ ] bot이 Stage B 추측 후보 금지 규칙이나 assault 진행 UX 기준과 명시적으로 정렬되도록 수정되지는 않았다.
  - `Bot.ts`는 기존 랜덤 추측 흐름 유지
- [ ] 수동 QA matrix의 시나리오 검증은 아직 수행되지 않았다.
  - 설계 위치: 9.1 Manual QA Matrix
- [ ] `pnpm --filter server build` 검증이 이번 analyze 기준에서는 완료되지 않았다.
  - 설계 위치: 10.4 Required Regression Commands
- [ ] “assault 중 hit 즉시 종료”에 대한 명시적 회귀 테스트는 문서상 요구되었지만 추가되지 않았다.
  - 현재는 구현 존재, 테스트 부재

## Changed Items (Deviations from Design)

- [ ] 추측 후보 helper가 core와 web에 각각 존재한다.
  - 설계는 helper 중심 구현을 허용했지만, 실제로는 `packages/core/src/ten-attack-defense.ts`와 `apps/web/src/lib/ten-attack-defense.ts`가 중복 구조를 가진다.
  - 이유: workspace package export/consumption 경계에서 web 빌드 안정성을 우선했다.
- [ ] Stage A 선언 UI 재설계는 `AttackDefensePanels`가 아니라 기존 `HandDisplay` projection 경로를 계속 사용한다.
  - 설계의 “단계 중심 HUD” 방향과 부분적으로 다르다.
- [ ] Assault tray는 설계상 draw 상태, 남은 횟수, 깡 액션을 명확히 분리하는 구조였으나 현재 구현은 `kanOption.pending`일 때만 하단 tray를 보여준다.

## Code vs Design Mapping

| Design Item | Expected | Actual | Category |
|-------------|----------|--------|----------|
| Guess candidate state helper | 후보 상태 계산 helper | 구현됨 (`packages/core/src/ten-attack-defense.ts`) | Match |
| Opponent discard blocking | 상대 버림패 X 처리 | 구현됨 | Match |
| Larger guess tiles | `sm` 이상 | 구현됨 | Match |
| Blocked reason badge/text | 이유 표시 | 구현됨 | Match |
| Last failed emphasis | 실패 피드백 강조 | 구현됨 | Match |
| `B_GUESS -> B_ASSAULT` transition | 2회 실패 시 전이 | 구현 및 테스트됨 | Match |
| 5-turn assault end | 5회 후 종료 | 구현 및 테스트됨 | Match |
| Hit-on-draw immediate end | 즉시 승리 처리 | 구현됨, 테스트는 미흡 | Partial |
| Assault HUD separation | draw 상태/남은 횟수 명확화 | 부분 반영 | Partial |
| `getTenAttackDefenseStageSummary` | HUD 요약 helper | 미구현 | Missing in Code |
| `shouldEnterAssault` helper | 전이 helper | 미구현 | Missing in Code |
| `App.tsx` projection review items | 시각적 진행성 보강 | 미구현 | Missing in Code |
| `DiscardPile` linkage | 버림패와 금지 상태 연계 | 미구현 | Missing in Code |
| Server validation | masking 재검증 | 미수행 | Missing in Code |
| Server build regression | `pnpm --filter server build` | 미수행 | Missing in Code |

## Recommendations

1. `AttackDefensePanels`와 `App.tsx`를 함께 수정해 Assault 진행 상태를 명시적으로 드러내는 iterate를 수행한다.
2. `assault hit immediate end` 테스트와 `pnpm --filter server build` 검증을 추가해 regression matrix를 설계 문서 수준으로 맞춘다.
3. `DiscardPile` 또는 인접 HUD에 상대 버림패와 추측 금지 상태의 연결 표현을 보강한다.
4. 가능하면 guess-state 계산 로직의 core/web 중복을 줄이되, build 안정성을 깨지 않는 방식으로 정리한다.

## Next Steps

- [x] check phase 분석 문서 작성
- [ ] iterate로 남은 UI/projection/server/test gaps 보완
- [ ] 보완 후 `$pdca analyze ten-attack-defense-rules-validation` 재실행
- [ ] matchRate 90% 이상 달성 시 `$pdca report ten-attack-defense-rules-validation`
