import { createActor } from 'xstate';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Tile } from '@step13/proto';
import { gameMachine, createGameMachine } from './machine';
import { RULES } from './rules';
import { GameEngine } from './engine/types';

async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
}

async function reachTurnWithAutoSubmit(actor: ReturnType<typeof createActor<typeof gameMachine>>): Promise<void> {
    await advance(1000);
    if (actor.getSnapshot().context.ruleset !== 'classic') {
        expect(actor.getSnapshot().value).toEqual({ tenDeclaration: 'turn' });
        expect(actor.getSnapshot().context.phase).toBe('TURN');
        expect(actor.getSnapshot().context.attackDefense.pendingDrawTile).toBeTruthy();
        return;
    }

    expect(actor.getSnapshot().value).toBe('doraSelect');

    const doraSnapshot = actor.getSnapshot();
    const dealer = doraSnapshot.context.dealer;
    if (dealer) {
        actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId: doraSnapshot.context.wall[0]?.id ?? 'fallback-dora' });
    }
    expect(actor.getSnapshot().value).toBe('doraSelect');
    await advance(RULES.timers.doraRevealTimeMs);
    expect(actor.getSnapshot().value).toBe('handBuild');

    await advance(RULES.timers.buildTimeMs);
    expect(actor.getSnapshot().value).toEqual({ gameLoop: 'turn' });
    expect(actor.getSnapshot().context.phase).toBe('TURN');
}

function makeTiles(count: number, prefix: string): Tile[] {
    return Array.from({ length: count }, (_, idx) => ({
        suit: 'man',
        rank: ((idx % 9) + 1) as Tile['rank'],
        isRed: false,
        id: `${prefix}-${idx + 1}`
    }));
}

function makeTenpaiHandForFiveMan(prefix: string): Tile[] {
    return [
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1a` },
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1b` },
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1c` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2a` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2b` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2c` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3a` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3b` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3c` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4a` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4b` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4c` },
        { suit: 'man', rank: 5, isRed: false, id: `${prefix}-m5w` }
    ];
}

function makeTenpaiHandForFivePin(prefix: string): Tile[] {
    return [
        { suit: 'pin', rank: 1, isRed: false, id: `${prefix}-p1a` },
        { suit: 'pin', rank: 1, isRed: false, id: `${prefix}-p1b` },
        { suit: 'pin', rank: 1, isRed: false, id: `${prefix}-p1c` },
        { suit: 'pin', rank: 2, isRed: false, id: `${prefix}-p2a` },
        { suit: 'pin', rank: 2, isRed: false, id: `${prefix}-p2b` },
        { suit: 'pin', rank: 2, isRed: false, id: `${prefix}-p2c` },
        { suit: 'pin', rank: 3, isRed: false, id: `${prefix}-p3a` },
        { suit: 'pin', rank: 3, isRed: false, id: `${prefix}-p3b` },
        { suit: 'pin', rank: 3, isRed: false, id: `${prefix}-p3c` },
        { suit: 'pin', rank: 4, isRed: false, id: `${prefix}-p4a` },
        { suit: 'pin', rank: 4, isRed: false, id: `${prefix}-p4b` },
        { suit: 'pin', rank: 4, isRed: false, id: `${prefix}-p4c` },
        { suit: 'pin', rank: 5, isRed: false, id: `${prefix}-p5w` }
    ];
}

function makePoolWithLeadingTiles(prefix: string, lead: Tile[]): Tile[] {
    const rest = makeTiles(21 - lead.length, `${prefix}-rest`);
    return [...lead, ...rest];
}

afterEach(() => {
    vi.useRealTimers();
});

