# riichi-city-juunana-ten-validation - Design Document (Starter)

> Version: 3.0.0 | Date: 2026-03-26 | Status: Rewritten
> Level: Starter | Plan: docs/01-plan/features/riichi-city-juunana-ten-validation.plan.md

---

## 1. Design Intent

이 문서는 `riichi-city-juunana-ten-validation` feature의 실행 설계서다. 핵심 목적은 "비교 검증 문서 묶음"을 실제 Do/Check/Report 단계에서 바로 사용할 수 있는 운영 패키지로 정리하는 것이다.

이번 설계는 UI 구현 설계서가 아니다. 아래 세 가지를 중심으로 한다.

1. 어떤 산출물이 어떤 질문에 답하는가
2. 산출물 간 판정 체계와 hand-off 규칙이 무엇인가
3. 언제 구현으로 들어가고 언제 evidence 확보를 우선하는가

## 2. Design Outcomes

이 설계가 완료되면 팀은 아래를 할 수 있어야 한다.

- `Juunana`, `ten`, `ten easy`를 한 feature 아래에서 읽되, 서로 다른 의사결정 경계를 유지할 수 있다.
- D1~D8 문서만 읽고도 지금 구현할 일과 아직 보류할 일을 구분할 수 있다.
- 문서, 코드, QA, release gate가 서로 다른 축임을 혼동하지 않는다.
- 이후 Check 단계에서 "문서는 있는데 왜 판단이 안 되는가" 같은 문제가 줄어든다.

## 3. Operating Model

### 3.1 Artifact System

| Artifact ID | Path | Role | Primary Question |
|-------------|------|------|------------------|
| D1 | `docs/02-design/features/riichi-city-juunana-ten-validation.design.md` | control tower | 전체적으로 무엇을 믿고 어떤 순서로 읽는가 |
| D2 | `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md` | Juunana parity ledger | `classic`은 Juunana와 어떻게 다른가 |
| D3 | `docs/02-design/features/riichi-city-juunana-ten-validation.ten-matrix.md` | ten parity ledger | A/B flow parity와 남은 불확실성은 무엇인가 |
| D4 | `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md` | numeric safety ledger | 지금 score/rules baseline을 바꿔도 되는가 |
| D5 | `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md` | sanitize contract ledger | 누가 무엇을 볼 수 있어야 하는가 |
| D6 | `docs/02-design/features/riichi-city-juunana-ten-validation.ui-flow.md` | UI traceback map | 어느 단계에서 어느 파일을 손대야 하는가 |
| D7 | `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md` | evidence gate | release-quality 증거가 무엇이 부족한가 |
| D8 | `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md` | execution queue | 지금 구현할 것과 나중에 판단할 것은 무엇인가 |

### 3.2 Reading Order

문서는 아래 순서로 읽는다.

1. D1: 전체 판단 구조
2. D2 / D3: track별 parity 판정
3. D4 / D5: shared baseline 및 visibility 위험 확인
4. D6: UI/runtime 수정 파일 역추적
5. D7: QA/release gate 확인
6. D8: 구현 우선순위 결정

이 순서를 어기면 scoring이나 visibility를 UI 문제처럼 오해할 가능성이 커진다.

## 4. Track Architecture

### 4.1 Track Definitions

| Track | External Mode | Internal Counterpart | Design Intent | Default Action |
|-------|---------------|----------------------|---------------|----------------|
| T1 | `Juunana Ho` | `classic` | parity target이 아니라 divergence audit | `doc-only` 우선 |
| T2 | `ten` | `ten_attack_defense` | flow parity audit + Do re-entry support | `do-now` 가능 |
| T3 | `ten easy` | `ten_attack_defense_easy` | regression and safe-mode audit | `runtime blocker` 우선 |
| T4 | shared UI/visibility | `apps/web`, `apps/server` | 전달력/보안/관찰 가능성 정리 | `do-now` 또는 `hold` |

### 4.2 Core Design Judgment

| Topic | Judgment | Design Consequence |
|-------|----------|--------------------|
| `classic` vs `Juunana Ho` | structurally changed | 동일 ruleset처럼 구현하지 않는다 |
| `ten` flow parity | strong enough for Do | UI/runtime 개선은 진행 가능 |
| `ten` score parity | not strong enough | score engine 변경 금지 |
| visibility external truth | partial | sanitize contract는 internal truth 기준으로 고정 |
| `ten easy` timeout issue | release blocker | backlog 최상단으로 유지 |

## 5. Source-of-Truth Layers

### 5.1 Internal Truth

