import { describe, expect, it } from 'vitest';
import { Tile } from '@step13/proto';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { createDefaultEngine } from './defaultEngine';

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

describe('defaultEngine mangan deal constraints', () => {
    it('buildDealResult is deterministic for same seed', () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 1,
            handSearchShuffles: 1
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
            handSearchShuffles: 1
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

    it('uses guaranteed fallback deal when validation attempts are exhausted', () => {
        const engine = createDefaultEngine({
            scoreOptions: SCORE_OPTIONS,
            dealValidationMaxAttempts: 0
        });

        const deal = engine.buildDealResult(['p1', 'p2'], 99);
        expect(deal.dealt['p1']).toHaveLength(34);
        expect(deal.dealt['p2']).toHaveLength(34);

        const p1Hand = deal.dealt['p1'].slice(0, 13);
        const p2Hand = deal.dealt['p2'].slice(0, 13);
        expect(isManganTenpai(p1Hand, [])).toBe(true);
        expect(isManganTenpai(p2Hand, [])).toBe(true);
    });
});
