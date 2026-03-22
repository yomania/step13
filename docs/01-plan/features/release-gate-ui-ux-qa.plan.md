# release-gate-ui-ux-qa - Plan Document

> Version: 1.0.0 | Date: 2026-03-22 | Status: Draft
> Level: Starter

---

## 1. Overview

### 1.1 Purpose
17보, 텐공방전, 텐공방전 EASY를 하나의 출시 전 최종 게이트로 묶어 1~2주 내에 공통 UI/UX polish, 룰셋별 핵심 흐름 검증, 최종 QA 통과 체계를 확정한다.

### 1.2 Background
현재 게이트의 핵심 과제는 세 룰셋이 공유하는 로그인, 로비, 실시간 상태 동기화, 재접속, 리플레이 표면에서 회귀 없이 출시 가능한 수준의 품질 기준을 맞추는 것이다. 운영 방식은 룰셋별 분산 소유가 아니라 중앙 `Release Gate Cell`이 전체 게이트를 소유하는 방식으로 고정한다.

## 2. Goals

### 2.1 Primary Goals
- [ ] Release Gate Cell 역할과 책임, 사인오프 권한을 문서로 고정한다.
- [ ] 공통 UX 경로와 룰셋별 Must 시나리오를 포함한 cross-ruleset scenario matrix를 확정한다.
- [ ] blocker / major / minor severity rubric과 triage 기본 규칙을 확정한다.
- [ ] evidence + sign-off sheet 포맷을 정의해 QA 결과와 승인 기준을 추적 가능하게 만든다.
- [ ] 게이트 중 발견된 비차단 polish 항목을 후속 backlog로 분리해 출시 판단과 개선 항목을 분리한다.

### 2.2 Non-Goals
- 공개 런타임 API, 프로토콜, 타입 계약 변경
- 대규모 리팩터링 또는 신규 기능 개발
- 새 테스트 프레임워크 도입
- 장기 운영 조직 설계 또는 룰셋별 전담 포드 체계 재편

## 3. Scope

### 3.1 In Scope
- Release Gate Cell 팀 구성과 역할표
- 공통 UX 점검 순서와 룰셋별 플레이 점검 절차
- 로그인/회원가입, 프로필, 룰셋 선택, 룸 생성/참가, 실전 매치, 재입장/포기, 리플레이, 3개 룰셋 핵심 전환 시나리오
- 교차 검증 항목: 타이머/타임뱅크, fog-of-war 마스킹, `queryId` 응답 매칭, 봇 포함 시작 흐름, 리플레이와 실제 로그 일치
- 자동화 실행 순서, 회귀 재실행 기준, 증빙 수집 방식
- final gate sign-off 기준과 후속 polish backlog 분류

### 3.2 Out of Scope
- 장기 로드맵 정의
- 새 규칙 추가 또는 기존 룰 로직 확장
- 비핵심 운영 툴링 교체
- 출시 후 운영 모니터링 체계 상세 설계

## 4. Team Design

| Role | Owner Model | Primary Responsibility | Backup / Merge Rule |
|------|-------------|------------------------|---------------------|
| Release Captain / CTO Lead | 고정 1명 | 전체 게이트 소유, 일일 triage, blocker 우선순위, 최종 go/no-go | 인원 3명일 때 Product UX 역할 겸임 |
| Product UX Lead | 고정 1명 | 로그인, 룰셋 선택, 로비/룸, 게임 진입, 리플레이, 모바일/데스크톱 가독성, 가이드 명확성 검증 | 인원 3명일 때 Release Captain과 통합 |
| Gameplay QA Lead | 고정 1명 | 17보, 텐공방전, EASY 규칙 흐름, 턴 진행, 결과 처리, 마스킹 정책, 점수/결산 검증 | 단독 유지 |
| Realtime/Platform Lead | 고정 1명 | 인증, ws-ticket, JOIN, 재접속, 타이머, `queryId`, 상태 동기화, 리플레이 안정성 검증 | 인원 3명일 때 Automation과 통합 |
| Automation Lead | 고정 1명 또는 겸임 | 자동화 명령 실행, 회귀 재실행 기준, 로그/증빙 수집, 결과 정리 | 인원 3명일 때 Realtime/Platform과 통합 |

### 4.1 Operating Model
- 운영 단위는 룰셋별 pod가 아니라 중앙 `Release Gate Cell`이다.
- 모든 blocker triage는 Release Captain이 소유한다.
- 룰셋별 이슈라도 공통 UI 또는 소켓 레이어를 건드리면 cross-ruleset regression으로 관리한다.
- QA 시작 전 baseline commit 또는 baseline issue list를 확정한다.

