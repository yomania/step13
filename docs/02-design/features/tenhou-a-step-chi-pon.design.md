# tenhou-a-step-chi-pon - Design Document (Starter)

> Version: 1.0.0 | Date: 2026-03-22 | Status: Draft
> Level: Starter | Plan: docs/01-plan/features/tenhou-a-step-chi-pon.plan.md

---

## 1. Overview

이 설계 문서는 텐공방전의 A 스탭에 `치`, `펑` 액션을 추가하기 위한 기술 기준선이다. 목표는 기존 선언 중심 흐름을 깨지 않으면서도, 공격자가 직전 공개 버림패에 반응해 합법적인 `치`, `펑`을 수행하고 이후 discard 및 단계 전이가 일관되게 이어지도록 만드는 것이다.

이번 설계는 다음 다섯 가지를 고정한다.

1. 어떤 조건에서 `치`, `펑` 버튼이 노출되고 서버가 이를 승인해야 하는지 정의한다.
2. 복수 조합이 가능한 경우 선택 UX와 이벤트 payload를 정의한다.
3. `치`, `펑` 직후 손패, 멘츠, 버림패, 현재 턴, pending action이 어떻게 바뀌는지 정의한다.
4. core, server, web, replay/logging 레이어별 책임을 분리한다.
5. 구현 직후 반드시 검증할 테스트 매트릭스와 회귀 범위를 고정한다.

이 문서는 `do` 단계의 source of truth로 사용하며, 실제 구현은 이 문서의 상태 전이와 payload 규칙을 우선 따른다.

## 2. Runtime Surface

### 2.1 Affected Screens

- 온라인 대전 메인 화면
  - `apps/web/src/App.tsx`
- 텐공방전 전용 액션/상태 패널
  - `apps/web/src/components/AttackDefensePanels.tsx`
  - `apps/web/src/components/HandDisplay.tsx`
- 손패/버림패/멘츠 표시 영역
  - `apps/web/src/components/GameBoard.tsx`
  - `apps/web/src/components/DiscardPile.tsx`

### 2.2 Affected Runtime Layers

| Layer | Primary Files | Design Role |
|------|---------------|-------------|
| Core state machine | `packages/core/src/machine.ts` | `치`, `펑` guard/action/transition 소유 |
| Core helper | `packages/core/src/ten-attack-defense.ts` 또는 신규 helper | 후보 조합 계산, 합법성 검증, stage summary 계산 |
| Shared contracts | `packages/core/src/messages.ts`, `packages/proto` | action payload 및 공개 상태 shape 정의 |
| Server sync | `apps/server/src/GameRoom.ts` | viewer별 sanitize, validation 통과 이벤트 broadcast |
| Web UI | `apps/web/src/App.tsx`, `apps/web/src/lib/ten-attack-defense.ts` | 버튼 노출, 조합 선택, 로컬 표시 모델 |
| Replay/logging | core event log + replay machine | 액션 재현 가능성 보장 |

## 3. Rule Design

### 3.1 Supported Action Window

`치`, `펑`은 텐공방전 `attackDefense.stage === 'A'`에서만 허용한다. Stage B 추측과 공격 단계에서는 이 액션을 노출하지 않는다.

허용 기본 조건은 다음과 같다.

| Condition | Chi | Pon | Notes |
|-----------|-----|-----|-------|
| ruleset is ten ruleset | required | required | `classic` 제외 |
| stage is `A` | required | required | Stage B 불가 |
| current player is attacker | required | required | 수비자에게는 미노출 |
| `lastDiscard` exists and belongs to defender | required | required | 직전 공개 버림패 기준 |
| attacker can form a legal meld using hand + `lastDiscard` | required | required | hand 내 사용 타일 2장 필요 |
| pending draw is present | optional | optional | A 스탭 구조상 현재 턴 액션 전 hand 계산에 포함 가능 |
| riichi-declared A flow conflict | blocked | blocked | 선언 확정 이후에는 액션 창 종료 |

### 3.2 Meld Semantics

- `치`
  - 수비자의 직전 버림패와 공격자 손패 2장으로 연속 수패 멘츠를 만든다.
  - 자패(`z`)는 `치` 불가다.
  - 복수 조합 가능 시 공격자가 조합을 선택해야 한다.
- `펑`
  - 수비자의 직전 버림패와 공격자 손패 동일 패 2장으로 커쯔를 만든다.
  - 복수 조합 개념은 거의 없지만 red tile 포함 여부로 실제 tile id 선택은 필요할 수 있다.

