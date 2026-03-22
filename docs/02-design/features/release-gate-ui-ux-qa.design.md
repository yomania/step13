# release-gate-ui-ux-qa - Design Document

> Version: 1.0.0 | Date: 2026-03-22 | Status: Final Draft
> Level: Starter | Plan: docs/01-plan/features/release-gate-ui-ux-qa.plan.md

---

## 1. Overview

이 문서는 `release-gate-ui-ux-qa`를 출시 직전 운영 게이트로 실제 집행하기 위한 기준서다. 범위는 구현 변경이 아니라 운영 설계, 검증 체계, 증빙 포맷, triage 규칙, sign-off 절차를 고정하는 것이다.

본 문서는 다음 질문에 즉시 답할 수 있어야 한다.

- 어떤 시나리오를 어떤 ID로 검증하는가
- 실패 시 어떤 severity로 분류하는가
- 누가 언제 escalation 하는가
- 어떤 evidence가 있어야 gate를 닫을 수 있는가
- 언제 baseline을 다시 잠그고 무엇을 rerun 해야 하는가
- 최종 sign-off를 어떤 순서로 승인하는가

## 2. Design Goals

- Release Gate Cell이 동일한 입력과 동일한 규칙으로 gate를 운영하도록 만든다.
- 공통 UX, 룰셋별 플레이, 실시간 안정성, 자동화 결과를 하나의 evidence chain으로 묶는다.
- severity 판단 편차를 줄이기 위해 기본 분류와 예외 규칙을 함께 고정한다.
- baseline lock, regression rerun, final sign-off를 체크리스트 기반으로 실행 가능하게 만든다.
- final sign-off 직전 누락 항목이 없도록 문서 포맷 자체에 검증용 필드를 포함한다.

## 3. Scope And Constraints

### 3.1 In Scope

- Release Gate Cell 운영 방식
- scenario ID 체계
- 시나리오별 owner / severity / evidence rule
- evidence package와 sign-off sheet 실사용 포맷
- severity exception rule과 triage escalation rule
- baseline lock, regression rerun, final sign-off checklist

### 3.2 Out Of Scope

- 공개 API 변경
- 타입 계약 변경
- 런타임 기능 변경 제안
- 신규 테스트 프레임워크 도입
- dirty worktree 정리 또는 기존 변경 되돌리기

## 4. Operating Model

### 4.1 Gate Ownership

| Area | Primary Owner | Backup | Responsibility |
|------|---------------|--------|----------------|
| Final Gate Control | Release Captain / CTO Lead | Product UX Lead | 전체 gate 상태, blocker 판정, 최종 go/no-go |
| Common UX | Product UX Lead | Release Captain | 로그인, 룰셋 선택, 로비, 룸, 리플레이, 가독성 |
| Gameplay Verification | Gameplay QA Lead | Release Captain | 17보, 텐공방전, EASY 핵심 흐름 |
| Realtime / Platform | Realtime/Platform Lead | Automation Lead | 인증, ws-ticket, JOIN, 재접속, 타이머, `queryId`, sync |
| Automation Evidence | Automation Lead | Realtime/Platform Lead | baseline command, rerun execution, raw log 보관, summary 작성 |

### 4.2 Decision Authority

- `blocker` 판정은 Release Captain이 최종 승인한다.
- `major` accepted risk는 Release Captain과 해당 영역 owner가 공동 승인한다.
- `minor` backlog 이관은 각 영역 owner가 제안하고 Release Captain이 확인한다.
- Final Gate sign-off는 area owner 4개 사인 완료 후 Release Captain이 마지막으로 승인한다.

### 4.3 Gate Lifecycle

1. Baseline lock
2. Common UX sweep
3. Ruleset gameplay sweep
4. Impact-based regression rerun
5. Final sign-off

## 5. Scenario ID System

### 5.1 ID Naming Rule

모든 시나리오는 `prefix-area-seq` 형식을 사용한다.

- `prefix`: 범주
- `area`: 시나리오 묶음
- `seq`: 두 자리 순번

허용 prefix:

