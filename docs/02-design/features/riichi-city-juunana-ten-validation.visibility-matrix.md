# Visibility Matrix

> Feature: `riichi-city-juunana-ten-validation`
> Purpose: attacker / defender / observer 기준으로 field-level evidence를 정리한다.
> Rule: `hidden`, `partial`, `unknown`을 구분한다.

## 1. Status Vocabulary

- `hidden`: 내부 구현상 명시적으로 masking 된다.
- `partial`: 존재/노출 필요성은 확인되지만 exact external field timing은 부족하다.
- `unknown`: external evidence가 없어 공개 여부를 판단할 수 없다.

## 2. Matrix

| viewer | field | external evidence | Step13 behavior | mapping to code | status | impact | nextAction |
|---|---|---|---|---|---|---|---|
| attacker | opponent hand | ten/juunana 모두 상대 전체 hand 공개 근거 없음 | round end 전 상대 hand hidden | `apps/server/src/GameRoom.ts:340-349` | hidden | major | direct capture 있더라도 hidden 유지 예상 |
| attacker | opponent pool / discard | discard-based reading gameplay는 확인되지만 exact per-field layout은 외부마다 불명확 | 상대 pool도 round end 전 hidden 처리 | `apps/server/src/GameRoom.ts:350-359` | partial | major | external UI field capture 필요 |
| attacker | pending draw tile | ten assault progression상 attacker는 자신의 draw 상태를 알아야 함 | currentTurn/player 본인일 때만 실타일, 타인은 hidden | `apps/server/src/GameRoom.ts:360-364`, `apps/web/src/lib/ten-attack-defense.ts:73-74` | partial | major | attacker/defender 동시 캡처 필요 |
| attacker | locked wait tile keys | wait secrecy는 ten 핵심 mechanic | attacker 외 viewer에겐 빈 배열로 masking | `apps/server/src/GameRoom.ts:429-435` | hidden | major | 유지 |
| attacker | event log seed / dealt tiles | spectator/game log 존재는 확인되나 seed 공개 근거 없음 | seed=0 또는 null, 상대 dealtTiles masked | `apps/server/src/GameRoom.ts:383-409`, `apps/server/src/GameRoom.ts:425-428` | hidden | major | 유지 |
| attacker | result summary | point calculation / result summary 존재 근거는 있다 | round end 후 결과 요약, confirmed state 노출 | `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:2510-2529` | partial | minor | numeric result capture 필요 |
| defender | opponent hand | guess game 특성상 attacker full hand 공개 근거 없음 | hidden | `apps/server/src/GameRoom.ts:340-349` | hidden | major | 유지 |
| defender | guess candidates | ten 공개 규칙상 defender는 후보 추측 UI를 본다 | `B_GUESS` + defender view일 때만 `guessCandidates` 주입 | `apps/server/src/GameRoom.ts:317-323`, `apps/web/src/components/AttackDefensePanels.tsx:251-320` | partial | major | external direct UI capture 추가 |
| defender | own remaining guesses | `2 attempts` 공개 규칙 존재 | stage summary와 badge에 남은 횟수 표시 | `apps/web/src/components/AttackDefensePanels.tsx:101-109`, `apps/web/src/components/AttackDefensePanels.tsx:257-260` | Match | minor | 유지 |
| defender | attacker pending draw | 외부 자료는 timing이 불분명 | defender는 hidden-pending-draw를 받음 | `apps/server/src/GameRoom.ts:360-364` | hidden | major | keep internal-only |
| observer | opponent hand / pool | Steam store는 spectator mode 존재만 말하며 hidden tile 공개 여부는 말하지 않음 | observer도 player와 동일하게 hidden 상태 수신 | `apps/server/src/GameRoom.ts:340-359`, `apps/server/src/GameRoom.ts:429-435` | unknown | major | observer real capture 필요 |
| observer | event log | game log 기능은 공개 근거가 있다 | sanitized eventLog 사용, dealt/seed 정보 제거 | `apps/server/src/GameRoom.ts:382-423`, `docs/prd.yaml:216-221` | partial | major | replay log screenshot 필요 |
| observer | deterministic seed | external evidence 없음 | client snapshot에서 null/0으로 masking | `apps/server/src/GameRoom.ts:389-392`, `apps/server/src/GameRoom.ts:425-428` | hidden | major | security note 유지 |
| observer | round end summary | spectator mode + point calculation 기능은 확인 | round end 이후 summary는 읽을 수 있으나 confirm actor role은 player 중심 | `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:2510-2529` | partial | minor | observer screenshot 필요 |
| classic viewers | opponent dealt tiles | Juunana hand-build viewer policy는 direct source 없음 | classic에서 상대 dealt tiles 항상 hidden count 처리 | `apps/server/src/GameRoom.ts:367-380` | unknown | major | Juunana direct capture 없으면 확정 금지 |