### 3.3 Post-Meld Flow

`치`, `펑`은 둘 다 즉시 종료 액션이 아니라 "멘츠 확정 후 추가 버리기 필요" 상태를 만든다.

표준 흐름:

1. 공격자가 `치` 또는 `펑`을 선택한다.
2. core는 `lastDiscard`를 소비해 공격자의 meld 목록에 공개 멘츠를 추가한다.
3. 멘츠에 사용된 공격자 손패 2장을 손패에서 제거한다.
4. 공격자는 이어서 1장의 discard를 강제로 수행해야 한다.
5. discard 완료 후 A 스탭을 계속 유지할지, 상대 턴 또는 다음 전이로 넘길지 규칙에 따라 결정한다.

이번 설계에서는 discard 강제 상태를 별도 boolean/pending action으로 모델링한다. `치`, `펑` 직후 자동 discard를 하지 않는다. 사용자가 명시적으로 버릴 패를 선택하게 한다.

### 3.4 Stage Continuity Decision

`치`, `펑`은 A 스탭 내부의 하위 액션으로 취급한다. 즉, `attackDefense.stage`는 `A`를 유지하되, A 스탭 내 substate 또는 pending action을 통해 "meld 후 discard 대기"를 표현한다.

이유:

- B 스탭은 선언 이후 전용 단계이므로 `치`, `펑` 때문에 stage를 바꾸면 의미가 흐려진다.
- replay/logging에서 A 스탭 내 세부 액션으로 유지하는 편이 기존 구조와 호환된다.
- UI도 단계 배지 변경 없이 A 스탭 안에서 액션 패널만 전환하면 된다.

## 4. State Model

### 4.1 Existing Relevant State

현재 확인된 핵심 필드는 다음과 같다.

- `context.attackDefense.stage`
- `context.currentTurn`
- `context.lastDiscard`
- `context.attackDefense.pendingDrawTile`
- `context.eventLog`
- `context.hands`
- `context.discards`
- `context.pools`

### 4.2 Proposed Additions

이번 기능은 `attackDefense` 안에 A 스탭 전용 substate를 추가한다.

제안 필드:

| Field | Type | Purpose |
|-------|------|---------|
| `pendingClaim` | `null | { type: 'CHI' | 'PON'; sourcePlayerId: string; discardTileId: string; discardTileKey: string; consumedTileIds: string[]; consumedTileKeys: string[] }` | 방금 성립한 `치`/`펑` 결과를 저장하고 후속 discard 전까지 유지 |
| `availableCalls` | `Array<{ type: 'CHI' | 'PON'; discardTileId: string; discardTileKey: string; consumedTileIds: string[]; consumedTileKeys: string[] }>` | 현재 공격자에게 노출할 액션 후보 목록 |
| `mustDiscardAfterClaim` | `boolean` | 멘츠 확정 직후 강제 discard 상태 표현 |

`availableCalls`는 derived helper로만 유지하는 방식도 가능하다. 그러나 UI/서버가 동일한 계산 결과를 재사용해야 하고, 복수 조합 선택 UX가 필요하므로 이번 설계에서는 helper로 계산하되 sanitize state에 포함 가능한 구조를 허용한다.

### 4.3 Meld Representation

공개 멘츠는 기존 `pools` 구조만으로 표현 가능한지 먼저 확인한다. 만약 `pools`가 단순 미공개 패 보관 용도로 사용돼 공개 멘츠와 의미가 충돌한다면 별도 `openMelds`를 도입한다.

우선 권장안:

- `openMelds[playerId] = Array<{ type: 'CHI' | 'PON'; tileIds: string[]; tileKeys: string[]; calledTileId: string; calledFrom: string }>`

이유:

- `pool`은 텐공방전 기존 UI 문맥에서 다른 의미로 사용될 수 있다.
- 멘츠 노출은 버림패/손패와 별도 렌더링이 안정적이다.
- replay에서 어떤 패가 호출 패인지 남기기 쉽다.

## 5. Core Architecture

### 5.1 Helper Functions

신규 helper는 core에서 단일 source of truth를 제공해야 한다.

