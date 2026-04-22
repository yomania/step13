# Gap Analysis: riichi-city-juunana-ten-validation

> Date: 2026-03-26 | Design: docs/02-design/features/riichi-city-juunana-ten-validation.design.md

---

## Match Rate: 89%

Calculation basis:
- Total analyzed design items: 19
- Implemented/aligned items: 17
- Match rate: 17 / 19 = 89%

## Summary

이번 check 단계에서는 v3로 재작성된 [D1 design](docs/02-design/features/riichi-city-juunana-ten-validation.design.md)와 D2~D8 산출물을 기준으로 문서 패키지, 코드 anchor, backlog, QA snapshot을 다시 대조했다.

이전 분석과 비교해 가장 큰 변화는 release blocker 상태다. 2026-03-26 현재 자동 검증은 아래와 같이 모두 통과했다.

- `pnpm --filter @step13/core exec vitest run` -> 7 files, 50 tests passed
- `pnpm --filter @step13/scoring test` -> 1 file, 28 tests passed
- `pnpm --filter web build` -> PASS, chunk-size warning only
- `pnpm --filter server build` -> PASS
- `pnpm test:e2e` -> PASS, including `ten easy: 리치 거부 및 timeout 강제 기리`

따라서 D7/D8이 유지하던 "`easy mode timeout discard`는 release blocker" 판정은 더 이상 현재 저장소 상태와 일치하지 않는다. 지금 남은 핵심 gap은 코드 구현 부족보다 evidence closure 부족이다. 특히 Juunana direct capture, ten result numeric packet, synchronized multi-viewer visibility packet, mobile-width manual QA note는 여전히 비어 있다.

정리하면, 이 feature의 D1~D8 운영 패키지는 구조적으로는 거의 닫혔고 현재 구현/검증 상태와도 잘 맞는다. 다만 external parity closure와 manual evidence closure가 아직 완전하지 않아 90% 기준에는 1점 모자란 상태다. 다음 단계는 대규모 iterate가 아니라 문서와 evidence packet을 최신 상태로 정리하는 짧은 act/re-report가 적절하다.

## Implemented Items

- [x] D1~D8 artifact set이 모두 존재하며 각 문서의 역할이 설계와 일치한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `*.juunana-matrix.md`, `*.ten-matrix.md`, `*.score-parity.md`, `*.visibility-matrix.md`, `*.ui-flow.md`, `*.qa-checklist.md`, `*.backlog.md`
- [x] D1이 control tower 역할로 reading order, track architecture, source-of-truth layer, quality rubric, evidence bundle registry를 명시한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`
- [x] D2는 `classic`과 `Juunana Ho`를 parity target이 아니라 divergence audit 대상으로 구분한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md`
- [x] D3는 ten의 A/B flow parity와 score parity를 분리해 판단한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.ten-matrix.md`
- [x] D4는 `safe-to-change` 경계와 scoring change policy를 명시한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md`
- [x] D5는 sanitize contract를 viewer/field/invariant 단위로 정리한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md`
- [x] D6는 step별 UI outcome과 파일 traceback을 제공한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.ui-flow.md`
- [x] D7는 automated validation, manual evidence, packet inventory, closure mapping을 분리한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`
- [x] D8는 now/later/minor backlog와 team allocation board를 제공한다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md`
- [x] ten A/B flow, visibility masking, round-end confirm gate, replay observation anchor는 실제 코드와 문서가 연결된다.
  - 근거: `packages/core/src/machine.ts`, `apps/server/src/GameRoom.ts`, `apps/web/src/App.tsx`, `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/AttackDefensePanels.tsx`
