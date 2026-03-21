import { describe, expect, it } from 'vitest';
import { Tile } from '@step13/proto';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { createDefaultEngine } from './defaultEngine';
import { GameContext } from '../messages';

const SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
} as const;

function t(suit: Tile['suit'], rank: number, id: string): Tile {
    return { suit, rank: rank as Tile['rank'], isRed: false, id };
}

function getWinningWaits(hand: Tile[]): Tile[] {
    if (hand.length !== 13) return [];
    const waits: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            if (calculateShanten([...hand, tile]) === -1) {
                waits.push(tile);
            }
        }
    }
    return waits;
}

function isManganTenpai(hand: Tile[], doraIndicators: Tile[]): boolean {
    for (const wait of getWinningWaits(hand)) {
        const score = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
        if (score.points >= 8000) {
            return true;
        }
    }
    return false;
}

function openingShapeSignature(tiles: Tile[]): string {
    const counts = new Map<string, number>();
    const suitCounts: Record<'man' | 'pin' | 'sou', number[]> = {
        man: Array(10).fill(0),
        pin: Array(10).fill(0),
        sou: Array(10).fill(0)
    };
    let honorCount = 0;
    for (const tile of tiles) {
        const key = `${tile.suit}-${tile.rank}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (tile.suit === 'z') {
            honorCount++;
        } else {
            suitCounts[tile.suit][tile.rank] += 1;
        }
    }

    const tripletCount = [...counts.values()].filter((count) => count >= 3).length;
    const pairCount = [...counts.values()].filter((count) => count >= 2).length;
    const suitSpread = (['man', 'pin', 'sou'] as const).filter((suit) => suitCounts[suit].some((count) => count > 0)).length;
    const waitCount = getWinningWaits(tiles).length;

    let sequenceCount = 0;
    for (const suit of ['man', 'pin', 'sou'] as const) {
        const bucket = [...suitCounts[suit]];
        for (let rank = 1; rank <= 7; rank++) {
            while (bucket[rank] > 0 && bucket[rank + 1] > 0 && bucket[rank + 2] > 0) {
                sequenceCount++;
                bucket[rank]--;
                bucket[rank + 1]--;
                bucket[rank + 2]--;
            }
        }
    }

    const waitBucket = waitCount === 0 ? '0' : waitCount === 1 ? '1' : waitCount === 2 ? '2' : '3+';
    return `t${tripletCount}-p${pairCount}-s${sequenceCount}-h${honorCount}-u${suitSpread}-w${waitBucket}`;
}

function buildRonContext(overrides?: Partial<GameContext>): GameContext {
    const p1Hand: Tile[] = [
        t('man', 1, 'm1a'), t('man', 1, 'm1b'), t('man', 1, 'm1c'),
        t('man', 2, 'm2a'), t('man', 2, 'm2b'), t('man', 2, 'm2c'),
        t('man', 3, 'm3a'), t('man', 3, 'm3b'), t('man', 3, 'm3c'),
        t('man', 4, 'm4a'), t('man', 4, 'm4b'), t('man', 4, 'm4c'),
        t('man', 5, 'm5a')
    ];
    const p2Pool = [t('man', 5, 'discard-5m')];

    return {
        players: ['p1', 'p2'],
        scores: { p1: 25000, p2: 25000 },
        currentTurn: 'p1',
        round: 1,
        dealtTiles: { p1: [], p2: [] },
        hands: { p1: p1Hand, p2: [] },
        pools: { p1: [], p2: p2Pool },
        wall: [],
        doraIndicators: [],
        dealerDice: { p1: 6, p2: 3 },
        discards: { p1: [], p2: [] },
        phase: 'TURN',
        step: 'classic_turn',
        winner: null,
        dealer: 'p1',
        winResult: null,
        lastDiscard: { playerId: 'p2', tile: p2Pool[0] },
        eventLog: [],
        matchHandIndex: 0,
        seatMap: { p1: 'EAST', p2: 'WEST' },
        deterministicSeed: 1,
        timeBankRemainingMs: { p1: 15000, p2: 15000 },
        roundEndConfirmedBy: {},
        ruleset: 'classic',
        attackDefense: {
            stage: 'A',
            attacker: null,
            defender: null,
            declaredBy: null,
            declaredWithRiichi: false,
            declarationType: null,
            ownTurns: { p1: 0, p2: 0 },
            guessesRemaining: 0,
            failedGuesses: 0,
            assaultRemaining: 0,
            lockedWaitTileKeys: [],
            lastGuessTileKey: null,
            lastGuessResult: 'idle',
            pendingDrawTile: null,
            kanOption: {
                pending: false,
                tileKey: null
            }
        },
        ...overrides
    };
}

describe('defaultEngine mangan deal constraints', () => {
    it('buildDealResult is deterministic for same seed', { timeout: 20000 }, () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 1,
            handSearchShuffles: 1,
            dealValidationPerPlayerSamples: 1,
            dealValidationDoraSampleSize: 2,
            fallbackSearchAttempts: 120
        });
        const players = ['p1', 'p2'];
        const first = engine.buildDealResult(players, 77);
        const second = engine.buildDealResult(players, 77);

        expect(first).toEqual(second);
    });

    it('buildDealResult gives both players at least one mangan-tenpai possibility', () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 1,
            handSearchShuffles: 1,
            dealValidationPerPlayerSamples: 1,
            dealValidationDoraSampleSize: 2,
            fallbackSearchAttempts: 120
        });
        const players = ['p1', 'p2'];
        const result = engine.buildDealResult(players, 123);

        const doraCandidates = [...new Set(result.wall.map((tile) => `${tile.suit}-${tile.rank}`))]
            .map((key) => {
                const [suit, rank] = key.split('-');
                return { suit: suit as Tile['suit'], rank: Number(rank) as Tile['rank'], isRed: false };
            });

        for (const playerId of players) {
            const dealt = result.dealt[playerId];
            const canReach = doraCandidates.some((indicator) => {
                const picked = engine.findTenpaiHand(dealt, { requireMangan: true, doraIndicators: [indicator] });
                return isManganTenpai(picked.hand, [indicator]);
            });
            expect(canReach).toBe(true);
        }
    });

    it('findTenpaiHand prefers mangan-tenpai when requireMangan is true', () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            handSearchShuffles: 400
        });

        const dealtTiles: Tile[] = [
            t('man', 1, 'm1a'), t('man', 1, 'm1b'), t('man', 1, 'm1c'),
            t('man', 2, 'm2a'), t('man', 2, 'm2b'), t('man', 2, 'm2c'),
            t('man', 3, 'm3a'), t('man', 3, 'm3b'), t('man', 3, 'm3c'),
            t('man', 4, 'm4a'), t('man', 4, 'm4b'), t('man', 4, 'm4c'),
            t('man', 5, 'm5a')
        ];
        expect(dealtTiles).toHaveLength(13);

        const picked = engine.findTenpaiHand(dealtTiles, { requireMangan: true, doraIndicators: [] });
        expect(picked.hand).toHaveLength(13);
        expect(isManganTenpai(picked.hand, [])).toBe(true);
    });

    it('uses randomized fallback deal when validation attempts are exhausted', () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 0,
            handSearchShuffles: 20,
            dealValidationPerPlayerSamples: 1,
            dealValidationDoraSampleSize: 4,
            fallbackSearchAttempts: 120
        });

        const deal = engine.buildDealResult(['p1', 'p2'], 99);
        expect(deal.dealt['p1']).toHaveLength(34);
        expect(deal.dealt['p2']).toHaveLength(34);

        const doraCandidates = [...new Set(deal.wall.map((tile) => `${tile.suit}-${tile.rank}`))]
            .map((key) => {
                const [suit, rank] = key.split('-');
                return { suit: suit as Tile['suit'], rank: Number(rank) as Tile['rank'], isRed: false };
            });

        for (const playerId of ['p1', 'p2']) {
            const dealt = deal.dealt[playerId];
            const canReach = doraCandidates.some((indicator) => {
                const picked = engine.findTenpaiHand(dealt, { requireMangan: true, doraIndicators: [indicator] });
                return isManganTenpai(picked.hand, [indicator]);
            });
            expect(canReach).toBe(true);
        }
    });

    it('fallback keeps low shape repetition over 100 seeds', { timeout: 30000 }, () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 0,
            handSearchShuffles: 1,
            dealValidationPerPlayerSamples: 1,
            dealValidationDoraSampleSize: 1,
            fallbackSearchAttempts: 12,
            fallbackTopK: 20,
            fallbackRandomPickWeight: 0.35
        });
        const players = ['p1', 'p2'];
        const signatureCounts = new Map<string, number>();
        const sampleCount = 100;
        for (let seed = 10; seed < 10 + sampleCount; seed++) {
            const deal = engine.buildDealResult(players, seed);
            const signature = players
                .map((playerId) => openingShapeSignature(deal.dealt[playerId].slice(0, 13)))
                .join('|');
            signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
        }

        const topCount = Math.max(...signatureCounts.values());
        const topShare = topCount / sampleCount;
        const uniqueRatio = signatureCounts.size / sampleCount;
        expect(topShare).toBeLessThanOrEqual(0.2);
        expect(uniqueRatio).toBeGreaterThanOrEqual(0.35);
    });
});

describe('defaultEngine ron and furiten rules', () => {
    it('allows ron when hand is valid and not furiten', () => {
        const engine = createDefaultEngine({ scoreOptions: SCORE_OPTIONS });
        const context = buildRonContext();

        expect(engine.canDeclareRon(context, 'p1')).toBe(true);
    });

    it('blocks ron when player is furiten from own discard', () => {
        const engine = createDefaultEngine({ scoreOptions: SCORE_OPTIONS });
        const context = buildRonContext({
            discards: {
                p1: [t('man', 5, 'p1-discarded-5m')],
                p2: []
            }
        });

        expect(engine.canDeclareRon(context, 'p1')).toBe(false);
    });

    it('auto ron does not trigger for furiten player', () => {
        const engine = createDefaultEngine({ scoreOptions: SCORE_OPTIONS });
        const context = buildRonContext({
            discards: {
                p1: [t('man', 5, 'p1-discarded-5m')],
                p2: []
            }
        });

        expect(engine.autoRonWinner(context)).toBeNull();
    });
});
