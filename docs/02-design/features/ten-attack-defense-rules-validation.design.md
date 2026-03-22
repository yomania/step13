# ten-attack-defense-rules-validation - Design Document (Starter)

> Version: 1.0.0 | Date: 2026-03-22 | Status: Draft
> Level: Starter | Plan: docs/01-plan/features/ten-attack-defense-rules-validation.plan.md

---

## 1. Overview

이 설계 문서는 텐 공방전의 실제 진행 순서, Stage B 추측 후보 규칙, Stage B 공격 5회 루프, UI 전달 방식, QA 검증 순서를 하나의 기준선으로 고정하기 위한 문서다.

목표는 다음 네 가지다.

1. 룰관리팀이 사용할 규칙 기준 문서를 정의한다.
2. 디자인팀이 마작일번가의 텐공방전 UI/UX를 참고해 적용할 화면 구조와 상호작용 기준을 정의한다.
3. QA팀이 개발 서버에서 순서 검증과 재현 테스트를 수행할 체크포인트를 정의한다.
4. 개발팀이 `packages/core`, `apps/server`, `apps/web`에 어떤 순서로 수정을 넣어야 하는지 구현 기준을 정의한다.

이 문서는 구현 문서가 아니라 구현 직전의 기술 설계 기준이며, 이후 `do` 단계에서 코드 수정과 테스트 추가는 이 문서를 source of truth로 사용한다.

## 2. Page Structure

### 2.1 Affected Screens

- 온라인 대전 메인 게임 화면
  - `apps/web/src/App.tsx`
  - `apps/web/src/components/GameBoard.tsx`
- 텐 공방전 전용 상단/하단 HUD
  - `apps/web/src/components/AttackDefensePanels.tsx`
- 추측/선언 관련 손패 및 후보 표시
  - `apps/web/src/components/HandDisplay.tsx`
  - `apps/web/src/components/DiscardPile.tsx`
- 결과 및 단계 피드백 오버레이
  - `apps/web/src/components/AttackDefensePanels.tsx`

### 2.2 Runtime Sections

| Section | Purpose | Ruleset Dependency |
|---------|---------|--------------------|
| Match Header | 현재 룰셋, 단계, 공격/수비 역할 표시 | 텐 공방전 전용 |
| Board Center | 상대 정보, 버림패, 라운드 상태 표시 | 공통 |
| Bottom Action Zone | Stage A 선언, Stage B 추측, Stage B 공격 액션 | 텐 공방전 전용 |
| Result Overlay | 추측 성공/실패, 공격 종료, 라운드 종료 피드백 | 텐 공방전 전용 |

## 3. Design

### 3.1 Layout

텐 공방전 UI는 단순히 기존 17보 UI에 패널 하나를 추가하는 방식이 아니라 "단계 중심 HUD"로 정리한다.

- 상단 왼쪽: 룰셋명, 현재 단계, 공격/수비 역할, 남은 턴/남은 추측/남은 공격 횟수
- 중앙 보드: 상대 버림패, 내 버림패, 라운드 상태
- 하단 액션 영역:
  - Stage A: 선언 가능 패와 선언 불가 이유를 손패 근처에서 직접 노출
  - Stage B Guess: 추측 후보 카탈로그, X 처리 후보, 선택된 패 preview, 확정 버튼
  - Stage B Assault: 현재 공격 draw 상태, 남은 5회, 필요 시 깡 선택 버튼
- 오버레이:
  - 추측 성공/실패는 중앙 전체폭 피드백 유지
  - 공격 진행 중에는 작은 피드백 대신 HUD 값이 계속 변하도록 설계

### 3.2 Styling

디자인팀은 마작일번가의 텐공방전에서 참고할 핵심 요소를 아래 수준으로 적용한다.

- 단계가 명확히 구분되는 컬러 체계
  - Stage A: cyan/blue 계열
  - Stage B Guess: cyan + amber 보조
  - Stage B Assault: amber/red 계열
- 추측 후보는 현재 `xs` 패보다 한 단계 큰 크기를 기본으로 사용
  - 모바일: 최소 `sm`
  - 데스크톱: `sm` 또는 전용 `guess` 사이즈 추가 검토
