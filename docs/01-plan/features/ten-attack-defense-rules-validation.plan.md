# ten-attack-defense-rules-validation - Plan Document

> Version: 1.0.0 | Date: 2026-03-22 | Status: Draft
> Level: Starter

---

## 1. Overview

### 1.1 Purpose
텐 공방전의 실제 게임 순서, 단계 전이, 후리텐/겐부츠 처리, 공격/수비 정보 노출 정책, 단계별 UI 전달력을 규칙 기준으로 재검증하고, 발견된 차이를 수정 가능한 작업 단위로 분해한다.

### 1.2 Background
현재 구현은 `packages/core/src/machine.ts`를 중심으로 텐 공방전 단계(A 선언, B 수비 추측, B 공격)를 구성하고 있고, `apps/web/src/components/AttackDefensePanels.tsx`와 `apps/web/src/App.tsx`가 주요 UI를 담당한다. 그러나 실제 플레이 기준으로는 다음과 같은 이상 징후가 이미 확인됐다.

- Phase B 추측 UI에서 상대 버림패가 추측 불가 타일로 처리되지 않는다.
- Phase B에서 수비자 추측 2회 실패 후 공격자의 5회 쯔모기리/피탄 판정 루프가 기대대로 진행되지 않는다.
- 방어측 추측 패 선택 UI의 패 크기와 피드백 밀도가 낮아 단계 의도가 약하게 전달된다.
- 단계별 전이, 타이머, 숨김 정보 정책이 규칙 기대와 일치하는지 문서/테스트 기준이 충분히 고정되어 있지 않다.

이 작업은 즉시 구현보다 먼저 "규칙 기준선"과 "수정 우선순위"를 명확히 하는 plan 단계다.

## 2. Goals

### 2.1 Primary Goals
- [ ] 텐 공방전의 전체 라운드 흐름을 단계별로 검증 가능한 체크리스트로 정의한다.
- [ ] Stage A, Stage B 추측, Stage B 공격 각각에 대해 기대 규칙과 현재 구현의 차이를 식별한다.
- [ ] 후리텐/겐부츠/추측 가능 타일 표시 규칙을 명시한다.
- [ ] UI 검토 범위를 정보 위계, 패 크기, 상호작용 명확성, 모바일 가독성까지 포함해 정리한다.
- [ ] 수정 작업을 상태머신, 서버 동기화, UI, 테스트, 문서 동기화 단위로 분해한다.
- [ ] 구현 전 필요한 design 문서의 핵심 항목을 식별한다.

### 2.2 Non-Goals
- 이번 단계에서 곧바로 전체 로직 수정 완료
- 텐 공방전 외 클래식 17보 룰의 기능 확장
- 대규모 UI 리브랜딩 또는 디자인 시스템 재구성
- 신규 룰셋 추가

## 3. Scope

### 3.1 In Scope
- 텐 공방전 표준 모드와 Easy 모드의 공통/차이 흐름 정의
- `docs/prd.yaml`, `docs/system-flow.md`, `docs/system-architecture.md` 기준과 실제 코드 비교
- 상태머신 전이 검토:
  - `ten_match_start`
  - `ten_a_turn`
  - `ten_b_guess`
  - `ten_b_assault`
  - `ten_round_end`
- 규칙 검토 항목:
  - 선언 가능 조건
  - 후리텐 선언 제한
  - 수비 추측 가능 타일/불가 타일 판정
  - 추측 실패 2회 후 공격 단계 전이
  - 공격자의 5회 쯔모기리 루프 및 피탄 판정
  - 깡 옵션 노출/처리 조건
  - 라운드 종료와 결과 반영
- UI 검토 항목:
  - Stage B 추측 트레이의 패 크기/가독성
  - 선택 상태, 제외 상태(X 표기), 남은 추측/공격 횟수 전달력
  - 공격/수비 역할 인지성
  - 모바일/데스크톱에서의 상호작용 밀도
- 테스트 자산 검토:
  - `packages/core/src/machine.test.ts`
  - 관련 봇/로직 테스트
  - 필요한 신규 회귀 테스트 목록

### 3.2 Out of Scope
- 인증, 로비, 랭킹, 프로필 등 텐 공방전과 직접 무관한 UX
- 멀티매치 토너먼트 규칙
- AI 플레이 성능 튜닝 전반
- 배포/인프라 변경

## 4. Current Findings

