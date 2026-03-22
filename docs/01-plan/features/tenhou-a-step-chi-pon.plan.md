# tenhou-a-step-chi-pon - Plan Document

> Version: 1.0.0 | Date: 2026-03-22 | Status: Draft
> Level: Starter

---

## 1. Overview

### 1.1 Purpose
텐공방전의 A 스탭에서 공격자에게 `치`, `펑` 액션을 추가해, 현재 선언 중심 흐름을 실제 의도한 진행 규칙에 맞게 확장하고 이후 단계 전이와 UI 피드백까지 일관되게 정리한다.

### 1.2 Background
현재 텐공방전은 Stage A에서 선언 및 버리기 중심 액션만 노출되고 있으며, 공격자가 직전 공개 정보에 반응해 `치`, `펑`을 수행하는 흐름은 아직 지원되지 않는다. 이로 인해 룰셋 의도와 실제 플레이 감각 사이에 차이가 있고, 이후 Stage B 추측/공격 흐름으로 넘어가기 전 hand state, meld 표시, 액션 가능 조건, 서버 동기화 규칙을 확정할 필요가 있다.

이 작업은 구현 이전의 `plan` 단계로서, 어떤 상황에서 `치`, `펑`이 가능해야 하는지, 어떤 레이어가 영향을 받는지, 테스트와 UI 기준을 어디까지 포함할지를 먼저 고정하는 데 목적이 있다.

## 2. Goals

### 2.1 Primary Goals
- [ ] 텐공방전 A 스탭에서 `치`, `펑`이 허용되는 조건과 금지 조건을 문서로 정의한다.
- [ ] `치`, `펑` 추가가 상태머신, 서버 동기화, UI, 로그/리플레이에 미치는 영향 범위를 분해한다.
- [ ] 액션 선택 이후 손패/부가패/버림패/턴 전이의 기대 동작을 명시한다.
- [ ] 추후 design 단계에서 바로 사용할 테스트 시나리오와 회귀 범위를 정리한다.
- [ ] 구현 시 기존 선언/버리기 흐름과 충돌하지 않도록 주요 리스크를 선제적으로 분류한다.

### 2.2 Non-Goals
- 이번 단계에서 실제 `치`, `펑` 로직 구현 완료
- 텐공방전 외 다른 룰셋의 울기 기능 추가
- 대규모 UI 리디자인 또는 디자인 시스템 개편
- 깡, 론, 추가 반응 액션 전체를 동시에 도입

## 3. Scope

### 3.1 In Scope
- 텐공방전 A 스탭에서의 `치`, `펑` 허용 규칙 정의
- 직전 버림패 기준 후보 조합 계산 방식 검토
- 액션 가능 여부를 판정하는 core 로직과 상태 전이 설계 준비
- 서버에서 플레이어별 공개/비공개 정보 동기화 정책 검토
- 웹 UI에서 `치`, `펑` 액션 버튼, 후보 선택, 결과 표시 방식 정의
- 로그, 리플레이, 이벤트 메시지에 필요한 변경점 정리
- 테스트 계획 수립:
  - 합법/불법 `치`, `펑` 판정
  - 액션 후 손패/부가패 반영
  - 턴 전이 및 후속 discard 강제 여부
  - 멀티클라이언트 상태 동기화

### 3.2 Out of Scope
- A 스탭 외 B 스탭 규칙 재설계
- AI 플레이 전략 고도화
- 애니메이션/사운드 연출 강화
- 매치메이킹, 인증, 로비, 결과 화면 일반 UX 개편

## 4. Rule And Product Questions

| ID | Topic | Planning Question | Why It Matters |
|----|-------|-------------------|----------------|
| ACP-01 | Trigger Window | `치`, `펑`은 어떤 직전 버림패/상태에서만 허용되는가 | 액션 노출 조건과 서버 검증 기준을 결정 |
| ACP-02 | Priority | `치`, `펑` 가능 시 선언/일반 버리기와 어떤 우선순위로 공존하는가 | UI 버튼 배치와 state transition 충돌 방지 |
| ACP-03 | Candidate Selection | 여러 조합이 가능할 때 선택 UI가 필요한가 | 클라이언트 상호작용과 이벤트 스키마에 영향 |
| ACP-04 | Post-Meld Flow | `치`, `펑` 직후 반드시 어떤 discard 또는 다음 단계가 이어지는가 | turn ownership과 pending action 모델 설계에 영향 |
| ACP-05 | Visibility | 다른 플레이어에게 공개해야 할 정보 범위는 어디까지인가 | server masking, replay log, spectator 동기화 영향 |
| ACP-06 | Easy/Standard | 텐공방전 EASY에도 동일 규칙을 적용하는가 | ruleset 분기와 회귀 테스트 범위를 결정 |

