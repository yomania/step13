# riichi-city-juunana-ten-validation - Plan Document

> Version: 2.0.0 | Date: 2026-03-26 | Status: Rewritten
> Level: Starter

---

## 1. Executive Summary

### 1.1 Purpose
`Riichi City`의 `Juunana Ho`, `ten`, `ten easy`와 현재 `Step13 Mahjong`의 `classic`, `ten_attack_defense`, `ten_attack_defense_easy`를 비교 검증하는 feature의 기획 기준을 다시 정의한다.

이번 재작성의 목적은 기존 문서의 "범위는 넓지만 phase별 판단 기준이 분리되지 않은 상태"를 정리하는 것이다. 이 문서는 구현 계획 문서가 아니라 아래 3가지를 고정하는 feature charter다.

1. 무엇을 검증 대상으로 삼는가
2. 어떤 증거가 있어야 parity 판단을 내릴 수 있는가
3. 어떤 경우에 구현으로 넘어가고 어떤 경우에 문서 보류로 남기는가

### 1.2 Why This Rewrite Exists
기존 문서와 산출물 패키지(D1~D8)는 이미 상당한 내용을 담고 있지만, 아래 문제가 남아 있었다.

- `plan`과 `design`의 책임 경계가 흐려져 있었다.
- `classic == Juunana parity target`인지 여부가 계획 단계에서 명시적으로 차단되지 않았다.
- external evidence 확보, internal audit, QA evidence, implementation backlog가 한 흐름으로 묶이지 않아 phase gate 판단이 어렵다.
- Do 단계에서 "바로 구현 가능한 항목"과 "근거 확보 후 판단할 항목"이 섞여 있었다.

이번 재작성은 기존 산출물을 폐기하지 않고, 그것들을 더 일관되게 읽기 위한 상위 문서 구조를 다시 세운다.

## 2. Background

### 2.1 Current Product Baseline
현재 저장소는 다음 ruleset을 중심으로 동작한다.

- `classic`
- `ten_attack_defense`
- `ten_attack_defense_easy`

핵심 내부 기준 문서는 아래다.

- 제품/룰 기준: `docs/prd.yaml`
- 시스템 구조: `docs/system-architecture.md`
- 상태머신/이벤트 계약: `packages/core/src/machine.ts`, `packages/core/src/messages.ts`, `packages/core/src/rules.ts`
- 점수 계산: `packages/scoring/src/points.ts`
- visibility/masking: `apps/server/src/GameRoom.ts`
- UI 투영: `apps/web/src/App.tsx`, `apps/web/src/components/GameBoard.tsx`, `apps/web/src/components/AttackDefensePanels.tsx`

### 2.2 Existing PDCA Assets
이 feature에는 이미 다음 산출물이 존재한다.

- 기존 plan / design / analysis / report
- `juunana-matrix`
- `ten-matrix`
- `score-parity`
- `visibility-matrix`
- `ui-flow`
- `qa-checklist`
- `backlog`

따라서 이번 작업의 목표는 "문서를 새로 만드는 것"이 아니라 "이미 있는 문서를 phase별 source of truth로 재편성하는 것"이다.

## 3. Problem Statement

이 feature가 해결해야 하는 실제 문제는 아래 네 가지다.

1. 외부 명칭(`Juunana Ho`, `ten`, `ten easy`)과 내부 ruleset(`classic`, `ten_attack_defense`, `ten_attack_defense_easy`)이 자연스럽게 1:1 대응한다고 오해될 위험
2. 룰/점수/플로우/UI/visibility 축이 섞여 있어 parity 판정이 재현 가능하지 않은 위험
3. 외부 근거가 부족한 상태에서 shared baseline을 잘못 수정해 기존 ruleset 전체를 흔들 위험
4. QA evidence와 release gate가 문서형 판단과 구현형 판단 사이에서 섞이는 위험

## 4. Planning Principles

### 4.1 Evidence-First
- 외부 근거가 없는 parity 확정은 금지한다.
- `Ambiguous`는 실패가 아니라 정상 상태로 취급한다.
- 추정으로 `Match` 또는 `Changed`를 만들지 않는다.

### 4.2 Variant-Safe
- `classic`을 자동으로 `Juunana Ho` parity target으로 취급하지 않는다.
- `ten`의 flow parity와 score parity를 분리해 읽는다.
- shared scoring / rules baseline은 direct numeric evidence 없이 수정 대상에 올리지 않는다.

### 4.3 Phase-Separated
- Plan은 검증 범위, 판정 규칙, gate를 정의한다.
- Design은 산출물 구조, 문서 간 링크, 실행 절차를 정의한다.
- Do는 evidence가 충분한 backlog만 다룬다.
- Check는 구현 존재 여부가 아니라 문서-근거-실행의 일치율을 본다.

