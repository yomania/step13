# Score Parity Table

> Feature: `riichi-city-juunana-ten-validation`
> Purpose: Juunana Ho와 ten을 분리해 시작점수, 라운드 구조, 최소타점, settlement, 종료 조건의 확정 범위를 정리한다.
> Rule: external numeric source가 없으면 `Ambiguous` 유지.

## 1. Decision Rule

이 표는 `숫자 차이`를 기록하는 문서이지만, 동시에 `지금 code를 바꿔도 되는가`를 판단하는 문서다.

| Status | Meaning | Code Change Policy |
|--------|---------|-------------------|
| `Match` | external / internal이 충분히 일치 | 유지 |
| `Partial` | 구조는 유사하지만 숫자/정산 증거가 불완전 | 설명/문서만 수정 가능 |
| `Changed` | 차이가 명확 | shared baseline 수정 금지, 필요 시 신규 variant 검토 |
| `Ambiguous` | 외부 numeric proof 부족 | code fix 금지 |

## 2. Table

| itemId | track | item | Riichi City 기준 | Step13 기준 | evidence | status | safe-to-change | impact | nextAction |
|---|---|---|---|---|---|---|---|---|---|
| S-J-01 | Juunana | starting points | `50000` | `60000` | external: `Riichi.Wiki - Juunana Ho` (2025-07-07); internal: `docs/prd.yaml:80-88` | Changed | no | blocker | classic baseline과 분리 유지 |
| S-J-02 | Juunana | hands per match | `4 hands`, all East, no renchan | `4`국 | external: `Riichi.Wiki - Juunana Ho` (2025-07-07); internal: `docs/prd.yaml:80-88` | Changed | no | major | wording 분리 |
| S-J-03 | Juunana | minimum scoring gate | mangan minimum enforced | `mangan_minimum_points = 8000` | external: `Riichi.Wiki - Juunana Ho`; internal: `docs/prd.yaml:82`, `packages/scoring/src/points.ts:218-235` | Partial | no | major | numeric threshold는 내부 8000, 외부는 mangan-minimum만 확인 |
| S-J-04 | Juunana | tsumo / ron | `ron` only, `tsumo` unavailable | scoring 엔진은 ron-only 전제지만 variant 전체는 Juunana local ruleset이 아님 | external: `Riichi.Wiki - Juunana Ho`; internal: `packages/scoring/src/points.ts:71-73` | Changed | no | blocker | rules/scoring 같이 취급 |
| S-J-05 | Juunana | call restrictions | `kan` 금지, 특수 local yaku 존재 | internal classic은 shared scoring options 사용 | external: `Riichi.Wiki - Juunana Ho`; internal: `packages/scoring/src/points.ts:35-51` | Changed | no | major | code parity 대상이 아니라 divergence note |
| S-J-06 | Juunana | noten settlement | no noten penalty | `noten_bappu.enabled = true`, `3000` | external: `Riichi.Wiki - Juunana Ho`; internal: `docs/prd.yaml:84-88` | Changed | no | major | round-end gap 유지 |
| S-J-07 | Juunana | bankrupt / end condition | direct bankrupt threshold numeric source 없음 | `0` threshold-like internal assumption remains | external: no direct source; internal: `docs/prd.yaml` | Ambiguous | no | minor | additional result-screen evidence 필요 |
| S-T-01 | ten | starting points | `10000` | `60000` | external: YouTube gameplay video (checked 2026-03-25, scoreboard scene), `Riichi.Wiki - Two-player rules from Ten` (2026-03-20); internal: `docs/prd.yaml:80-88` | Changed | no | blocker | ten을 classic/shared score baseline과 분리 |
| S-T-02 | ten | round count | `4 rounds` | `4`국 | external: YouTube gameplay video (checked 2026-03-25), `Riichi.Wiki - Two-player rules from Ten`; internal: `docs/prd.yaml:80-88` | Partial | no | major | 구조는 유사하나 naming/settlement 의미 차이 note 유지 |
| S-T-03 | ten | target / match end | `100000` 도달 시 즉시 종료 또는 4라운드 종료 후 고득점 승리 | Step13은 일반 4국 종료 후 leader 판정 | external: YouTube gameplay video (checked 2026-03-25, result summary scene); internal: `packages/core/src/machine.ts:956-969` | Changed | no | blocker | match-end rule 분리 필요 |
| S-T-04 | ten | minimum yaku / declaration | stage A 내 유효 역 텐파이 선언 필요 | internal은 `DECLARE_TENPAI`와 shared scoring engine을 조합한다 | external: `Riichi.Wiki - Two-player rules from Ten`; internal: `packages/core/src/machine.ts:642-688`, `packages/scoring/src/points.ts` | Partial | no | major | declaration rule은 flow로 확정, numeric minimum은 미확정 |
| S-T-05 | ten | settlement model | tsumo-only full-payment style baseline, dealer/honba 증가 설명 존재 | internal은 `riichi_han_fu` 기반 점수 계산 및 round-end score swap | external: `Riichi.Wiki - Two-player rules from Ten`; internal: `packages/scoring/src/points.ts:64-240`, `packages/core/src/machine.ts:712-724` | Partial | no | major | direct result numeric capture 필요 |
| S-T-06 | ten | tobi / bankruptcy | `tobi disabled` | internal PRD shared baseline과 다름 | external: `Riichi.Wiki - Two-player rules from Ten`; internal: `docs/prd.yaml` | Changed | no | major | end-condition difference 유지 |
| S-T-07 | ten | chi/pon/kan | `chii` 허용, assault 중 공격 처리 존재 | internal A단계 chi/pon, assault kan/pass 구현 존재 | external: YouTube gameplay video (checked 2026-03-25), `Riichi.Wiki - Two-player rules from Ten`; internal: `packages/core/src/machine.ts:690-814` | Match | yes | major | 유지 |
| S-T-08 | ten | detailed score table | Riichi City 전용 exact per-result score table은 미확보 | internal numeric behavior는 code 기준으로만 확인 가능 | external: insufficient direct numeric source; internal: `packages/scoring/src/points.ts` | Ambiguous | no | major | result-flow capture 및 external rule text 필요 |

