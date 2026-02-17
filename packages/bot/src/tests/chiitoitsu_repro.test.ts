
import { describe, test, expect } from 'vitest';
import { BotLogic, CandidateEvaluation } from '../logic';
import { Tile } from '@step13/proto';

describe('BotLogic - Chiitoitsu Reproduction', () => {
    // Data from user report
    const dealtTilesRaw = [
        "z4", "pin4", "pin7", "pin1", "pin9", "man7", "sou7", "z3", "sou9", "pin6",
        "man2", "pin6", "man5", "pin1", "sou6", "man5", "man6", "z3", "man7", "man4",
        "man1", "sou5", "pin3", "man8", "pin5", "sou1", "z2", "pin4", "z6", "man6",
        "z7", "sou6", "man4", "man6"
    ];

    const parseTile = (str: string, id: number): Tile => {
        const suit = str.replace(/[0-9]/g, '') as any;
        const rank = parseInt(str.replace(/[^0-9]/g, ''), 10);
        return { suit, rank: rank as any, isRed: false, id: `tile-${id}` };
    };

    const dealtTiles = dealtTilesRaw.map((s, i) => parseTile(s, i));
    const doraIndicators = [parseTile("pin4", 99)];

    // The hand user selected (6 pairs + z2)
    // Indices: 19, 32, 12, 15, 16, 29, 5, 18, 7, 17, 3, 13, 26
    const targetIndices = [19, 32, 12, 15, 16, 29, 5, 18, 7, 17, 3, 13, 26];

    test('should recommend Chiitoitsu candidate', async () => {
        const bot = new BotLogic('test-player', 'MEDIUM');

        // We expect the bot to find candidates from the dealtTiles 
        // that resemble the Chiitoitsu hand the user found.
        const candidates = bot.buildBestCandidates(dealtTiles, doraIndicators, 10, {}, 'HARD');

        console.log(`Found ${candidates.length} candidates`);

        const chiitoitsuCandidates = candidates.filter(c => {
            // Check if hand has 6 pairs (Chiitoitsu Tenpai)
            // Or just check if yaku includes Chiitoitsu (requires BotLogic to eval score first)
            // But score is in the candidate.
            return c.score.yaku.includes('Chiitoitsu');
        });

        console.log('Chiitoitsu Candidates:', chiitoitsuCandidates.length);
        if (chiitoitsuCandidates.length > 0) {
            console.log('First Chiitoitsu Score:', chiitoitsuCandidates[0].score);
        }

        expect(chiitoitsuCandidates.length).toBeGreaterThan(0);
    });

    test('evaluate specific hand quality', () => {
        // This test manually checks if the specific 6-pair hand is considered valid/tenpai
        const bot = new BotLogic('test-player', 'HARD');
        const hand = targetIndices.map(i => dealtTiles[i]);

        const waits = bot.getWinningTiles(hand);
        console.log('Waits for target hand:', waits);

        // If waits > 0, it means it is Tenpai.
        expect(waits.length).toBeGreaterThan(0);
    });
});