- [x] Do re-entry allowed-now 항목은 실제 코드/문서 anchor와 연결돼 있다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.ui-flow.md`
- [x] hold queue 항목은 evidence 부족 상태에서 code fix 금지 원칙과 맞게 정리돼 있다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md`
- [x] release blocker, documentation blocker, evidence gap이 별도 축으로 분리돼 읽힌다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`
- [x] automated validation snapshot은 현재 저장소 기준으로 refresh 가능하며 blocker였던 easy timeout discard 경로도 통과한다.
  - 근거: 2026-03-26 실행 결과
- [x] `pnpm test:e2e`가 `ten easy: 리치 거부 및 timeout 강제 기리`까지 통과해 D8의 `RCJT-B01` blocker 전제가 해소됐다.
  - 근거: 2026-03-26 `pnpm test:e2e`
- [x] evidence bundle registry와 packet inventory가 D1/D7 사이에서 연결된다.
  - 근거: `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`
- [x] report에 필요한 핵심 읽기값(무엇이 구현됐는가, 무엇이 hold인가, 무엇이 gate인가)을 현재 문서 세트만으로 추출할 수 있다.
  - 근거: D1~D8 전반

## Missing Items

- [ ] external parity closure는 아직 미완료다.
  - 현재 상태: D2/D3/D4/D5가 모두 source와 checked date를 담고 있지만 Juunana direct UI/result capture, ten detailed numeric result packet, synchronized multi-viewer visibility packet이 비어 있다.
- [ ] manual release evidence closure는 아직 미완료다.
  - 현재 상태: D7의 `Q-03`, `Q-04`, `Q-05`, `Q-06`, `Q-12`, `QP-01`~`QP-05`, `MQ-01`~`MQ-05`가 여전히 partial/missing이다.

## Changed Items (Deviations from Prior Analysis)

- [x] 이전 analysis/report가 유지하던 "`pnpm test:e2e` fail = release blocker" 판정은 더 이상 유효하지 않다.
  - 실제로는 2026-03-26 재실행에서 전체 e2e가 통과했다.
- [x] check 단계의 주된 병목은 runtime bug보다 evidence packet closure로 이동했다.
  - 의미: 다음 act는 코드 수정 중심보다 D7/D8/D4/D5 상태 refresh 중심이 맞다.

## Code vs Design Mapping

| Design Item | Expected | Actual | Category |
|-------------|----------|--------|----------|
| Artifact system | D1~D8 operational package | 모두 존재하고 상호 참조됨 | Match |
| Reading order | D1 -> D2/D3 -> D4/D5 -> D6 -> D7 -> D8 | D1에 명시됨 | Match |
| Track architecture | Juunana / ten / ten easy / shared UI 분리 | D1과 D8에서 유지 | Match |
| Source-of-truth layers | PRD/core/rules/messages/scoring/server/web 구분 | D1에 정리되고 코드 anchor 존재 | Match |
| Juunana boundary | `classic`을 parity target이 아닌 divergence audit로 처리 | D2/D4/D8에 반영 | Match |
| ten flow/score boundary | flow parity와 score parity 분리 | D3/D4에 반영 | Match |
| Visibility policy | sanitize contract/invariants 유지 | D5 + `GameRoom.ts` anchor 존재 | Match |
| UI traceback | step별 파일 책임과 CTA 중심 판독 | D6에 반영 | Match |
| QA packet rule | automated/manual/packet closure 분리 | D7에 반영 | Match |
| Execution queue | now/later/minor 분리, owner 지정 | D8에 반영 | Match |
| Do re-entry policy | allowed now / not allowed yet | D1과 D8이 일치 | Match |
| Automated validation | current snapshot refresh | 2026-03-26 기준 전부 PASS | Match |
| easy timeout discard | blocker if failing, close if passing | 현재 PASS로 blocker 해소 | Match |
| External parity evidence | row-level closure packet 확보 | 다수 row가 partial/ambiguous | Partial |
| Manual QA evidence | mobile/result/multi-viewer packet 존재 | 여전히 partial/missing | Partial |
| Release utility | 문서만 읽고 immediate vs hold 구분 가능 | 가능 | Match |
| Quality rubric target | D1/D7/D8 High, D2~D6 Medium+ | 현재 읽기상 충족 | Match |
| Report readiness | check 결과가 next action으로 연결 | 가능하나 stale report refresh 필요 | Partial |
| Archive readiness | feature 종료/보관까지 바로 갈 수 있는가 | stale blocker wording이 남아 있어 아직 이르다 | Partial |

## Recommendations

1. D7의 automated validation snapshot과 `Q-11`, `QP-06`, `MQ-06` 상태를 2026-03-26 실행 결과로 갱신한다.
2. D8에서 `RCJT-B01`을 blocker가 아니라 completed-or-closed item으로 재분류하고, 남은 최우선 과제를 evidence packet closure로 재정렬한다.
3. D4/D5/D7에 Juunana direct capture, ten numeric result packet, multi-viewer visibility packet, mobile-width evidence의 부족 상태를 더 명시적으로 링크한다.
4. report를 다시 쓴다면 “runtime blocker 해소, evidence gap 잔존”이라는 현재 판단으로 refresh한다.
5. code change가 아니라 docs/evidence refresh를 한 번 더 수행한 뒤 report 또는 archive 여부를 결정한다.

## Next Steps

- [x] current code/doc/validation 기준으로 check 문서 갱신
- [x] D7 QA snapshot을 2026-03-26 기준으로 갱신
- [x] D8 backlog priority를 evidence-packet 중심으로 재정렬
- [x] stale report wording 정리 후 `$pdca report riichi-city-juunana-ten-validation` 재실행 검토 준비
- [ ] Juunana direct capture / ten numeric result packet / multi-viewer visibility / mobile-width evidence 확보
- [ ] evidence refresh 후 90% 이상이면 report, 아니면 짧은 iterate 후 재분석
