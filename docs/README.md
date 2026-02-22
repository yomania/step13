# 문서 인덱스 (Docs Index)

기준일: `2026-02-18`

이 폴더는 "현재 구현 코드"를 빠르게 이해하고, 변경 시 문서를 먼저 갱신하기 위한 운영 문서 모음입니다.

## 소스 오브 트루스 우선순위

1. 실제 동작: `packages/core`, `apps/server`, `apps/web` 코드
2. 합의된 설계/운영 기준: 이 `docs/*` 문서

코드와 문서가 불일치하면, 먼저 문서를 최신 코드 기준으로 맞춘 뒤 코드 작업을 진행합니다.

## 문서 맵

- `docs/prd.yaml`
  - 현재 구현 기준 제품/룰/이벤트 계약
- `docs/system-architecture.md`
  - 모노레포 구조, 런타임 책임, 상태 소유권, 보안 마스킹
- `docs/system-flow.md`
  - 매치 수명주기, 타이머, 분석 질의(query) 상관관계 흐름
- `docs/ruleset-extension.md`
  - 룰셋/엔진 확장 절차와 테스트 체크리스트
- `docs/env.md`
  - 런타임 환경 변수(서버/웹) 가이드
- `docs/ai-doc-first-workflow.md`
  - AI 작업용 "문서 선행 -> 코드 변경" 운영 가이드
- `docs/CODE_DOCS_GAP_ANALYSIS.md`
  - 코드-문서 동기화 점검 리포트

## 빠른 참조 (AI/개발자 공통)

- 룰 상수/타이머/핸드 수치
  - 코드: `packages/core/src/rules.ts`
  - 문서: `docs/prd.yaml`, `docs/system-flow.md`
- 상태머신 전이
  - 코드: `packages/core/src/machine.ts`
  - 문서: `docs/system-flow.md`
- 룸/소켓 계약
  - 코드: `apps/server/src/GameRoom.ts`, `apps/server/src/index.ts`
  - 문서: `docs/system-architecture.md`, `docs/prd.yaml`
- 조패 분석/미니게임 질의
  - 코드: `apps/web/src/components/HandBuilder.tsx`, `apps/web/src/components/SingleMiniGame.tsx`, `apps/server/src/GameRoom.ts`
  - 문서: `docs/system-flow.md`
- 봇 페르소나/난이도
  - 코드: `packages/bot/src/personas.ts`, `apps/server/src/Bot.ts`
  - 문서: `docs/system-architecture.md`, `docs/prd.yaml`

## 변경 원칙

- 아키텍처/룰/계약이 바뀌는 변경은 코드보다 문서 갱신을 먼저 수행
- 코드 변경 후에는 영향 문서를 다시 검토하여 최종 동기화 확인
- 자세한 절차는 `docs/ai-doc-first-workflow.md`를 따름