### 4.4 Release-Oriented
- 이 feature는 단순 비교 메모가 아니라 release-grade validation framework를 만드는 작업이다.
- 따라서 문서 품질 기준에 `traceability`, `decision quality`, `QA packet completeness`가 포함돼야 한다.

## 5. Goals

### 5.1 Primary Goals
- [ ] 외부 mode와 내부 ruleset의 매핑을 `Match / Partial / Changed / Ambiguous`로 재현 가능하게 정의한다.
- [ ] `Juunana`, `ten`, `ten easy`를 하나의 feature 아래에서 비교하되, track별 의사결정 경계를 분리한다.
- [ ] D1~D8 산출물 각각의 역할, 입력, 출력, 승인 질문을 정리한다.
- [ ] Do 단계에 바로 투입 가능한 backlog와 evidence-first hold backlog를 분리한다.
- [ ] Check 단계에서 사용할 match-rate 판단 기준을 문서 중심으로 고정한다.
- [ ] release gate, documentation gate, runtime gate를 독립적으로 정의한다.

### 5.2 Non-Goals
- 이번 단계에서 Riichi City parity 구현을 모두 완료하는 것
- 외부 증거가 없는 점수 테이블을 추정으로 코드에 반영하는 것
- `Juunana Ho` 신규 variant 신설을 지금 확정하는 것
- 인증, 로비, 계정, 매치메이킹, 배포 같은 비직접 범위를 다루는 것
- 마케팅용 UI 리디자인

## 6. Scope

### 6.1 In Scope
- 외부 검증 대상
  - Riichi City `Juunana Ho`
  - Riichi City `ten`
  - Riichi City `ten easy` 관련 공개 근거
- 내부 비교 대상
  - `classic`
  - `ten_attack_defense`
  - `ten_attack_defense_easy`
- 비교 축
  - `rules`
  - `scoring`
  - `flow`
  - `visibility`
  - `ui`
  - `qa`
- 내부 검토 레이어
  - PRD
  - core machine / rules / messages
  - scoring
  - server sanitize contract
  - web projection and gameplay UI
- 산출물 운영 범위
  - D1~D8 문서 패키지
  - validation command snapshot
  - evidence packet rule
  - backlog prioritization

### 6.2 Out of Scope
- 외부 기준 부재 상태에서 세부 numeric parity 최종 확정
- AI/bot 성능 튜닝
- 네트워크/배포/인프라 최적화
- unrelated classic UX polish
- replay 시스템 자체의 신규 기능 설계

## 7. Validation Tracks

### 7.1 Track A: Juunana Audit
핵심 질문:

- `classic`은 `Juunana Ho`와 같은 mode인가, 아니면 17보 계열의 다른 변형인가
- 어떤 항목은 명확히 `Changed`라고 말할 수 있고, 어떤 항목은 여전히 `Ambiguous`인가
- Juunana 관련 후속 작업은 구현보다 wording 분리/variant decision이 우선인가

### 7.2 Track B: Ten Audit
핵심 질문:

- `ten_attack_defense`는 Riichi City `ten`의 A/B flow를 얼마나 재현하는가
- flow parity는 강하지만 score parity는 약한지
- 즉시 개선 가능한 UI/runtime 항목은 무엇이고, direct evidence가 더 필요한 항목은 무엇인가

### 7.3 Track C: Ten Easy Risk
핵심 질문:

- `ten_attack_defense_easy`가 별도 ruleset risk를 만들고 있는가
- `pnpm test:e2e` 실패가 단순 test issue인지, 실제 flow regression인지
- easy mode는 ten core parity 판단과 어떻게 분리해서 읽어야 하는가

### 7.4 Track D: Shared Presentation and Visibility
핵심 질문:

- round-end, confirm, replay, role, step, CTA 전달력이 충분한가
- attacker/defender/observer 기준 sanitize contract가 문서와 구현에서 동일한가
- mobile/narrow-width에서 정보 우선순위가 무너지지 않는가

## 8. Decision Framework

### 8.1 Allowed Decision Types

| Type | Meaning | When Allowed |
|------|---------|--------------|
| `match` | parity가 충분히 입증됨 | external + internal anchor가 모두 존재할 때 |
| `changed` | 차이가 명확함 | 구조 또는 숫자 차이가 직접 확인될 때 |
| `partial` | 일부만 확정 가능 | flow는 맞지만 score/UI detail이 약할 때 |
| `ambiguous` | 아직 판단 유보 | external direct evidence가 부족할 때 |
| `doc-only divergence` | 문서상 차이만 고정 | 구현 변경이 위험하거나 premature일 때 |
| `do-now` | 바로 구현으로 넘김 | internal anchor와 risk가 명확할 때 |
| `evidence-first hold` | 추가 증거 확보 우선 | 구현보다 capture/log/timecode 확보가 먼저일 때 |