| Helper | Responsibility |
|--------|----------------|
| `listTenCallCandidates(context, playerId)` | 현재 A 스탭에서 가능한 `치`, `펑` 조합 목록 계산 |
| `canApplyTenCall(context, event)` | 특정 `CALL_CHI`/`CALL_PON` 이벤트의 합법성 검증 |
| `applyTenCall(context, event)` | 멘츠 확정, 손패 제거, lastDiscard 소비, pending claim 설정 |
| `getTenStageASummary(context, playerId)` | A 스탭 HUD용 액션 가능 여부, 강제 discard 여부 계산 |

### 5.2 State Machine Changes

현재 machine은 `DECLARE_TENPAI`, `DEFENDER_GUESS`, `ATTACKER_KAN` 중심으로 작성돼 있다. 여기에 A 스탭 전용 이벤트를 추가한다.

신규 이벤트:

- `CALL_CHI`
- `CALL_PON`

payload 제안:

```ts
type CallChiEvent = {
    type: 'CALL_CHI';
    playerId: string;
    discardTileId: string;
    useTileIds: [string, string];
};

type CallPonEvent = {
    type: 'CALL_PON';
    playerId: string;
    discardTileId: string;
    useTileIds: [string, string];
};
```

설계 원칙:

- 클라이언트는 tile key가 아니라 실제 `tileId`를 보낸다.
- 서버/코어는 `lastDiscard.tile.id === discardTileId`인지 검증한다.
- 코어는 `useTileIds`가 현재 공격자 hand 또는 `pendingDrawTile` 내에 존재하는지 검증한다.

### 5.3 Transition Rules

| Current Situation | Event | Result |
|-------------------|-------|--------|
| A 스탭, 합법 `치` 후보 존재 | `CALL_CHI` | `pendingClaim` 설정, `mustDiscardAfterClaim = true`, currentTurn 유지 |
| A 스탭, 합법 `펑` 후보 존재 | `CALL_PON` | `pendingClaim` 설정, `mustDiscardAfterClaim = true`, currentTurn 유지 |
| claim 직후 discard 대기 | `DISCARD` | claim 종료, `mustDiscardAfterClaim = false`, `lastDiscard` 갱신 |
| claim 없이 일반 A 진행 | `DECLARE_TENPAI` | 기존 흐름 유지 |
| claim 직후 다른 액션 시도 | `DECLARE_TENPAI` / 추가 call | 거부 |

추가 guard:

- `mustDiscardAfterClaim === true`이면 `DECLARE_TENPAI`, `PASS_DECLARATION`, 중복 `CALL_CHI`, 중복 `CALL_PON`을 모두 막는다.
- `DISCARD`는 현재 턴 공격자만 가능하다.

## 6. Server And Sync Design

### 6.1 Validation Strategy

서버는 별도 규칙 엔진을 만들지 않고 core machine을 통해서만 합법성을 판정한다. `apps/server/src/GameRoom.ts`는 이벤트 허용 목록만 추가하고, broadcast 전 sanitize state에 필요한 공개 정보만 포함한다.

신규 TEN 이벤트 허용 목록:

- `CALL_CHI`
- `CALL_PON`

### 6.2 Sanitized State

viewer별 공개 정보는 아래만 노출한다.

| Field | Attacker View | Defender View |
|-------|---------------|---------------|
| `availableCalls` | visible | hidden |
| `pendingClaim.type` | visible | visible |
| `pendingClaim.consumedTileKeys` | visible | visible after claim confirmed |
| `mustDiscardAfterClaim` | visible | visible as action status |
| 실제 공격자 hidden hand | visible | hidden |

조합 후보는 공격자에게만 노출한다. 수비자에게는 버튼 상태 대신 "상대가 호출 가능한 상태"를 직접 보여주지 않는다.

### 6.3 Replay / Event Log

event log에는 `CALL_CHI`, `CALL_PON`, 후속 `DISCARD`가 순서대로 남아야 한다.

필수 replay 가능 정보:

- 누가 호출했는가
- 어떤 discard를 대상으로 했는가
- 어떤 tile ids 두 장을 사용했는가
- 후속 discard가 무엇이었는가

## 7. UI Design

### 7.1 Action Zone

A 스탭 하단 액션 영역을 다음 순서로 정리한다.

1. 선언 가능 상태 요약
2. `치`, `펑` 버튼
3. 조합 선택 패널
4. claim 후 discard 가이드

### 7.2 Interaction Model

| Situation | UI Behavior |
|-----------|-------------|
| call 불가 | 버튼 숨김 또는 disabled + 이유 텍스트 |
| call 1개 가능 | 버튼 클릭 시 즉시 확정 또는 간단 confirm |
| call 복수 조합 가능 | 버튼 클릭 후 조합 리스트/타일 프리뷰 노출 |
| claim 직후 | 손패에서 "버릴 패를 선택하세요" 상태 강조 |