## 5. Impacted Areas

| Area | Expected Touch Points | Planning Focus |
|------|-----------------------|----------------|
| Core state machine | `packages/core/src/machine.ts`, 관련 rules/helper | `치`, `펑` 액션 guard, state transition, post-action discard 흐름 |
| Shared contracts | `packages/proto`, core messages/types | 새로운 action payload, meld 표현, replay-safe event shape |
| Server sync | `apps/server/src/GameRoom.ts` | action validation, broadcast payload, hidden info policy |
| Web UI | `apps/web/src/App.tsx`, 관련 action panel/hand component | 액션 버튼 노출, 조합 선택 UX, meld 표시 |
| Replay/logging | replay event surface, message formatting | 액션 내역 재현 가능성, 로그 가독성 |
| Tests | core/server/web 영향 테스트 | 합법성, 회귀, 동기화 검증 |

## 6. Work Breakdown

### 6.1 Rule Definition
- A 스탭에서 `치`, `펑` 가능 조건을 게임 규칙 기준으로 고정한다.
- `치`, `펑` 이후 강제 discard/다음 턴 규칙을 확정한다.
- Easy 룰셋과 공통 적용 여부를 결정한다.

### 6.2 Data And State Design Preparation
- 현재 컨텍스트에 meld/claim pending 상태를 추가해야 하는지 검토한다.
- action payload에 타겟 discard, 사용 타일, 선택 조합 식별자가 필요한지 정의한다.
- replay 및 message log에 필요한 최소 이벤트 정보를 정리한다.

### 6.3 UI Planning
- 액션 버튼을 어디에 어떤 조건으로 노출할지 정한다.
- 복수 조합 가능 시 후보 선택 UX를 정의한다.
- 손패, 부가패, 최근 버림패 영역에서 액션 결과를 어떻게 드러낼지 정한다.

### 6.4 Validation Planning
- core 규칙 테스트와 UI/동기화 검증 명령을 미리 고정한다.
- 기존 A 스탭 기능과의 회귀 범위를 정의한다.
- 리플레이 또는 event log 기반 검증 필요 여부를 design 단계 입력으로 남긴다.

## 7. Success Criteria

- [ ] A 스탭 `치`, `펑` 기능의 목적과 범위가 문서로 고정되어 있다.
- [ ] 구현에 필요한 영향 영역이 core/server/web/contracts 기준으로 분리되어 있다.
- [ ] design 단계에서 답해야 할 핵심 규칙 질문이 정리되어 있다.
- [ ] 테스트 및 회귀 범위가 명시돼 구현 단계에서 누락 가능성이 낮다.
- [ ] 기존 선언/버리기 흐름과 충돌할 수 있는 주요 리스크가 문서화돼 있다.

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| `치`, `펑` 규칙이 현재 텐공방전 의도와 다르게 해석될 수 있음 | High | Medium | design 단계에서 허용 조건과 예외 조건을 먼저 고정 |
| 액션 추가로 A 스탭 상태머신이 복잡해져 기존 선언/버리기 흐름이 깨질 수 있음 | High | High | action guard와 post-action transition을 분리 설계하고 회귀 테스트 우선 추가 |
| 복수 조합 선택 UX가 불명확하면 입력 실수와 동기화 오류가 발생할 수 있음 | Medium | High | UI에서 조합 선택을 명시적으로 모델링하고 payload shape를 단순화 |
| 서버/클라이언트가 서로 다른 합법성 판단을 하면 desync가 발생할 수 있음 | High | Medium | core 중심 단일 판정 로직을 설계하고 server/web는 그 결과만 소비 |
| replay/logging 스키마가 불충분하면 디버깅과 QA가 어려워짐 | Medium | Medium | design 단계에서 이벤트 필드 요구사항을 함께 정의 |

## 9. Deliverables

- `tenhou-a-step-chi-pon` plan 문서
- 규칙 질문 목록과 design 입력 항목
- 영향 범위 표(core/server/web/contracts/tests)
- 구현 전 테스트/회귀 체크리스트

## 10. Schedule

| Phase | Target Date | Status |
|-------|-------------|--------|
| Plan | 2026-03-22 | In Progress |
| Design | 2026-03-22 to 2026-03-23 | Pending |
| Implementation | TBD | Pending |
| Review | TBD | Pending |

## 11. References

- `docs/prd.yaml`
- `docs/system-flow.md`
- `docs/system-architecture.md`
- `packages/core/src/machine.ts`
