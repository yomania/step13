import { Tile } from '../../proto/src';
import { calculateShanten, getUkeire, calculateScore, ScoreOptions, evaluateHandQuality, Difficulty } from '../../scoring/src';
import { GameContext } from '../../core/src';

// Re-export context type if needed or use directly
// Usually context includes hands, dealtTiles, etc.

const SCORE_OPTIONS: ScoreOptions = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
};

export class BotLogic {
    constructor(private playerId: string, private difficulty: Difficulty = 'HARD') { }

    // Main decision function
    public getBestDiscard(hand: Tile[], context: GameContext): Tile | null {
        if (hand.length === 0) return null;

        // 1. Identify isolated tiles that don't help (Shanten + Ukeire analysis)
        // We will simulate discarding each tile and see how "good" the remaining hand is.

        let bestTile: Tile | null = null;
        let bestScore = -Infinity;

        // visible tiles for ukeire calculation
        const visibleTiles = this.getVisibleTiles(context);

        // Normalize difficulty if not set (constructor default handles it but good to be safe)
        const diff = this.difficulty;

        for (let i = 0; i < hand.length; i++) {
            const tileToDiscard = hand[i];
            const remainingHand = [...hand.slice(0, i), ...hand.slice(i + 1)];

            // Calculate state AFTER discard
            const ukeire = getUkeire(remainingHand, visibleTiles);

            // Score components:
            const qualityScore = evaluateHandQuality(remainingHand, diff, context.doraIndicators);

            // Add Ukeire count weight (Efficiency)
            // Hardcoded weights approx matching heuristics.ts
            // EASY: 100, MEDIUM: 50, HARD: 20
            const ukeireWeight = diff === 'EASY' ? 100 : (diff === 'MEDIUM' ? 50 : 20);

            let evalScore = qualityScore;
            evalScore += ukeire.ukeireCount * ukeireWeight;

            // Tie-breaker: If score is very similar, prefer edge tile discard?
            // Already handled by structure analysis in evaluateHandQuality (ryanmen vs penchan preference)

            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestTile = tileToDiscard;
            }
        }

        return bestTile;
    }

    // Helper to gather visible tiles from context (discards, open calls, dora)
    private getVisibleTiles(context: GameContext): Tile[] {
        const visible: Tile[] = [];

        // Add discards
        Object.values(context.discards).forEach(discards => {
            visible.push(...discards);
        });

        // Add dora indicators
        if (context.doraIndicators) {
            visible.push(...context.doraIndicators);
        }

        // (Optional) Add open calls if implemented

        return visible;
    }
}