- X 처리 후보는 단순 흐림이 아니라 아래 중 하나로 명확히 노출
  - 빨간 X 배지
  - "추측 불가" 툴팁
  - 이유 코드(`상대 버림패`, `패산 소진`) 표시
- 반응형 기준
  - 모바일: 2열 정보 카드 + 6~8열 후보 그리드
  - 태블릿/데스크톱: 11~17열 후보 그리드
- 정보 우선순위
  - 현재 단계 > 남은 기회 > 선택 상태 > 최근 결과 순으로 강도 배치

## 4. Architecture

### 4.1 Source of Truth

| Layer | Responsibility | Source |
|------|----------------|--------|
| Rule constants | 최대 턴 수, 추측 횟수, 공격 횟수 | `packages/core/src/rules.ts` |
| State transition | Stage A/B 전이, draw/discard, 종료 조건 | `packages/core/src/machine.ts` |
| Visibility masking | 상대 손패/풀/pending draw 가리기 | `apps/server/src/GameRoom.ts` |
| Client rendering | 단계별 액션 패널, 후보 시각화 | `apps/web/src/App.tsx`, `apps/web/src/components/AttackDefensePanels.tsx` |
| Test baseline | 상태 전이/룰 회귀 검증 | `packages/core/src/machine.test.ts` 외 |

### 4.2 Proposed Responsibility Split

- 룰관리팀
  - 단계별 게임 순서표 정의
  - 추측 가능/불가 규칙 정의
  - 공격 종료 조건 정의
- 디자인팀
  - 각 규칙을 유저가 이해 가능한 UI 상태로 번역
  - 금지 후보와 최근 추측 피드백 시각화
- QA팀
  - 문서 기준과 실제 개발 서버 동작 비교
  - 재현 절차 및 우선순위화
- 개발팀
  - core/server/web 구현
  - 테스트/빌드/검증 자동화

### 4.3 Affected Code Paths

- Core
  - `packages/core/src/machine.ts`
  - `packages/core/src/messages.ts`
  - 필요 시 신규 helper: 예) `packages/core/src/tenAttackDefense.ts`
- Server
  - `apps/server/src/GameRoom.ts`
  - `apps/server/src/Bot.ts`
- Web
  - `apps/web/src/App.tsx`
  - `apps/web/src/components/AttackDefensePanels.tsx`
  - `apps/web/src/components/Tile.tsx`
  - 필요 시 전용 helper: 예) `apps/web/src/lib/ten-attack-defense.ts`

## 5. Rule Flow Specification

### 5.1 Stage A Declaration Flow

1. `ten_match_start` 이후 현재 턴 플레이어가 Stage A를 진행한다.
2. 현재 턴 플레이어는 draw 후 선언 가능 여부를 확인한다.
3. 후리텐이면 선언할 수 없다.
4. Easy 모드는 `withRiichi`를 허용하지 않는다.
5. 선언 시:
   - 선언 버림패가 discard에 추가된다.
   - 공격자 손패는 13장으로 고정된다.
   - 수비자 턴으로 전환된다.
   - `attackDefense.stage = B_GUESS`

### 5.2 Stage B Guess Flow

1. 수비자는 최대 2회 추측한다.
2. 추측 후보는 전체 타일 카탈로그 기준으로 렌더링하되, 상태를 구분한다.

| Candidate State | Meaning | UI Treatment |
|-----------------|---------|-------------|
| selectable | 추측 가능 | 일반 선택 가능 |
| blocked_by_opponent_discard | 상대가 이미 버린 패라 추측 대상 아님 | 빨간 X + 비활성 |
| exhausted | 남은 장수가 0 | 회색 X + 비활성 |
| selected | 현재 선택 | cyan 강조 |
| last_failed | 직전 실패 추측 | 실패 피드백 강조 |

3. 올바른 추측이면 즉시 수비자 승리로 `ten_round_end` 이동
4. 1회 실패면 남은 추측 횟수와 최근 추측 패를 갱신
5. 2회 실패면 아래 상태로 전환
   - `attackDefense.stage = B_ASSAULT`
   - `attackDefense.assaultRemaining = 5`
   - `currentTurn = attacker`
   - `step = ten_b_assault`

### 5.3 Stage B Assault Flow

1. 공격자는 최대 5회 공격 draw를 진행한다.
2. 각 공격 턴은 다음 순서를 따른다.

