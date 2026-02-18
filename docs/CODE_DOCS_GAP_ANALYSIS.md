# 코드-문서 동기화 리포트 (Code vs Docs Gap Analysis)

분석일: `2026-02-18`
분석 범위: `apps/*`, `packages/*`, `docs/*`

## 1. 이번 동기화에서 정리한 불일치

기존 문서 대비 실제 코드 기준으로 다음 항목을 수정했습니다.

- 룰 수치 불일치
  - 시작 점수: `50000 -> 60000`
  - 턴 타이머: `5s -> 10s`
  - 타임뱅크: `10s -> 3s`
  - 도라 공개 지연(`3000ms`) 및 `matchStart` 지연(`1000ms`) 반영
- 패키지 상태 불일치
  - `@step13/bot`은 future가 아니라 실사용/테스트 대상임을 반영
- 라운드 종료 흐름 누락
  - `CONFIRM_ROUND_END` 전원 확인 게이트, 봇 자동확인 반영
- 분석 질의 계약 누락
  - `QUERY_ANALYSIS`/`ANALYSIS_RESULT`의 `queryId` 상관관계 규칙 반영
- 서버 마스킹 정책 누락
  - wall/hands/pools/dealtTiles/eventLog seed 마스킹 반영

## 2. 현재 잔여 갭

중대 불일치 없음.

주의 사항(의도된 상태):

- `packages/assets`는 placeholder 패키지이며 런타임 로직 없음
- `RULESET`은 현재 `classic`만 지원

## 3. 재발 방지 규칙

- 아키텍처/룰/계약 변경 시 코드 변경 전 `docs/*` 선행 갱신
- PR 제출 전 `docs/README.md`의 문서 맵 기준으로 영향 문서 재검토
- 작업 절차는 `docs/ai-doc-first-workflow.md`를 기준으로 수행

## 4. 다음 점검 시 확인 파일

- `packages/core/src/rules.ts`
- `packages/core/src/machine.ts`
- `apps/server/src/GameRoom.ts`
- `apps/web/src/hooks/useGameSocket.ts`
- `apps/web/src/components/HandBuilder.tsx`
- `apps/web/src/components/SingleMiniGame.tsx`