## 3. Interpretation

- D5의 핵심 source of truth는 external spectator existence가 아니라 `GameRoom.ts` sanitize contract다.
- `hidden`은 내부 구현 확정 상태이고, external source가 없는 viewer policy는 `unknown` 또는 `partial`로 남긴다.
- Do 단계에서 수정 가능 항목은 sanitize contract 명확화와 UI 설명 보강이지, external truth를 추측해 공개 범위를 바꾸는 것이 아니다.

## 4. Runtime Contract Invariants

아래 불변식은 external evidence가 부족하더라도 Step13 런타임 보안/공정성 기준으로 유지해야 한다.

| invariantId | invariant | Why It Must Hold | Code Anchor |
|-------------|-----------|------------------|-------------|
| V-INV-01 | round end 전 상대 hand는 실타일로 노출되지 않는다 | hidden-information game integrity | `apps/server/src/GameRoom.ts:339-349` |
| V-INV-02 | attacker 전용 wait 정보는 defender/observer에 노출되지 않는다 | ten 핵심 추측 구조 보호 | `apps/server/src/GameRoom.ts:429-435` |
| V-INV-03 | pending draw 실타일은 현재 조작 주체 외 viewer에 숨긴다 | 실시간 정보 누설 방지 | `apps/server/src/GameRoom.ts:360-364` |
| V-INV-04 | deterministic seed와 dealt history는 replay/debug 편의보다 비밀 보호를 우선한다 | 재현성보다 공정성 우선 | `apps/server/src/GameRoom.ts:383-409`, `apps/server/src/GameRoom.ts:425-428` |
| V-INV-05 | guessCandidates는 defender의 `B_GUESS` 시점에만 주입된다 | role-based UI contract 유지 | `apps/server/src/GameRoom.ts:317-323` |

## 5. Evidence Capture Scenarios

현재 D5의 부족한 부분은 “필드별 정책”은 있는데 “동일 장면 비교 세트”가 없다는 점이다. 아래 시나리오를 확보하면 `partial`/`unknown` 항목을 가장 효율적으로 줄일 수 있다.

| scenarioId | scenario | required viewers | required proof | target rows |
|------------|----------|------------------|----------------|-------------|
| VIS-01 | `ten_b_guess` 직전 상태 동시 캡처 | attacker, defender, observer | hand/pool/guessCandidates/pendingDraw 비교 스크린샷 | `attacker opponent hand`, `defender guess candidates`, `observer hand/pool` |
| VIS-02 | `ten_b_assault` 진행 중 pending draw 상태 | attacker, defender | attacker는 실타일, defender는 hidden tile인지 비교 | `attacker pending draw`, `defender attacker pending draw`, `observer pending draw` |
| VIS-03 | `ten_round_end` 결과 화면 | attacker, defender, observer | summary visibility와 confirm actor 차이 | `result summary`, `observer round end summary` |
| VIS-04 | `classic_hand_build` 진행 중 상대 dealt tile 상태 | self, opponent, observer | dealt tiles count vs actual tile masking | `classic viewers opponent dealt tiles` |

## 6. Reviewer Questions

CTO/Runtime 팀은 D5를 승인하기 전에 아래 질문에 답해야 한다.

1. 각 `hidden` row는 실제 보안 불변식인지, 단순 구현 편의인지 구분됐는가.
2. `observer` 정책은 “외부 truth”가 아니라 “Step13 policy”라고 명시돼 있는가.
3. 한 시나리오에서 여러 viewer를 동시에 비교할 캡처 계획이 있는가.
4. 문서 wording과 `GameRoom.ts` sanitize 조건이 1:1로 대응되는가.

## 7. Multi-Viewer Evidence Packet Status

| packetId | target scenarios | current strength | strongest current proof | missing proof to close |
|----------|------------------|------------------|--------------------------|------------------------|
| VP-01 | `VIS-01` | medium | defender `guessCandidates` code + panel anchor | attacker/observer 동시 screenshot |
| VP-02 | `VIS-02` | medium-low | `pendingDrawTile` masking code anchor | assault 중 attacker/defender same-frame packet |
| VP-03 | `VIS-03` | medium-low | round-end summary UI anchor | observer round-end summary + confirm-role note |
| VP-04 | `VIS-04` | low | classic dealt-tile masking code anchor | Juunana/classic hand-build observer evidence |

판정 메모:

1. 현재 D5는 policy 문서로는 충분하지만 parity 문서로는 packet이 더 필요하다.
2. `VP-01`~`VP-03`가 닫히면 `partial` 일부를 `Match` 또는 stronger `hidden` justification으로 올릴 수 있다.
3. `VP-04`는 direct source가 없으면 계속 `unknown`으로 남겨도 정상이다.
