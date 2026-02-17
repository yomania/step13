import { Tile } from '@step13/proto';
import { calculateShanten, getUkeire, calculateScore, ScoreOptions, evaluateHandQuality, Difficulty } from '@step13/scoring';
import { GameContext } from '@step13/core';

export type PotentialScore = {
    points: number;
    han: number;
    limit: string;
    yaku: string[];
    bestWait: Tile | null;
};

export type CandidateEvaluation = {
    indices: number[];
    hand: Tile[];
    waits: Tile[];
    score: PotentialScore;
};

const SUITS = ['man', 'pin', 'sou', 'z'] as const;

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

        let bestTile: Tile | null = null;
        let bestScore = -Infinity;

        const visibleTiles = this.getVisibleTiles(context);
        const diff = this.difficulty;

        for (let i = 0; i < hand.length; i++) {
            const tileToDiscard = hand[i];
            const remainingHand = [...hand.slice(0, i), ...hand.slice(i + 1)];

            const ukeire = getUkeire(remainingHand, visibleTiles);
            const qualityScore = evaluateHandQuality(remainingHand, diff, context.doraIndicators);

            const ukeireWeight = diff === 'EASY' ? 100 : (diff === 'MEDIUM' ? 50 : 20);

            let evalScore = qualityScore;
            evalScore += ukeire.ukeireCount * ukeireWeight;

            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestTile = tileToDiscard;
            }
        }

        return bestTile;
    }

    // --- Ported Logic from Client HandAnalysis ---

    public getWinningTiles(hand: Tile[]): Tile[] {
        const waits: Tile[] = [];
        for (const suit of SUITS) {
            const maxRank = suit === 'z' ? 7 : 9;
            for (let rank = 1; rank <= maxRank; rank++) {
                const winTile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
                if (calculateShanten([...hand, winTile]) === -1) {
                    waits.push(winTile);
                }
            }
        }
        return waits;
    }

    public async evaluatePotentialScore(
        hand: Tile[],
        waits: Tile[],
        doraIndicators: Tile[],
        _options?: { seatWind?: string; roundWind?: string }
    ): Promise<PotentialScore | null> {
        let bestPoints = -1;
        let bestHan = -1;
        let bestLimit = '';
        let bestYaku: string[] = [];
        let bestWait: Tile | null = null;

        for (const wait of waits) {
            const res = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
            if (res.points > bestPoints || (res.points === bestPoints && res.han > bestHan)) {
                bestPoints = res.points;
                bestHan = res.han;
                bestLimit = res.limit || '';
                bestYaku = [...res.yaku];
                bestWait = wait;
            }
        }

        if (bestPoints === -1) return null;

        return {
            points: bestPoints,
            han: bestHan,
            limit: bestLimit,
            yaku: bestYaku,
            bestWait
        };
    }

    public buildBestCandidates(
        dealtTiles: Tile[],
        doraIndicators: Tile[] = [],
        maxCount = 8,
        _options: { seatWind?: string; roundWind?: string } = {},
        difficulty: Difficulty = 'MEDIUM',
        scoreDiff?: number
    ): CandidateEvaluation[] {
        if (dealtTiles.length < 13) return [];

        const params = {
            EASY: { attempts: 100, improveSteps: 50, suitSeeds: false },
            MEDIUM: { attempts: 200, improveSteps: 80, suitSeeds: true },
            HARD: { attempts: 300, improveSteps: 120, suitSeeds: true }
        }[difficulty];

        const attempts = params.attempts;
        const improveSteps = params.improveSteps;
        const unique = new Map<string, CandidateEvaluation>();
        const baseIndices = dealtTiles.map((_, index) => index);
        const randomPick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
        const getHandByIndices = (indices: number[]) => indices.map((index) => dealtTiles[index]);

        const poolCounts: Record<string, number> = {};
        for (const idx of baseIndices) {
            const t = dealtTiles[idx];
            const key = `${t.suit}${t.rank}`;
            poolCounts[key] = (poolCounts[key] || 0) + 1;
        }

        const dangerMap: Record<string, number> = {};
        for (let s of SUITS) {
            for (let r = 1; r <= (s === 'z' ? 7 : 9); r++) {
                const key = `${s}${r}`;
                const count = poolCounts[key] || 0;
                dangerMap[key] = (4 - count) / 4.0;
            }
        }

        const tryAddCandidate = (indices: number[]) => {
            const selected = [...indices].sort((a, b) => a - b);
            const key = selected.join('-');
            if (unique.has(key)) return;

            const hand = getHandByIndices(selected);
            const waits = this.getWinningTiles(hand);
            if (waits.length === 0) return;

            // Furiten-like check
            const discardedTiles = baseIndices.filter(idx => !selected.includes(idx)).map(idx => dealtTiles[idx]);
            const availableWaits = waits.filter(wait => {
                const discardedCount = discardedTiles.filter(dt => dt.suit === wait.suit && dt.rank === wait.rank).length;
                const poolCount = poolCounts[`${wait.suit}${wait.rank}`] || 0;
                return discardedCount < poolCount;
            });

            if (availableWaits.length === 0) return;

            const score = this.calculateCandidateScoreHeuristic(hand, availableWaits, doraIndicators, dangerMap, scoreDiff, difficulty);

            unique.set(key, {
                indices: selected,
                hand,
                waits: availableWaits,
                score
            });
        };

        const runHillClimb = (initialSelected: number[], steps: number) => {
            let selected = [...initialSelected];
            let currentHand = getHandByIndices(selected);
            let currentScore = evaluateHandQuality(currentHand, difficulty, doraIndicators, dangerMap, scoreDiff);

            for (let step = 0; step < steps; step++) {
                const waits = this.getWinningTiles(currentHand);
                if (waits.length > 0) tryAddCandidate(selected);

                const selectedIndex = randomPick(selected);
                const replacementIndex = randomPick(baseIndices.filter(idx => !selected.includes(idx)));
                if (replacementIndex === undefined) break;

                const nextSelected = selected.map(idx => (idx === selectedIndex ? replacementIndex : idx));
                const nextHand = getHandByIndices(nextSelected);
                const nextScore = evaluateHandQuality(nextHand, difficulty, doraIndicators, dangerMap, scoreDiff);

                if (nextScore >= currentScore || Math.random() < 0.05) {
                    selected = nextSelected;
                    currentHand = nextHand;
                    currentScore = nextScore;
                }
            }
        };

        for (let i = 0; i < attempts; i++) {
            const shuffled = [...baseIndices].sort(() => Math.random() - 0.5).slice(0, 13);
            runHillClimb(shuffled, improveSteps);
        }

        tryAddCandidate(baseIndices.slice(0, 13));

        return [...unique.values()]
            .sort((a, b) => b.score.points - a.score.points || b.waits.length - a.waits.length)
            .slice(0, maxCount);
    }

    private calculateCandidateScoreHeuristic(
        hand: Tile[],
        waits: Tile[],
        doraIndicators: Tile[],
        dangerMap: Record<string, number>,
        scoreDiff: number | undefined,
        difficulty: Difficulty
    ): PotentialScore {
        let bestPoints = -1;
        let bestHan = -1;
        let bestLimit = '';
        let bestYaku: string[] = [];
        let bestWait: Tile | null = null;

        for (const wait of waits) {
            const res = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
            if (res.points > bestPoints || (res.points === bestPoints && res.han > bestHan)) {
                bestPoints = res.points;
                bestHan = res.han;
                bestLimit = res.limit || '';
                bestYaku = [...res.yaku];
                bestWait = wait;
            }
        }

        const quality = evaluateHandQuality(hand, difficulty, doraIndicators, dangerMap, scoreDiff);

        return {
            points: Math.max(0, bestPoints) + quality,
            han: Math.max(0, bestHan),
            limit: bestLimit,
            yaku: bestYaku,
            bestWait
        };
    }

    public scoreCandidateForRate(candidate: { waits: Tile[]; score: PotentialScore }): number {
        if (candidate.waits.length === 0) return 0;
        return candidate.score.points + (candidate.waits.length * 100);
    }

    public async evaluateMiniGame(
        playerHand: Tile[],
        dealtTiles: Tile[],
        doraIndicators: Tile[]
    ): Promise<any> {
        const candidates = this.buildBestCandidates(dealtTiles, doraIndicators, 1, { seatWind: 'EAST', roundWind: 'EAST' }, 'HARD', 0);
        const aiBest = candidates[0];

        if (!aiBest) return null;

        let playerResult = null;
        if (playerHand.length === 13) {
            const waits = this.getWinningTiles(playerHand);
            const score = await this.evaluatePotentialScore(playerHand, waits, doraIndicators);
            if (score) {
                playerResult = {
                    hand: playerHand,
                    waits,
                    han: score.han,
                    points: score.points,
                    yaku: score.yaku,
                    bestWait: score.bestWait
                };
            }
        }

        if (!playerResult) {
            playerResult = {
                hand: [],
                waits: [],
                han: 0,
                points: 0,
                yaku: [],
                bestWait: null
            };
        }

        const playerMetric = this.scoreCandidateForRate({ waits: playerResult.waits, score: playerResult as any });
        const aiMetric = this.scoreCandidateForRate({ waits: aiBest.waits, score: aiBest.score });

        const rawRate = aiMetric <= 0 ? 100 : Math.round((playerMetric / aiMetric) * 100);
        const rate = Math.max(0, Math.min(150, rawRate));

        return {
            player: playerResult,
            ai: {
                hand: aiBest.hand,
                waits: aiBest.waits,
                han: aiBest.score.han,
                points: aiBest.score.points,
                yaku: aiBest.score.yaku,
                bestWait: aiBest.score.bestWait
            },
            rate,
            description: `AI 점수(${aiBest.score.points}) 대비 ${rate}% 효율입니다.`
        };
    }

    private getVisibleTiles(context: GameContext): Tile[] {
        const visible: Tile[] = [];
        Object.values(context.discards).forEach(discards => visible.push(...discards));
        if (context.doraIndicators) visible.push(...context.doraIndicators);
        return visible;
    }
}
