# Juunana Comparison Matrix

> Feature: `riichi-city-juunana-ten-validation`
> Track: Riichi City `Juunana Ho` vs Step13 `classic`
> Rule: Riichi City direct evidence가 없는 항목은 `Ambiguous`로 유지하고, 내부 구현 차이는 `Changed` 여부를 명시한다.

## 1. Scope

이 문서는 `Juunana Ho`와 `classic`을 `rules`, `flow`, `scoring`, `visibility`, `ui`, `qa` 축으로 다시 점검해, Do 단계에서 무엇을 구현 대상으로 보고 무엇을 별도 variant 차이로 남길지 정리한다.

## 2. Matrix

| itemId | axis | referenceBehavior | internalBehavior | evidence | status | impact | nextAction |
|---|---|---|---|---|---|---|---|
| J-RULE-01 | rules | `Juunana Ho`는 2인 17보 계열이며 `34`패에서 `13`패 텐파이 손을 만들고 나머지를 버림 운용에 사용한다 | `classic`은 `classic_match_start -> classic_dora_select -> classic_hand_build -> classic_turn` 구조로 손 구성 후 턴 공방을 진행한다 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07, mode=`Juunana Ho`, scene=`setup`), `SteamDB patch note` (2025-04-11, scene=`17 Steps event summary`); internal: `docs/prd.yaml:95-99`, `packages/core/src/machine.ts:1092-1116` | Changed | blocker | `classic`을 Juunana parity 구현으로 보지 말고 variant gap으로 유지 |
| J-RULE-02 | rules | Riichi City 쪽은 랜덤 도라 지시패, 첫 버림 리치, `kan` 금지, `ron` 전용, `tsumo` 불가가 명시된다 | 내부 `classic`은 도라 선택 단계가 있고 scoring 엔진은 ron-only PRD를 따르지만 first-discard-riichi, kan 금지, local yaku bundle은 그대로 표현되지 않는다 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07, scene=`rule options`); internal: `docs/prd.yaml:80-88`, `packages/scoring/src/points.ts:64-75`, `apps/web/src/components/GameBoard.tsx:31-38` | Changed | blocker | rules/scoring 분리 backlog 유지 |
| J-FLOW-01 | flow | 공개 설명은 `34`패 배분 -> `13`패 선택 -> 남은 `21`패 discard 흐름 -> 양측 `17`장 소진 시 draw 로 읽힌다 | 내부는 hand build 이후 일반 턴 루프와 round end 확인 게이트로 이어진다 | external: `SteamDB patch note` (2025-04-11), `TuxDB mirror` (2025-04-15), `Riichi.Wiki - Juunana Ho` (2025-07-07); internal: `docs/prd.yaml:95-99`, `packages/core/src/messages.ts:9-12` | Changed | blocker | flow parity 구현보다 variant difference 문서화 우선 |
| J-FLOW-02 | flow | 이벤트 설명만으로는 Riichi City의 round-end confirm CTA, 결과 확인 화면 밀도는 확인되지 않는다 | 내부는 `round_end_gate.requires_all_players_confirm = true`로 전원 확인을 강제한다 | external: `TuxDB mirror` (2025-04-15, scene=`event note only`); internal: `docs/prd.yaml:127-130`, `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:1142-1145` | Ambiguous | major | direct round-end capture 확보 전까지 hold |
| J-SCOR-01 | scoring | Riichi City 구현값은 시작점수 `50000`, `4 hands`, `all East`, `no renchan`, mangan minimum enforced로 정리된다 | Step13 `classic`은 시작점수 `60000`, `4`국, mangan minimum `8000`, 일반 round-end settle 을 따른다 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07, scene=`score settings`); internal: `docs/prd.yaml:80-88`, `packages/scoring/src/points.ts:218-235` | Changed | blocker | D4에 숫자 차이 확정 반영 |
| J-SCOR-02 | scoring | red fives, local yaku, `Tsubame gaeshi`, noten penalty 없음이 Juunana 쪽 특징으로 보인다 | 내부 scoring은 `riichi_han_fu`, omote dora minimum, kiriage mangan, auto fallback 중심이며 local yaku bundle은 없다 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07, scene=`local rules`); internal: `packages/scoring/src/points.ts:35-51`, `docs/prd.yaml:80-88` | Changed | major | scoring compatibility가 아닌 variant divergence로 기록 |
| J-VIS-01 | visibility | spectator mode 존재와 hand-building interface 존재는 보이지만 Juunana viewer별 hidden-field policy는 direct source가 없다 | 서버는 round end 이전 상대 hand/pool/dealt/eventLog seed를 masking한다 | external: Steam store page (checked 2026-03-25, scene=`spectator/game log`), `Riichi.Wiki - Juunana Ho` (UI caption only); internal: `apps/server/src/GameRoom.ts:339-438` | Ambiguous | major | D5에서 attacker/defender/observer 별도 검증 지속 |
| J-VIS-02 | visibility | hand-building phase에서 상대 dealt tiles 공개 범위는 외부 자료로 직접 확인되지 않는다 | `classic`에서는 상대 dealt tiles를 항상 hidden tile count 형태로 보낸다 | external: no direct field capture; internal: `apps/server/src/GameRoom.ts:367-380`, `docs/prd.yaml:206-217` | Ambiguous | major | external capture 없으면 hidden policy를 internal-only로 유지 |
| J-UI-01 | ui | wiki 캡션과 이벤트 공지는 hand-building interface 존재만 보여주며 CTA 배열, 결과 강조, 모바일 배치는 확인하지 못한다 | `GameBoard`는 step headline, phase timeline, pressure badge를 제공한다 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07, scene=`hand-building image`), `SteamDB/TuxDB` event posts; internal: `apps/web/src/components/GameBoard.tsx:27-49`, `apps/web/src/components/GameBoard.tsx:191-215` | Partial | minor | direct capture 없으므로 inferred UI로 유지 |
| J-UI-02 | ui | 결과 화면에서 score delta, confirm CTA, replay 진입이 실제 Riichi City와 같은지는 외부 근거가 없다 | 내부는 round-end summary, confirmed state, replay 진입점을 제공한다 | external: no direct result screen source; internal: `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:1516-1524`, `apps/web/src/App.tsx:2510-2529` | Ambiguous | minor | Do에서는 readability 개선만 수행, parity 확정은 보류 |
| J-QA-01 | qa | `17 Steps` 이벤트 출시/종료 window와 mode naming은 확보되지만 direct capture, timestamped replay evidence는 부족하다 | replay/eventLog 기반 관찰 경로는 존재하나 Juunana 전용 수동 검증 기록은 부족하다 | external: `SteamDB patch note` (2025-04-11), `TuxDB mirror` (2025-04-15); internal: `docs/prd.yaml:219-226`, `apps/web/src/App.tsx:1516-1524` | Partial | major | D7과 연결해 Juunana-specific manual QA gap 유지 |