## 5. Execution Sequence

| Order | Step | Description | Exit Condition |
|------|------|-------------|----------------|
| 1 | Baseline Lock | dirty worktree, baseline commit, known issue list, 실행 환경을 고정 | 기준선 합의 완료 |
| 2 | Common UX Sweep | 공통 UX 경로를 혼합 유저군 기준으로 검증 | Must 공통 시나리오 결과 기록 |
| 3 | Ruleset Gameplay Sweep | 17보, 텐공방전, EASY 핵심 플레이 흐름 점검 | 룰셋별 Must 시나리오 결과 기록 |
| 4 | Regression Replay | 자동화와 영향 범위 기반 회귀 재실행 | 영향 범위별 required rerun 완료 |
| 5 | Final Sign-off | blocker 0, major owner/due 명시, evidence package 확인 | go/no-go 결정 가능 |

## 6. Scenario Matrix

### 6.1 Common Must Scenarios

| ID | Scenario | Primary Owner | Evidence |
|----|----------|---------------|----------|
| C01 | 로그인 / 회원가입 | Product UX + Realtime | 화면 캡처, auth/ws smoke 로그 |
| C02 | 룰셋 전환 | Product UX | 화면 캡처, 수기 체크 |
| C03 | 룸 목록 / 생성 / 입장 | Product UX + Realtime | 화면 캡처, e2e 또는 수기 로그 |
| C04 | 매치 시작 | Gameplay QA + Realtime | 게임 로그, 시나리오 체크 |
| C05 | 포기 / 나가기 | Gameplay QA | 게임 종료 결과 캡처 |
| C06 | 재접속 / 재입장 | Realtime/Platform | 서버 로그, 화면 캡처 |
| C07 | 리플레이 열기 | Product UX + Realtime | 리플레이 캡처, 실제 로그 비교 |

### 6.2 Ruleset-Specific Must Scenarios

| Ruleset | Scenario | Expected Focus |
|---------|----------|----------------|
| 텐공방전 | Stage A 선언 | 선언 UI 명확성, 상태 전이 정확성 |
| 텐공방전 | Stage B 추측 | 입력 유효성, 정보 노출 정책 |
| 텐공방전 | Stage B 공격 | 턴 진행, 결과 반영, 상태 sync |
| 텐공방전 | 리치 허용 흐름 | 허용 조건, UI affordance, 판정 반영 |
| 텐공방전 | 정산 / 결과 표시 | 점수/결과 표기 일관성 |
| 텐공방전 EASY | 리치 비허용 | 일반 룰과 차이점이 명확하고 잘못 허용되지 않음 |
| 텐공방전 EASY | `tileId` 기반 선언 | 초심자 이해 가능성, 입력 실수 방지 |
| 텐공방전 EASY | 입문자 가이드 이해 가능성 | 가이드 문구, 도움말, 진입장벽 완화 |
| 텐공방전 EASY | 일반 텐공방전과 UI 혼동 여부 | 룰셋 라벨, 액션 문구, 경고 노출 |
| 17보 | 핵심 플레이 루프 | 턴 진행, 액션 선택, 결과 반영 |
| 17보 | 정산 / 결과 표시 | 룰셋 특화 결과 표기, 재입장 영향 없음 |

### 6.3 Cross-Ruleset Verification

| ID | Check Item | Failure Class |
|----|------------|---------------|
| X01 | 타이머 / 타임뱅크 동작 | blocker 또는 major |
| X02 | fog-of-war 마스킹 | blocker |
| X03 | `queryId` 응답 매칭 | blocker |
| X04 | 봇 포함 시작 흐름 | major 이상 |
| X05 | 리플레이와 실제 로그 일치 | blocker 또는 major |

## 7. Severity Rubric

| Severity | Definition | Examples | Gate Rule |
|----------|------------|----------|-----------|
| blocker | 플레이 시작, 진행, 종료, 재접속이 불가하거나 잘못된 state sync, 마스킹 오류, 치명적 UX 혼란이 있는 상태 | 매치 시작 불가, 재접속 실패, 다른 요청 응답 소비, 숨김 정보 노출 | 릴리즈 불가, 즉시 triage |
| major | 우회는 가능하지만 릴리즈 품질을 해치고 혼합 유저군의 이해를 크게 떨어뜨리는 문제 | 룰셋 혼동 유발 UI, 결과 표기 불일치, 반복 발생하는 리플레이 mismatch | owner + due date 필수 |
| minor | cosmetic 또는 비핵심 polish 문제 | spacing, copy tone, 약한 시각 정렬 문제 | backlog 이관 가능 |