describe('gameMachine full cycle and edge cases', () => {
    it('allows players to leave the lobby while idle', () => {
        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        expect(actor.getSnapshot().context.players).toEqual(['p1', 'p2']);

        actor.send({ type: 'LEAVE', playerId: 'p2' });

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('idle');
        expect(snapshot.context.players).toEqual(['p1']);
        expect(snapshot.context.eventLog[snapshot.context.eventLog.length - 1]).toEqual({ type: 'LEAVE', playerId: 'p2' });
    });

    it('ignores leave events for players that are not in lobby', () => {
        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'LEAVE', playerId: 'ghost' });

        const snapshot = actor.getSnapshot();
        expect(snapshot.context.players).toEqual(['p1']);
        expect(snapshot.context.eventLog[snapshot.context.eventLog.length - 1]).toEqual({ type: 'JOIN', playerId: 'p1' });
    });

    it('keeps the configured ruleset in idle before match start', () => {
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
        actor.start();

        expect(actor.getSnapshot().value).toBe('idle');
        expect(actor.getSnapshot().context.ruleset).toBe('ten_attack_defense');

        actor.send({ type: 'JOIN', playerId: 'p1' });
        expect(actor.getSnapshot().context.ruleset).toBe('ten_attack_defense');
    });

    it('preserves the configured ruleset after restart', () => {
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense_easy' }));
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'RESTART' });

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('idle');
        expect(snapshot.context.ruleset).toBe('ten_attack_defense_easy');
        expect(snapshot.context.players).toEqual([]);
    });

    it('ends the match when a player leaves during an active match', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 11 });

        await advance(1);
        actor.send({ type: 'LEAVE', playerId: 'p2' });

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('matchEnd');
        expect(snapshot.context.winner).toBe('p1');
        expect(snapshot.context.eventLog[snapshot.context.eventLog.length - 1]).toEqual({ type: 'MATCH_END', winner: 'p1' });
    });

    it('falls back to first wall tile when dealer sends an invalid dora tile id', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 7 });

        await advance(1000);
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('doraSelect');

        const dealer = snapshot.context.dealer;
        const firstWallTile = snapshot.context.wall[0];
        actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId: 'stale-or-missing-id' });

        const afterSelect = actor.getSnapshot();
        expect(afterSelect.value).toBe('doraSelect');
        expect(afterSelect.context.doraIndicators[0]?.id).toBe(firstWallTile?.id);
        await advance(RULES.timers.doraRevealTimeMs);
        expect(actor.getSnapshot().value).toBe('handBuild');
    });

    it('waits dora reveal time before entering handBuild after selecting dora', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 9 });

        await advance(1000);
        expect(actor.getSnapshot().value).toBe('doraSelect');
        const snap = actor.getSnapshot();
        actor.send({ type: 'SELECT_DORA', playerId: snap.context.dealer, tileId: snap.context.wall[0].id! });

        expect(actor.getSnapshot().value).toBe('doraSelect');
        await advance(RULES.timers.doraRevealTimeMs - 1);
        expect(actor.getSnapshot().value).toBe('doraSelect');
        await advance(1);
        expect(actor.getSnapshot().value).toBe('handBuild');
    });

    it('still enters handBuild when dora is selected after initial reveal timer passed', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 19 });

        await advance(1000);
        expect(actor.getSnapshot().value).toBe('doraSelect');

        await advance(RULES.timers.doraRevealTimeMs + 1000);
        expect(actor.getSnapshot().value).toBe('doraSelect');

        const snap = actor.getSnapshot();
        actor.send({ type: 'SELECT_DORA', playerId: snap.context.dealer, tileId: snap.context.wall[0].id! });
        expect(actor.getSnapshot().value).toBe('doraSelect');

        await advance(RULES.timers.doraRevealTimeMs - 1);
        expect(actor.getSnapshot().value).toBe('doraSelect');
        await advance(1);
        expect(actor.getSnapshot().value).toBe('handBuild');
    });

    it('plays all 4 hands and reaches match end', { timeout: 20000 }, async () => {
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
            const players = actor.getSnapshot().context.players;
            players.forEach((playerId) => actor.send({ type: 'CONFIRM_ROUND_END', playerId }));
        }

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('matchEnd');
        expect(snapshot.context.phase).toBe('MATCH_END');
        expect(snapshot.context.matchHandIndex).toBe(RULES.match.handsPerMatch);

        const lastEvent = snapshot.context.eventLog[snapshot.context.eventLog.length - 1];
        expect(lastEvent.type).toBe('MATCH_END');
    });

    it('ignores invalid discard attempts (wrong player and unknown tile id)', { timeout: 20000 }, async () => {
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

    it('consumes turn timebank on timeout and logs timeout event', { timeout: 20000 }, async () => {
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
        expect(actor.getSnapshot().context.timeBankRemainingMs[firstTurn]).toBe(0);
        expect(actor.getSnapshot().context.currentTurn).toBe(firstTurn);
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toEqual({ gameLoop: 'turnOvertime' });
        expect((snapshot.context.discards[firstTurn] ?? []).length).toBe(beforeDiscardCount);
        expect(snapshot.context.eventLog.length).toBeGreaterThan(beforeEventLogLen);
        expect(snapshot.context.eventLog[snapshot.context.eventLog.length - 1]).toEqual({
            type: 'TIMEOUT',
            playerId: firstTurn,
            phase: 'TURN'
        });
    });

    it('auto-submits hand on build timeout', { timeout: 10000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 3 });

        // Advance to Hand Build
        await advance(1100); // matchStart -> doraSelect
        const doraSnap = actor.getSnapshot();
        const dealer = doraSnap.context.dealer;
        const tileId = doraSnap.context.wall[0]?.id;
        if (dealer && tileId) {
            actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId });
        }
        await advance(RULES.timers.doraRevealTimeMs);
        expect(actor.getSnapshot().value).toBe('handBuild');

        // Wait for build timeout
        await advance(RULES.timers.buildTimeMs);

        // Should have moved to gameLoop (turn)
        expect(actor.getSnapshot().value).toEqual({ gameLoop: 'turn' });

        // Context should have hands populated
        expect(actor.getSnapshot().context.hands['p1']).toBeDefined();
        expect(actor.getSnapshot().context.hands['p2']).toBeDefined();

        // Log should contain TIMEOUT and SUBMIT_HAND events
        const log = actor.getSnapshot().context.eventLog;
        const p1Timeout = log.find(e => e.type === 'TIMEOUT' && e.playerId === 'p1' && e.phase === 'HAND_BUILD');
        const p2Timeout = log.find(e => e.type === 'TIMEOUT' && e.playerId === 'p2' && e.phase === 'HAND_BUILD');
        expect(p1Timeout).toBeDefined();
        expect(p2Timeout).toBeDefined();
    });

    it('blocks next hand until both players confirm round end', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 11 });

        await reachTurnWithAutoSubmit(actor);

        let safety = 0;
        while (actor.getSnapshot().value !== 'roundEnd' && safety < 200) {
            const s = actor.getSnapshot();
            const playerId = s.context.currentTurn!;
            const tileId = s.context.pools[playerId]?.[0]?.id;
            if (!tileId) break;
            actor.send({ type: 'DISCARD', playerId, tileId });
            safety += 1;
        }

        expect(actor.getSnapshot().value).toBe('roundEnd');
        await advance(5000);
        expect(actor.getSnapshot().value).toBe('roundEnd');

        actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p1' });
        expect(actor.getSnapshot().value).toBe('roundEnd');
        actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p2' });
        expect(actor.getSnapshot().value).toBe('matchStart');
    });

    it('auto-confirms bot on round end and advances when human confirms', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'bot-1' });
        actor.send({ type: 'START_MATCH', seed: 13 });

        await reachTurnWithAutoSubmit(actor);

        let safety = 0;
        while (actor.getSnapshot().value !== 'roundEnd' && safety < 200) {
            const s = actor.getSnapshot();
            const playerId = s.context.currentTurn!;
            const tileId = s.context.pools[playerId]?.[0]?.id;
            if (!tileId) break;
            actor.send({ type: 'DISCARD', playerId, tileId });
            safety += 1;
        }

        const roundEnd = actor.getSnapshot();
        expect(roundEnd.value).toBe('roundEnd');
        expect(roundEnd.context.roundEndConfirmedBy['bot-1']).toBe(true);
        expect(roundEnd.context.roundEndConfirmedBy['p1']).not.toBe(true);

        actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p1' });
        expect(actor.getSnapshot().value).toBe('matchStart');
    });

    it('ends match early when a player score drops to 0 or below', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const dealtP1 = makeTiles(34, 'p1-dealt');
        const dealtP2 = makeTiles(34, 'p2-dealt');
        const wall = makeTiles(20, 'wall');
        const p1Pool = makeTiles(21, 'p1-pool');
        const p2Pool = makeTiles(21, 'p2-pool');

        const mockEngine: GameEngine = {
            buildDealResult: () => ({ dealt: { p1: dealtP1, p2: dealtP2 }, wall }),
            selectDealer: () => ({
                dealer: 'p1',
                dealerDice: { p1: 6, p2: 1 },
                seatMap: { p1: 'EAST', p2: 'WEST' }
            }),
            getEastPlayer: () => 'p1',
            hasWinningWait: () => true,
            findTenpaiHand: () => ({ hand: makeTiles(13, 'auto-hand'), pool: makeTiles(21, 'auto-pool') }),
            canSelectDora: () => true,
            selectDora: (context, event) => ({
                wall: context.wall,
                doraIndicators: [context.wall.find((tile) => tile.id === event.tileId) ?? context.wall[0]],
                eventLog: [...context.eventLog, event]
            }),
            autoSelectDora: (context) => ({
                wall: context.wall,
                doraIndicators: [context.wall[0]],
                eventLog: [...context.eventLog, { type: 'TIMEOUT', playerId: 'p1', phase: 'DORA_SELECT' }, { type: 'SELECT_DORA', playerId: 'p1', tileId: context.wall[0]?.id ?? '' }]
            }),
            canDiscard: (context, playerId, tileId) => Boolean((context.pools[playerId] ?? []).find((tile) => tile.id === tileId)),
            applyDiscard: (context, playerId, tileId) => {
                const pool = context.pools[playerId] ?? [];
                const tile = pool.find((entry) => entry.id === tileId);
                if (!tile) return context;
                const nextPlayer = context.players.find((id) => id !== playerId) ?? null;
                return {
                    ...context,
                    pools: {
                        ...context.pools,
                        [playerId]: pool.filter((entry) => entry.id !== tileId)
                    },
                    discards: {
                        ...context.discards,
                        [playerId]: [...(context.discards[playerId] ?? []), tile]
                    },
                    currentTurn: nextPlayer,
                    lastDiscard: { playerId, tile },
                    eventLog: [...context.eventLog, { type: 'DISCARD', playerId, tileId }]
                };
            },
            isDrawReached: () => false,
            autoRonWinner: () => null,
            canDeclareRon: () => true,
            resolveRon: (context, winnerId) => {
                const loserId = context.players.find((id) => id !== winnerId);
                if (!loserId) return null;
                return {
                    winner: winnerId,
                    winResult: {
                        han: 13,
                        fu: 0,
                        points: 70000,
                        yaku: ['Yakuman'],
                        doraCount: 0,
                        isMangan: true,
                        pointsDelta: 70000,
                        limit: 'Yakuman',
                        limitCategory: 'Yakuman'
                    },
                    scores: {
                        ...context.scores,
                        [winnerId]: (context.scores[winnerId] ?? 0) + 70000,
                        [loserId]: (context.scores[loserId] ?? 0) - 70000
                    }
                };
            },
            resolveDraw: (context) => ({ winner: null, winResult: null, scores: context.scores })
        };

        const actor = createActor(createGameMachine({ engine: mockEngine }));
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 101 });

        await advance(1000);
        actor.send({ type: 'SELECT_DORA', playerId: 'p1', tileId: wall[0].id! });
        await advance(RULES.timers.doraRevealTimeMs);

        actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: makeTiles(13, 'p1-hand'), pool: p1Pool });
        actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: makeTiles(13, 'p2-hand'), pool: p2Pool });
        expect(actor.getSnapshot().value).toEqual({ gameLoop: 'turn' });

        actor.send({ type: 'DISCARD', playerId: 'p1', tileId: p1Pool[0].id! });
        actor.send({ type: 'DECLARE_WIN', playerId: 'p2' });
        expect(actor.getSnapshot().value).toBe('roundEnd');
        expect(actor.getSnapshot().context.scores['p1']).toBeLessThanOrEqual(0);

        actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p1' });
        actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p2' });

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toBe('matchEnd');
        expect(snapshot.context.phase).toBe('MATCH_END');
        expect(snapshot.context.winner).toBe('p2');
    });

    it('blocks manual and auto ron when winner is furiten by prior self-discard', { timeout: 20000 }, async () => {
        vi.useFakeTimers();

        const actor = createActor(gameMachine);
        actor.start();

        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 31 });

        await advance(1000);
        expect(actor.getSnapshot().value).toBe('doraSelect');
        const doraSnap = actor.getSnapshot();
        actor.send({ type: 'SELECT_DORA', playerId: doraSnap.context.dealer, tileId: doraSnap.context.wall[0]?.id ?? 'fallback-dora' });
        await advance(RULES.timers.doraRevealTimeMs);
        expect(actor.getSnapshot().value).toBe('handBuild');

        const p1Hand = makeTenpaiHandForFiveMan('p1');
        const p2Hand = makeTenpaiHandForFivePin('p2');
        const p1Pool = makePoolWithLeadingTiles('p1-pool', [{ suit: 'man', rank: 5, isRed: false, id: 'p1-discard-5m' }]);
        const p2Pool = makePoolWithLeadingTiles('p2-pool', [
            { suit: 'pin', rank: 1, isRed: false, id: 'p2-first-discard' },
            { suit: 'man', rank: 5, isRed: false, id: 'p2-discard-5m' }
        ]);

        actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1Hand, pool: p1Pool });
        actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2Hand, pool: p2Pool });
        expect(actor.getSnapshot().value).toEqual({ gameLoop: 'turn' });

        const firstTurn = actor.getSnapshot().context.currentTurn;
        if (firstTurn === 'p1') {
            actor.send({ type: 'DISCARD', playerId: 'p1', tileId: 'p1-discard-5m' });
            actor.send({ type: 'DISCARD', playerId: 'p2', tileId: 'p2-discard-5m' });
        } else {
            actor.send({ type: 'DISCARD', playerId: 'p2', tileId: 'p2-first-discard' });
            actor.send({ type: 'DISCARD', playerId: 'p1', tileId: 'p1-discard-5m' });
            actor.send({ type: 'DISCARD', playerId: 'p2', tileId: 'p2-discard-5m' });
        }

        const afterDangerDiscard = actor.getSnapshot();
        expect(afterDangerDiscard.value).toEqual({ gameLoop: 'turn' });
        expect(afterDangerDiscard.context.lastDiscard?.playerId).toBe('p2');
        expect(afterDangerDiscard.context.lastDiscard?.tile.id).toBe('p2-discard-5m');

        actor.send({ type: 'DECLARE_WIN', playerId: 'p1' });
        const afterDeclare = actor.getSnapshot();
        expect(afterDeclare.value).toEqual({ gameLoop: 'turn' });
        expect(afterDeclare.context.winner).toBeNull();
    });
});

