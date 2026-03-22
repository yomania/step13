# Completion Report: ten-attack-defense-rules-validation

> Date: 2026-03-22
> Status: Warning - below target match rate for final closure

---

## 1. Summary

이 report는 `ten-attack-defense-rules-validation` feature의 plan, design, check, act 결과를 종합한 완료 보고서다.

사용자 요청에 따라 report를 생성하지만, 본 feature는 아직 설계 기준 90% match rate를 충족하지 못했다.

- latest saved analysis match rate: `73%`
- post-iterate reassessment match rate: `80%`
- calculation basis: `12 / 15 design items aligned`

이번 act 단계에서 핵심 blocker였던 Stage B 추측 후보 금지 규칙, B_ASSAULT 진입 helper 분리, assault 진행 HUD, hit-on-draw 회귀 테스트, server build 검증이 보강됐다. 반면 `App.tsx` projection 정리, `DiscardPile` 연계 표현, server masking에 대한 명시적 재검증, 수동 QA evidence는 아직 미완료다.

따라서 이 문서는 "완전 종료 보고서"라기보다 "현재까지의 구현 완료 보고서 + 잔여 항목 경고"로 취급해야 한다.

## 2. Related Documents

- Plan: `docs/01-plan/features/ten-attack-defense-rules-validation.plan.md`
- Design: `docs/02-design/features/ten-attack-defense-rules-validation.design.md`
- Analysis: `docs/03-analysis/ten-attack-defense-rules-validation.analysis.md`

## 3. Completed Items

### 3.1 Functional / Logic

- Stage B 추측 후보가 `selectable`, `blocked_by_opponent_discard`, `exhausted` 상태로 계산된다.
- 공격자 버림패가 수비자 추측 후보에서 제외된다.
- 2회 실패 후 `B_ASSAULT` 진입 로직이 helper(`shouldEnterAssault`) 기반으로 명시화됐다.
- `B_ASSAULT`에서 5회 공격 종료 시 `DRAW` 처리 로직이 유지된다.
- 공격 draw가 locked wait와 일치하면 즉시 `RON`으로 종료되는 회귀 테스트가 추가됐다.

### 3.2 UI / UX

- Stage B 추측 후보 타일 크기가 `sm` 기준으로 상향됐다.
- 금지 후보가 X 처리와 사유 텍스트(`상대 버림패`, `패산 소진`)로 표현된다.
- 최근 실패한 추측 타일이 별도 시각 상태로 강조된다.
- 공격자 시점에 assault 진행 HUD가 추가되어 pending draw, 진행량, 남은 공격 횟수가 노출된다.
- `getTenAttackDefenseStageSummary` helper가 HUD 표시용 요약 데이터를 제공한다.

### 3.3 Validation

- `pnpm --filter @step13/core exec vitest run src/machine.test.ts` passed
- `pnpm --filter web build` passed
- `pnpm --filter server build` passed

## 4. Quality Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Latest saved analysis match rate | 73% | `docs/03-analysis/ten-attack-defense-rules-validation.analysis.md` 기준 |
| Post-iterate reassessment | 80% | helper, HUD, hit-on-draw test, server build 반영 후 재평가 |
| Iteration count | 2 | PDCA status 기준 |
| Core test status | Pass | `25/25` |
| Web build status | Pass | production build 완료 |
| Server build status | Pass | Prisma generate 포함 |

### 4.1 Reassessment Mapping

| Design Item | Current State | Category |
|-------------|---------------|----------|
| Guess candidate state helper | 구현됨 | Match |
| Opponent discard blocking | 구현됨 | Match |
| Larger guess tiles | 구현됨 | Match |
| Blocked reason badge/text | 구현됨 | Match |
| Last failed emphasis | 구현됨 | Match |
| `B_GUESS -> B_ASSAULT` transition | 구현 및 테스트됨 | Match |
| 5-turn assault end | 구현 및 테스트됨 | Match |
| Hit-on-draw immediate end | 구현 및 테스트됨 | Match |
| Assault HUD separation | assault HUD 추가로 보강됨 | Match |
| `getTenAttackDefenseStageSummary` | 구현됨 | Match |
| `shouldEnterAssault` helper | 구현됨 | Match |
| Server build regression | 수행 완료 | Match |
| `App.tsx` projection review items | 미완료 | Missing |
| `DiscardPile` linkage | 미완료 | Missing |
| Server validation / masking review | 명시적 후속 검증 미완료 | Missing |

## 5. Remaining Gaps

- `apps/web/src/App.tsx`의 assault projection은 여전히 별도 정리 대상이다.
- `apps/web/src/components/DiscardPile.tsx` 또는 인접 HUD와의 규칙 연결 표현은 추가되지 않았다.
- `apps/server/src/GameRoom.ts` masking 로직은 유지되지만, 이번 feature 범위에서 별도 회귀 테스트나 문서화된 재검증은 수행하지 않았다.
- `apps/server/src/Bot.ts`는 기존 흐름을 유지하며, design의 UX 기준에 맞춘 명시적 정렬은 완료되지 않았다.
- 수동 QA matrix evidence가 report에 첨부되지 않았다.

## 6. Lessons Learned

### Keep

- Stage B 규칙 계산을 helper로 분리하면 UI와 테스트가 같은 기준선을 공유하기 쉬워진다.
- 텐 공방전의 blocker는 로직 자체보다 "보이지 않아서 버그처럼 느껴지는 상태"가 크므로 HUD 요약이 중요하다.
- 회귀 테스트와 build 검증을 함께 묶어야 iterate의 효과를 신뢰할 수 있다.

### Problem

- formal analysis 문서가 iterate 이후 자동 갱신되지 않아 report 시점에 수동 재평가가 필요했다.
- web/core helper가 분리되어 중복이 생겼다.
- PDCA feature와 실제 파일 경로(`apps`, `packages`) 사이 매핑이 완전히 자동화되지 않았다.

### Try

- 다음 cycle에서는 report 전에 analysis 문서를 먼저 갱신해 match rate를 문서 기준으로 고정한다.
- 가능하면 core helper 재사용 경로를 정리해 web duplication을 줄인다.
- server masking과 manual QA evidence를 별도 체크리스트로 문서화해 report 진입 기준을 명확히 한다.

## 7. Next Steps

1. `docs/03-analysis/ten-attack-defense-rules-validation.analysis.md`를 현재 구현 기준으로 갱신한다.
2. `apps/web/src/App.tsx`의 B_ASSAULT projection 보강 여부를 별도 check item으로 확정한다.
3. `DiscardPile` 연계 표현과 server masking validation을 완료한다.
4. 수동 QA evidence를 수집한 뒤 최종 match rate가 90% 이상이면 archive 판단을 진행한다.

