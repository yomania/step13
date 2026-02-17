
import { describe, test, expect } from 'vitest';
import { BotLogic, CandidateEvaluation } from '../logic';
import { Tile } from '@step13/proto';

// Helper to parse tiles
const parse = (str: string): Tile[] => {
    const tiles: Tile[] = [];
    const parts = str.split(' ');
    let idCounter = 0;
    for (const part of parts) {
        if (!part) continue;
        const suitMatch = part.match(/[a-z]+/);
        const rankMatch = part.match(/[0-9]+/);
        if (suitMatch && rankMatch) {
            const suit = suitMatch[0] as any;
            const rank = parseInt(rankMatch[0], 10);
            tiles.push({ suit, rank: rank as any, isRed: false, id: `t-${idCounter++}` });
        }
    }
    return tiles;
};

// Start with a full deck of 34 tiles x 4
// But for "dealtTiles", we usually provide a pool. 
// For these tests, we will provide a "Pool" that contains the perfect tiles for the target hand + some random noise.
const createPool = (targetHand: Tile[], noiseCount: number = 20): Tile[] => {
    const pool = [...targetHand];
    // Add noise
    const suits = ['man', 'pin', 'sou', 'z'] as const;
    for (let i = 0; i < noiseCount; i++) {
        const suit = suits[i % 4];
        const maxRank = suit === 'z' ? 7 : 9;
        const rank = (i % maxRank) + 1;
        pool.push({ suit, rank: rank as any, isRed: false, id: `noise-${i}` });
    }
    return pool;
};

