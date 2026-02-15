# Step13 System Flow

## 1. Session Flow

```mermaid
sequenceDiagram
    participant C as Client (web)
    participant S as Server (ws room)
    participant M as Core Machine

    C->>S: JOIN
    S->>M: JOIN
    C->>S: START_MATCH
    S->>M: START_MATCH
    M-->>S: UPDATE(matchStart)
    M-->>S: UPDATE(doraSelect)

    alt dealer player
        C->>S: SELECT_DORA
        S->>M: SELECT_DORA
    else timeout
        M->>M: autoSelectDoraIndicator
    end

    M-->>S: UPDATE(handBuild)

    par each player
        C->>S: SUBMIT_HAND
        S->>M: SUBMIT_HAND
    and timeout fallback
        M->>M: autoSubmitMissingHands
    end

    M-->>S: UPDATE(gameLoop)

    loop turn
        C->>S: DISCARD
        S->>M: DISCARD
        M->>M: checkRon/draw
    end

    M-->>S: UPDATE(roundEnd/matchEnd)
```

## 2. AI Match Exit Flow

```mermaid
flowchart TD
    A[AI match running] --> B[User clicks AI match exit]
    B --> C{Destination}
    C -->|Lobby| D[Send RESTART]
    C -->|Restart from hand-build| E[Send RESTART]
    E --> F[Auto JOIN]
    F --> G[Auto ADD_BOT]
    G --> H[Auto START_MATCH]
```

## 3. Hand Build Scoring Preview Flow

1. client selects 13 tiles
2. waits are calculated from shanten (`-1` winning shape)
3. each wait tile is scored via `calculateScore(hand, waitTile, ..., doraIndicators, options)`
4. preview chooses best result by:
   - max `points`
   - tie-breaker: max `han`
5. UI renders
   - `(currentHan / minimumRequiredHan)`
   - point preview
   - wait tiles list

## 4. Timer Domains

- `doraSelectTimeMs`: dealer dora selection timeout
- `buildTimeMs`: hand build timeout
- `turnTimeMs`: per-turn countdown
- `timeBankMs`: per-player turn reserve

Timers are phase-scoped in the machine. Entering/leaving phase rebinds timer behavior.

## 5. Observability

Primary trace sources:

- `context.eventLog` in core snapshots
- server console telemetry (`START_MATCH`, `SUBMIT_HAND`, `DISCARD`, `AUTO_RON`, `ROUND_END`, `GUIDE_VIEW`)
- websocket UPDATE payloads in web console

For debugging, reproduce by replaying `eventLog` via `replayMachine`.