### 8.2 Forbidden Decisions
- external numeric evidence 없이 shared score baseline을 parity fix로 해석하는 것
- visibility external capture 없이 공개 범위를 넓히는 것
- `classic`과 `Juunana Ho`를 이름만으로 동일 variant로 확정하는 것
- `ten` flow match를 근거로 score match까지 자동 확장하는 것

## 9. Deliverables

### 9.1 Core Deliverables
- D1: 통합 design 문서
- D2: Juunana comparison matrix
- D3: Ten comparison matrix
- D4: Score parity table
- D5: Visibility matrix
- D6: UI flow map
- D7: QA evidence checklist
- D8: Backlog registry

### 9.2 Supporting Outputs
- validation command snapshot
- evidence packet rule
- reviewer question set
- Do re-entry decision note
- release gate note

## 10. Work Breakdown

### 10.1 Reference Audit
- 외부 근거를 source / timestamp / mode / scene 단위로 재정리한다.
- direct gameplay, wiki, store, patch note를 confidence와 함께 구분한다.
- 외부 근거가 없는 항목은 `Ambiguous`로 둔다.

### 10.2 Internal Baseline Audit
- PRD, machine, scoring, sanitize, UI projection을 track별로 매핑한다.
- shared baseline과 mode-specific behavior를 분리한다.
- test/build/e2e 상태를 feature 기준으로 다시 묶는다.

### 10.3 Matrix and Ledger Consolidation
- D2~D5는 parity 판정 문서로, D6~D8은 execution 문서로 역할을 분리한다.
- 각 row에는 최소한 external note 또는 internal anchor가 있어야 한다.
- next action은 `doc-only`, `do-now`, `hold` 중 하나로 귀결돼야 한다.

### 10.4 Phase Gate Definition
- Do gate: 즉시 구현 항목과 수정 파일이 명확해야 한다.
- Check gate: external/internal/evidence/command 결과가 한 문맥으로 연결돼야 한다.
- Report gate: release blocker와 documentation blocker가 분리돼 있어야 한다.

## 11. Success Criteria

- [ ] `Juunana`, `ten`, `ten easy`의 비교 트랙이 서로 다른 판단 규칙으로 정의돼 있다.
- [ ] D1~D8의 역할과 읽는 순서가 문서상으로 명확하다.
- [ ] `classic != Juunana parity target by default`가 기획 수준에서 명시돼 있다.
- [ ] `ten flow parity`와 `ten score parity`가 분리된 판단 축으로 정리돼 있다.
- [ ] `do-now` backlog와 `evidence-first hold` backlog가 구분돼 있다.
- [ ] `pnpm test:e2e` blocker를 포함한 release gate가 문서에 명시돼 있다.
- [ ] QA evidence packet 규칙과 manual capture 필요 목록이 추적 가능하다.

## 12. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 외부 직접 증거가 부족해 parity를 과도하게 확정할 위험 | High | High | `Ambiguous` 유지, direct capture/timecode 확보 전 구현 확정 금지 |
| shared baseline 수정이 classic/ten 전체 회귀를 만들 위험 | High | Medium | score/rules 변경은 D4 근거와 blocker review를 통과한 뒤에만 진행 |
| UI parity와 release-quality UX 개선을 혼동할 위험 | Medium | High | D3/D6에서 parity row와 UX readability row를 분리 |
| easy mode e2e 실패를 문서 이슈로 오인할 위험 | High | Medium | D7/D8에서 runtime blocker로 별도 승격 |
| 산출물은 많지만 source-of-truth 순서가 없어서 실행력이 떨어질 위험 | Medium | Medium | D1에서 읽는 순서와 phase gate를 고정 |

## 13. Schedule

| Phase | Target Date | Status |
|-------|-------------|--------|
| Plan Rewrite | 2026-03-26 | Completed in this revision |
| Design Rewrite | 2026-03-26 | In Progress |
| Do Re-entry Review | 2026-03-26 | Pending |
| Check Re-run | TBD | Pending |
| Report Refresh | TBD | Pending |

## 14. References

- `docs/prd.yaml`
- `docs/system-architecture.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.design.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.ten-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.score-parity.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.ui-flow.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md`
- `docs/02-design/features/riichi-city-juunana-ten-validation.backlog.md`
- `docs/03-analysis/riichi-city-juunana-ten-validation.analysis.md`
- `docs/04-report/riichi-city-juunana-ten-validation.report.md`
