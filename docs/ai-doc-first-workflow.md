# AI 문서 선행 작업 가이드 (Doc-First Workflow)

기준일: `2026-02-18`
대상: 이 저장소에서 작업하는 AI/자동화 에이전트

## 1. 목적

- 아키텍처 문서와 실제 코드를 항상 동기화한다.
- 코드 변경 전에 설계 의도를 문서에 먼저 고정한다.
- 비동기/상태 부작용 회귀를 작업 절차에서 줄인다.

## 2. 필수 워크플로우

### Step 0. 변경 의도 먼저 기록 (코드 수정 전)

최소 아래를 문서에 먼저 반영한다.

- 변경 대상 기능/룰/흐름
- 영향 받는 런타임 레이어(`web/server/core/bot/scoring`)
- 영향 문서 목록

권장 위치:

- 제품/룰 변경: `docs/prd.yaml`
- 전이/시퀀스 변경: `docs/system-flow.md`
- 모듈 책임/계약 변경: `docs/system-architecture.md`

### Step 1. 코드 변경

- Step 0에서 기록한 범위 내에서만 수정
- 비동기 응답은 상관관계 키(`queryId`)를 사용
- 타이머/소켓/구독/워커는 cleanup 경로 유지

### Step 2. 문서 재동기화

- 실제 구현 결과를 문서에 최종 반영
- 설계 의도와 구현이 달라졌다면 문서를 구현 기준으로 즉시 수정

### Step 3. 검증 실행 (비-watch)

영향 범위별로 아래를 실행한다.

- `apps/web` 변경
  - `pnpm --filter web build`
  - `pnpm --filter @step13/core exec vitest run`
- `apps/server` 변경
  - `pnpm --filter server build`
  - `pnpm test:e2e`
- `packages/core` 변경
  - `pnpm --filter @step13/core exec vitest run`
- `packages/scoring` 변경
  - `pnpm --filter @step13/scoring test`
- `packages/bot` 변경
  - `pnpm --filter @step13/bot test`

원칙:

- `vitest` watch 모드는 금지, 반드시 `vitest run`

### Step 4. 작업 보고

작업 결과에는 반드시 포함한다.

- 변경 이유와 영향 범위
- 업데이트한 문서 파일
- 실행한 검증 명령과 pass/fail 결과

## 3. 문서 업데이트 매트릭스

코드 파일이 바뀌면 최소 아래 문서를 함께 갱신한다.

- `packages/core/src/rules.ts`, `packages/core/src/machine.ts`
  - `docs/prd.yaml`, `docs/system-flow.md`
- `packages/core/src/engine/*`
  - `docs/prd.yaml`, `docs/ruleset-extension.md`
- `apps/server/src/GameRoom.ts`, `apps/server/src/index.ts`
  - `docs/system-architecture.md`, `docs/system-flow.md`
- `apps/web/src/hooks/useGameSocket.ts`
  - `docs/system-flow.md`
- `apps/web/src/components/HandBuilder.tsx`, `apps/web/src/components/SingleMiniGame.tsx`
  - `docs/system-flow.md`, 필요 시 `docs/prd.yaml`
- `packages/bot/src/personas.ts`, `apps/server/src/Bot.ts`
  - `docs/prd.yaml`, `docs/system-architecture.md`

## 4. 부작용 방지 체크리스트

작업 전/후로 아래를 확인한다.

- 분석/질의 응답은 `queryId`로 요청-응답 1:1 매칭되는가?
- UI 초기화는 "참조 변경"이 아니라 "실데이터 변화" 기준으로 작동하는가?
- 타이머/소켓/구독/워커 cleanup이 존재하고 테스트 가능한가?
- 라운드 전이 게이트(`CONFIRM_ROUND_END`)가 의도대로 유지되는가?

## 5. 완료 정의 (Definition of Done)

다음을 모두 만족해야 완료로 본다.

- 코드 반영 완료
- 영향 문서 반영 완료
- 범위별 검증 명령 실행 완료
- 결과 보고에 명령/결과 명시 완료