| Layer | Source | Why It Matters |
|-------|--------|----------------|
| product baseline | `docs/prd.yaml` | ruleset/점수/단계 설명의 1차 기준 |
| machine truth | `packages/core/src/machine.ts` | 실제 전이와 종료 조건 |
| rules/options truth | `packages/core/src/rules.ts` | ruleset baseline 수치와 옵션 |
| message contract | `packages/core/src/messages.ts` | UI와 sanitize가 의존하는 payload 정의 |
| scoring truth | `packages/scoring/src/points.ts` | numeric 동작과 settlement logic |
| visibility truth | `apps/server/src/GameRoom.ts` | viewer별 노출/숨김 계약 |
| UI projection | `apps/web/src/App.tsx`, `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/AttackDefensePanels.tsx` | 사용자에게 실제로 보이는 의미 |

### 5.2 External Truth

외부 자료는 아래 필드가 있어야 design row의 증거로 인정한다.

| Required Field | Meaning |
|----------------|---------|
| `referenceSource` | 출처가 무엇인가 |
| `referenceTimestamp` | 언제 확인했는가 |
| `mode` | 어떤 mode를 다루는가 |
| `scene` | 어떤 단계/장면을 보여주는가 |
| `observedBehavior` | 실제로 무엇을 확인했는가 |
| `confidence` | 신뢰도는 어느 정도인가 |

### 5.3 Conflict Resolution Rule

internal과 external이 충돌할 때는 아래 순서로 처리한다.

1. external direct evidence가 충분하면 `Changed` 또는 `Match`를 선언한다.
2. external evidence가 약하면 `Partial` 또는 `Ambiguous`로 둔다.
3. shared baseline 변경은 D4의 safe-change rule을 통과하기 전까지 금지한다.

## 6. Artifact Design Specifications

### 6.1 D2 Juunana Matrix

설계 목표:

- `classic`을 Juunana parity implementation으로 잘못 읽지 않게 만든다.
- changed/ambiguous 항목을 무리하게 줄이지 않는다.
- 신규 variant 제안 여부를 문서상 backlog로만 남긴다.

필수 컬럼:

- `itemId`
- `axis`
- `referenceBehavior`
- `internalBehavior`
- `evidence`
- `status`
- `impact`
- `nextAction`

승인 질문:

1. Juunana와 classic의 구조 차이를 과소평가하지 않았는가
2. ambiguity를 억지로 제거하지 않았는가
3. shared baseline 수정 요구가 plan/design 단계에서 premature하게 나오지 않는가

### 6.2 D3 Ten Matrix

설계 목표:

- A/B flow parity는 최대한 명확히 한다.
- flow parity와 score parity를 섞지 않는다.
- UI와 visibility의 direct proof 부족을 `Partial`/`Ambiguous`로 남긴다.

승인 질문:

1. A/B 흐름은 충분히 `Match`로 볼 수 있는가
2. round-end numeric proof 부족이 score parity에 반영돼 있는가
3. Do 단계 UI 개선과 parity 확정 판단이 분리돼 있는가

### 6.3 D4 Score Parity

설계 목표:

- "숫자 차이 기록표"가 아니라 "지금 바꿔도 되는지 판단하는 안전 표"가 된다.
- shared baseline 리스크를 explicit하게 드러낸다.

핵심 규칙:

1. `safe-to-change != yes`면 코드 변경 근거로 쓰지 않는다.
2. `Changed`라도 evidence 부족이면 variant divergence로만 유지한다.
3. score 문제를 UI wording 문제로 치환하지 않는다.

### 6.4 D5 Visibility Matrix

설계 목표:

- external truth가 부족한 영역에서도 internal security contract를 흔들지 않는다.
- `hidden`, `partial`, `unknown`을 구분한다.
- attacker/defender/observer 동시 캡처 시나리오를 정의한다.

핵심 불변식:

- 상대 hand는 round end 전 실타일로 공개되지 않는다.
- attacker의 locked wait 정보는 defender/observer에 노출되지 않는다.
- pending draw 실타일은 조작 주체 외 viewer에 숨긴다.
- deterministic seed/dealt history는 공정성 우선 원칙 아래 보호한다.

### 6.5 D6 UI Flow Map

설계 목표:

- 화면 예쁘기보다 step 책임과 CTA 전달력을 검증한다.
- 파일 단위 수정 우선순위를 즉시 추적 가능하게 한다.

핵심 산출:

- flow별 `required UI outcome`
- `current anchor`
- `implementation implication`
- mobile/narrow-width gate

### 6.6 D7 QA Checklist

설계 목표:

