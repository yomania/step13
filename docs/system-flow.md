# Step13 시스템 흐름 (System Flow)

기준일: `2026-03-20`

## 1. 매치 수명주기

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> matchStart: START_MATCH classic
    idle --> tenMatchStart: START_MATCH ten
    matchStart --> doraSelect: 1000ms
    doraSelect --> handBuild: dora selected + 3000ms reveal
    doraSelect --> doraSelect: 15000ms timeout -> auto select
    handBuild --> gameLoop: all SUBMIT_HAND
    handBuild --> gameLoop: 120000ms timeout -> auto submit
    gameLoop --> roundEnd: classic RON or DRAW
    tenMatchStart --> tenDeclaration: 1000ms
    tenDeclaration --> tenDefenseGuess: DECLARE_TENPAI
    tenDefenseGuess --> roundEnd: correct guess
    tenDefenseGuess --> tenAssault: guess fail x2
    tenAssault --> roundEnd: assault end / hit / draw
    roundEnd --> matchStart: all CONFIRM_ROUND_END and hands remain
    roundEnd --> tenMatchStart: all CONFIRM_ROUND_END and ten hands remain
    roundEnd --> matchEnd: all CONFIRM_ROUND_END and no next hand / bankrupt
    matchEnd --> [*]
```

## 2. 상세 이벤트 시퀀스

```mermaid
sequenceDiagram
    participant C as Client(Web)
    participant A as Auth API
    participant S as Ruleset Server
    participant M as core machine

    C->>A: POST /auth/login
    A-->>C: access+refresh
    C->>A: POST /auth/ws-ticket
    A-->>C: ws ticket(30s, one-time)
    C->>C: ruleset 선택 (classic / ten / easy)
    C->>S: WS connect ?ticket=...&roomId=... on selected ruleset endpoint
    C->>S: JOIN (playerId 없음, roomId는 ws 쿼리로 선택)
    C->>S: START_MATCH
    S->>M: START_MATCH
    M-->>S: UPDATE(matchStart -> doraSelect)

    alt dealer selects dora
        C->>S: SELECT_DORA
        S->>M: SELECT_DORA
    else timeout
        M->>M: autoSelectDora
    end

    M-->>S: UPDATE(handBuild)

    par each player submit
        C->>S: SUBMIT_HAND
        S->>M: SUBMIT_HAND
    and timeout fallback
        M->>M: autoSubmitMissingHands
    end

    M-->>S: UPDATE(gameLoop)

    loop turn
        C->>S: DISCARD
        S->>M: DISCARD
        M->>M: checkRon / draw / next turn
    end

    M-->>S: UPDATE(roundEnd)
    C->>S: CONFIRM_ROUND_END
    S->>M: CONFIRM_ROUND_END