- `COM`: 공통 시나리오
- `JB`: 17보
- `TG`: 텐공방전
- `TE`: 텐공방전 EASY
- `XRV`: cross-ruleset verification

예시:

- `COM-AUTH-01`
- `JB-CORE-02`
- `TG-STAGEB-03`
- `TE-GUIDE-02`
- `XRV-SYNC-01`

### 5.2 ID Assignment Principles

- 같은 사용자 목적을 검증하는 시나리오는 같은 `area`를 공유한다.
- 룰셋별로 별도 동작이 있는 경우 ID prefix를 분리한다.
- evidence는 반드시 scenario ID 단위로 연결한다.
- rerun도 scenario ID 단위로 기록한다.
- 같은 실패가 여러 시나리오에서 반복되면 issue는 하나로 묶되 impacted scenario 목록을 별도 기록한다.

## 6. Scenario Matrix

### 6.1 Common Must Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence |
|-------------|----------|-------|--------------------------|-------------------|
| COM-AUTH-01 | 회원가입 성공 및 초기 진입 | Product UX + Realtime | blocker | 화면 캡처, auth/ws smoke 로그 |
| COM-AUTH-02 | 로그인 성공 및 세션 복원 | Product UX + Realtime | blocker | 화면 캡처, 세션 재사용 확인 로그 |
| COM-LOBBY-01 | 룰셋 선택 화면 진입 및 라벨 구분 | Product UX | major | 화면 캡처, 수기 체크 |
| COM-ROOM-01 | 룸 목록 조회 및 상태 반영 | Product UX + Realtime | major | 화면 캡처, 서버 로그 또는 e2e 기록 |
| COM-ROOM-02 | 룸 생성 후 참가 가능 상태 확인 | Product UX + Realtime | blocker | 화면 캡처, 생성/참가 기록 |
| COM-MATCH-01 | 매치 시작 및 초기 턴 진입 | Gameplay QA + Realtime | blocker | 게임 로그, 시작 화면 캡처 |
| COM-MATCH-02 | 포기 / 나가기 후 종료 결과 반영 | Gameplay QA | major | 종료 캡처, 결과 로그 |
| COM-REJOIN-01 | 재접속 / 재입장 후 상태 복원 | Realtime/Platform | blocker | 서버 로그, 화면 캡처 |
| COM-REPLAY-01 | 리플레이 진입 및 기본 재생 가능 | Product UX + Realtime | major | 리플레이 캡처, 로그 링크 |
| COM-RESP-01 | 모바일/데스크톱 핵심 가독성 유지 | Product UX | major | 디바이스별 캡처 |

### 6.2 17보 Must Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence |
|-------------|----------|-------|--------------------------|-------------------|
| JB-CORE-01 | 17보 룰셋 진입 후 핵심 플레이 루프 시작 | Gameplay QA | blocker | 턴 시작 캡처, 플레이 로그 |
| JB-CORE-02 | 턴 진행 중 액션 선택과 상태 반영 | Gameplay QA | blocker | 액션 전후 로그, 화면 캡처 |
| JB-CORE-03 | 진행 중 결과/상태 표시 일관성 | Gameplay QA + Product UX | major | 상태 패널 캡처 |
| JB-RESULT-01 | 정산 / 결과 화면 표시 정확성 | Gameplay QA | blocker | 결과 화면 캡처, 정산 로그 |
| JB-RESULT-02 | 종료 후 재입장/리플레이 경로 무결성 | Gameplay QA + Realtime | major | 종료 후 이동 캡처, 로그 |

