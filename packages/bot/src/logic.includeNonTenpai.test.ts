import { describe, expect, it } from 'vitest';
import { BotLogic } from './logic';
import { Tile } from '@step13/proto';

const t = (suit: Tile['suit'], rank: number): Tile => ({
    suit,
    rank: rank as Tile['rank'],
    isRed: false
});

describe('BotLogic.buildBestCandidates includeNonTenpai option', () => {
    it('returns fallback candidates when includeNonTenpai is true', () => {
        const bot = new BotLogic('test-bot', 'HARD');
        const dealtTiles: Tile[] = [
            t('man', 1), t('man', 3), t('man', 5), t('man', 7), t('man', 9),
            t('pin', 1), t('pin', 3), t('pin', 5), t('pin', 7), t('pin', 9),
            t('sou', 1), t('sou', 3), t('z', 1)
        ];

        const tenpaiOnly = bot.buildBestCandidates(dealtTiles, [], 5, {}, 'HARD', 0, false);
        expect(tenpaiOnly.length).toBe(0);

        const withFallback = bot.buildBestCandidates(dealtTiles, [], 5, {}, 'HARD', 0, true);
        expect(withFallback.length).toBeGreaterThan(0);
        expect(withFallback[0].hand.length).toBe(13);
    });
});
