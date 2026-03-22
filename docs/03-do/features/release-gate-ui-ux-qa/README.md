# release-gate-ui-ux-qa - Do Artifact Package

> Purpose: design 문서를 실제 gate 운영에 바로 쓸 수 있는 do 단계 문서 패키지로 정리한다.
> Source of truth: `docs/02-design/features/release-gate-ui-ux-qa.design.md`

## 1. Package Scope

이 패키지는 구현 변경 없이 release gate 운영 준비를 완료하기 위한 문서 산출물만 포함한다.

- baseline lock 직전까지 필요한 운영 문서
- evidence / issue / waiver / sign-off 템플릿
- scenario control 기준
- triage governance 기준
- 최종 sign-off 직전 운영 순서

이 패키지는 다음을 포함하지 않는다.

- 구현 코드 변경
- 공개 API 또는 타입 계약 변경
- 런타임 기능 제안
- 새 테스트 프레임워크 도입

## 2. Artifact Map

| File | Purpose | Primary Owner |
|------|---------|---------------|
| `release-ops-runbook.md` | baseline lock, rerun, final sign-off 운영 순서 | Release Ops Agent 초안 + CTO Lead 통합 |
| `evidence-package-template.md` | evidence package, scenario run, issue/waiver/sign-off 템플릿 | Evidence Agent 초안 + CTO Lead 통합 |
| `scenario-control-matrix.md` | scenario ID, owner, severity, evidence, rerun 연결 정합성 기준 | Scenario Control Agent 초안 + CTO Lead 통합 |
| `triage-governance.md` | severity exception, accepted-risk, escalation, SLA, 의사결정 경계 | Triage Governance Agent 초안 + CTO Lead 통합 |

## 3. Operator Start Order

1. `release-ops-runbook.md`에서 baseline lock 준비 순서를 확인한다.
2. `scenario-control-matrix.md`로 scenario owner, severity, evidence 정합성을 먼저 확인한다.
3. `evidence-package-template.md`를 복붙해 gate 실행용 evidence package를 만든다.
4. fail이 발생하면 `triage-governance.md` 기준으로 severity와 escalation을 결정한다.
5. area sign-off가 모두 정리되면 `release-ops-runbook.md`의 final sign-off 순서를 따른다.

## 4. Exit Condition

이 패키지는 아래 상태를 목표로 한다.

- gate 운영자가 별도 해석 없이 baseline lock을 시작할 수 있다.
- scenario 실행, rerun, issue linkage, sign-off를 한 패키지로 기록할 수 있다.
- `do` 단계 종료 후 `check` 단계에서 gap analysis와 실행 검증으로 넘어갈 수 있다.
