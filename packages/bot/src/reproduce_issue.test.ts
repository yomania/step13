
import { describe, it, expect } from 'vitest';
import { BotLogic } from './logic';
import { Tile } from '../../proto/src';
import { GameContext } from '../../core/src';

// Helper to create tile
function createTile(str: string): Tile {
    const suitMap: Record<string, 'man' | 'pin' | 'sou' | 'z'> = { m: 'man', p: 'pin', s: 'sou', z: 'z' };
    const suitChar = str.slice(-1);
    const suit = suitMap[suitChar];
    const rank = parseInt(str.slice(0, -1), 10);
    return { suit, rank, isRed: false };
}

// Helper to parse hand string "1m 2m 3m"
function parseHand(str: string): Tile[] {
    return str.split(' ').map(createTile);
}

function tileToString(t: Tile | null): string {
    if (!t) return 'null';
    const suitMap: Record<string, string> = { man: 'm', pin: 'p', sou: 's', z: 'z' };
    return `${t.rank}${suitMap[t.suit]}`;
}

describe('Bot Logic Reproduction', () => {
    const bot = new BotLogic('test-player');
    const mockContext: GameContext = {
        id: 'test',
        players: {},
        wall: [],
        deadWall: [],
        doras: [],
        doraIndicators: [],
        discards: {},
        turn: 0,
        scores: {},
        round: 0,
        honba: 0,
        riichiSticks: 0,
        state: 'playing',
    } as any;

    it('Scenario 1: Tenpai check (Basic)', () => {
        // Hand: 123m 456m 789m 11p 4s 6s 9s
        // Should discard 9s to be Tenpai (waiting for 5s)
        const hand = parseHand("1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 1p 4s 6s 9s");
        const discard = bot.getBestDiscard(hand, mockContext);
        console.log(`[Scenario 1] Discarded: ${tileToString(discard)}`);
        expect(tileToString(discard)).toBe('9s');
    });

    it('Scenario 2: Simple efficiency (Isolated tile)', () => {
        // Hand: 123m 123p 123s 89p 89s 5z
        // Should discard 5z.
        const hand = parseHand("1m 2m 3m 1p 2p 3p 1s 2s 3s 8p 9p 8s 9s 5z");
        const discard = bot.getBestDiscard(hand, mockContext);
        console.log(`[Scenario 2] Discarded: ${tileToString(discard)}`);
        expect(tileToString(discard)).toBe('5z');
    });

    it('Scenario 3: Honitsu vs Chiitoitsu (User Report)', () => {
        // Approximating user's hand from screenshot 2
        // Hand: 3x Green, 2x West, 234s, 234s... and some pairs.
        // Let's construct a hand that is definitely Honitsu but looks like Chiitoitsu to a dumb bot.
        // 5 Pairs: West, West, Green, Green, 2s, 2s, 5s, 5s. + 6s, 8m (Iso).
        // 11 tiles. + 3 tiles.
        // Let's use:
        // West West
        // Green Green
        // 2s 2s
        // 5s 5s
        // 8s 8s
        // 1p (Iso, non-souzu) -> Discard 1p.
        // 9s (Iso, souzu) -> Keep 9s.

        // If we have 5 pairs, Shanten for Chiitoitsu is 1.
        // If we discard 1p, we are 1-shanten for Chiitoitsu.
        // What about Honitsu?
        // We have West(2), Green(2), 2s(2), 5s(2), 8s(2), 9s(1).
        // Pairs are also sets (Pon).
        // 1p is the only non-Honitsu tile.
        // Everyone (Bot and Person) should discard 1p.

        // Let's make it harder.
        // We have 4 pairs. 1-shanten for Chiitoitsu? No 4 pairs is 2-shanten.
        // Hand:
        // West West Green Green (Honors)
        // 1s 1s 4s 5s 7s 8s (Souzu)
        // 1p 9p (Pinzu, Iso)
        // Total 14 tiles.
        // Pairs: West, Green, 1s. (3 pairs).
        // Discard 1p or 9p.

        // AI currently optimizes strict Shanten/Ukeire.
        // If discard 1p: Shanten for Honitsu improves?
        // If discard 1s (breaking pair): simple efficiency might be higher?

        // Let's reproduce the exact conflict.
        // User had: Green(3), West(2), 2s,3s,4s, 2s,3s,4s ...
        // That's a completed hand (almost).
        // AI saw Chiitoitsu.
        // This implies the AI saw many pairs.
        // Maybe the user hand was:
        // Green Green Green
        // 2s 2s
        // 3s 3s
        // 4s 4s
        // West West
        // 9m 9m (Wait, 9m in Honitsu? No)

        // If there were 9m pairs, it's NOT Honitsu.
        // Ah, the 2nd screenshot shows "AI Results -> Chiitoitsu". 
        // "AI Predicted Hand": 9m 9m, 2p 2p, 5p 5p... 
        // This means the AI *Constructed* a Chiitoitsu hand from the start?
        // Or the AI suggested a discard *long ago* that would have led to Chiitoitsu?
        // "AI Expected Max Score" usually means "Given the current hand, what is the best path?"

        // If the current hand has 9m pair, 2p pair, 5p pair... then it is NOT a Souzu Honitsu hand.
        // So the Player Hand and AI Hand in the screenshot are TOTALLY DIFFERENT?
        // "My Result" vs "AI Expected..."
        // This screen (Result Analysis) shows "What you did" vs "What AI would have done".
        // But they start from the *same* dealt hand? Or is it evaluating *turn by turn*?
        // Usually these analyzers check "Did you make the efficient cut?"
        // If "AI Expected Hand" is completely different (different suits), it implies the AI took a different path *very early*.

        // Let's assume the starting hand (or an intermediate hand) had:
        // Pairs of 9m, 2p, 5p... AND potential for Honitsu?
        // Unlikely to have both.
        // Maybe the user *forced* Honitsu from a bad start, got lucky/skilled, and got Baiman.
        // The AI looked at the distribution and said "Chiitoitsu is faster/safer".
        // And the AI result (Mangan) < Player Result (Baiman).
        // BUT, usually AI should aim for max EV (Score * Probability).

        // Let's search for a case where preserving Yaku (Honitsu/Sanshoku) > Ukeire.

        // Case: Sanshoku Potential (123)
        // Hand: 123m 123p 12s 3s 88z 5m 6p (14 tiles)
        // Sets: 123m, 123p. Pair: 88z.
        // Incomplete: 12s 3s (need 3s for 123s sanshoku).
        // 5m, 6p (Iso/useless).
        // Discard 5m or 6p.
        // Keeping 1s 2s 3s is vital.
        // What if we have 1s 2s and draw 4s?
        // Hand: 123m 123p 1s 2s 4s 88z 5m 9p
        // Discard 9p.
        // AI should value 1s 2s (Penchan) HIGHLY because it completes Sanshoku.
        // Normal tile efficiency: 1s 2s (Penchan) is worse than 4s 5s (Ryanmen) or even 3s 5s (Kanchan)?
        // If AI discards 1s or 2s here, it fails Sanshoku.

        const handSanshoku = parseHand("1m 2m 3m 1p 2p 3p 1s 2s 8s 9s 5z 5z 8p 9p");
        // Sets: 123m, 123p. Pair: 5z.
        // Candidates: 1s 2s (Penchan for Sanshoku), 8s 9s (Penchan), 8p 9p (Penchan).
        // All are Penchan.
        // ukeire is valid for 3s, 7s, 7p.
        // 1s 2s waits for 3s. (Completes 123s -> Sanshoku).
        // 8s 9s waits for 7s. (No yaku).
        // 8p 9p waits for 7p. (No yaku).
        // AI should discard 8s, 9s, 8p, or 9p.
        // AI MUST NOT discard 1s or 2s.

        const discardS = bot.getBestDiscard(handSanshoku, mockContext);
        console.log(`[Scenario 3 - Sanshoku] Discarded: ${tileToString(discardS)}`);

        // If AI discards 1s or 2s, IT FAILS.
        expect(['8s', '9s', '8p', '9p']).toContain(tileToString(discardS));
    });

    it('Scenario 4: Chanta Potential', () => {
        // Chanta: Terminal/Honor in every set.
        // Hand: 123m 789m 123p 789p 11s 45s.
        // 4 sets + pair.
        // 123m (OK), 789m (OK), 123p (OK), 789p (OK).
        // 11s (Pair).
        // 45s (Ryanmen).
        // We have 4 sets already. 45s is 5th set candidate.
        // But 45s forms 456s or 345s -> NOT Chanta.
        // If we keep 45s, we discard 11s? No.
        // We are "Block Overflow" (5 blocks needed, we have 4 sets + 1 pair + 1 tatsu = 6).
        // We must break one.
        // Breaking 45s (Ryanmen) is bad for efficiency.
        // Breaking 11s (Pair) is bad.
        // Breaking 123m? No.
        // Actually, if we discard 4s 5s, we are Tenpai for Chanta?
        // No, we need 5 sets (4 sets + pair).
        // We have 123m, 789m, 123p, 789p. (4 sets).
        // Pair 11s.
        // Extra 45s.
        // We are Tenpai waiting for... nothing? We have 14 tiles.
        // 3*4 + 2 = 14.
        // 123m(3) + 789m(3) + 123p(3) + 789p(3) + 11s(2) = 14 tiles.
        // WE ARE WINNING (Ron/Tsumo).
        // Wait, BotLogic.getBestDiscard is called. If winning, it returns null?
        // Or shanten -1.

        // Let's make it 1-shanten.
        // 123m 789m 123p 1s 1s 9s 9s (Pairs) + 4s 5s.
        // Sets: 123m, 789m, 123p.
        // Pairs: 1s, 9s.
        // Tatsu: 4s 5s.
        // We need 1 more set + 1 pair.
        // Path A: Use 4s 5s -> 345s / 456s. (Not Chanta).
        // Path B: Use 1s 1s + 9s 9s (Shanpon). (Chanta).
        // AI should discard 4s or 5s to keep Chanta (if close enough).

        const handChanta = parseHand("1m 2m 3m 7m 8m 9m 1p 2p 3p 1s 1s 9s 9s 4s");
        // 14 tiles.
        // Discard 4s.
        const discardC = bot.getBestDiscard(handChanta, mockContext);
        console.log(`[Scenario 4 - Chanta] Discarded: ${tileToString(discardC)}`);
        expect(tileToString(discardC)).toBe('4s');
    });
});