### 6.3 텐공방전 Must Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence |
|-------------|----------|-------|--------------------------|-------------------|
| TG-STAGEA-01 | Stage A 선언 진입과 액션 노출 정확성 | Gameplay QA + Product UX | blocker | 선언 UI 캡처 |
| TG-STAGEA-02 | Stage A 선언 결과가 다음 상태로 정확히 전이 | Gameplay QA + Realtime | blocker | 상태 전이 로그 |
| TG-STAGEB-01 | Stage B 추측 입력 유효성 검증 | Gameplay QA | blocker | 입력 시도 캡처, 검증 로그 |
| TG-STAGEB-02 | Stage B 정보 노출 정책 준수 | Gameplay QA + Realtime | blocker | 마스킹 비교 캡처 |
| TG-STAGEB-03 | Stage B 공격 후 턴 진행 및 결과 sync | Gameplay QA + Realtime | blocker | 전후 상태 로그 |
| TG-RIICHI-01 | 리치 허용 조건 충족 시 액션 노출 | Gameplay QA + Product UX | major | 리치 가능 상태 캡처 |
| TG-RIICHI-02 | 리치 결과가 판정/표기에 반영 | Gameplay QA | major | 결과 캡처, 로그 |
| TG-RESULT-01 | 정산 / 결과 표시 일관성 | Gameplay QA | blocker | 결과 화면, 정산 로그 |

### 6.4 텐공방전 EASY Must Scenarios

| Scenario ID | Scenario | Owner | Default Severity On Fail | Required Evidence |
|-------------|----------|-------|--------------------------|-------------------|
| TE-ENTRY-01 | EASY 룰셋 진입과 일반 룰셋 대비 차이 인지 가능 | Product UX | major | 진입 화면 캡처 |
| TE-RIICHI-01 | EASY에서 리치 비허용 상태 유지 | Gameplay QA | blocker | 액션 영역 캡처 |
| TE-TILEID-01 | `tileId` 기반 선언 UI 노출 및 선택 가능 | Gameplay QA + Product UX | major | 선언 화면 캡처 |
| TE-TILEID-02 | `tileId` 선택 실수 방지 affordance 동작 | Product UX | major | 오류 방지/가이드 캡처 |
| TE-GUIDE-01 | 입문자 가이드 문구가 핵심 흐름 이해를 돕는지 확인 | Product UX | major | 가이드 캡처, 수기 메모 |
| TE-GUIDE-02 | 일반 텐공방전과 혼동되지 않는 라벨/카피 유지 | Product UX | major | EASY vs 일반 비교 캡처 |
| TE-RESULT-01 | 종료 / 결과 화면이 EASY 규칙 기대와 일치 | Gameplay QA | major | 결과 캡처 |

### 6.5 Cross-Ruleset Verification

| Scenario ID | Check Item | Owner | Default Severity On Fail | Required Evidence |
|-------------|------------|-------|--------------------------|-------------------|
| XRV-TIMER-01 | 타이머 / 타임뱅크 동작 일관성 | Realtime/Platform | blocker | 타이머 로그, 화면 캡처 |
| XRV-MASK-01 | fog-of-war 마스킹 정책 준수 | Gameplay QA + Realtime | blocker | 플레이어별 비교 캡처 |
| XRV-SYNC-01 | `queryId` 응답 매칭 무결성 | Realtime/Platform | blocker | 서버 로그, 클라이언트 로그 |
| XRV-BOT-01 | 봇 포함 시작 흐름 안정성 | Gameplay QA + Realtime | major | 시작 로그, 화면 캡처 |
| XRV-REPLAY-01 | 리플레이와 실제 로그 일치 | Realtime/Platform | blocker | replay 캡처, raw log 비교 |

## 7. Verification Record Model

### 7.1 Scenario Record

| Field | Type | Rule |
|-------|------|------|
| scenarioId | string | 본 문서에 정의된 ID만 사용 |
| ruleset | enum | `common`, `17bo`, `tengong`, `tengong-easy`, `cross` |
| owner | string | 실행 owner 또는 sign-off owner |
| runType | enum | `baseline`, `rerun`, `waiver-review` |
| status | enum | `pending`, `running`, `pass`, `fail`, `waived`, `blocked` |
| severityOnFail | enum | 기본 severity 또는 예외 재분류 severity |
| issueIds | string | 연결된 tracker ID 목록 |
| evidenceRef | string | 문서 경로, 로그 링크, 캡처 링크 |
| executedAt | datetime | 실행 시각 |
| executedBy | string | 수행자 |
| notes | string | 관찰 메모, 예외 근거 |

### 7.2 Issue Record

