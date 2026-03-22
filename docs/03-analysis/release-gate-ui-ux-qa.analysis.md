# release-gate-ui-ux-qa - Check Gap Analysis

> Date: 2026-03-22
> Feature: `release-gate-ui-ux-qa`
> PDCA Phase: `check`
> Design Baseline: `docs/02-design/features/release-gate-ui-ux-qa.design.md`
> Do Package: `docs/03-do/features/release-gate-ui-ux-qa/`

## 1. Scope

이 문서는 `release-gate-ui-ux-qa` design과 do 산출물 패키지를 대조한 check 단계 결과다.

검토 범위:

- `README.md`
- `release-ops-runbook.md`
- `evidence-package-template.md`
- `scenario-control-matrix.md`
- `triage-governance.md`

제외 범위:

- 구현 코드
- 공개 API / 타입 계약
- 런타임 기능
- 기존 dirty worktree 정리

## 2. Executive Summary

- do 패키지의 기본 뼈대는 design을 전반적으로 충족한다.
- `release-ops-runbook.md`는 baseline lock, rerun, final sign-off 흐름을 design과 거의 동일하게 운영 가능 수준으로 정리했다.
- `scenario-control-matrix.md`는 시나리오 coverage 확인 용도로 충분하지만, 일부 문구가 design 해석 여지를 남겨 baseline lock 직전 operator를 혼란시킬 수 있었다.
- `evidence-package-template.md`는 실제 gate 기록용으로 유용하지만, design의 scenario record 최소 필드와 final notes가 빠져 있어 즉시 보완이 필요했다.
- `triage-governance.md`는 design 기반 규칙을 잘 옮겼지만, do 단계에서 새 triage packet 정책을 추가로 제안해 design 일탈이 발생해 있었다.

## 3. Match Rate

- Match Rate: `92%`
- 산정 기준: 이번 check에서 design의 핵심 운영 요구 12개를 기준으로 평가했고, 그중 11개는 do 산출물에서 충족됐으며 1개는 iterate 또는 운영 판단이 필요한 잔여 gap으로 남았다.
- 판정: `>= 90%`

평가 기준에 포함한 핵심 항목:

- gate ownership / decision authority 반영
- scenario ID / coverage 정합성
- baseline lock checklist
- regression rerun matrix
- triage escalation rule
- severity / accepted-risk rule
- evidence package minimum set
- scenario record 최소 필드
- sign-off sheet
- final sign-off rule
- operator runbook completeness
- baseline lock 직전 operator blocker 해소 여부

## 4. Category Summary

| Category | Count | Assessment |
|----------|-------|------------|
| `missing` | 2 | 기록 포맷 최소 필드와 final notes가 일부 누락되어 있었다. |
| `inconsistent` | 3 | design 해석을 바꾸거나 새 운영 규칙을 추가한 항목이 있었다. |
| `ambiguous` | 3 | operator가 baseline lock 직전 별도 판단을 해야 하는 open question이 남아 있다. |
| `ready-for-check` | 4 | 즉시 gate 운영에 사용 가능한 문서 묶음이 확인됐다. |

## 5. Detailed Findings

### 5.1 Missing

| ID | Artifact | Gap | Impact | Disposition |
|----|----------|-----|--------|-------------|
| M-01 | `evidence-package-template.md` | scenario run 템플릿에 design의 `owner` 필드가 없었다. | scenario record와 sign-off 책임 연결이 약해져 rerun / sign-off 추적이 끊길 수 있다. | 즉시 문서 수정 필요 |
| M-02 | `evidence-package-template.md` | design `11.3 Evidence Sheet Template`의 `Final Notes` 구간이 빠져 있었다. | cross-ruleset regression summary와 outstanding major/minor 정리가 빠져 final sign-off 직전 수기 보완이 필요해진다. | 즉시 문서 수정 필요 |

### 5.2 Inconsistent

| ID | Artifact | Gap | Impact | Disposition |
|----|----------|-----|--------|-------------|
| I-01 | `triage-governance.md` | design에 없는 `Single Triage Packet Rule`과 개선안이 normative rule처럼 추가돼 있었다. | check/do 산출물이 design source of truth를 넘어 새 운영 정책을 강제하게 된다. | 즉시 문서 수정 필요 |
| I-02 | `scenario-control-matrix.md` | `COM-RESP-01`을 hard gate인지 supporting quality check인지 다시 판단하게 만드는 문구가 있었다. | must scenario의 강도를 operator가 재해석하게 되어 baseline lock 직전 판단이 흔들릴 수 있다. | 즉시 문서 수정 필요 |
| I-03 | `evidence-package-template.md` | status 규칙이 `pending`, `running`을 제외해 design record model보다 좁게 정의돼 있었다. | baseline 준비 중 또는 진행 중 상태를 표준 값으로 남기기 어렵다. | 즉시 문서 수정 필요 |

### 5.3 Ambiguous