## 3. Safe Change Boundary

1. `yes`가 아닌 row는 설명 강화만 가능하고 code 변경 근거로 쓰지 않는다.
2. `Changed`라도 shared baseline 파일(`packages/core/src/rules.ts`, `packages/scoring/src/points.ts`)은 evidence 없이 수정하지 않는다.
3. `ten`은 flow parity와 score parity를 분리해 읽는다. A/B 흐름이 맞아도 score baseline까지 맞는 것은 아니다.

## 4. Interpretation

- Juunana는 숫자 차이가 명확해 `Changed` 판정이 가능하다.
- ten은 시작점수/라운드/종료 조건은 상당 부분 확인됐지만 detailed settlement table은 아직 확정 근거가 부족하다.
- Do 단계에서 scoring 수정 여부는 ten UI/flow 보정 이후 결정하고, 외부 숫자 근거 없는 변경은 금지한다.

## 5. Numeric Evidence Gap Ledger

| gapId | target rows | what is already proven | what is still missing | allowed action now |
|-------|-------------|------------------------|-----------------------|--------------------|
| NEG-01 | `S-J-03` | Juunana가 mangan minimum을 쓴다는 규칙 설명 | exact threshold numeric scene | wording 유지, code fix 금지 |
| NEG-02 | `S-J-07` | 내부는 bankrupt-like threshold를 가정하고 있음 | Juunana result/end-condition numeric source | ambiguity 유지 |
| NEG-03 | `S-T-02`, `S-T-03` | ten scoreboard/start/result summary note로 구조 차이는 읽힘 | round-end exact scoreboard capture, 100000 도달 장면 | difference note 유지 |
| NEG-04 | `S-T-04`, `S-T-05` | declaration/tsumo-only 구조는 설명됨 | detailed settlement per-result packet | flow 문서만 강화 가능 |
| NEG-05 | `S-T-08` | internal table/code는 존재 | 외부 exact score table 또는 equivalent result packet | scoring baseline 변경 금지 |

packet 완료 기준:

1. `source`
2. `timestamp`
3. `scene`
4. `visible numeric value or explicit rules text`
5. `linked row id`