## 3. Judgment

- `Juunana Ho`와 `classic`은 이름상 17보 계열이어도 parity target이라기보다 `Changed`가 많은 별도 variant다.
- Do 단계에서 이 트랙의 우선 구현은 “Juunana를 완전히 복제”가 아니라 “classic을 Juunana와 혼동하지 않도록 rules/scoring/UX 설명을 분리”하는 쪽이다.
- direct UI / visibility / result-flow capture가 없으므로 `Ambiguous`를 강제로 줄이지 않는다.

## 4. Hard Boundary

| Boundary | Decision |
|----------|----------|
| `classic`을 Juunana parity implementation이라고 부르지 않는다 | adopt |
| Juunana local rule을 shared baseline에 섞어 넣지 않는다 | adopt |
| external direct capture 없이 UI/result parity를 확정하지 않는다 | adopt |
| 신규 Juunana variant proposal은 CTO 결정 전 backlog에만 유지한다 | adopt |

## 5. Evidence Packet Registry

| packetId | covers rows | current evidence | packet status | still missing |
|----------|-------------|------------------|---------------|---------------|
| JP-01 | `J-RULE-01`, `J-RULE-02`, `J-FLOW-01` | `Riichi.Wiki - Juunana Ho` 2025-07-07 + `SteamDB patch note` 2025-04-11 + `TuxDB mirror` 2025-04-15 | strong for divergence | none for variant-difference judgment |
| JP-02 | `J-SCOR-01`, `J-SCOR-02` | `Riichi.Wiki - Juunana Ho` score/local-rule text + internal PRD/scoring anchors | medium | direct result numeric scene, scoreboard capture |
| JP-03 | `J-FLOW-02`, `J-UI-02` | event note only + internal round-end overlay anchors | weak | round-end result, confirm CTA, replay entry direct capture |
| JP-04 | `J-VIS-01`, `J-VIS-02` | spectator existence + UI caption + internal sanitize anchors | weak | spectator/observer same-scene capture, dealt-tile visibility proof |
| JP-05 | `J-UI-01`, `J-QA-01` | hand-building image, event window, replay anchor | medium | mobile layout note, timestamped manual QA note |

읽는 법:

1. `strong for divergence`는 "같지 않다"를 고정하기엔 충분하다는 뜻이다.
2. `weak` packet은 parity 확정이 아니라 hold decision 근거로만 쓴다.
3. Juunana 트랙은 `Changed`를 늘리는 것보다 `Ambiguous`가 왜 남는지 설명하는 packet 품질이 더 중요하다.
