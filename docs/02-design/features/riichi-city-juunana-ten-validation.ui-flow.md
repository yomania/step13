# UI Flow Map: riichi-city-juunana-ten-validation

## 1. Purpose

이 문서는 step별 현재 화면 책임, CTA, Do 단계 수정 대상 파일을 바로 역추적할 수 있게 정리한다. 기준은 "어느 컴포넌트를 건드려야 하는가"다.

## 2. Step Map

| flowId | stepGroup | required UI outcome | current anchor | implementation implication |
|---|---|---|---|---|
| F-01 | `classic_match_start` | ruleset, match start, round 문맥이 즉시 보여야 한다 | `apps/web/src/components/GameBoard.tsx:7-25,186-246` | ruleset badge/label을 Juunana parity가 아닌 classic track으로 명확화 |
| F-02 | `classic_dora_select` | 선택 가능 여부와 reveal 문맥이 분명해야 한다 | `apps/web/src/App.tsx:985-1014`, `apps/web/src/components/GameBoard.tsx:31-38` | `App.tsx`가 reveal timing, `GameBoard.tsx`가 headline 담당 |
| F-03 | `classic_hand_build` | hand build 진행/남은 시간/제출 CTA가 보여야 한다 | `apps/web/src/App.tsx:959-983`, `apps/web/src/components/GameBoard.tsx:33-35` | classic 준비 UI는 App 상태와 Board headline 정합성 점검 필요 |
| F-04 | `classic_turn` | 턴 주체, ron/discard 압박, 남은 discard 맥락을 보여야 한다 | `apps/web/src/components/GameBoard.tsx:56-70,199-215`, `apps/web/src/App.tsx:1186-1213` | classic turn CTA는 GameBoard pressure + App ron query 흐름으로 분리 |
| F-05 | `classic_round_end` | 결과 요약, confirm CTA, replay 진입점이 보여야 한다 | `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:1142-1145`, `apps/web/src/App.tsx:1516-1524`, `apps/web/src/App.tsx:2510-2529` | App.tsx가 결과/확인/replay 책임을 더 명시해야 함 |
| F-06 | `ten_match_start` | ten ruleset 진입과 역할 배정 시작이 즉시 읽혀야 한다 | `apps/web/src/components/GameBoard.tsx:39-49,185-233` | GameBoard ruleset badge와 ten mode label 유지 |
| F-07 | `ten_a_turn` | 공격/수비 role, 남은 턴, 선언 가능 상태, chi/pon call flow가 한 시야에 있어야 한다 | `apps/web/src/components/AttackDefensePanels.tsx:87-173`, `apps/web/src/components/GameBoard.tsx:72-103` | `AttackDefensePanels.tsx`가 Stage A CTA 주 책임 |
| F-08 | `ten_b_guess` | guess 후보, 남은 시도, 실패 히스토리, 확정 CTA가 한 패널에 있어야 한다 | `apps/web/src/components/AttackDefensePanels.tsx:175-179`, `apps/web/src/components/AttackDefensePanels.tsx:251-320` | direct Do 대상 1순위 |
| F-09 | `ten_b_assault` | 남은 공격 횟수, pending draw, 현재 진행도, 피드백이 보여야 한다 | `apps/web/src/components/AttackDefensePanels.tsx:180-249`, `apps/web/src/components/GameBoard.tsx:83-103` | assault progress/result readability 강화 대상 |
| F-10 | `ten_round_end` | guess 성공/실패, assault 결과, confirm/replay 경로가 결과 화면에서 이어져야 한다 | `apps/web/src/App.tsx:896-915`, `apps/web/src/App.tsx:1142-1145`, `apps/web/src/App.tsx:1516-1524`, `apps/web/src/App.tsx:2510-2529` | App.tsx round-end overlay 재정리 필요 |

## 3. File Responsibility

### 3.1 `apps/web/src/App.tsx`

- round-end summary, confirm gate, replay 진입, action dispatch를 책임진다.
- Do 단계에서 바꿔야 할 것:
  - `classic_round_end` / `ten_round_end`의 결과 흐름 문맥을 더 명시적으로 분리
  - confirm CTA와 replay CTA가 결과 정보와 시각적으로 묶이게 정리
  - mobile 폭에서도 결과 카드와 버튼이 겹치지 않는지 재검증

### 3.2 `apps/web/src/components/GameBoard.tsx`

- ruleset badge, phase timeline, pressure label, turn headline을 책임진다.
- Do 단계에서 바꿔야 할 것:
  - Juunana/classic 혼동을 줄이는 wording 정리
  - ten pressure 문구와 assault 상태 문구를 D3/D5 terminology에 맞춤
  - result 단계 진입 시 board headline과 App overlay가 충돌하지 않게 조정