describe('ten_attack_defense ruleset', () => {
    it('allows Stage A manual discard of a selected hand tile after draw', { timeout: 20000 }, async () => {
        vi.useFakeTimers();
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 41 });
        await reachTurnWithAutoSubmit(actor as any);

        const current = actor.getSnapshot().context.currentTurn!;
        const opponent = actor.getSnapshot().context.players.find((id) => id !== current)!;
        const originalHand = makeTenpaiHandForFiveMan('stage-a');
        const selectedDiscardId = originalHand[0].id!;
        const drawnTile: Tile = { suit: 'sou', rank: 9, isRed: false, id: 'stage-a-draw' };
        actor.getSnapshot().context.hands[current] = originalHand;
        actor.getSnapshot().context.attackDefense.pendingDrawTile = drawnTile;

        actor.send({ type: 'DISCARD', playerId: current, tileId: selectedDiscardId });

        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toEqual({ tenDeclaration: 'turn' });
        expect(snapshot.context.currentTurn).toBe(opponent);
        expect(snapshot.context.lastDiscard?.playerId).toBe(current);
        expect(snapshot.context.lastDiscard?.tile.id).toBe(selectedDiscardId);
        expect(snapshot.context.discards[current]?.at(-1)?.id).toBe(selectedDiscardId);
        expect(snapshot.context.hands[current]).toHaveLength(RULES.ten.initialHandSize);
        expect(snapshot.context.hands[current]?.some((tile) => tile.id === selectedDiscardId)).toBe(false);
        expect(snapshot.context.hands[current]?.some((tile) => tile.id === drawnTile.id)).toBe(true);
        expect(snapshot.context.attackDefense.pendingDrawTile?.id).not.toBe(drawnTile.id);
    });

    it('transitions to Stage B guess after valid declaration', { timeout: 20000 }, async () => {
        vi.useFakeTimers();
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 42 });
        await reachTurnWithAutoSubmit(actor as any);

        const current = actor.getSnapshot().context.currentTurn!;
        actor.getSnapshot().context.hands[current] = makeTenpaiHandForFiveMan('atk');
        actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'atk-draw' };
        actor.send({ type: 'DECLARE_TENPAI', playerId: current, tileId: 'atk-draw', withRiichi: true });

        const snapshot = actor.getSnapshot();
        expect(snapshot.context.attackDefense.stage).toBe('B_GUESS');
        expect(snapshot.context.attackDefense.attacker).toBe(current);
        expect(snapshot.context.attackDefense.guessesRemaining).toBe(2);
    });

    it('easy mode rejects riichi declaration flag', { timeout: 20000 }, async () => {
        vi.useFakeTimers();
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense_easy' }));
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 55 });
        await reachTurnWithAutoSubmit(actor as any);

        const current = actor.getSnapshot().context.currentTurn!;
        actor.getSnapshot().context.hands[current] = makeTenpaiHandForFiveMan('easy');
        actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'easy-draw' };
        actor.send({ type: 'DECLARE_TENPAI', playerId: current, tileId: 'easy-draw', withRiichi: true });
        expect(actor.getSnapshot().context.attackDefense.stage).toBe('A');
    });

    it('defender wins on correct guess', { timeout: 20000 }, async () => {
        vi.useFakeTimers();
        const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
        actor.start();
        actor.send({ type: 'JOIN', playerId: 'p1' });
        actor.send({ type: 'JOIN', playerId: 'p2' });
        actor.send({ type: 'START_MATCH', seed: 90 });
        await reachTurnWithAutoSubmit(actor as any);

        const attacker = actor.getSnapshot().context.currentTurn!;
        actor.getSnapshot().context.hands[attacker] = makeTenpaiHandForFiveMan('g');
        actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'g-draw' };
        actor.send({ type: 'DECLARE_TENPAI', playerId: attacker, tileId: 'g-draw' });
        const defender = actor.getSnapshot().context.attackDefense.defender!;
        actor.send({ type: 'DEFENDER_GUESS', playerId: defender, tileKey: 'man-5' });
        expect(actor.getSnapshot().value).toBe('roundEnd');
        expect(actor.getSnapshot().context.winner).toBe(defender);
        expect(actor.getSnapshot().context.winResult).toBeNull();
    });
});
