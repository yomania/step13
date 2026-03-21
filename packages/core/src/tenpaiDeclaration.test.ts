import { describe, expect, it } from 'vitest';
import { Tile } from '@step13/proto';
import { evaluateTenpaiDeclaration, listTenpaiDeclarationCandidates } from './tenpaiDeclaration';

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

describe('tenpaiDeclaration', () => {
    it('marks a valid declaration tile as declareable', () => {
        const pendingDrawTile: Tile = { suit: 'sou', rank: 9, isRed: false, id: 'draw-9s' };
        const result = evaluateTenpaiDeclaration({
            turnTiles: [...makeTenpaiHandForFiveMan('ok'), pendingDrawTile],
            discardedTiles: [],
            doraIndicators: [],
            ruleset: 'ten_attack_defense',
            seatWind: 'EAST',
            tileId: pendingDrawTile.id
        });

        expect(result.declareable).toBe(true);
        expect(result.rejectReason).toBeNull();
        expect(result.waits).toContain('man-5');
    });

    it('rejects furiten declarations', () => {
        const pendingDrawTile: Tile = { suit: 'sou', rank: 9, isRed: false, id: 'draw-9s' };
        const result = evaluateTenpaiDeclaration({
            turnTiles: [...makeTenpaiHandForFiveMan('furiten'), pendingDrawTile],
            discardedTiles: [{ suit: 'man', rank: 5, isRed: false, id: 'discarded-5m' }],
            doraIndicators: [],
            ruleset: 'ten_attack_defense',
            seatWind: 'EAST',
            tileId: pendingDrawTile.id
        });

        expect(result.declareable).toBe(false);
        expect(result.rejectReason).toBe('furiten');
    });

    it('returns all turn tiles with mixed declaration states', () => {
        const turnTiles = [
            ...makeTenpaiHandForFiveMan('list'),
            { suit: 'sou', rank: 9, isRed: false, id: 'draw-9s' }
        ];

        const candidates = listTenpaiDeclarationCandidates({
            turnTiles,
            discardedTiles: [],
            doraIndicators: [],
            ruleset: 'ten_attack_defense',
            seatWind: 'EAST'
        });

        expect(candidates).toHaveLength(turnTiles.length);
        expect(candidates.some((candidate) => candidate.declareable)).toBe(true);
        expect(candidates.some((candidate) => !candidate.declareable)).toBe(true);
    });
});