| Field | Type | Rule |
|-------|------|------|
| issueId | string | tracker ID |
| title | string | 짧고 재현 가능한 요약 |
| severity | enum | `blocker`, `major`, `minor` |
| affectedSurface | enum | `common-ui`, `ruleset-ui`, `server`, `socket`, `replay`, `automation` |
| impactedScenarioIds | string[] | 영향 scenario ID 목록 |
| owner | string | 해결 owner |
| dueDate | string | `major`, `blocker` 필수 |
| status | enum | `open`, `in-progress`, `resolved`, `accepted-risk`, `waived` |
| rerunRequired | boolean | 수정 후 rerun 필요 여부 |
| escalationLevel | enum | `none`, `owner`, `release-captain`, `cto` |
| exceptionRationale | string | 예외 승인 시 근거 |

### 7.3 Sign-off Record

| Field | Type | Rule |
|-------|------|------|
| area | string | `Common UX`, `Gameplay`, `Realtime`, `Automation`, `Final Gate` |
| owner | string | 승인 책임자 |
| status | enum | `pending`, `signed`, `blocked` |
| evidenceRef | string | evidence package 링크 |
| blockerCount | number | area 기준 미해결 blocker |
| majorOpenCount | number | area 기준 미해결 major |
| signedAt | datetime | 승인 시각 |
| note | string | 조건부 승인 근거 또는 차단 사유 |

## 8. Severity Rule

### 8.1 Default Rubric

| Severity | Definition | Gate Rule |
|----------|------------|-----------|
| blocker | 시작, 진행, 종료, 재접속, 상태 동기화, 정보 은닉, 결과 신뢰성에 치명적 결함이 있는 상태 | 즉시 triage, 미해결 시 `No-Go` |
| major | 우회는 가능하지만 출시 품질, 사용성, 규칙 이해, 결과 해석을 의미 있게 훼손하는 상태 | owner + due date + 처리 방침 없으면 sign-off 불가 |
| minor | cosmetic, 문구 polish, 낮은 빈도의 비핵심 불편 | backlog 이관 가능 |

### 8.2 Severity Exception Rule

기본 severity는 시나리오 표의 `Default Severity On Fail`을 따른다. 다만 아래 규칙에 따라 상향 또는 하향 재분류할 수 있다.

상향 규칙:

- `major` 이슈가 재현율 3회 중 2회 이상이고 매치 진행을 중단시키면 `blocker`로 상향한다.
- 단일 룰셋 이슈라도 공통 표면 로그인, 룸, 재접속, 리플레이, sync에 영향을 주면 최소 `major`로 상향한다.
- 정보 노출, 잘못된 마스킹, 다른 플레이어 응답 오소비, 잘못된 결과 정산은 재현율과 무관하게 `blocker`다.
- EASY에서 잘못된 룰 노출이 초심자에게 금지 액션을 허용하면 `blocker`로 상향한다.

하향 규칙:

- 화면 정렬, copy tone, 비핵심 강조 차이처럼 기능과 의사결정에 영향이 없으면 `minor`로 유지한다.
- 일시적 네트워크/로컬 환경 문제로 확인되었고 product 결함이 아니면 제품 severity가 아니라 environment incident로 분리한다.
- evidence 부족으로 미판정 상태면 하향하지 않고 `pending triage`로 유지한다.

예외 금지 규칙:

- `blocker`를 근거 없이 `major`로 낮출 수 없다.
- `accepted-risk`는 `major`까지 허용되며 `blocker`에는 적용할 수 없다.
- owner 부재, due date 부재, evidence 부재는 severity 예외 승인 조건이 될 수 없다.

### 8.3 Accepted-Risk Rule

`major`를 `accepted-risk`로 처리하려면 아래를 모두 만족해야 한다.

- 재현 조건과 사용자 영향 범위가 명확하다.
- 출시 차단 사유가 아니라는 근거가 evidence에 남아 있다.
- owner, due date, 후속 backlog/tracker가 있다.
- Release Captain과 영역 owner가 공동 승인했다.

## 9. Triage Escalation Rule

### 9.1 Escalation Levels

