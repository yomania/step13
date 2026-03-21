import { describe, expect, it } from 'vitest';
import {
    appendBoundedHistory,
    extractMatchedMiniGameResult,
    isMiniGamePrefetchReady
} from '../../../apps/web/src/lib/miniGameState';

describe('miniGameState helpers', () => {
    it('accepts prefetch results only before the round result exists', () => {
        const analysisResult = {
            type: 'ANALYSIS_RESULT',
            candidates: [{ hand: [] }]
        };

        expect(isMiniGamePrefetchReady(analysisResult, false)).toBe(true);
        expect(isMiniGamePrefetchReady(analysisResult, true)).toBe(false);
    });

    it('extracts only the matching mini game result by query id', () => {
        const miniResult = { rate: 100 };

        expect(extractMatchedMiniGameResult({ type: 'ANALYSIS_RESULT', miniResult, queryId: 'q-1' }, 'q-1')).toEqual(miniResult);
        expect(extractMatchedMiniGameResult({ type: 'ANALYSIS_RESULT', miniResult, queryId: 'q-2' }, 'q-1')).toBeNull();
    });

    it('keeps bounded history length', () => {
        const history = appendBoundedHistory([2, 1], 3, 3);
        expect(history).toEqual([3, 2, 1]);

        const trimmed = appendBoundedHistory(history, 4, 3);
        expect(trimmed).toEqual([4, 3, 2]);
    });
});
