# Ten Comparison Matrix

> Feature: `riichi-city-juunana-ten-validation`
> Track: Riichi City `ten` vs Step13 `ten_attack_defense`
> Rule: A/B 단계 parity는 최대한 `Match`까지 올리되, direct UI / visibility / numeric result evidence가 없는 항목은 `Partial` 또는 `Ambiguous`로 남긴다.

## 1. Scope

이 문서는 `ten`의 A/B 단계, guess/assault contract, result-flow, visibility, UI 전달력을 `ten_attack_defense`와 비교한다. 핵심은 `Match 가능한 항목`과 `근거 부족으로 아직 확정하지 못한 항목`을 분리하는 것이다.

## 2. Matrix

| itemId | axis | referenceBehavior | internalBehavior | evidence | status | impact | nextAction |
|---|---|---|---|---|---|---|---|
| T-FLOW-01 | flow | Riichi City `ten`은 Akagi & Ten collab의 `2P Attack-Defense Battles`로 공개됐고 round는 stage A/B로 나뉜다 | `ten_match_start -> ten_a_turn -> ten_b_guess -> ten_b_assault -> ten_round_end`가 코드와 PRD에 명시돼 있다 | external: official Steam announcement (2025-03-13 / 2025-03-14, scene=`mode naming`), `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`A/B stages`); internal: `docs/prd.yaml:100-105`, `packages/core/src/messages.ts:15-17` | Match | major | 유지 |
| T-FLOW-02 | flow | stage A는 `18th turn` 이전 텐파이 선언 시 attacker가 되고 stage B로 진입한다 | `DECLARE_TENPAI` 처리 시 attacker/defender 결정 후 `ten_b_guess`로 전이한다 | external: `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`Stage A declaration`); internal: `packages/core/src/machine.ts:642-688` | Match | major | 유지 |
| T-FLOW-03 | flow | stage A에서 `chii` 허용과 공격자 중심 조패 흐름이 존재한다 | `CALL_CHI`, `CALL_PON`, `PASS_DECLARATION` 분기가 존재하며 A단계 panel에서 call flow를 노출한다 | external: YouTube gameplay video (checked 2026-03-25, scene=`Stage A hand building / calls`), `Riichi.Wiki - Two-player rules from Ten`; internal: `apps/server/src/GameRoom.ts:34`, `apps/web/src/components/AttackDefensePanels.tsx:122-173` | Match | major | 유지 |
| T-FLOW-04 | flow | stage B는 defender가 먼저 wait를 추측하고 최대 `2 attempts` 실패 후 attacker assault로 넘어간다 | defender guess hit/miss, `guessesRemaining`, failed count, assault 전이가 구현돼 있다 | external: `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`defender first / 2 attempts`); internal: `packages/core/src/machine.ts:704-759`, `packages/core/src/machine.test.ts` | Match | major | 유지 |
| T-FLOW-05 | flow | 공격자는 stage B assault에서 최대 `5`회 draw/discard 하며 hit/draw/wall depletion 중 하나로 종료된다 | `assaultRemaining`, pending draw, draw 종료, hit 종료, timeout discard가 구현돼 있다 | external: `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`5 assault turns`), YouTube gameplay video (checked 2026-03-25, scene=`assault pacing`); internal: `packages/core/src/machine.ts:815-884` | Match | major | easy mode timeout regression만 별도 보정 |
| T-FLOW-06 | flow | `18`턴 이내 아무도 선언하지 못하면 no-ten draw로 다음 라운드로 간다 | PRD는 `after_18_a_turns_each_without_declaration` draw 조건을 가진다 | external: YouTube gameplay video (checked 2026-03-25, scene=`no declaration -> draw`); internal: `docs/prd.yaml:84-88`, `packages/core/src/machine.ts` | Match | major | 유지 |
| T-VIS-01 | visibility | defender는 stage B에서 guess UI와 남은 시도 수를 반드시 본다 | defender view에서만 `guessCandidates`를 sanitize state에 주입한다 | external: `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`guess phase`); internal: `apps/server/src/GameRoom.ts:317-323`, `apps/web/src/components/AttackDefensePanels.tsx:251-320` | Match | major | screen capture 보강 시 confidence 상향 |
| T-VIS-02 | visibility | attacker의 locked wait는 defender/observer에게 비공개여야 한다 | attacker 외 viewer에겐 `lockedWaitTileKeys = []`로 masking한다 | external: mechanics inference from wait-guess game structure, confidence=`medium`; internal: `apps/server/src/GameRoom.ts:429-435`, `packages/core/src/messages.ts:62-67` | Partial | major | direct external field evidence 없음 |
| T-VIS-03 | visibility | pending draw는 attacker 진행의 일부지만 타일 실물 공개 범위는 외부 자료가 부족하다 | currentTurn이 아닌 viewer에겐 `pendingDrawTile`을 hidden tile로 보낸다 | external: no direct field capture; internal: `apps/server/src/GameRoom.ts:360-364`, `apps/web/src/lib/ten-attack-defense.ts:73-74,254-255` | Ambiguous | major | timecoded capture 필요 |
| T-UI-01 | ui | stage A는 mode label, 선언 가능 상태, 남은 턴, call flow를 한 화면에서 읽혀야 한다 | 상단 mode/stage/남은 턴 카드와 call panel이 분리되어 있다 | external: YouTube gameplay video (checked 2026-03-25, scene=`Stage A HUD`); internal: `apps/web/src/components/AttackDefensePanels.tsx:87-173`, `apps/web/src/components/GameBoard.tsx:39-47` | Partial | minor | direct comparative screenshot 부재 |
| T-UI-02 | ui | stage B guess는 guess 후보, 실패 기록, 선택 CTA가 한 시야권에 있어야 한다 | 선택 상태, 남은 횟수, 확정 CTA, 후보 카탈로그를 한 패널에 배치한다 | external: YouTube gameplay video (checked 2026-03-25, scene=`guess UI`), `Riichi.Wiki - Two-player rules from Ten`; internal: `apps/web/src/components/AttackDefensePanels.tsx:251-320` | Match | minor | 유지 |
| T-UI-03 | ui | assault는 남은 공격 횟수, 현재 draw 상태, 결과 피드백이 읽혀야 한다 | assault summary, pending draw, progress bar, feedback overlay가 있다 | external: `Riichi.Wiki - Two-player rules from Ten`, YouTube gameplay video (checked 2026-03-25, scene=`assault UI/result`); internal: `apps/web/src/components/AttackDefensePanels.tsx:180-249`, `apps/web/src/components/GameBoard.tsx:83-103` | Partial | minor | round-end/result capture 추가 필요 |
| T-SCOR-01 | scoring | 공개 근거상 ten은 시작점수 `10000`, 총 `4`라운드, 목표 `100000`, `tobi disabled`, permanent East baseline을 가진다 | Step13 baseline은 시작점수 `60000`, 4국, mangan minimum `8000`이다 | external: YouTube gameplay video (checked 2026-03-25, scene=`scoreboard/start`), `Riichi.Wiki - Two-player rules from Ten` (2026-03-20); internal: `docs/prd.yaml:80-88` | Changed | blocker | D4에서 숫자 차이 확정 반영 |
| T-SCOR-02 | scoring | full-payment/settlement baseline은 설명되지만 Riichi City 전용 detailed score table 수치까지는 아직 부족하다 | 내부는 `riichi_han_fu` scoring 엔진을 사용한다 | external: `Riichi.Wiki - Two-player rules from Ten` (2026-03-20, scene=`tsumo-only settlement`); internal: `packages/scoring/src/points.ts:64-240` | Partial | major | numeric result capture 전까지 hold |
| T-QA-01 | qa | event window와 gameplay anchor는 확보됐고 A/B flow는 external reference와 대응된다 | unit test / replay 기반 재현은 가능하나 mobile width, round-end capture, e2e는 부족하다 | external: Steam announcement (2025-03-13/14), YouTube gameplay video (checked 2026-03-25); internal: `packages/core/src/replayMachine.test.ts:175-196`, `docs/02-design/features/riichi-city-juunana-ten-validation.qa-checklist.md` | Partial | major | D7과 연결 |

## 3. Judgment

- `ten` 핵심 A/B flow는 Do 재진입에 충분할 만큼 `Match`가 많다.
- 남아 있는 주요 불확실성은 direct UI capture, visibility field timing, detailed score table, round-end numeric proof다.
- 따라서 Do 단계는 `ten` UI/UX 개선과 runtime contract 보정으로 진행할 수 있다.

## 4. Flow vs Score Boundary

| Area | Current Judgment | What It Means |
|------|------------------|---------------|
| A/B flow | strong | state machine / UI 흐름 개선은 바로 진행 가능 |
| visibility timing | medium | sanitize wording 보강은 가능하지만 공개 범위 변경은 보류 |
| score baseline | weak | score numeric/code baseline 변경 금지 |
| result numeric proof | weak | capture/timecode 확보 전 문서 판단 유지 |

## 5. Evidence Packet Registry

| packetId | covers rows | current evidence | packet status | still missing |
|----------|-------------|------------------|---------------|---------------|
| TP-01 | `T-FLOW-01`~`T-FLOW-06` | Steam announcement 2025-03-13/14, `Riichi.Wiki - Two-player rules from Ten` 2026-03-20, YouTube gameplay checked 2026-03-25 | strong for flow | round-end scene timecode 정리 |
| TP-02 | `T-VIS-01`, `T-VIS-02`, `T-VIS-03` | rules text + internal sanitize anchors | medium | observer/pending draw same-scene direct capture |
| TP-03 | `T-UI-01`, `T-UI-02`, `T-UI-03` | gameplay HUD note + internal panel anchors | medium | comparative screenshot, result/feedback scene packet |
| TP-04 | `T-SCOR-01`, `T-SCOR-02` | scoreboard/start note + rules text + internal scoring anchors | medium-low | detailed settlement scene, exact result numeric packet |
| TP-05 | `T-QA-01` | announcement window + replay test anchor + D7 snapshot | medium | mobile width note, round-end capture, e2e unblock evidence |

보강 규칙:

1. `TP-01`이 strong이라고 해서 `TP-04`까지 strong이 되는 것은 아니다.
2. UI packet이 약하면 flow `Match`는 유지하되 release-quality parity는 보류한다.
3. timecode를 확보하면 `TP-02`~`TP-04`의 confidence를 올릴 수 있지만, 숫자 근거가 없으면 scoring row는 그대로 `Partial` 또는 `Ambiguous`다.