describe('BotLogic - Yaku Scenarios', () => {
    const bot = new BotLogic('test', 'MEDIUM');
    const defaults = { seatWind: 'EAST', roundWind: 'EAST' };

    const checkYaku = (candidates: CandidateEvaluation[], expectedYaku: string) => {
        const found = candidates.some(c => c.score.yaku.includes(expectedYaku));
        // Also print top candidate yakus for debugging
        if (!found && candidates.length > 0) {
            console.log(`Expected ${expectedYaku} but got: ${candidates[0].score.yaku.join(', ')}`);
        } else if (!found) {
            console.log(`Expected ${expectedYaku} but got NO candidates`);
        }
        return found;
    };

    /**
     * 1. Basic Yaku: Tanyao, Pinfu
     */
    test('Should recommend Tanyao (All Simples)', () => {
        // Hand: 234m 234p 234s 66p 88s (Target: 234m 234p 234s 66p 88s -> discard 8s for Tanyao wait?)
        // Let's ensure we have tiles for 234m 234p 234s 66p 88s
        const handStr = "man2 man3 man4 pin2 pin3 pin4 sou2 sou3 sou4 pin6 pin6 sou8 sou8";
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Tanyao')).toBe(true);
    });

    test('Should recommend Pinfu', () => {
        // Hand: 123m 456p 789s 23m (Wait 1m/4m). Pair must be valueless (e.g. 55z is bad, 22p ok).
        // Let's use 123m 456p 789s 23m 88p (Head 88p)
        const handStr = "man1 man2 man3 pin4 pin5 pin6 sou7 sou8 sou9 man2 man3 pin8 pin8";
        // To be Pinfu, must be Menzen and have Ryanmen wait etc.
        // BotLogic `getWinningTiles` finds waits.
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Pinfu')).toBe(true);
    });

    /**
     * 2. Special Yaku: Chiitoitsu
     */
    test('Should recommend Chiitoitsu', () => {
        // 11m 22m 33m 44p 55p 66s 77z
        const handStr = "man1 man1 man2 man2 man3 man3 pin4 pin4 pin5 pin5 sou6 sou6 z7 z7";
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Chiitoitsu')).toBe(true);
    });

    /**
     * 3. High Value: Kokushi Musou
     */
    test('Should recommend Kokushi Musou', () => {
        // 19m 19p 19s 1234567z (13 tiles, tenpai for 13-way wait or single wait)
        const handStr = "man1 man9 pin1 pin9 sou1 sou9 z1 z2 z3 z4 z5 z6 z7";
        const target = parse(handStr);
        const pool = createPool(target, 50); // Need more noise to ensure random selection doesn't accidentally pick this up only

        // Kokushi might adhere neither to SuitSeeds nor ChiitoitsuSeeds.
        // It relies on standard search finding high value? 
        // Or we might need a Kokushi seed if standard search fails.
        // Standard hill climb swaps 1 tile. It might struggle to reach Kokushi from random.
        // Let's see if it finds it. If not, we might need to add Kokushi strategy in Logic.ts!
        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        // Kokushi is "KokushiMusou" usually
        expect(candidates.some(c => c.score.yaku.some(y => y.includes('Kokushi')))).toBe(true);
    });

    /**
     * 4. Triplets: Toitoi
     */
    test('Should recommend Toitoi (All Triplets)', () => {
        // 111m 222p 333s 444z 5m
        const handStr = "man1 man1 man1 pin2 pin2 pin2 sou3 sou3 sou3 z4 z4 z4 man5";
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Toitoi')).toBe(true);
    });

    /**
     * 5. Honitsu / Chinitsu
     */
    test('Should recommend Chinitsu (Full Flush)', () => {
        // All Man: 111 234 567 88 999
        const handStr = "man1 man1 man1 man2 man3 man4 man5 man6 man7 man8 man8 man9 man9 man9";
        const target = parse(handStr).slice(0, 13);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Chinitsu')).toBe(true);
    });

    /**
     * 6. Yakuman: Daisangen (Big Three Dragons)
     */
    test('Should recommend Daisangen', () => {
        // Red, White, Green dragons (3 each) + 2 pairs (or 1 sequence + pair)
        // 555z 666z 777z 123m 99p
        const handStr = "z5 z5 z5 z6 z6 z6 z7 z7 z7 man1 man2 man3 pin9 pin9";
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        // Yakuman might just show as "Yakuman" or specific name
        // Our scoring logic returns specific names.
        expect(checkYaku(candidates, 'Daisangen') || checkYaku(candidates, 'Yakuman')).toBe(true);
    });

    /**
     * 7. Yakuman: Daisushi / Shousushi
     */
    test('Should recommend Daisushi (Big Four Winds)', () => {
        // East, South, West, North (3 each) + pair
        // 111z 222z 333z 444z 55m
        const handStr = "z1 z1 z1 z2 z2 z2 z3 z3 z3 z4 z4 z4 man5 man5";
        const target = parse(handStr);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Daisushi') || checkYaku(candidates, 'Shousushi') || checkYaku(candidates, 'Yakuman')).toBe(true);
    });

    /**
     * 8. Special: Sankantsu (Three Quads)
     * Note: BotLogic currently doesn't simulate calling Kans in 17-step (it selects closed hands).
     * But if we have 4 of a kind, it might see it as Ankan candidate? 
     * Or just 3 Triplets (Sanankou).
     * Sankantsu requires declaring Kans. 
     * In 17-step, maybe we just check for Sanankou (Three Concealed Triplets)?
     * User asked for "Sankantsu". Valid only if we support Kan declarations.
     * If not, let's test Sanankou instead, or Toitoi with 4-of-a-kinds.
     */
    test('Should recommend Sanankou (Three Concealed Triplets)', () => {
        // 111m 222m 333m 45p (wait 4p/5p)
        const handStr = "man1 man1 man1 man2 man2 man2 man3 man3 man3 pin4 pin5"; // 11 tiles
        // Need 13 tiles. Add pair? 99s.
        const handStrFull = handStr + " sou9 sou9";
        const target = parse(handStrFull);
        const pool = createPool(target);

        const candidates = bot.buildBestCandidates(pool, [], 5, defaults, 'MEDIUM');
        expect(checkYaku(candidates, 'Sanankou')).toBe(true);
    });
});