- 자동 검증과 수동 검증을 분리한다.
- release blocker와 documentation blocker를 혼동하지 않게 한다.
- evidence packet 규칙을 명시한다.

핵심 구조:

- automated validation snapshot
- manual evidence still required
- evidence note format
- evidence packet completeness rule
- manual scenario pack

### 6.7 D8 Backlog Registry

설계 목표:

- `지금 구현할 것`과 `근거 확보 후 구현할 것`을 분리한다.
- team/owner/severity/sourceArtifact/targetFiles를 포함한다.
- release blocker를 backlog 최상단에 고정한다.

## 7. Workflow Design

### 7.1 Plan -> Design
- plan은 track, scope, decision rule을 고정한다.
- design은 이를 D1~D8 운영 규격으로 구체화한다.

### 7.2 Design -> Do
Do 재진입은 아래를 모두 만족할 때만 허용한다.

1. D2~D5의 핵심 row가 구현/보류 판단으로 연결돼 있다.
2. D6에서 수정 파일 추적이 가능하다.
3. D7에서 blocker와 evidence gap이 분리돼 있다.
4. D8에서 `do-now` backlog가 존재한다.

### 7.3 Do -> Check
Check는 "코드가 있나"가 아니라 아래를 본다.

- 문서 row와 구현 상태가 맞는가
- external/internal/evidence 해석이 일치하는가
- release blocker가 남아 있는가

### 7.4 Check -> Report
report는 match rate 숫자만이 아니라 아래를 포함해야 한다.

- 무엇이 구현됐는가
- 무엇이 아직 문서 보류인가
- 무엇이 release blocker인가
- 다음 PDCA 액션은 무엇인가

## 8. Do Re-entry Policy

### 8.1 Allowed Now

- `ten_b_guess` / `ten_b_assault` 전달력 개선
- round-end confirm / replay 흐름 정리
- visibility wording과 sanitize contract 정합성 검증
- easy mode timeout discard blocker 분석 및 수정
- `classic`을 Juunana와 혼동시키는 wording 정리

### 8.2 Not Allowed Yet

- Juunana direct parity implementation 확정
- ten score baseline 수정
- external direct evidence 없는 visibility 공개 범위 변경
- 신규 variant 확정 선언

## 9. Review Board

| Team | Responsibility | Must Approve |
|------|----------------|--------------|
| CTO / Doc Architecture | 전체 source-of-truth, phase gate, variant safety | D1, D8 |
| Rules / Scoring | rules/scoring divergence and safe-change boundary | D2, D4 |
| Runtime Visibility | sanitize contract and observer risk | D5 |
| UX | step readability, CTA hierarchy, mobile gate | D6 |
| QA / Release | evidence packet, blocker status, rerun policy | D7 |

## 10. Quality Rubric

| Axis | Low | Medium | High |
|------|-----|--------|------|
| Traceability | 파일/질문 연결이 약함 | 일부 연결됨 | 수정 파일과 next action이 즉시 보임 |
| Evidence Density | 근거가 거의 없음 | internal/external 중 하나만 강함 | external + internal + gate가 함께 존재 |
| Decision Quality | 상태만 있음 | 상태와 next action 일부 존재 | 왜 보류/구현인지 명확함 |
| Execution Readiness | 메모 수준 | 작업 목록 수준 | owner, severity, target, gate가 연결됨 |
| Release Utility | 참고 문서 | 검토 문서 | release/QA 판단에 바로 사용 가능 |

목표 기준:

- D1, D7, D8: High
- D2, D3, D4, D5, D6: Medium 이상, 핵심 row는 High

## 10.1 Artifact Completeness Audit

2026-03-26 기준으로 D1~D8 산출물을 다시 점검한 결과는 아래와 같다.

| Artifact | Structural Completeness | Evidence Completeness | Current Reading | Missing Proof to Close |
|----------|--------------------------|-----------------------|-----------------|------------------------|
| D1 | High | Medium | 전체 운영 규칙은 충분하나 각 증거 묶음의 closure 상태가 한눈에 보이지 않았다 | artifact별 packet completeness 표 필요 |
| D2 | High | Medium-Low | Juunana divergence 판단은 강하지만 direct UI/result/visibility capture가 약하다 | result-flow capture, spectator/hand-build capture |
| D3 | High | Medium | ten A/B flow는 강하나 UI/result numeric/observer timing direct proof가 약하다 | timecoded UI/result packet, observer timing packet |
| D4 | Medium-High | Medium-Low | score parity boundary는 명확하나 numeric proof source가 row별로 균질하게 정리되진 않았다 | result numeric packet, settlement scene packet |
| D5 | High | Medium-Low | sanitize contract는 강하지만 동일 장면 멀티-viewer 비교 세트가 없다 | attacker/defender/observer synchronized capture |
| D6 | High | Medium | 파일 추적성은 충분하나 모바일/round-end readability 증거 링크가 약하다 | narrow-width packet, round-end CTA packet |
| D7 | High | Medium | 자동/수동 QA 분리는 좋지만 evidence packet inventory가 부족했다 | packet inventory, row linkage, completion state |
| D8 | High | Medium | 실행 backlog는 명확하나 문서 closure 성격의 작업이 흩어져 보였다 | artifact-closure task grouping |

