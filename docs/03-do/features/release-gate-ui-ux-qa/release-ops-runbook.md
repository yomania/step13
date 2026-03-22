# release-gate-ui-ux-qa - Release Ops Runbook

> Purpose: baseline lock, regression rerun, final sign-off를 설계 기준대로 실제 운영 순서로 고정한다.
> Source of truth: `docs/02-design/features/release-gate-ui-ux-qa.design.md`

## 1. Operating Rules

- baseline 선언 전에는 manual scenario sweep을 시작하지 않는다.
- baseline evidence와 rerun evidence는 분리 보관한다.
- rerun은 반드시 issue ID 또는 change set과 연결한다.
- blocker가 남아 있으면 Final Gate sign-off를 진행하지 않는다.
- accepted-risk는 `major`에만 적용한다.
- design 문서의 scenario ID, severity, sign-off rule을 재해석하지 않는다.

## 2. Baseline Lock Execution Order

| Order | Step | Operator Action | Required Artifact | Exit Condition |
|------|------|-----------------|-------------------|----------------|
| 1 | Worktree snapshot | 현재 dirty worktree 상태를 기록한다. | worktree snapshot note | snapshot evidence가 남아 있다. |
| 2 | Baseline ref fix | baseline commit 또는 baseline issue list를 확정한다. | baseline ref line | 기준선이 하나로 고정됐다. |
| 3 | Scenario owner confirm | 모든 must scenario owner를 확인한다. | owner-assigned matrix | owner 공란이 없다. |
| 4 | Environment note | branch, 시각, 실행 환경 메모를 남긴다. | evidence header | baseline 환경이 재현 가능하다. |
| 5 | Evidence shell create | evidence package와 sign-off sheet를 초기화한다. | evidence package draft | baseline 기록 준비가 끝났다. |
| 6 | Known issue seed load | 기존 known issue를 gate fail과 분리해 등록한다. | issue register seed | baseline 이전 known issue가 분리됐다. |
| 7 | Baseline commands run | baseline command set 4종을 순서대로 실행한다. | raw logs + summary rows | command 결과가 모두 기록됐다. |
| 8 | Baseline result triage | baseline 실패를 severity 기준으로 분류한다. | issue register update | blocker/major/minor 초안이 정리됐다. |
| 9 | Baseline lock declare | scenario sweep 시작 가능 여부를 확인한다. | captain note | baseline lock 상태가 선언됐다. |

### 2.1 Baseline Command Order

| Order | Command | Purpose | Evidence Requirement |
|------|---------|---------|----------------------|
| 1 | `pnpm --filter @step13/core exec vitest run` | 공통 로직 회귀 | raw log + pass/fail summary |
| 2 | `pnpm test:e2e` | 주요 사용자 흐름 회귀 | raw log + 실패 케이스 요약 |
| 3 | `pnpm run sim:ai` | AI 시뮬레이션 기반 흐름 점검 | raw log + 이상 징후 요약 |
| 4 | `pnpm test:auth-ws:smoke` | 인증 및 WS smoke 검증 | raw log + auth/ws 결과 요약 |

### 2.2 Baseline Lock Checklist

- [ ] dirty worktree snapshot을 남겼다.
- [ ] baseline commit 또는 baseline issue list를 확정했다.
- [ ] must scenario owner를 모두 배정했다.
- [ ] evidence package header를 만들었다.
- [ ] sign-off sheet를 `pending`으로 초기화했다.
- [ ] known issue seed를 issue register에 기록했다.
- [ ] baseline command 4종을 모두 실행했다.
- [ ] baseline command raw log와 summary를 연결했다.
- [ ] Release Captain이 baseline lock 가능 상태를 확인했다.

## 3. Regression Rerun Decision Table

여러 조건이 동시에 해당되면 rerun scope는 합집합으로 적용한다.

| Trigger | Automation Rerun | Manual Scenario Rerun | Owner | Escalation Rule |
|--------|-------------------|-----------------------|-------|-----------------|
| `apps/web` 수정 | `pnpm --filter web build` + `pnpm --filter @step13/core exec vitest run` | 영향받은 `COM-*` + 관련 ruleset 시나리오 | Product UX Lead + Release Captain | 공통 UX 또는 replay 영향이면 즉시 Release Captain 공유 |
| `apps/server` 수정 | `pnpm --filter server build` + `pnpm test:e2e` | 영향받은 `COM-*` + 관련 ruleset 시나리오 | Realtime/Platform Lead + Release Captain | sync, join, rejoin 변화면 즉시 escalation |
| 공통 UI 수정 | 필요 시 `pnpm --filter web build` | 모든 `COM-*`, `TE-ENTRY-01`, `TE-GUIDE-*` | Product UX Lead | ruleset 혼동 가능성이 있으면 Release Captain escalation |
| socket / sync 수정 | `pnpm test:e2e` + `pnpm test:auth-ws:smoke` | `COM-ROOM-*`, `COM-REJOIN-01`, `XRV-SYNC-01`, `XRV-TIMER-01`, `XRV-REPLAY-01` | Realtime/Platform Lead | `queryId`, replay, sync 이슈는 즉시 escalation |
| replay 수정 | 필요 시 `pnpm test:e2e` | `COM-REPLAY-01`, `JB-RESULT-02`, `XRV-REPLAY-01` | Realtime/Platform Lead | replay/raw log mismatch면 즉시 escalation |
| masking / hidden info 수정 | 필요 시 관련 smoke/e2e | `TG-STAGEB-02`, `XRV-MASK-01` | Gameplay QA Lead + Realtime/Platform Lead | 정보 노출 의심 시 즉시 escalation |
| ruleset-specific gameplay 수정 | 영향 surface 기준 command 선택 | 해당 ruleset 시나리오 전체 | Gameplay QA Lead | 2개 이상 ruleset으로 번지면 Release Captain escalation |
| automation flaky 의심 | 동일 baseline에서 동일 command 1회 재실행 | 필요 시 직전 fail 시나리오 재실행 | Automation Lead | 같은 현상 재발 시 flaky가 아니라 escalation 대상 |
| unresolved `major` | 관련 surface 기준 command 선택 | issue와 연결된 scenario ID 재실행 | Area owner + Release Captain | due date/owner 불명확 시 escalation |
| suspected `blocker` | 원인 식별 전 범위 확정 금지 | 영향 scenario ID만 제한적으로 rerun | Release Captain | rerun 뒤에도 재현되면 CTO escalation |

