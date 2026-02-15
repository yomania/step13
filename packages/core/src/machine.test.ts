import { createActor } from 'xstate';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { gameMachine } from './machine';
import { RULES } from './rules';

async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
}

async function reachTurnWithAutoSubmit(actor: ReturnType<typeof createActor<typeof gameMachine>>): Promise<void> {
    await advance(1000);
    expect(actor.getSnapshot().value).toBe('doraSelect');

    const doraSnapshot = actor.getSnapshot();
    const dealer = doraSnapshot.context.dealer;
    const doraTileId = doraSnapshot.context.wall[0]?.id;
    if (dealer && doraTileId) {
        actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId: doraTileId });
    }
    expect(actor.getSnapshot().value).toBe('handBuild');

    await advance(RULES.timers.buildTimeMs);
    expect(actor.getSnapshot().value).toEqual({ gameLoop: 'turn' });
    expect(actor.getSnapshot().context.phase).toBe('TURN');
}

afterEach(() => {
    vi.useRealTimers();
});

describe('gameMachine full cycle and edge cases', () => {
    it('plays all 4 hands and reaches match end', async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 1234 });

        for (let hand = 0; hand < RULES.match.handsPerMatch; hand++) {
            await reachTurnWithAutoSubmit(actor);

            let roundSafety = 0;
            while (actor.getSnapshot().value !== 'roundEnd' && roundSafety < 200) {
                const snapshot = actor.getSnapshot();
                const currentTurn = snapshot.context.currentTurn;
                if (!currentTurn) {
                    break;
                }
                const pool = snapshot.context.pools[currentTurn] ?? [];
                if (pool.length === 0 || !pool[0]?.id) {
                    break;
                }

                actor.send({ type: 'DISCARD', playerId: currentTurn, tileId: pool[0].id });
                roundSafety += 1;
            }

            expect(actor.getSnapshot().value).toBe('roundEnd');
            await advance(1200);
        }

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('matchEnd');
        expect(snapshot.context.phase).toBe('MATCH_END');
        expect(snapshot.context.matchHandIndex).toBe(RULES.match.handsPerMatch);

        const lastEvent = snapshot.context.eventLog[snapshot.context.eventLog.length - 1];
        expect(lastEvent.type).toBe('MATCH_END');
    });

    it('ignores invalid discard attempts (wrong player and unknown tile id)', async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 1 });

        await reachTurnWithAutoSubmit(actor);

        const before = actor.getSnapshot();
        const turnPlayer = before.context.currentTurn!;
        const otherPlayer = before.context.players.find((p) => p !== turnPlayer)!;

        // Wrong player attempts discard
        actor.send({ type: 'DISCARD', playerId: otherPlayer, tileId: (before.context.pools[otherPlayer] ?? [])[0]?.id ?? 'bad' });
        expect(actor.getSnapshot().context.discards[otherPlayer] ?? []).toHaveLength(0);

        // Current player discards an unknown tile id
        actor.send({ type: 'DISCARD', playerId: turnPlayer, tileId: 'does-not-exist' });
        const after = actor.getSnapshot();
        expect(after.context.discards[turnPlayer] ?? []).toHaveLength(0);
        expect(after.context.currentTurn).toBe(turnPlayer);
    });

    it('consumes turn timebank on timeout and logs timeout event', async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 2 });

        await reachTurnWithAutoSubmit(actor);

        const firstTurn = actor.getSnapshot().context.currentTurn!;
        const beforeDiscardCount = (actor.getSnapshot().context.discards[firstTurn] ?? []).length;
        const beforeEventLogLen = actor.getSnapshot().context.eventLog.length;

        await advance(RULES.timers.turnTimeMs);
        expect(actor.getSnapshot().context.timeBankRemainingMs[firstTurn]).toBe(5000);
        expect(actor.getSnapshot().context.currentTurn).toBe(firstTurn);
        const snapshot = actor.getSnapshot();
        expect((snapshot.context.discards[firstTurn] ?? []).length).toBe(beforeDiscardCount);
        expect(snapshot.context.eventLog.length).toBeGreaterThan(beforeEventLogLen);
        expect(snapshot.context.eventLog[snapshot.context.eventLog.length - 1]).toEqual({
            type: 'TIMEOUT',
            playerId: firstTurn,
            phase: 'TURN'
        });
    });
});
