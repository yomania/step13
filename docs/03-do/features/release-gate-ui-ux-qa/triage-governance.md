# release-gate-ui-ux-qa - Triage Governance

> Purpose: 운영 중 발생한 fail을 동일한 기준으로 분류하고, accepted-risk와 escalation을 설계 문서 범위 안에서 일관되게 처리하기 위한 실행 규칙이다.
> Source of truth: `docs/02-design/features/release-gate-ui-ux-qa.design.md`

## 1. Governance Scope

이 문서는 다음을 다룬다.

- severity exception rule
- accepted-risk 처리 기준
- escalation trigger와 SLA 경계
- owner, release-captain, CTO의 의사결정 경계

이 문서는 다음을 하지 않는다.

- 공개 API, 타입 계약, 런타임 동작 변경 제안
- 신규 테스트 프레임워크 도입
- dirty worktree 정리 또는 기존 변경 되돌리기

## 2. Severity Exception Rules

### 2.1 Default Rule

각 fail은 먼저 해당 scenario row의 `Default Severity On Fail`을 따른다. 기본 분류를 변경하려면 아래 예외 규칙 중 하나 이상에 명확히 부합해야 한다.

### 2.2 Upgrade Rules

- `blocker`는 시작, 진행, 종료, 재접속, 상태 동기화, 정보 은닉, 결과 신뢰성에 영향을 주는 경우 유지한다.
- `major`가 재현율 3회 중 2회 이상이고 매치 진행 또는 검증 흐름을 실제로 막으면 `blocker`로 상향한다.
- 단일 ruleset에만 보이는 문제라도 `login`, `room`, `rejoin`, `replay`, `queryId`, masking, sync에 영향을 주면 최소 `major`로 상향한다.
- `queryId` 응답 매칭 실패, 잘못된 마스킹, 다른 플레이어 응답 오소비, 결과 정산 오류는 재현율과 무관하게 `blocker`다.
- 텐공방전 EASY에서 잘못된 룰 노출이 초심자에게 금지 액션을 허용하면 `blocker`로 상향한다.

### 2.3 Downgrade Rules

- 단순 spacing, copy tone, 경미한 visual alignment, 비핵심 안내문 표현 차이는 `minor`로 유지할 수 있다.
- 제품 결함이 아니라 일시적 환경 문제로 확인되면 severity를 낮추지 말고 environment incident로 분리한다.
- 증거가 부족하면 `minor`로 임의 하향하지 말고 `pending triage`로 보류한다.

### 2.4 Non-Negotiable Rules

- `blocker`는 근거 없이 `major`로 낮추지 않는다.
- `accepted-risk`는 `major`에만 적용한다.
- owner, due date, evidence가 없으면 severity 예외를 승인하지 않는다.

## 3. Accepted-Risk Handling

`major`를 accepted-risk로 전환하려면 아래 조건을 모두 만족해야 한다.

- 재현 조건과 사용자 영향 범위가 명확하다.
- 출시 차단 사유가 아니라는 근거가 evidence에 남아 있다.
- owner, due date, 후속 backlog 또는 tracker ref가 있다.
- Release Captain과 해당 영역 owner가 공동 승인한다.

Accepted-risk는 sign-off sheet와 issue register 둘 다에 기록한다. 기록 항목은 다음과 같다.

- issueId
- impactedScenarioIds
- owner
- dueDate
- rationale
- follow-up ref
- approvedBy
- approvedAt

Accepted-risk는 다음과 같이 다룬다.

- blocker를 감싸는 용도로 사용하지 않는다.
- rerun 대상이면 rerun evidence를 추가한 뒤 승인한다.
- final sign-off 24시간 전까지 미해결이면 design의 mandatory escalation trigger로 처리한다.

## 4. Escalation Triggers

### 4.1 Mandatory Triggers

다음은 즉시 escalation 대상이다.

- `blocker` 또는 `blocker` 의심 fail
- `queryId`, sync, replay mismatch, masking 관련 fail
- 동일 원인으로 2개 이상 ruleset scenario가 동시에 fail 한 경우
- area owner 간 severity 의견이 갈리는 경우
- rerun 후에도 같은 현상이 재발한 경우
- final sign-off 24시간 전까지 미해결인 `major`

### 4.2 Escalation Levels and SLA

| Level | Trigger | Action Owner | SLA |
|------|---------|--------------|-----|
| owner | 단일 area 안에서 분류 가능한 fail | 해당 area owner | 30분 이내 |
| release-captain | blocker 의심, cross-ruleset 영향, severity 분쟁, due date 없는 major | Release Captain | 15분 이내 |
| cto | go/no-go 직접 영향, accepted-risk 승인 필요, blocker 장기 미해결 | CTO Lead | 당일 즉시 |

### 4.3 Escalation Boundary

- owner는 사실 확인, 재현, issue 등록, rerun scope 제안을 담당한다.
- release-captain은 severity 최종 확정, 우선순위 조정, cross-ruleset 충돌 해소를 담당한다.
- CTO는 출시 판단, 장기 미해결 blocker, accepted-risk 최종 승인만 담당한다.

## 5. Decision Lines

### 5.1 Owner

owner는 다음까지 책임진다.

- scenario fail 기록
- issue 생성
- impacted scenario 연결
- 기본 severity 적용
- rerun scope 초안 작성
- evidence 링크 확보

owner는 다음을 하지 않는다.

- blocker를 임의로 major로 낮추는 결정
- accepted-risk 최종 승인
- final go/no-go 결정

### 5.2 Release Captain

Release Captain은 다음을 책임진다.

- severity 분쟁 해소
- blocker 최종 승인
- due date 없는 major의 처리 방향 확정
- accepted-risk 공동 승인 여부 확인
- final sign-off 직전 residual risk 정리

Release Captain은 다음을 CTO로 올린다.

- go/no-go에 직접 영향을 주는 이슈
- accepted-risk 승인 필요 건
- blocker가 재발하거나 장기 미해결인 건

### 5.3 CTO Lead

CTO Lead는 다음만 최종 결정한다.

- 출시 가능 여부
- blocker 장기 미해결 시의 예외 처리
- accepted-risk 최종 승인
- release-captain 간 충돌 해소가 불가능한 경우의 최종 판단

## 6. Triage Workflow Reference

이 섹션은 design의 triage workflow를 운영 문서 관점에서 다시 적은 것이다. 추가 정책을 도입하지 않는다.

1. fail 시 scenario record를 즉시 `fail`로 기록한다.
2. 15분 이내 issue를 생성하고 impacted scenario IDs를 연결한다.
3. severity를 기본 규칙으로 분류한다.
4. escalation trigger 해당 여부를 확인한다.
5. escalation 대상이면 Release Captain에게 즉시 전달한다.
6. 수정 또는 우회 결정 후 rerun scope를 확정한다.
7. rerun 결과를 기존 issue와 scenario record에 연결한다.

## 7. Operating Notes

- blocker는 당일 처리 우선순위 1순위로 둔다.
- major는 release 전에 해결하거나 accepted-risk 승인이 필요하다.
- minor는 gate 판단과 분리해 후속 backlog로 옮길 수 있다.
- final sign-off 24시간 전까지 unresolved major가 남아 있으면 escalation 여부를 즉시 확인한다.

## 8. Ambiguity Note

다음 항목은 설계 문서상 원칙은 있으나 운영 시 세부 표현이 남아 있다.

- `pending triage`의 임시 상태를 issue tracker에서 별도 status로 둘지, note 필드로만 둘지
- accepted-risk 승인 서명을 한 번의 공동 승인으로 충분히 볼지, evidence package에 별도 sign-off 로그를 남길지