```

## 3. 타이머 도메인 (실제 코드 값)

- `matchStart -> doraSelect`: `1000ms`
- `doraSelectTimeMs`: `15000ms`
- `doraRevealTimeMs`: `3000ms`
- `buildTimeMs`: `120000ms`
- `turnTimeMs`: `10000ms`
- `timeBankMs`: `3000ms`

턴 타임아웃 규칙:

1. `turnTimeMs` 만료
2. 현재 턴 플레이어 타임뱅크가 남아 있으면 `turnOvertime` 진입
3. `timeBankMs` 만료 시 강제 `DISCARD`

## 4. 라운드 종료 게이트

라운드는 즉시 다음 핸드로 넘어가지 않으며, `roundEndConfirmedBy`가 모든 플레이어에 대해 `true`가 되어야 전이한다.

- 사람 플레이어: `CONFIRM_ROUND_END` 필요
- 봇 플레이어: `roundEnd` 진입 시 자동 확인

전이 조건:

- 전원 확인 + 파산(`<= 0`) 발생 -> `matchEnd`
- 전원 확인 + 핸드 남음 -> `matchStart`
- 전원 확인 + 핸드 없음 -> `matchEnd`

## 5. 분석 질의(Query) 흐름

### 5.1 일반 분석

1. 웹이 `QUERY_ANALYSIS` 전송 (`queryId` 포함)
2. 서버가 질의 타입별 계산
3. 서버가 `ANALYSIS_RESULT` 응답 (`queryId` 그대로)
4. 웹은 현재 대기 중인 `queryId`와 일치할 때만 반영

주요 질의 타입:

- `SHANTEN`
- `SCORE`
- `SCORE_PREVIEW`
- `AI_HINT`
- `MINI_GAME_EVAL`

### 5.2 상관관계 키 규칙

- 요청마다 새 `queryId` 생성
- UI 상태는 `queryId` 매칭으로만 갱신
- 매칭 실패 응답은 반드시 무시

관련 코드:

- `apps/web/src/components/HandBuilder.tsx`
- `apps/web/src/components/SingleMiniGame.tsx`
- `apps/web/src/App.tsx`
- `apps/server/src/GameRoom.ts`

## 5.5 인증/토큰 갱신 흐름

1. access 만료 또는 401 수신
2. 웹이 `POST /auth/refresh` 호출
3. 서버가 refresh rotation 후 새 토큰 발급
4. 웹은 새 refresh를 저장하고 이후 요청/소켓 티켓 발급에 재사용

## 5.6 비밀번호 초기화 + 임시 비밀번호 로그인 흐름 (클라이언트 입력 포함)

1. 운영자가 비밀번호 초기화 서비스 호출 (엔드포인트는 추후 어드민에서 연결)
2. 서버는 임시 비밀번호를 발급하고, 해당 유저의 refresh token을 모두 폐기
3. 사용자는 임시 비밀번호로 로그인
4. 클라이언트는 "임시 비밀번호 로그인" 상태를 감지하면 신규 비밀번호 입력 UI를 표시
5. 사용자가 신규 비밀번호를 입력하고 저장 요청
6. 서버는 비밀번호를 갱신하고, 기존 refresh token을 재폐기한 뒤 새 세션을 발급

주의:
- 4~6 단계는 차후 전용 엔드포인트 구현이 필요 (현재는 서비스만 존재)
- 클라이언트는 신규 비밀번호 저장 완료 전까지 주요 기능 접근을 제한

## 6. AI 대전 종료/재시작 흐름

`App.tsx`에서 AI 대전 중 종료 메뉴 제공:

- 로비로 이동: `RESTART` 전송 후 idle
- 조패부터 재시작: `RESTART` 후 자동 시퀀스
  - `JOIN` -> `ADD_BOT` -> `START_MATCH`

## 7. 리플레이 흐름

- 데이터 소스: `context.eventLog`
- 재생기: `packages/core/src/replayMachine.ts`
- 지연 전이(`after`)도 재생 시계로 선반영하여 상태를 재구성

웹 리플레이 화면:

- `apps/web/src/components/ReplayViewer.tsx`
- 현재 스냅샷 기준 위험패/대안 패를 계산해 가이드 오버레이 제공

## 8. 운영 리스크 체크포인트

- refresh token은 재사용 시 거부되어야 함(rotation)
- ws ticket은 단일 사용 + 짧은 TTL을 유지해야 함
- 비동기 질의 응답은 `queryId`로 반드시 상관관계 매칭
- `dealtTiles`/라운드 변경 시 UI 상태 초기화는 실제 데이터 시그니처 변화로만 수행
- 소켓/타이머 구독은 effect cleanup 보장

## 8.5 매치 중 이탈 처리

- 매치 진행 중 `LEAVE` 발생 시 즉시 `matchEnd`로 전환
- 남은 플레이어가 1명인 경우 해당 플레이어를 승자로 기록

## 9. 룸 생성 흐름

- 룸 생성: `POST /rooms` -> `roomId` 반환
- 룸 접속: `ws://.../ws?ticket=...&roomId=...` (비기본 룸은 사전 생성 필요)
- 웹은 `ruleset` URL 쿼리와 selected endpoint를 함께 유지하며, 현재 선택된 ruleset 서버의 룸만 조회한다
- 룸 목록 응답에는 `ruleset`이 포함되며, 웹은 이를 배지/현재 룸 정보에 그대로 사용한다