| ID | Artifact | Gap | Impact | Disposition |
|----|----------|-----|--------|-------------|
| A-01 | do package 전체 | evidence package 실제 저장 위치와 naming ref는 design에서 원칙만 있고 저장소 내 canonical path는 고정되지 않았다. | gate 실행 시 evidence 경로를 현장에서 다시 정해야 할 수 있다. | 운영 판단 필요 |
| A-02 | `evidence-package-template.md`, `triage-governance.md` | `waiver`의 허용 범위와 approval log 방식은 design에서 accepted-risk보다 덜 구체적이다. | non-blocking exception을 어떻게 기록할지 owner 간 표현 차이가 날 수 있다. | iterate 단계로 이관 |
| A-03 | do package 전체 | tracker ID namespace (`RG-*` 예시)의 조직 표준 여부가 design에 명시되지 않았다. | evidence, issue, rerun 문서 간 참조 prefix가 gate마다 달라질 수 있다. | 운영 판단 필요 |

### 5.4 Ready-for-Check

| ID | Artifact | Evidence |
|----|----------|----------|
| R-01 | `README.md` | 패키지 범위, artifact map, operator start order가 design 범위와 충돌 없이 정리돼 있다. |
| R-02 | `release-ops-runbook.md` | baseline lock, rerun matrix, final sign-off sequence가 design `10`, `12`, `13`, `14`와 실사용 수준으로 정합하다. |
| R-03 | `scenario-control-matrix.md` | must scenario coverage와 owner/severity/evidence 정합성 검사용으로 사용 가능하다. |
| R-04 | `triage-governance.md` | severity exception, accepted-risk, escalation level/SLA, decision line은 design `8`, `9`와 정합하다. |

## 6. Operator Blocker Check Before Baseline Lock

baseline lock 직전 operator가 실제로 막히는지를 기준으로 점검한 결과는 다음과 같다.

- baseline lock 순서 자체는 `release-ops-runbook.md`만으로 수행 가능하다.
- must scenario coverage 확인은 `scenario-control-matrix.md`로 가능하다.
- evidence package 생성도 템플릿만으로 가능하지만, 수정 전에는 `owner`와 `Final Notes`를 수기로 추가해야 해서 sign-off 직전 누락 위험이 있었다.
- triage는 `triage-governance.md` 기준으로 수행 가능했지만, 수정 전에는 design 외 triage packet 규칙을 따라야 하는지 혼선이 있었다.

결론:

- 즉시 수정 전: baseline lock은 가능하지만 sign-off와 triage 정합성에서 operator 해석 부담이 남아 있었다.
- 즉시 수정 후: check 단계 기준으로 do 패키지는 baseline lock 직전 운영에 사용 가능한 수준이다.

## 7. Immediate Document Changes Applied

이번 check 단계에서 다음 최소 수정만 반영했다.

| File | Change |
|------|--------|
| `docs/03-do/features/release-gate-ui-ux-qa/evidence-package-template.md` | scenario run에 `owner` 필드 추가, status enum을 design 범위로 확장, `Final Notes` 템플릿 추가 |
| `docs/03-do/features/release-gate-ui-ux-qa/triage-governance.md` | design 외 `triage packet` 개선안 제거, design triage workflow reference로 정리 |
| `docs/03-do/features/release-gate-ui-ux-qa/scenario-control-matrix.md` | must scenario와 accepted-risk timing을 재해석하게 만드는 manual confirmation 문구 제거 |

## 8. Iterate Candidates

아래 항목은 check 단계에서 정책을 새로 만들지 않고 iterate 대상으로만 분리한다.

| ID | Topic | Reason |
|----|-------|--------|
| IT-01 | waiver 정의와 승인 로그 최소 형식 | design이 accepted-risk는 구체적이지만 waiver는 상대적으로 덜 구체적이다. |
| IT-02 | evidence package canonical storage path | design은 searchable rule만 정의하고 저장소 내 canonical 위치는 고정하지 않는다. |
| IT-03 | issue / rerun / sign-off tracker prefix 표준화 | 현재 예시는 있으나 조직 표준 contract는 아니다. |

## 9. Open Questions Requiring Operational Decision

- 이번 gate run에서 evidence package를 실제로 어느 경로에 둘지
- 조직 표준 tracker prefix를 그대로 쓸지, gate 전용 prefix를 따로 둘지
- waiver를 evidence package 내부 표로만 남길지, 별도 sign-off attachment를 병행할지

## 10. Recommendations

1. report 단계로 넘기기 전, iterate 후보 중 policy 고정이 필요한지 운영 owner 확인을 거친다.
2. evidence package 실제 저장 경로와 tracker prefix는 gate 시작 전에 한 번만 확정한다.
3. waiver 기록 방식이 이번 release gate의 의사결정에 직접 영향이 있으면 iterate로 분리하고, 아니면 운영 판단으로 문서 외부에서만 고정한다.

## 11. Next Step

- PDCA 기준 다음 권장 단계: `$pdca report release-gate-ui-ux-qa`
- 단, iterate 후보 중 정책 고정이 필요한 항목을 먼저 다루려면 `$pdca iterate release-gate-ui-ux-qa`로 제한 범위 보완 후 다시 analyze 한다.

## 12. Check Phase Conclusion

- do 산출물은 design 기준 핵심 운영 흐름을 대부분 충족한다.
- 즉시 수정이 필요한 design 일탈은 문서 수준에서 정리했다.
- 남은 항목은 새 정책을 발명하지 않고 iterate 또는 운영 판단으로 분리했다.
- 현재 상태는 `check` 결과 기록 완료이며, 다음 단계는 iterate 후보 중 실제로 정책 고정이 필요한 항목만 분리해 처리하는 것이다.