| Level | Trigger | Action | SLA |
|-------|---------|--------|-----|
| owner | 단일 area 내 처리 가능한 fail | 해당 owner가 분류, issue 등록, rerun 계획 작성 | 30분 이내 |
| release-captain | blocker 의심, cross-ruleset 영향, severity 분쟁, due date 없는 major | Release Captain이 severity와 우선순위 확정 | 15분 이내 |
| cto | go/no-go 직접 영향, accepted-risk 승인 필요, blocker 장기 미해결 | CTO Lead가 최종 결정 | 당일 즉시 |

### 9.2 Mandatory Escalation Triggers

- `blocker`로 분류되었거나 의심되는 모든 건
- `queryId`, sync, replay mismatch, masking 관련 모든 건
- 동일 원인으로 2개 이상 ruleset scenario가 fail 한 건
- area owner 간 severity 의견이 갈리는 건
- rerun 후에도 같은 현상이 재발한 건
- final sign-off 24시간 전까지 미해결인 `major`

### 9.3 Triage Workflow

1. fail 시 scenario record를 즉시 `fail`로 기록한다.
2. 15분 이내 issue를 생성하고 impacted scenario IDs를 연결한다.
3. severity를 기본 규칙으로 분류한다.
4. escalation trigger 해당 여부를 확인한다.
5. escalation 대상이면 Release Captain에게 즉시 전달한다.
6. 수정 또는 우회 결정 후 rerun scope를 확정한다.
7. rerun 결과를 기존 issue와 scenario record에 연결한다.

## 10. Automation Baseline And Regression Design

### 10.1 Baseline Command Set

| Order | Command | Purpose | Evidence Requirement |
|------|---------|---------|----------------------|
| 1 | `pnpm --filter @step13/core exec vitest run` | 공통 로직 회귀 | raw log + pass/fail summary |
| 2 | `pnpm test:e2e` | 주요 사용자 흐름 회귀 | raw log + 실패 케이스 목록 |
| 3 | `pnpm run sim:ai` | AI 시뮬레이션 기반 흐름 점검 | raw log + 이상 징후 요약 |
| 4 | `pnpm test:auth-ws:smoke` | 인증 및 WS smoke 검증 | raw log + auth/ws result summary |

### 10.2 Baseline Lock Checklist

Baseline lock은 gate의 시작 조건이다. 아래 항목이 모두 채워지기 전에는 scenario 실행을 시작하지 않는다.

| Check | Required | Owner | Completion Rule |
|-------|----------|-------|-----------------|
| dirty worktree snapshot 기록 | Yes | Release Captain | 현재 변경 파일 목록이 evidence에 남아 있음 |
| baseline commit 또는 baseline issue list 확정 | Yes | Release Captain | 둘 중 하나가 sign-off sheet에 기록됨 |
| 실행 환경 기록 | Yes | Automation Lead | 브랜치, 실행 시각, 주요 env note 기록 |
| baseline command set 실행 | Yes | Automation Lead | 4개 명령의 결과가 evidence에 연결됨 |
| known issue seed 등록 | Yes | 각 area owner | baseline 시점 미해결 known issue가 분리 기록됨 |
| scenario owner 배정 확인 | Yes | Release Captain | 모든 must scenario owner 비어있지 않음 |

### 10.3 Regression Rerun Matrix

| Change / Event | Required Rerun |
|----------------|----------------|
| `apps/web` 수정 | `pnpm --filter web build` + `pnpm --filter @step13/core exec vitest run` + 영향받은 `COM-*`/ruleset 시나리오 |
| `apps/server` 수정 | `pnpm --filter server build` + `pnpm test:e2e` + 영향받은 `COM-*`/ruleset 시나리오 |
| 공통 UI 수정 | 모든 `COM-*` + `TE-GUIDE-*` + `TE-ENTRY-01` rerun |
| socket / sync 수정 | `COM-ROOM-*`, `COM-REJOIN-01`, `XRV-SYNC-01`, `XRV-TIMER-01`, `XRV-REPLAY-01` rerun |
| replay 수정 | `COM-REPLAY-01`, `JB-RESULT-02`, `XRV-REPLAY-01` rerun |
| masking / hidden info 수정 | `TG-STAGEB-02`, `XRV-MASK-01` rerun |
| ruleset-specific gameplay 수정 | 해당 ruleset 시나리오 전체 rerun |
| automation false negative / flaky 의심 | 동일 baseline에서 1회 재실행 후 flaky 여부 분리 기록 |