| ID | Area | Current Observation | Suspected Cause | Severity |
|----|------|---------------------|-----------------|----------|
| TAD-01 | Stage B Guess UI | 상대 버림패가 추측 불가(X)로 표시되지 않음 | 후보 계산이 `wall` 잔량 기준만 사용하고 상대 버림패/겐부츠 규칙을 반영하지 않음 (`apps/web/src/components/AttackDefensePanels.tsx`) | blocker |
| TAD-02 | Stage B Assault Flow | 수비자 추측 2회 실패 후 공격자의 5회 공격 루프가 체감상 진행되지 않음 | `B_ASSAULT` 진입 후 draw/discard 루프 또는 UI 반영/서버 동기화 경로에 결함 가능 (`packages/core/src/machine.ts`, `apps/web/src/App.tsx`, `apps/server/src/GameRoom.ts`) | blocker |
| TAD-03 | Guess Interaction UX | 방어측 추측 패가 너무 작고 선택/제외 상태 구분이 약함 | `TileView size=\"xs\"`와 타일 그리드 레이아웃이 공방전 전용 상호작용 밀도를 감당하지 못함 | major |
| TAD-04 | Rules Coverage | 단계별 기대 순서를 검증하는 테스트가 부족함 | 상태 전이 happy path 일부만 테스트하고 Stage B 전체 루프 커버가 부족함 | major |
| TAD-05 | Documentation Drift | 문서에는 단계가 정의돼 있으나 단계별 세부 게이트와 금지 행동이 부족함 | PRD/system-flow가 구현 세부 규칙까지 고정하지 못함 | major |

## 5. CTO Team Structure

| Team | Primary Responsibility | Key Outputs | Handoff |
|------|------------------------|-------------|---------|
| 룰관리팀 | 텐공방전 진행 룰을 정리하고 문서화해 전체 플로우의 기준선을 관리 | 단계별 게임 순서표, 금지 행동 규칙, 승패/종료 조건 문서, 상태 전이 기준 | 디자인팀, QA팀, 개발팀이 동일 규칙 기준을 사용하도록 제공 |
| 디자인팀 | 마작일번가의 텐공방전 구현을 참고해 본 게임에 적용할 UI/UX를 검토하고 설계 | 단계별 화면 흐름, HUD 구조, 추측 패널 개선안, 모바일/데스크톱 가독성 기준 | 룰관리팀 기준을 UI 상호작용과 시각 피드백으로 번역 |
| QA팀 | 개발 서버에서 실제 게임 플로우를 검증해 룰과 디자인이 올바른지 확인하고 피드백 | 단계별 QA 체크리스트, 재현 절차, 버그 리포트, 우선순위 분류 | 룰관리팀/디자인팀 기준 대비 실제 동작 차이를 개발팀에 전달 |
| 개발팀 | 서버/클라이언트의 성능 이슈와 시스템 버그를 수정하고 안정적으로 동작하게 구현 | 상태머신 수정, UI 수정, 동기화 수정, 회귀 테스트, 빌드 검증 결과 | QA 피드백과 문서 기준을 구현으로 반영하고 결과를 다시 QA에 전달 |

### 5.1 Operating Model

- CTO 팀은 텐공방전 검증과 수정을 총괄하는 상위 의사결정 단위다.
- 룰관리팀이 규칙의 source of truth를 소유한다.
- 디자인팀은 규칙을 그대로 시각화하지 않고, 실제 플레이에서 오해가 없도록 UX로 재해석한다.
- QA팀은 개발 서버 기준으로 실제 플레이 순서를 검증하며, 문서 기준과 구현 기준의 차이를 분리해 기록한다.
- 개발팀은 서버, 클라이언트, 테스트를 함께 수정하되 룰관리팀 문서와 디자인팀 산출물을 기준으로 작업한다.
- blocker 판단은 CTO 팀 공통 기준으로 관리하고, 규칙 오해/UX 혼란/시스템 버그를 분리해서 추적한다.

## 6. Rule Validation Checklist

### 6.1 Match Start / Stage A

| Check | Expected Behavior | Primary Code Surface |
|------|-------------------|----------------------|
| A-01 | 텐 공방전 시작 시 `ten_match_start -> ten_a_turn`으로 진입 | `packages/core/src/machine.ts` |
| A-02 | 현재 턴 플레이어만 선언/버리기 가능 | `packages/core/src/machine.ts`, `apps/web/src/App.tsx` |
| A-03 | 후리텐이면 선언 불가 | `packages/core/src/tenpaiDeclaration.ts`, `apps/web/src/components/HandDisplay.tsx` |
| A-04 | Easy 모드는 리치 선언 플래그 거부 | `packages/core/src/machine.ts`, 테스트 |
| A-05 | 선언 후 공격자 손패 13장 고정, 선언 버림패가 discard에 반영 | `packages/core/src/machine.ts` |