### 3.3 `apps/web/src/components/AttackDefensePanels.tsx`

- ten 전용 A/B stage UX의 중심이다.
- Do 단계에서 바꿔야 할 것:
  - Stage A 선언/call 흐름의 CTA 우선순위 정리
  - Guess 후보/선택/실패 피드백의 시선 경로 개선
  - Assault progress와 pending draw/result feedback 연결 강화

### 3.4 `apps/server/src/GameRoom.ts`

- viewer별 숨김 정책을 책임진다.
- Do 단계에서 바꿔야 할 것:
  - defender guessCandidates 주입 조건과 attacker/observer masking 계약을 문서와 맞춤
  - `pendingDrawTile`, `lockedWaitTileKeys`, eventLog seed/dealt sanitization이 D5 wording과 일치하는지 확인

## 4. Immediate Do Traceback

| Need | Primary file | Secondary file |
|------|--------------|----------------|
| ten guess/assault 전달력 강화 | `apps/web/src/components/AttackDefensePanels.tsx` | `apps/web/src/components/GameBoard.tsx` |
| round-end 결과/confirm/replay 정리 | `apps/web/src/App.tsx` | `apps/web/src/components/GameBoard.tsx` |
| viewer masking 문서-코드 정합성 | `apps/server/src/GameRoom.ts` | `docs/02-design/features/riichi-city-juunana-ten-validation.visibility-matrix.md` |
| Juunana/classic wording 분리 | `apps/web/src/components/GameBoard.tsx` | `docs/02-design/features/riichi-city-juunana-ten-validation.juunana-matrix.md` |

## 5. UX Acceptance Checklist

각 step은 “예쁘다”가 아니라 “오독 없이 행동을 유도한다”를 기준으로 검토한다.

| flowId | must-be-visible | must-be-actionable | common failure signature |
|--------|------------------|--------------------|--------------------------|
| F-04 `classic_turn` | 현재 턴 주체, 남은 버림 맥락, ron 가능 여부 | discard 또는 ron 선택 | headline과 실제 CTA가 따로 놀아 턴 주체를 오인 |
| F-05 `classic_round_end` | 결과 요약, 점수 변화, 확인 상태 | confirm 후 다음 라운드 기대 행동 | overlay 정보는 많지만 다음 행동이 약함 |
| F-07 `ten_a_turn` | 공격/수비 role, 선언 가능 상태, call flow | declare / chi / pon / discard | call panel이 있어도 우선 CTA가 불분명 |
| F-08 `ten_b_guess` | 선택 중인 패, 남은 추측 횟수, 실패 기록 | guess 선택 후 확정 | 선택과 확정의 시선 경로가 분리돼 hesitation 발생 |
| F-09 `ten_b_assault` | 남은 공격 횟수, pending draw, 진행도 | discard / kan / pass | pending draw와 결과 피드백의 연결이 약함 |
| F-10 `ten_round_end` | 성공/실패 원인, score/result, replay 진입 | confirm / replay | 결과는 보이지만 다음 행동의 우선순위가 약함 |

## 6. Mobile and Narrow-Width Gate

`<= 430px` 환경에서 아래가 깨지면 UI acceptance를 통과하지 못한다.

| gateId | screen | failure condition | owner |
|--------|--------|-------------------|-------|
| M-01 | `ten_b_guess` | 선택 정보 박스와 확정 버튼이 겹치거나 줄바꿈으로 의미가 깨짐 | UX |
| M-02 | `ten_b_assault` | pending draw 카드와 남은 공격 요약이 한 시야에 안 들어옴 | UX |
| M-03 | `classic_round_end` / `ten_round_end` | 결과 카드와 confirm/replay CTA가 세로 스크롤 하단으로 밀림 | UX |
| M-04 | `GameBoard` 상단 헤더 | ruleset badge, round, bank 정보가 2행 이상으로 깨져 가독성 하락 | UX |

## 7. Review Questions

1. 각 step에서 사용자가 3초 내에 “지금 누구 턴이고 무엇을 해야 하는지” 읽을 수 있는가.
2. `App.tsx`와 `GameBoard.tsx`가 같은 정보를 중복 강조해 충돌하지 않는가.
3. `AttackDefensePanels.tsx`의 Stage B 패널은 선택, 피드백, 확정이 하나의 시선 경로로 이어지는가.
4. 결과 화면은 정보 열람이 아니라 다음 행동 유도를 중심으로 설계돼 있는가.
