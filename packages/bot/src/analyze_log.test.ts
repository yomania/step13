import { describe, it, expect } from 'vitest';
import { Tile } from '@step13/proto';
import { evaluateHandQuality, Difficulty } from '@step13/scoring';
import { BotLogic } from './logic';

function parseTile(id: string): Tile {
    // Format: "pin1", "z6", "man5"
    const match = id.match(/([a-z]+)(\d+)/);
    if (!match) throw new Error(`Invalid tile id: ${id}`);
    const suit = match[1] as any;
    const rank = parseInt(match[2], 10) as any; // Cast to any to avoid rank range lint
    return { suit, rank, isRed: false };
}

describe('Analyze User Log', () => {
    const playerHandIds = [
        "z7", "z7", "z2", "z2", "z3", "z3",
        "pin2", "pin2", "pin7", "pin7", "pin4", "pin4",
        "z4"
    ];
    const aiHandIds = [
        "sou5", "pin4", "man8", "pin4", "sou5", "sou4",
        "man1", "man1", "pin2", "man9", "man9", "pin2", "sou4"
    ];

    const dealtTileIds = [
        "pin1", "z6", "man5", "sou5", "z4", "z2", "pin4", "man8", "sou2", "z3",
        "man7", "man3", "pin8", "pin4", "sou8", "pin7", "sou5", "sou4", "man1", "man1",
        "z7", "pin7", "pin2", "sou3", "man9", "z7", "man9", "z7", "z3", "pin2",
        "z2", "pin6", "pin5", "sou4"
    ];

    const doraIndicatorIds = ["pin1"];

    it('compares Player Hand (Honitsu) vs AI Hand (Chiitoitsu)', () => {
        const playerHand = playerHandIds.map(parseTile);
        const aiHand = aiHandIds.map(parseTile);

        // Score with HARD difficulty
        const diff: Difficulty = 'HARD';
        const playerScore = evaluateHandQuality(playerHand, diff);
        const aiScore = evaluateHandQuality(aiHand, diff);

        console.log(`Player Score (Honitsu): ${playerScore}`);
        console.log(`AI Score (Mixed): ${aiScore}`);

        expect(playerScore).toBeGreaterThan(aiScore);
    });

    it('finds high-value Honitsu hand from user log using improved search', () => {
        const allDealtTiles = dealtTileIds.map(parseTile);
        const doraIndicators = doraIndicatorIds.map(parseTile);

        // Run search with HARD difficulty
        const candidates = new BotLogic('test').buildBestCandidates(allDealtTiles, [], 8, { seatWind: 'EAST', roundWind: 'EAST' }, 'HARD', 0);

        console.log(`Found ${candidates.length} candidates`);
        candidates.forEach((c, idx) => {
            console.log(`Candidate ${idx}: ${c.score.han} han, ${c.score.points} pts, Yaku: ${c.score.yaku.join(', ')}`);
        });

        // The best candidate should ideally be the Honitsu hand or better
        const best = candidates[0];
        expect(best.score.yaku).toContain('Honitsu');
        expect(best.score.han).toBeGreaterThanOrEqual(6);
    });
});