판정 원칙:

1. 구조가 있어도 `source + timestamp + scene + row linkage`가 없으면 evidence completeness는 높게 보지 않는다.
2. `Ambiguous`를 줄이는 것보다 어떤 packet이 비어 있는지 드러내는 것을 우선한다.
3. `Changed` 판정은 이미 충분해도 `Partial`/`Ambiguous` row는 후속 packet이 없으면 design closure로 간주하지 않는다.

## 10.2 Evidence Bundle Registry

아래 레지스트리는 D1이 각 산출물의 증거 묶음을 어디서 읽어야 하는지 바로 가리키기 위한 control-table이다.

| Bundle ID | Primary Sources | Checked / Timestamp | Primary Scenes | Target Artifacts | Current Completeness |
|-----------|-----------------|---------------------|----------------|------------------|----------------------|
| EB-J-01 | `SteamDB patch note`, `TuxDB mirror`, `Riichi.Wiki - Juunana Ho` | 2025-04-11, 2025-04-15, 2025-07-07 | event summary, setup, local rules, score settings | D2, D4, D7 | partial |
| EB-T-01 | Steam announcement, `Riichi.Wiki - Two-player rules from Ten`, YouTube gameplay note | 2025-03-13/14, 2026-03-20, checked 2026-03-25 | mode naming, Stage A, Stage B, assault pacing, scoreboard/start | D3, D4, D7 | partial |
| EB-V-01 | Step13 sanitize/runtime anchors | code truth | attacker/defender/observer field masking | D5, D7 | strong internal / weak external |
| EB-Q-01 | validation command results | 2026-03-25 snapshot | core/scoring/web/server/e2e | D7, D8 | partial |
| EB-UI-01 | web UI anchors + gameplay notes | checked 2026-03-25 | Stage A HUD, guess UI, assault UI, round-end overlay | D3, D6, D7 | partial |

closure 조건:

1. bundle은 최소 한 개 이상의 artifact section에서 직접 참조돼야 한다.
2. `partial` bundle은 D7 evidence packet inventory에 부족한 증거가 적혀 있어야 한다.
3. `strong internal / weak external` bundle은 code-safe boundary를 강화하는 용도로만 쓰고, 외부 parity 확정 근거로 사용하지 않는다.

## 11. Implementation Order

### 11.1 First-Wave
1. `packages/core/src/machine.ts`
   easy timeout discard blocker 정리
2. `apps/web/src/components/AttackDefensePanels.tsx`
   ten guess/assault 전달력 강화
3. `apps/web/src/App.tsx`
   round-end confirm/replay 흐름 정리
4. `apps/server/src/GameRoom.ts`
   sanitize wording과 구현 정합성 검증

### 11.2 Second-Wave
1. `apps/web/src/components/GameBoard.tsx`
   classic/Juunana wording 분리, headline/timeline 정리
2. `docs/prd.yaml` and scoring-related docs
   wording/interpretation 보강

### 11.3 Hold Queue
1. Juunana 신규 variant proposal
2. ten detailed score parity fix
3. external direct capture 없는 observer policy 변경

## 12. Exit Conditions

설계 완료는 아래가 충족될 때 성립한다.

1. D1~D8의 역할과 읽는 순서가 명확하다.
2. `classic`과 `Juunana Ho`의 관계가 "audit 대상"으로 명시된다.
3. `ten` flow와 score의 분리 원칙이 확정된다.
4. release blocker, doc blocker, evidence gap이 각각 따로 보인다.
5. Do 단계 작업자가 문서만 읽고 우선 수정 파일과 hold 항목을 구분할 수 있다.

## 13. References

- `docs/01-plan/features/riichi-city-juunana-ten-validation.plan.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.ten-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.ui-flow.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md`
- `docs/03-analysis/riichi-city-juunana-ten-validation.analysis.md`
- `docs/04-report/riichi-city-juunana-ten-validation.report.md`