### 6.2 Stage B Guess

| Check | Expected Behavior | Primary Code Surface |
|------|-------------------|----------------------|
| B-01 | 선언 직후 수비자 턴으로 전환 | `packages/core/src/machine.ts` |
| B-02 | 수비자는 최대 2회 추측 가능 | `packages/core/src/rules.ts`, `packages/core/src/machine.ts` |
| B-03 | 공격자의 실제 대기패를 맞히면 즉시 수비자 승리 | `packages/core/src/machine.ts` |
| B-04 | 상대 버림패는 추측 후보에서 제외되거나 명확히 X 처리 | `apps/web/src/components/AttackDefensePanels.tsx`, 필요 시 core helper |
| B-05 | 추측 실패 시 최근 추측, 남은 횟수, 실패 피드백이 일관되게 갱신 | `packages/core/src/messages.ts`, `apps/web/src/components/AttackDefensePanels.tsx` |
| B-06 | 숨김 정보 정책이 유지되어 수비자는 실제 대기패를 알 수 없어야 함 | `apps/server/src/GameRoom.ts` |

### 6.3 Stage B Assault

| Check | Expected Behavior | Primary Code Surface |
|------|-------------------|----------------------|
| BA-01 | 추측 2회 실패 시 `ten_b_assault`로 전이 | `packages/core/src/machine.ts` |
| BA-02 | 공격자는 최대 5회 쯔모기리 기회를 가진다 | `packages/core/src/rules.ts`, `packages/core/src/machine.ts` |
| BA-03 | 각 공격 턴에서 피탄 여부를 즉시 판정한다 | `packages/core/src/machine.ts` |
| BA-04 | 공격 루프 중 pending draw, discard, 남은 공격 횟수가 UI에 보인다 | `apps/web/src/App.tsx`, `apps/web/src/components/AttackDefensePanels.tsx` |
| BA-05 | 5회 소진 시 의도된 결과(무승부 또는 규칙상 종료)가 일관되게 처리된다 | `packages/core/src/machine.ts`, PRD 명세 보강 필요 |
| BA-06 | 깡 옵션이 규칙상 허용되는 경우에만 노출되고, 선택/패스가 루프를 깨지 않는다 | `packages/core/src/machine.ts`, `apps/web/src/components/AttackDefensePanels.tsx` |

## 7. UI Review Checklist

| ID | Topic | Review Question |
|----|-------|-----------------|
| UI-01 | Guess Tile Size | Phase B 추측 그리드에서 패 이미지가 모바일/데스크톱 모두 충분히 읽히는가 |
| UI-02 | Excluded Candidates | 추측 불가 패가 단순 비활성화가 아니라 규칙 이유와 함께 명확히 보이는가 |
| UI-03 | Selection Feedback | 현재 선택 패, 마지막 추측 패, 성공/실패 결과가 혼동 없이 분리되는가 |
| UI-04 | Role Awareness | 공격자/수비자 역할과 현재 단계가 첫눈에 인지되는가 |
| UI-05 | Assault Visibility | 공격 단계에서 남은 5회, 현재 피탄 체크 흐름, pending draw가 충분히 드러나는가 |
| UI-06 | Density On Small Screens | 하단 패널이 작은 화면에서 터치 가능한 크기와 여백을 유지하는가 |

## 8. Work Breakdown

### 8.1 Design Preparation
- 규칙 기준 문서를 작성한다.
- Stage B 추측 가능/불가 타일 정책을 명시한다.
- Stage B 공격 루프의 상태 전이 다이어그램을 문서로 분리한다.

### 8.2 Logic Audit
- `packages/core/src/machine.ts`에서 Stage A/B 전이와 guard/action을 추적한다.
- `packages/core/src/messages.ts`와 `GameContext.attackDefense` 필드가 규칙을 표현하기에 충분한지 검토한다.
- 필요 시 공격 루프의 draw/discard/round-end 조건을 helper 단위로 분리하는 설계를 준비한다.

### 8.3 UI Audit
- `apps/web/src/components/AttackDefensePanels.tsx`의 후보 계산과 비활성화 기준을 규칙 기준으로 재정의한다.
- X 표기, 이유 배지, 선택된 패 preview, 패 크기 스케일을 재설계한다.
- `apps/web/src/App.tsx`의 Stage A/B 손패/풀 표시 정책이 실제 턴 상태와 어긋나지 않는지 확인한다.

