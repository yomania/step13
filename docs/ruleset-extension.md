# 룰셋 확장 가이드 (Ruleset Extension Guide)

기준일: `2026-02-18`

현재 활성 룰셋은 `classic` 1종이며, 확장은 "머신 그래프 최소 변경" 원칙으로 진행합니다.

## 1. 설계 원칙

- 전이 시점(when): `packages/core/src/machine.ts`
- 연산 방법(how): `packages/core/src/engine/*`
- 룰 이름/팩토리: `packages/core/src/engine/rulesets.ts`

머신 전이는 가능하면 그대로 두고, 엔진 정책으로 차이를 흡수합니다.

## 2. 최소 구현 단계

1. `RulesetName`에 새 이름 추가
   - 파일: `packages/core/src/engine/rulesets.ts`
2. 새 엔진 생성 또는 `createDefaultEngine` 파라미터 분기
   - 파일: `packages/core/src/engine/defaultEngine.ts` 또는 신규 엔진 파일
3. `createEngineForRuleset`에 매핑 추가
4. 서버 런타임 선택 경로 확인
   - 파일: `apps/server/src/index.ts`
   - 환경변수: `RULESET=<new_ruleset>`

## 3. 머신 변경이 필요한 경우

아래 중 하나라도 충족되면 `machine.ts` 전이를 수정해야 합니다.

- 페이즈 개수 자체가 달라짐
- 타이머 경계가 달라져 상태 구조 변경이 필요
- 라운드 종료 게이트 조건이 룰셋마다 다름

그 외는 엔진/상수(`rules.ts`)에서 우선 처리합니다.

## 4. 테스트 체크리스트

룰셋 추가 시 최소 검증:

- `pnpm --filter @step13/core exec vitest run`
- `pnpm --filter server build`
- `pnpm test:e2e`

권장 추가 테스트:

- 엔진 단위 테스트: `packages/core/src/engine/defaultEngine.test.ts` 패턴 확장
- 상태머신 타이머/게이트 테스트: `packages/core/src/machine.test.ts` 패턴 확장

## 5. 문서 동기화 (필수)

룰셋 확장 PR에는 아래 문서가 함께 변경되어야 합니다.

- `docs/prd.yaml`
- `docs/system-architecture.md`
- `docs/system-flow.md`
- 필요 시 `docs/CODE_DOCS_GAP_ANALYSIS.md`

작업 순서는 `docs/ai-doc-first-workflow.md`를 따릅니다.

## 6. 실행 예시

```bash
RULESET=classic pnpm --filter server dev
```