| Order | Action | Expected Effect |
|-------|--------|-----------------|
| 1 | assault draw | `pendingDrawTile` 설정 또는 피탄 즉시 종료 |
| 2 | hit check | draw한 패가 locked wait와 일치하면 즉시 공격자 승리 |
| 3 | optional kan | 규칙상 허용되는 경우에만 선택지 노출 |
| 4 | discard | 현재 draw 패를 버린다 |
| 5 | decrement | `assaultRemaining` 1 감소 |
| 6 | loop/end | 0이면 종료, 아니면 다음 공격 턴 |

3. `assaultRemaining = 0`이면 라운드 종료
4. 종료 결과는 현재 코드상 `DRAW` 처리이나, 룰관리팀 검토 후 draw 고정인지 별도 정산인지 확정이 필요하다.

### 5.4 Visibility Policy

| Viewer | Visible | Hidden |
|--------|---------|--------|
| Defender | 상대 버림패, 최근 내 추측, 남은 횟수 | 공격자 실제 대기패, 공격자 pending draw |
| Attacker | 실제 대기패, 최근 수비 추측, 남은 공격 횟수 | 수비자가 알 수 없는 실제 hidden state |
| Round End | 양측 정보 공개 가능 | 종료 전까지 hidden 유지 |

## 6. Data Model

### 6.1 Existing Model

현재 `GameContext.attackDefense`는 아래 필드를 사용한다.

- `stage`
- `attacker`
- `defender`
- `declaredBy`
- `declaredWithRiichi`
- `declarationType`
- `ownTurns`
- `guessesRemaining`
- `failedGuesses`
- `assaultRemaining`
- `lockedWaitTileKeys`
- `lastGuessTileKey`
- `lastGuessResult`
- `pendingDrawTile`
- `kanOption`

### 6.2 Proposed Additions / Derived Helpers

이번 설계는 우선 helper 중심으로 구현하고, 꼭 필요한 경우에만 상태 필드를 늘린다.

우선 추가를 검토할 derived helper:

- `getGuessCandidateStates(context, viewerId)`
  - 목적: Stage B 후보별 상태를 계산
  - 출력: `tileKey`, `remainingCount`, `blockedReason`, `selectable`
- `getTenAttackDefenseStageSummary(context, viewerId)`
  - 목적: HUD 렌더링용 요약 정보 계산
- `shouldEnterAssault(context, guessEvent)`
  - 목적: 추측 2회 실패 전이 로직을 명시화

필드 추가는 아래 조건에서만 허용한다.

- UI가 event log 재해석 없이 필요한 상태를 얻을 수 없는 경우
- server sanitize 이후도 보존되어야 하는 상태인 경우
- 테스트에서 명확히 검증 가능한 경우

## 7. API / Event Design

### 7.1 Existing Event Contract

사용 이벤트:

- `DECLARE_TENPAI`
- `PASS_DECLARATION`
- `DEFENDER_GUESS`
- `ATTACKER_KAN`
- `ATTACKER_KAN_PASS`
- `DISCARD`
- `CONFIRM_ROUND_END`

### 7.2 No New Public Events by Default

이번 수정은 가능한 한 기존 이벤트 계약을 유지한다.

- 이유 1: WS 계약 확장을 피한다.
- 이유 2: 대부분의 문제는 상태 계산과 렌더링 문제다.
- 이유 3: replay/eventLog 호환성을 깨지 않는다.

필요 시 내부 helper만 추가한다.

## 8. Component Design

### 8.1 AttackDefensePanels

수정 목표:

- 추측 후보 계산을 `wall` 수량만이 아니라 상대 버림패 기반 금지 규칙까지 반영
- 패 크기 상향
- 금지 사유 배지 제공
- 선택/실패/최근 추측 시각화 강화
- Assault HUD를 추측 HUD와 분리해 명확화

구성:

| Subsection | Purpose |
|------------|---------|
| Mode Header | 룰셋명, 단계명, 역할 표시 |
| Stat Cards | 남은 턴, 남은 추측, 남은 공격 |
| Guess Tray | 추측 후보와 상태 표시 |
| Guess Preview | 현재 선택 패와 확정 액션 |
| Assault Tray | 남은 공격 횟수, draw 상태, 깡 액션 |
| Result Overlay | 최근 추측 성공/실패 강조 |