### 8.4 Server Sync Audit
- `apps/server/src/GameRoom.ts`의 hidden tile masking이 공격/수비 정보 정책을 깨지 않는지 확인한다.
- `apps/server/src/Bot.ts`가 B_GUESS / B_ASSAULT 상태와 같은 규칙을 사용하도록 맞춘다.

### 8.5 Test Plan
- 상태머신 테스트 추가:
  - 상대 버림패가 추측 후보에서 제외되는 규칙 helper 테스트
  - 추측 2회 실패 후 `ten_b_assault` 진입 테스트
  - 공격자 5회 쯔모기리 루프 완료 테스트
  - 공격 중 피탄 시 즉시 종료 테스트
- 웹 검증:
  - 최소한 컴포넌트 수준 렌더링 또는 수기 QA 체크리스트
- 회귀 명령:
  - `pnpm --filter @step13/core exec vitest run`
  - `pnpm --filter web build`
  - 필요 시 `pnpm --filter server build`

## 8. Success Criteria

- [ ] 텐 공방전 단계별 기대 순서가 문서로 고정되어 있다.
- [ ] 현재 구현과 규칙 간 차이가 blocker/major/minor로 분류되어 있다.
- [ ] Stage B 추측 후보 규칙과 Assault 루프 규칙이 design 입력으로 충분히 정리됐다.
- [ ] UI 검토 항목이 구체적인 수정 작업으로 분해됐다.
- [ ] 구현 단계에서 바로 사용할 테스트 매트릭스가 준비됐다.
- [ ] CTO 팀 산하 각 팀의 역할과 handoff가 명확히 정의되어 있다.

## 9. Team Execution Sequence

| Order | Team | Primary Focus | Exit Condition |
|-------|------|---------------|----------------|
| 1 | 룰관리팀 | 텐공방전 실제 진행 룰과 단계별 금지/허용 행동 정리 | 전체 플로우 문서 초안 확정 |
| 2 | 디자인팀 | 마작일번가 참고 UI/UX 검토 및 본 게임 적용안 정리 | 단계별 UI 개선안과 기준 화면 정의 |
| 3 | QA팀 | 개발 서버에서 실제 플레이 기준 검증 | 단계별 버그 목록과 재현 절차 확보 |
| 4 | 개발팀 | 서버/클라이언트/테스트 수정 및 안정화 | blocker 수정, 회귀 테스트 통과 |
| 5 | CTO Team Review | 각 팀 산출물 교차 검토 및 우선순위 확정 | design/do 단계 입력 확정 |

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 실제 텐 공방전 세부 규칙이 문서에 충분히 고정되지 않음 | High | Medium | design 단계에서 게임 순서 표와 금지 행동 표를 먼저 고정 |
| UI 문제와 로직 문제가 섞여 원인 추적이 늦어짐 | High | High | core/server/web 레이어별로 이슈를 분리 기록 |
| B_ASSAULT 버그가 상태머신이 아니라 masking/UI 문제일 수 있음 | High | Medium | eventLog, currentTurn, pendingDrawTile, assaultRemaining 동기화 경로를 모두 비교 |
| Easy/표준 모드 차이를 수정 중 회귀시킬 수 있음 | Medium | Medium | 공통 테스트 + ruleset-specific 테스트를 분리 추가 |

## 11. Deliverables

- 텐 공방전 규칙 검증 plan 문서
- CTO 팀 구조와 역할 정의
- design 단계 입력용 규칙 차이 목록
- 상태머신/UI/서버/테스트별 수정 backlog
- 우선순위가 부여된 버그 리스트

## 12. Schedule

| Phase | Target Date | Status |
|-------|-------------|--------|
| Plan | 2026-03-22 | In Progress |
| Design | 2026-03-22 to 2026-03-23 | Pending |
| Logic/UI Audit | 2026-03-23 | Pending |
| Implementation | TBD | Pending |
| Verification | TBD | Pending |

## 13. References

- `docs/prd.yaml`
- `docs/system-flow.md`
- `docs/system-architecture.md`
- `packages/core/src/machine.ts`
- `packages/core/src/messages.ts`
- `packages/core/src/rules.ts`
- `packages/core/src/tenpaiDeclaration.ts`
- `packages/core/src/machine.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/AttackDefensePanels.tsx`
- `apps/server/src/GameRoom.ts`
- `apps/server/src/Bot.ts`