### 10.4 Regression Rerun Execution Rule

- rerun은 반드시 issue 또는 change set에 연결된 이유를 기록한다.
- rerun 전 기존 evidence를 덮어쓰지 않고 `runType=rerun`으로 추가한다.
- 같은 이슈 수정으로 공통 시나리오와 룰셋 시나리오가 모두 영향받으면 공통 시나리오를 먼저 rerun 한다.
- rerun pass 후에도 linked issue 상태를 자동으로 닫지 말고 owner가 evidence 확인 후 `resolved`로 변경한다.

## 11. Evidence Package Design

### 11.1 Evidence Minimum Set

최종 sign-off를 위해 아래 evidence가 모두 있어야 한다.

- baseline snapshot
- baseline command 결과
- scenario execution 결과
- fail issue list
- waiver / accepted-risk 목록
- rerun 기록
- sign-off sheet

### 11.2 Evidence Storage Rule

- evidence는 scenario ID 또는 issue ID 기준으로 검색 가능해야 한다.
- 자동화 결과는 `raw log`와 `human summary` 둘 다 남긴다.
- 화면 캡처는 최소한 시나리오 진입 전후 상태를 포함한다.
- replay mismatch는 replay 화면과 raw log 비교 evidence를 함께 남긴다.
- accepted-risk는 rationale와 승인자를 동일 evidence package 안에 남긴다.

### 11.3 Evidence Sheet Template

아래 포맷을 그대로 사용한다.

```md
## Evidence Package Header

- Feature: release-gate-ui-ux-qa
- Gate Date:
- Baseline Ref:
- Branch / Working Tree Note:
- Release Captain:
- Automation Lead:

## Baseline Commands

| Command | Result | Log Ref | Summary |
|---------|--------|---------|---------|
| pnpm --filter @step13/core exec vitest run | PASS/FAIL |  |  |
| pnpm test:e2e | PASS/FAIL |  |  |
| pnpm run sim:ai | PASS/FAIL |  |  |
| pnpm test:auth-ws:smoke | PASS/FAIL |  |  |

## Scenario Runs

| Scenario ID | Run Type | Status | Severity On Fail | Evidence Ref | Issue IDs | Executed By | Executed At | Notes |
|-------------|----------|--------|------------------|--------------|-----------|-------------|-------------|-------|
| COM-AUTH-01 | baseline | PASS | blocker |  |  |  |  |  |
| TG-STAGEB-02 | baseline | FAIL | blocker |  | RG-101 |  |  | hidden info mismatch |

## Issue Register

| Issue ID | Severity | Impacted Scenario IDs | Owner | Due Date | Status | Escalation Level | Exception Rationale |
|----------|----------|-----------------------|-------|----------|--------|------------------|---------------------|
| RG-101 | blocker | TG-STAGEB-02,XRV-MASK-01 |  |  | open | release-captain |  |

## Accepted Risks / Waivers

| Issue ID | Type | Approved By | Approved At | Scope | Rationale | Follow-up Ref |
|----------|------|-------------|-------------|-------|-----------|---------------|

## Final Notes

- Cross-ruleset regression summary:
- Outstanding majors:
- Outstanding minors moved to backlog:
```

## 12. Sign-off Sheet Design

### 12.1 Sign-off Rule

- area sign-off는 각 영역 owner가 직접 기록한다.
- `pending` 또는 `blocked` 영역이 하나라도 있으면 Final Gate sign-off를 진행하지 않는다.
- Final Gate sign-off는 area 4개가 모두 `signed`일 때만 가능하다.
- Final Gate sign-off 시 blocker 0건, unresolved major 0건 또는 승인된 accepted-risk만 허용된다.

### 12.2 Sign-off Sheet Template