### 7.1 Triage Defaults
- blocker는 당일 처리 우선순위 1순위로 고정한다.
- major는 릴리즈 전 해결 또는 명시적 예외 승인 둘 중 하나가 필요하다.
- minor는 게이트 판단과 분리해 후속 polish backlog로 이동할 수 있다.

## 8. Automation And Regression

### 8.1 Baseline Automation Commands

| Order | Command | Purpose |
|------|---------|---------|
| 1 | `pnpm --filter @step13/core exec vitest run` | 공통 로직 회귀 |
| 2 | `pnpm test:e2e` | 주요 사용자 흐름 회귀 |
| 3 | `pnpm sim:ai` | AI 시뮬레이션 기반 흐름 점검 |
| 4 | `pnpm test:auth-ws:smoke` | 인증 및 WS smoke 검증 |

### 8.2 Rerun Rules
- `apps/web` 변경 시 `pnpm --filter web build`와 `pnpm --filter @step13/core exec vitest run`을 재실행한다.
- `apps/server` 변경 시 `pnpm --filter server build`와 `pnpm test:e2e`를 재실행한다.
- 공통 UI 또는 소켓 레이어 변경 시 3개 룰셋 공통 시나리오를 전부 재실행한다.
- 자동화 실패 시 같은 baseline에서 1회 재시도 후 flaky 여부를 분리 기록한다.

## 9. Evidence And Sign-off

### 9.1 Evidence Package
- 실행 커맨드와 pass/fail 결과
- 주요 시나리오별 캡처 또는 로그 링크
- blocker / major / minor 이슈 목록
- baseline commit 또는 baseline issue list
- 룰셋별 Must 시나리오 체크 결과

### 9.2 Sign-off Sheet

| Area | Owner | Status | Evidence Link / Note | Signed At |
|------|-------|--------|----------------------|-----------|
| Common UX | Product UX Lead | Pending | TBD | TBD |
| Gameplay Rules | Gameplay QA Lead | Pending | TBD | TBD |
| Realtime / Platform | Realtime/Platform Lead | Pending | TBD | TBD |
| Automation | Automation Lead | Pending | TBD | TBD |
| Final Gate | Release Captain / CTO Lead | Pending | TBD | TBD |

## 10. Success Criteria

- [ ] Common / ruleset-specific Must 시나리오가 모두 green이다.
- [ ] blocker 이슈가 0건이다.
- [ ] major 이슈는 모두 owner와 due date가 있다.
- [ ] 혼합 유저군 기준으로 핵심 흐름 이해 가능성이 확보되었다.
- [ ] evidence package와 sign-off sheet가 최신 상태다.

## 11. Risks And Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 공통 UX 표면이 넓어 회귀가 분산됨 | High | High | 공통 경로 우선 검증, 영향 범위별 rerun 규칙 강제 |
| WS / 타이머 / 마스킹 문제가 수동 QA에서 누락됨 | High | Medium | Realtime owner 고정, smoke + 수기 교차 검증 |
| dirty worktree로 baseline이 흐려짐 | Medium | High | QA 시작 전 baseline commit 또는 issue list 고정 |
| 룰셋 간 UI 문구 혼동 | Medium | Medium | Product UX lead가 룰셋 라벨/가이드 일괄 검증 |

## 12. Deliverables

- release gate roster
- cross-ruleset scenario matrix
- severity rubric
- evidence + sign-off sheet
- post-gate polish backlog

## 13. Post-Gate Polish Backlog Defaults

| Bucket | Definition | Example |
|--------|------------|---------|
| Copy clarity | 문구 정리, 룰셋 차이 설명 보강 | EASY 안내문, 버튼 라벨 |
| Visual polish | spacing, hierarchy, mobile readability | 로비 카드 정렬, 리플레이 패널 가독성 |
| Feedback refinement | 상태 전환 피드백 개선 | reconnect toast, loading state wording |
| Low-risk ergonomics | 학습 비용을 낮추는 소규모 개선 | tileId 도움말, empty state 보강 |

## 14. Schedule

| Phase | Target Date | Status |
|-------|-------------|--------|
| Plan | 2026-03-22 | In Progress |
| Design | 2026-03-23 | Pending |
| Gate Preparation | 2026-03-24 | Pending |
| Gate Execution | 2026-03-24 to 2026-03-31 | Pending |
| Final Sign-off | 2026-03-31 to 2026-04-04 | Pending |

## 15. References

- `docs/prd.yaml`
- `docs/system-flow.md`
- `docs/system-architecture.md`
- `docs/CODE_DOCS_GAP_ANALYSIS.md`
