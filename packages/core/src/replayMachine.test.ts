
import { createActor } from 'xstate';
import { replayMachine } from './replayMachine';
import { gameMachine } from './machine';
import { GameEvents } from './messages';
import { RULES } from './rules';
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
    vi.useRealTimers();
});

describe('replayMachine', () => {
    it('should load events and reproduce the final state', async () => {
        // 1. Play a short game to generate events
        const gameActor = createActor(gameMachine);
        gameActor.start();

        const player1 = 'p1';
        const player2 = 'p2';

        gameActor.send({ type: 'JOIN', playerId: player1 });
        gameActor.send({ type: 'JOIN', playerId: player2 });
        gameActor.send({ type: 'START_MATCH' });

        // Wait for state transition if async, but gameMachine is mostly synchronous logic in tests
        // except strict timing. However, START_MATCH -> matchStart -> (after 1000) -> handBuild
        // We might need to fake timer or just force state?
        // Let's manually construct events to be safe and deterministic for this test

        const events: GameEvents[] = [
            { type: 'JOIN', playerId: player1 },
            { type: 'JOIN', playerId: player2 },
            { type: 'START_MATCH' }, // This generates tiles!
            // We need to capture the *actual* events handled by the machine to get the generated tiles
        ];

        // Actually, the gameMachine *stores* the eventLog with the generated tiles!
        // So we can extract the log from the context.

        // Let's run the game machine properly
        const snapshot1 = gameActor.getSnapshot();
        // Since START_MATCH uses 'assign' to log, it should be in context.eventLog

        // Check if logs are there
        // The machine transition for START_MATCH is guarded by players.length === 2

        // We need to wait for the machine to process. XState actors are immediate for sync events.

        const finalContext = gameActor.getSnapshot().context;
        const loggedEvents = finalContext.eventLog;

        expect(loggedEvents.length).toBeGreaterThan(0);
        expect(loggedEvents[0].type).toBe('JOIN');

        // 2. Load these events into Replay Machine
        const replayActor = createActor(replayMachine);
        replayActor.start();

        replayActor.send({ type: 'LOAD_LOG', events: loggedEvents });

        const replaySnapshot = replayActor.getSnapshot();
        const replayContext = replaySnapshot.context;

        // 3. Verify
        expect(replayContext.totalEvents.length).toBe(loggedEvents.length);
        expect(replayContext.snapshots.length).toBeGreaterThan(0);

        // The last snapshot in replay should match the final context of the game (mostly)
        const lastReplaySnapshot = replayContext.snapshots[replayContext.snapshots.length - 1];

        // Compare specific fields (players, phase, etc)
        expect(lastReplaySnapshot.players).toEqual(finalContext.players);
        expect(lastReplaySnapshot.phase).toEqual(finalContext.phase);

        // Verify START_MATCH contained tiles
        const startEvent = loggedEvents.find(e => e.type === 'START_MATCH');
        expect(startEvent).toBeDefined();
        if (startEvent && startEvent.type === 'START_MATCH') {
            expect(startEvent.dealtTiles).toBeDefined();
        }
    });

    it('should navigate through steps', () => {
        const replayActor = createActor(replayMachine);
        replayActor.start();

        const dummyEvents: GameEvents[] = [
            { type: 'JOIN', playerId: 'p1' },
            { type: 'JOIN', playerId: 'p2' }
        ];

        replayActor.send({ type: 'LOAD_LOG', events: dummyEvents });

        expect(replayActor.getSnapshot().context.currentIndex).toBe(0);

        replayActor.send({ type: 'NEXT' });
        expect(replayActor.getSnapshot().context.currentIndex).toBe(1);

        replayActor.send({ type: 'PREV' });
        expect(replayActor.getSnapshot().context.currentIndex).toBe(0);
    });

    it('replays delayed transitions before applying next logged event', async () => {
        vi.useFakeTimers();

        const gameActor = createActor(gameMachine);
        gameActor.start();
        gameActor.send({ type: 'JOIN', playerId: 'p1' });
        gameActor.send({ type: 'JOIN', playerId: 'p2' });
        gameActor.send({ type: 'START_MATCH', seed: 77 });

        await vi.advanceTimersByTimeAsync(1000);
        const doraSnapshot = gameActor.getSnapshot();
        expect(doraSnapshot.value).toBe('doraSelect');

        const dealer = doraSnapshot.context.dealer;
        const doraTileId = doraSnapshot.context.wall[0]?.id;
        expect(doraTileId).toBeDefined();
        gameActor.send({ type: 'SELECT_DORA', playerId: dealer, tileId: doraTileId! });

        await vi.advanceTimersByTimeAsync(RULES.timers.doraRevealTimeMs);
        expect(gameActor.getSnapshot().value).toBe('handBuild');

        const loggedEvents = gameActor.getSnapshot().context.eventLog;
        gameActor.stop();

        const replayActor = createActor(replayMachine);
        replayActor.start();
        replayActor.send({ type: 'LOAD_LOG', events: loggedEvents });

        const replayContext = replayActor.getSnapshot().context;
        const lastSnapshot = replayContext.snapshots[replayContext.snapshots.length - 1];
        expect(lastSnapshot.doraIndicators.length).toBe(1);
        expect(lastSnapshot.phase).toBe('ROUND_START');
    });
});
