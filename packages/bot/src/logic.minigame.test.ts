import { describe, expect, it, vi } from 'vitest';
import { BotLogic, CandidateEvaluation } from './logic';
import { Tile } from '@step13/proto';

const tile = (suit: Tile['suit'], rank: Tile['rank'], copy = 0): Tile => ({
    suit,
    rank,
    isRed: false,
    id: `${suit}${rank}-${copy}`
});

describe('BotLogic mini-game evaluation', () => {
    it('returns 0% when player gives up', async () => {
        const bot = new BotLogic('test-player');
        const aiCandidate: CandidateEvaluation = {
            indices: [],
            hand: Array.from({ length: 13 }, (_, i) => tile('man', ((i % 9) + 1) as Tile['rank'], i)),
            waits: [tile('pin', 3)],
            score: { points: 12000, han: 6, fu: 40, yaku: ['Riichi (Auto)'], bestWait: tile('pin', 3) }
        };

        vi.spyOn(bot, 'buildBestCandidates').mockReturnValue([aiCandidate]);

        const result = await bot.evaluateMiniGame([], [tile('man', 1)], [tile('sou', 4)]);
        expect(result).toBeTruthy();
        expect(result.gaveUp).toBe(true);
        expect(result.rate).toBe(0);
    });

    it('does not return 100% when ai effective waits are empty', async () => {
        const bot = new BotLogic('test-player');
        const aiCandidate: CandidateEvaluation = {
            indices: [],
            hand: Array.from({ length: 13 }, (_, i) => tile('sou', ((i % 9) + 1) as Tile['rank'], i)),
            waits: [],
            score: { points: 12000, han: 6, fu: 40, yaku: ['Honitsu'], bestWait: tile('sou', 7) }
        };

        vi.spyOn(bot, 'buildBestCandidates').mockReturnValue([aiCandidate]);

        const result = await bot.evaluateMiniGame([], [tile('pin', 1)], [tile('pin', 7)]);
        expect(result).toBeTruthy();
        expect(result.rate).toBe(0);
    });

    it('keeps all waits and marks furiten waits separately', async () => {
        const bot = new BotLogic('test-player');
        const playerHand = [
            tile('pin', 4, 0),
            ...Array.from({ length: 12 }, (_, i) => tile('man', ((i % 9) + 1) as Tile['rank'], i + 1))
        ];
        const dealtTiles = [...playerHand, tile('pin', 3, 99), tile('pin', 4, 98)];
        const aiCandidate: CandidateEvaluation = {
            indices: [],
            hand: Array.from({ length: 13 }, (_, i) => tile('sou', ((i % 9) + 1) as Tile['rank'], i)),
            waits: [tile('sou', 2), tile('sou', 3)],
            furitenWaits: [tile('sou', 3)],
            score: { points: 8000, han: 4, fu: 40, yaku: ['Riichi (Auto)'], bestWait: tile('sou', 2) }
        };

        vi.spyOn(bot, 'buildBestCandidates').mockReturnValue([aiCandidate]);
        vi.spyOn(bot, 'getWinningTiles').mockReturnValue([tile('pin', 3), tile('pin', 4)]);
        vi.spyOn(bot, 'evaluatePotentialScore').mockResolvedValue({
            points: 3900,
            han: 2,
            fu: 30,
            yaku: ['Riichi (Auto)'],
            bestWait: tile('pin', 4)
        });

        const result = await bot.evaluateMiniGame(playerHand, dealtTiles, [tile('man', 5)]);
        expect(result).toBeTruthy();
        expect(result.player.waits).toHaveLength(2);
        expect(result.player.furitenWaits).toHaveLength(1);
        expect(result.player.furitenWaits[0]).toMatchObject({ suit: 'pin', rank: 3 });
        expect(result.player.waitBreakdown).toHaveLength(2);
        expect(result.ai.waitBreakdown).toHaveLength(2);
    });
});