```md
## Sign-off Sheet

| Area | Owner | Status | Blocker Count | Open Major Count | Evidence Ref | Signed At | Note |
|------|-------|--------|---------------|------------------|--------------|-----------|------|
| Common UX |  | pending | 0 | 0 |  |  |  |
| Gameplay |  | pending | 0 | 0 |  |  |  |
| Realtime |  | pending | 0 | 0 |  |  |  |
| Automation |  | pending | 0 | 0 |  |  |  |
| Final Gate | Release Captain / CTO Lead | pending | 0 | 0 |  |  |  |
```

### 12.3 Sign-off Interpretation Rule

- `signed`: 해당 영역의 must scenario, evidence, issue 상태가 기준을 만족한다.
- `blocked`: blocker 존재, evidence 누락, rerun 미완료, owner 미배정 major가 있다.
- `pending`: 실행 또는 검토가 아직 완료되지 않았다.

## 13. Execution Checklists

### 13.1 Baseline Lock Checklist

```md
## Baseline Lock Checklist

- [ ] dirty worktree snapshot을 남겼다.
- [ ] baseline commit 또는 baseline issue list를 확정했다.
- [ ] baseline command 4종을 실행했다.
- [ ] baseline command raw log와 summary를 저장했다.
- [ ] known issue seed를 issue register에 기록했다.
- [ ] must scenario owner를 모두 배정했다.
- [ ] evidence package header를 작성했다.
- [ ] sign-off sheet를 `pending` 상태로 초기화했다.
```

### 13.2 Regression Rerun Checklist

```md
## Regression Rerun Checklist

- [ ] 수정 또는 이슈가 영향을 주는 surface를 분류했다.
- [ ] impacted scenario IDs를 issue에 연결했다.
- [ ] rerun 대상 automation command를 선택했다.
- [ ] rerun 대상 manual scenario를 선택했다.
- [ ] rerun을 `runType=rerun`으로 기록했다.
- [ ] rerun evidence를 기존 evidence에 추가했다.
- [ ] 재현 여부와 severity 변동 여부를 triage에 반영했다.
- [ ] issue status를 `resolved`, `open`, `accepted-risk` 중 하나로 갱신했다.
```

### 13.3 Final Sign-off Checklist

```md
## Final Sign-off Checklist

- [ ] 모든 must scenario가 `pass` 또는 승인된 `waived` 상태다.
- [ ] unresolved blocker가 0건이다.
- [ ] unresolved major가 0건이거나 모두 accepted-risk 승인이 있다.
- [ ] 모든 accepted-risk에 owner, due date, rationale, follow-up ref가 있다.
- [ ] baseline 이후 수행된 rerun이 evidence에 모두 기록되었다.
- [ ] area sign-off 4개가 모두 `signed`다.
- [ ] evidence package header, scenario runs, issue register, waiver table이 최신 상태다.
- [ ] Final Gate sign-off를 Release Captain이 기록했다.
```

## 14. Exit Criteria

- common, ruleset-specific, cross-ruleset must scenario가 모두 기록되었다.
- blocker 0건이 확인되었다.
- major는 모두 해결되었거나 accepted-risk 규칙을 만족한다.
- evidence package가 누락 없이 채워졌다.
- sign-off sheet가 Final Gate까지 완료되었다.
- 이 문서만으로 gate 운영자가 추가 해석 없이 진행 가능하다.

## 15. Handoff To Do Phase

다음 PDCA 단계인 `do`에서는 구현 변경보다 운영 실행 준비를 진행한다. 즉, 이 design 문서의 체크리스트와 포맷을 기준으로 실제 gate 실행 artifact를 만들고 scenario/evidence/sign-off를 채워나가면 된다.

do 단계의 우선순위:

1. evidence package와 sign-off sheet의 실제 저장 위치 확정
2. scenario owner 배정 완료
3. baseline lock 수행
4. baseline automation 실행
5. manual scenario sweep 시작

## 16. References

- `docs/01-plan/features/release-gate-ui-ux-qa.plan.md`
- `docs/prd.yaml`
- `docs/system-flow.md`
- `docs/system-architecture.md`
- `docs/CODE_DOCS_GAP_ANALYSIS.md`