### 8.2 App State Projection

`apps/web/src/App.tsx`는 stage별 손패/풀 projection을 담당한다.

검토 포인트:

- Stage A에서 hand/pool 분리 로직이 선언 UI와 일치하는가
- Stage B Assault에서 `pendingDrawTile`만 보여주는 현재 방식이 실제 공격 흐름을 충분히 설명하는가
- currentTurn과 projection이 어긋나서 "진행되지 않는 것처럼 보이는" 상태를 만들지 않는가

### 8.3 Tile / Discard Rendering

- 추측 후보용 전용 크기(`guess`) 추가 여부 검토
- `DiscardPile`에서 상대 버림패와 추측 금지 상태의 시각적 연결을 강화
- X 처리 타일과 실제 버림패 영역의 관계를 더 명확히 보여줄 수 있는지 검토

## 9. QA Design

### 9.1 Manual QA Matrix

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| QA-01 | Stage A 선언 가능한 손패 | 선언 가능 패가 강조된다 |
| QA-02 | 후리텐 상태 선언 시도 | 선언 불가 이유가 표시된다 |
| QA-03 | Stage B에서 상대 버림패 후보 확인 | 해당 후보가 X 처리된다 |
| QA-04 | 추측 1회 실패 | 남은 추측이 1 감소하고 실패 피드백이 보인다 |
| QA-05 | 추측 2회 실패 | 즉시 공격 단계로 진입하고 공격 HUD가 보인다 |
| QA-06 | 공격 1~5회 루프 | 매번 draw/discard 및 남은 공격 횟수가 갱신된다 |
| QA-07 | 공격 중 피탄 | 즉시 종료되고 결과가 올바르게 표시된다 |
| QA-08 | Easy 모드 | 리치 관련 요소가 숨겨지거나 금지된다 |

### 9.2 QA Ownership

- 룰관리팀: 기대 규칙 확인
- 디자인팀: UI 오해 포인트 확인
- QA팀: 개발 서버 재현
- 개발팀: 로그와 테스트 기반 원인 확정

## 10. Test Plan

### 10.1 Core Tests

- `packages/core/src/machine.test.ts`
  - Stage B guess -> assault 전이
  - assault 5회 루프 종료
  - assault 중 hit 즉시 종료
- 필요 시 신규 helper test
  - guess candidate state calculation

### 10.2 Web Validation

- `pnpm --filter web build`
- 수기 검증
  - 모바일 viewport
  - 데스크톱 viewport

### 10.3 Server Validation

- `pnpm --filter server build`
- pending draw masking과 attacker/defender 시야가 의도대로 유지되는지 검증

### 10.4 Required Regression Commands

- `pnpm --filter @step13/core exec vitest run`
- `pnpm --filter web build`
- `pnpm --filter server build`

## 11. Implementation Order

1. 룰관리팀이 Stage A / B_GUESS / B_ASSAULT 순서표와 종료 조건을 문서로 확정
2. 개발팀이 core helper 또는 상태 전이 수정
3. 개발팀이 server masking과 bot 로직을 맞춤
4. 디자인팀 기준으로 `AttackDefensePanels`와 관련 projection UI 수정
5. 테스트 추가 및 회귀 실행
6. QA팀이 개발 서버에서 시나리오 재검증

## 12. Learning Points

- 상태머신 버그와 UI projection 버그는 분리해서 설계해야 한다.
- 텐 공방전처럼 단계가 많은 룰셋은 "현재 가능한 행동"보다 "왜 불가능한지"를 UI에 더 강하게 표시해야 한다.
- 서버 권위 구조에서는 core 수정만으로 끝나지 않고 sanitize/masking/UI projection까지 함께 검토해야 한다.
- 규칙 문서, UI 설계, QA 체크리스트가 따로 놀면 blocker가 반복된다.

## 13. References

- `docs/01-plan/features/ten-attack-defense-rules-validation.plan.md`
- `docs/prd.yaml`
- `docs/system-flow.md`
- `docs/system-architecture.md`
- `packages/core/src/machine.ts`
- `packages/core/src/messages.ts`
- `packages/core/src/rules.ts`
- `apps/server/src/GameRoom.ts`
- `apps/server/src/Bot.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/AttackDefensePanels.tsx`
