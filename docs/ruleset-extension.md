# 룰셋 확장 가이드 (Ruleset Extension Guide)

## 목표 (Goal)

`machine.ts`의 조건 분기를 늘리지 않고 새로운 게임 변형(variants)을 추가합니다.

## 진입점 (Entry Points)

1. 엔진 레이어에서 정책(policy) 동작 구현:
   - `packages/core/src/engine/defaultEngine.ts` (참조)
   - 또는 새로운 엔진 모듈 추가
2. 다음 위치에 등록:
   - `packages/core/src/engine/rulesets.ts`
3. 머신 생성 시 선택:
   - `createGameMachine({ ruleset: '...' })`

## 최소 단계 (Minimal Steps)

1. `RulesetName`에 새로운 룰셋 이름 추가.
2. `createEngineForRuleset`에서 해당 룰셋에 대한 엔진 인스턴스 생성.
3. 페이즈 파이프라인 자체가 다르지 않다면 머신 그래프는 변경하지 않고 유지.

## 런타임 선택 (Runtime Selection)

서버 부트:

- `apps/server/src/index.ts`가 `RULESET` 환경 변수를 읽음
- `new GameRoom(roomId, ruleset)`으로 방 생성

예시:

```bash
RULESET=classic pnpm --filter server dev
```

## 설계 규칙 (Design Rule)

- 연산 **방법(how)**은 엔진 정책에 둡니다.
- 전이 **시점(when)**은 머신 상태에 유지합니다.