복수 조합 UX는 modal보다 인라인 패널을 우선한다. 이유는 현재 화면이 실시간 보드 중심이며, modal은 단계 맥락을 끊기 쉽기 때문이다.

### 7.3 Visual Representation

- `치`는 연속 3장 프리뷰로 표시
- `펑`은 동일 3장 프리뷰로 표시
- 호출된 멘츠는 손패 바깥의 공개 멘츠 영역에 배치
- claim 직후 discard 대기 상태에서는 손패 상단에 amber 배지 표시

## 8. API / Event Spec

### 8.1 Client To Machine

```ts
sendEvent({
    type: 'CALL_CHI',
    playerId,
    discardTileId,
    useTileIds: ['tile-a', 'tile-b']
});

sendEvent({
    type: 'CALL_PON',
    playerId,
    discardTileId,
    useTileIds: ['tile-c', 'tile-d']
});
```

### 8.2 Read Model For UI

`context.attackDefense` 또는 derived summary는 최소 아래 정보를 제공해야 한다.

```ts
type TenCallCandidate = {
    type: 'CHI' | 'PON';
    discardTileId: string;
    discardTileKey: string;
    useTileIds: [string, string];
    useTileKeys: [string, string];
};
```

UI summary 제안:

```ts
type TenStageASummary = {
    canDeclareTenpai: boolean;
    canCallChi: boolean;
    canCallPon: boolean;
    mustDiscardAfterClaim: boolean;
    availableCalls: TenCallCandidate[];
};
```

## 9. Implementation Order

1. core helper와 type 정의 추가
2. machine guard/action에 `CALL_CHI`, `CALL_PON`, claim 후 discard 제한 추가
3. server TEN event whitelist 및 sanitize state 반영
4. web action panel과 hand interaction 업데이트
5. replay/log 검증 및 회귀 테스트 추가

## 10. Test Plan

### 10.1 Core Tests

필수 테스트:

- 합법 `치` 조합 1개 계산
- 합법 `치` 조합 복수 계산
- 자패 `치` 불가
- 합법 `펑` 계산
- 잘못된 `discardTileId` 거부
- hand에 없는 `useTileIds` 거부
- claim 직후 `DECLARE_TENPAI` 거부
- claim 직후 discard만 허용
- claim 후 discard 완료 시 `mustDiscardAfterClaim` 해제

명령:

- `pnpm --filter @step13/core exec vitest run`

### 10.2 Web Validation

- A 스탭에서 call 가능 시 버튼 노출 확인
- 복수 조합 시 인라인 선택 패널 렌더링 확인
- claim 후 손패에서 discard 유도 상태 확인
- 멘츠 공개 영역 렌더링 확인

명령:

- `pnpm --filter web build`
- 필요 시 관련 웹 테스트 추가

### 10.3 Server / Integration Validation

- 다른 클라이언트에서 claim 결과가 동일하게 보이는지 확인
- 수비자 뷰에 공격자 call 후보가 노출되지 않는지 확인
- replay/event log 순서가 `CALL_* -> DISCARD`로 유지되는지 확인

명령:

- `pnpm --filter server build`
- `pnpm test:e2e`

## 11. Risks And Design Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| stage 변경 여부 | `A` 유지 | B 단계 의미를 보존하고 기존 구조와 충돌을 줄임 |
| claim 직후 discard 방식 | 자동 discard 금지, 명시적 선택 필요 | UX 명확성과 replay 가독성 확보 |
| 후보 계산 위치 | core 우선 | server/web 불일치 방지 |
| 이벤트 payload | `tileId` 기반 | 동일 패 복수 보유와 red tile 구분을 안전하게 처리 |
| 공개 멘츠 구조 | `openMelds` 분리 우선 | 기존 `pools` 의미 충돌 방지 |

## 12. Learning Points

- 상태머신에 신규 액션을 추가할 때는 stage를 늘리기보다 기존 stage 내부의 pending action으로 모델링하는 편이 회귀를 줄일 수 있다.
- 실시간 게임에서는 클라이언트 편의용 helper가 아니라 core helper가 규칙 source of truth여야 desync를 줄일 수 있다.
- `tileKey`는 규칙 판정 요약에 적합하지만 실제 이벤트 입력은 `tileId`가 더 안전하다.