### 3.1 Rerun Recording Rules

- rerun row는 반드시 `runType=rerun`으로 기록한다.
- rerun은 baseline evidence를 덮어쓰지 않는다.
- common과 ruleset scenario가 동시에 얽히면 common scenario를 먼저 rerun 한다.
- rerun pass 뒤에도 issue는 owner가 evidence 확인 후에만 `resolved`로 바꾼다.
- rerun 실패가 반복되면 새 이슈를 만들지 말고 기존 issue에 누적 기록한다.

## 4. Final Sign-off Operating Sequence

| Order | Step | Required Check | Exit Condition |
|------|------|----------------|----------------|
| 1 | Evidence consolidate | baseline, scenario, rerun, issue, waiver, sign-off row가 최신인지 확인한다. | evidence package가 현재 상태와 일치한다. |
| 2 | Blocker review | unresolved blocker가 0건인지 확인한다. | blocker 0건이 확인된다. |
| 3 | Major review | unresolved major 0건 또는 accepted-risk 승인 완료인지 확인한다. | major 처리 방침이 모두 기록된다. |
| 4 | Area sign-off review | Common UX, Gameplay, Realtime, Automation row가 모두 `signed`인지 확인한다. | area 4개가 모두 signed다. |
| 5 | Final Gate review | Release Captain이 잔여 리스크, backlog 이관, evidence completeness를 확인한다. | final decision 준비가 끝난다. |
| 6 | Final Gate sign | Release Captain / CTO Lead가 최종 결정을 기록한다. | final gate row가 갱신된다. |
| 7 | Archive handoff | package를 lock하고 후속 추적 ref를 남긴다. | gate package가 baseline lock 직후 운영 상태에서 sign-off 완료 상태로 종료된다. |

### 4.1 Final Sign-off Rules

- area 4개 중 하나라도 `pending` 또는 `blocked`면 Final Gate로 넘어가지 않는다.
- accepted-risk는 `major`만 허용된다.
- blocker는 waiver나 accepted-risk로 넘기지 않는다.
- final sign-off는 evidence completeness 확인 이후에만 한다.

## 5. Operator Step-by-Step

1. `README.md`로 패키지 구성을 확인한다.
2. `scenario-control-matrix.md`에서 must scenario coverage와 owner 공란 여부를 먼저 확인한다.
3. `evidence-package-template.md`를 복붙해 이번 gate의 evidence package를 만든다.
4. worktree snapshot과 baseline ref를 evidence package header에 기록한다.
5. baseline command 4종을 순서대로 실행하고 raw log / summary를 채운다.
6. baseline 실패 건을 issue register에 즉시 연결한다.
7. Common UX 시나리오를 먼저 실행한다.
8. 17보, 텐공방전, 텐공방전 EASY 시나리오를 ruleset별로 실행한다.
9. cross-ruleset verification 시나리오를 별도 묶음으로 실행한다.
10. fail이 나오면 `triage-governance.md` 기준으로 severity, escalation, rerun scope를 결정한다.
11. rerun 필요 시 rerun row를 추가하고 evidence를 append 한다.
12. unresolved blocker가 있으면 gate를 중지하고 escalation 한다.
13. area owner가 각 sign-off row를 갱신한다.
14. area 4개가 모두 `signed`인 경우에만 Final Gate sign-off를 진행한다.

## 6. Operator Close Checklist

- [ ] baseline ref가 고정됐다.
- [ ] baseline automation 결과가 기록됐다.
- [ ] must scenario 전부에 outcome row가 있다.
- [ ] fail row마다 issue ID가 연결됐다.
- [ ] rerun row마다 trigger와 impacted scenario가 연결됐다.
- [ ] unresolved blocker가 0건이다.
- [ ] unresolved major는 0건이거나 accepted-risk 승인 완료다.
- [ ] Common UX, Gameplay, Realtime, Automation sign-off가 완료됐다.
- [ ] Final Gate sign-off가 기록됐다.

## 7. Escalation Summary

- blocker 의심, severity 분쟁, cross-ruleset 영향은 Release Captain으로 즉시 올린다.
- accepted-risk 승인 필요, 장기 미해결 blocker, go/no-go 직접 영향은 CTO Lead로 올린다.
- replay, masking, `queryId`, sync 관련 문제는 지연 없이 escalation 한다.
