import { Tile } from '@step13/proto';
import { calculateShanten, getUkeire, calculateScore, ScoreOptions, evaluateHandQuality, Difficulty } from '@step13/scoring';
import { GameContext } from '@step13/core';

export interface PotentialScore {
    points: number;
    han: number;
    fu: number;
    limit?: string;
    yaku: string[];
    bestWait: Tile | null;
    quality?: number; // Internal heuristic score for search
}

export type CandidateEvaluation = {
    indices: number[];
    hand: Tile[];
    waits: Tile[];
    furitenWaits?: Tile[];
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
        // Optimization: If hand is not Tenpai (shanten > 0), no single tile can make it a win
        if (calculateShanten(hand) > 0) {
            return [];
        }

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
        let bestFu = 0;
        let bestLimit = '';
        let bestYaku: string[] = [];
        let bestWait: Tile | null = null;

        for (const wait of waits) {
            const res = calculateScore(hand, wait, false, doraIndicators, {
                ...SCORE_OPTIONS,
                seatWind: _options?.seatWind as any,
                roundWind: _options?.roundWind as any
            });
            if (res.points > bestPoints || (res.points === bestPoints && res.han > bestHan)) {
                bestPoints = res.points;
                bestHan = res.han;
                bestFu = res.fu;
                bestLimit = res.limit || '';
                bestYaku = [...res.yaku];
                bestWait = wait;
            }
        }

        if (bestPoints === -1) return null;

        return {
            points: bestPoints,
            han: bestHan,
            fu: bestFu,
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
        scoreDiff?: number,
        includeNonTenpai: boolean = false
    ): CandidateEvaluation[] {
        if (dealtTiles.length < 13) return [];

        const params = {
            EASY: { attempts: 100, improveSteps: 50, suitSeeds: false },
            MEDIUM: { attempts: 10, improveSteps: 60, suitSeeds: true },
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
            if (!includeNonTenpai && waits.length === 0) return;

            // Future-danger assessment (instead of hard filter)
            const discardedTiles = baseIndices.filter(idx => !selected.includes(idx)).map(idx => dealtTiles[idx]);
            const furitenWaits = waits.filter(wait => {
                const discardedCount = discardedTiles.filter(dt => dt.suit === wait.suit && dt.rank === wait.rank).length;
                const poolCount = poolCounts[`${wait.suit}${wait.rank}`] || 0;
                return discardedCount >= poolCount;
            });

            // Calculate score with internal quality
            const score = this.calculateCandidateScoreHeuristic(
                hand,
                waits, // Pass all possible waits for score calculation
                doraIndicators,
                dangerMap,
                scoreDiff,
                difficulty,
                discardedTiles, // Pass discarded tiles for furiten penalty
                poolCounts
            );

            unique.set(key, {
                indices: selected,
                hand,
                waits,
                furitenWaits,
                score
            });
        };

        const runHillClimb = (initialSelected: number[], steps: number) => {
            let selected = [...initialSelected];
            let currentHand = getHandByIndices(selected);
            let currentScore = evaluateHandQuality(currentHand, difficulty, doraIndicators, dangerMap, scoreDiff);

            for (let step = 0; step < steps; step++) {
                const waits = this.getWinningTiles(currentHand);
                if (waits.length > 0 || includeNonTenpai) tryAddCandidate(selected);

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

        if (params.suitSeeds) {
            // Seed with flushed hands logic
            const suits = ['man', 'pin', 'sou'] as const;
            for (const suit of suits) {
                // Try to fill hand with THIS suit + honors
                const suitIndices: number[] = [];
                const honorIndices: number[] = [];
                const otherIndices: number[] = [];

                baseIndices.forEach(idx => {
                    const t = dealtTiles[idx];
                    if (t.suit === suit) suitIndices.push(idx);
                    else if (t.suit === 'z') honorIndices.push(idx);
                    else otherIndices.push(idx);
                });

                // Strategy 1: Maximize suit + honors (Honitsu)
                let attemptIndices = [...suitIndices, ...honorIndices];

                // Fill remaining with random others if needed
                if (attemptIndices.length < 13) {
                    const others = [...otherIndices].sort(() => Math.random() - 0.5);
                    attemptIndices.push(...others.slice(0, 13 - attemptIndices.length));
                } else {
                    attemptIndices = attemptIndices.slice(0, 13);
                }

                // Run specialized search for this suit
                runHillClimb(attemptIndices, improveSteps);

                // Strategy 2: Maximize suit ONLY (Chinitsu)
                let chinitsuIndices = [...suitIndices];
                if (chinitsuIndices.length < 13) {
                    const others = [...honorIndices, ...otherIndices].sort(() => Math.random() - 0.5);
                    chinitsuIndices.push(...others.slice(0, 13 - chinitsuIndices.length));
                } else {
                    chinitsuIndices = chinitsuIndices.slice(0, 13);
                }
                runHillClimb(chinitsuIndices, improveSteps);
            }

            // Strategy 3: Chiitoitsu (Seven Pairs) Strategy
            // Identify all pairs in dealtTiles and try to maximize pair count
            const pairMap: Record<string, number[]> = {};
            baseIndices.forEach(idx => {
                const t = dealtTiles[idx];
                const key = `${t.suit}${t.rank}`;
                if (!pairMap[key]) pairMap[key] = [];
                pairMap[key].push(idx);
            });

            const pairIndices: number[] = [];
            const singleIndices: number[] = [];

            Object.values(pairMap).forEach(indices => {
                if (indices.length >= 2) {
                    // Take first two as pair
                    pairIndices.push(indices[0], indices[1]);
                    // Remainder to singles
                    for (let i = 2; i < indices.length; i++) singleIndices.push(indices[i]);
                } else {
                    singleIndices.push(indices[0]);
                }
            });

            // If we have many pairs, this is a good candidate
            if (pairIndices.length >= 8) { // 4 pairs (8 tiles)
                let chiitoiIndices = [...pairIndices];
                // Fill rest with strict singles (try to avoid creating triplets if possible, 
                // but for Chiitoitsu we just need unique tiles mostly, 
                // wait, Chiitoitsu needs 7 DISTINCT pairs.
                // If we have 4 of same tile, that's 2 pairs? No. 4 identical tiles = 2 pairs is NOT allowed in standard Chiitoitsu.
                // Standard Chiitoitsu must use 7 DIFFERENT pairs.
                // But 4 identical tiles can be considered 2 pairs? No.
                // Actually most rules say 4 identical tiles cannot form 2 pairs for Chiitoitsu.
                // So we should pick max 2 per tile type.

                // My pairMap logic above picked 2 if available. 
                // If 3, picked 2, 1 single.
                // If 4, picked 2, 2 singles? 
                // Wait, `values.length >= 2`. indices[0], indices[1].
                // If 4 tiles, indices: [0,1,2,3]. 
                // Pushed [0,1]. [2,3] went to singleIndices.
                // So we only picked 1 pair per tile key. Correct.

                // Now fill the rest to 13.
                // We have `pairIndices` (2 * N tiles).
                // We need 13 tiles total.
                const needed = 13 - chiitoiIndices.length;
                if (needed > 0) {
                    // Prefer tiles that are NOT already in pairIndices (to avoid triplets)
                    // But we already separated them.
                    const others = [...singleIndices].sort(() => Math.random() - 0.5);
                    chiitoiIndices.push(...others.slice(0, needed));
                } else if (needed < 0) {
                    // We have too many pairs? (e.g. 7 pairs = 14 tiles? No, hand is 13)
                    // Tennpai for Chiitoitsu is 6 pairs + 1 single = 13 tiles.
                    // If we have 7 pairs (14 tiles) in dealt tiles... we need to discard one.
                    // The input `dealtTiles` might be 14 (if it's turn) but here `dealtTiles` is usually the full pool provided by HandBuilder?
                    // Verify: HandBuilder passes `dealtTiles` which is usually ~34 tiles?
                    // No, dealtTiles is the pool of ALL valid tiles for the user to select from?
                    // Ah, HandBuilder `dealtTiles` indicates the "Starting Hand + Draws"?
                    // In the supplied JSON: "dealtTiles" has 34 items.
                    // So we select 13 from 34.

                    // So we just take top 13 from our constructed list.
                    chiitoiIndices = chiitoiIndices.slice(0, 13);
                }

                runHillClimb(chiitoiIndices, improveSteps);
            }
        }

        for (let i = 0; i < attempts; i++) {

            const shuffled = [...baseIndices].sort(() => Math.random() - 0.5).slice(0, 13);
            runHillClimb(shuffled, improveSteps);
        }

        tryAddCandidate(baseIndices.slice(0, 13));

        return [...unique.values()]
            .sort((a, b) => {
                const aTotal = a.score.points + (a.score.quality ?? 0);
                const bTotal = b.score.points + (b.score.quality ?? 0);
                const aEffectiveWaits = a.waits.length - (a.furitenWaits?.length ?? 0);
                const bEffectiveWaits = b.waits.length - (b.furitenWaits?.length ?? 0);
                return bTotal - aTotal || bEffectiveWaits - aEffectiveWaits;
            })
            .slice(0, maxCount);
    }

    private calculateCandidateScoreHeuristic(
        hand: Tile[],
        waits: Tile[],
        doraIndicators: Tile[],
        dangerMap: Record<string, number>,
        scoreDiff: number | undefined,
        difficulty: Difficulty,
        discardedTiles: Tile[] = [],
        poolCounts: Record<string, number> = {}
    ): PotentialScore {
        let bestPoints = -1;
        let bestHan = -1;
        let bestFu = 0;
        let bestLimit = '';
        let bestYaku: string[] = [];
        let bestWait: Tile | null = null;

        for (const wait of waits) {
            const res = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
            if (res.points > bestPoints || (res.points === bestPoints && res.han > bestHan)) {
                bestPoints = res.points;
                bestHan = res.han;
                bestFu = res.fu;
                bestLimit = res.limit || '';
                bestYaku = [...res.yaku];
                bestWait = wait;
            }
        }

        let quality = evaluateHandQuality(hand, difficulty, doraIndicators, dangerMap, scoreDiff);

        // Apply soft penalty for potential furiten
        const waitIsFuriten = waits.some(wait => {
            const discardedCount = discardedTiles.filter(dt => dt.suit === wait.suit && dt.rank === wait.rank).length;
            const poolCount = poolCounts[`${wait.suit}${wait.rank}`] || 0;
            return discardedCount >= poolCount;
        });

        if (waitIsFuriten) {
            quality -= 5000; // Deduct from search quality but don't ruin actual points
        }

        return {
            points: Math.max(0, bestPoints), // Pure mahjong score
            han: Math.max(0, bestHan),
            fu: Math.max(0, bestFu),
            limit: bestLimit,
            yaku: bestYaku,
            bestWait,
            quality // Separate heuristic score
        };
    }

    public scoreCandidateForRate(candidate: { waits: Tile[]; score: PotentialScore }): number {
        if (candidate.waits.length === 0 && candidate.score.points <= 0) return 0;
        const waitBonus = Math.max(1, candidate.waits.length) * 100;
        return Math.max(0, candidate.score.points) + waitBonus;
    }

    public async evaluateMiniGame(
        playerHand: Tile[],
        dealtTiles: Tile[],
        doraIndicators: Tile[],
        scoreDiff?: number
    ): Promise<any> {
        const candidates = this.buildBestCandidates(
            dealtTiles,
            doraIndicators,
            1,
            { seatWind: 'EAST', roundWind: 'EAST' },
            'HARD',
            scoreDiff
        );
        const aiBest = candidates[0];

        if (!aiBest) return null;

        const poolCounts: Record<string, number> = {};
        for (const t of dealtTiles) {
            const key = `${t.suit}${t.rank}`;
            poolCounts[key] = (poolCounts[key] || 0) + 1;
        }

        const gaveUp = playerHand.length === 0;
        const tileKey = (tile: Tile) => `${tile.suit}${tile.rank}`;
        let playerResult = null;
        if (playerHand.length === 13) {
            const rawWaits = this.getWinningTiles(playerHand);

            // Fair Furiten Check for player
            const playerDiscarded = dealtTiles.filter(t => !playerHand.some(ph => ph.id === t.id));
            const furitenWaits = rawWaits.filter(wait => {
                const discardedCount = playerDiscarded.filter(dt => dt.suit === wait.suit && dt.rank === wait.rank).length;
                const poolCount = poolCounts[`${wait.suit}${wait.rank}`] || 0;
                return discardedCount >= poolCount;
            });

            const score = await this.evaluatePotentialScore(playerHand, rawWaits, doraIndicators, {
                seatWind: 'EAST', // Mini-game default, or from context
                roundWind: 'EAST'
            });
            if (score) {
                playerResult = {
                    hand: playerHand,
                    waits: rawWaits,
                    furitenWaits,
                    han: score.han,
                    fu: score.fu,
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
                furitenWaits: [],
                han: 0,
                fu: 0,
                points: 0,
                yaku: [],
                bestWait: null
            };
        }

        // Rate calculation using pure points + waits bonus
        const playerFuritenSet = new Set((playerResult.furitenWaits ?? []).map(tileKey));
        const aiFuritenSet = new Set((aiBest.furitenWaits ?? []).map(tileKey));
        const playerEffectiveWaits = playerResult.waits.filter(wait => !playerFuritenSet.has(tileKey(wait)));
        const aiEffectiveWaits = aiBest.waits.filter(wait => !aiFuritenSet.has(tileKey(wait)));

        const playerMetric = this.scoreCandidateForRate({ waits: playerEffectiveWaits, score: playerResult as any });
        const aiMetric = this.scoreCandidateForRate({ waits: aiEffectiveWaits, score: aiBest.score });

        const rawRate = aiMetric <= 0 ? 0 : Math.round((playerMetric / aiMetric) * 100);
        const rate = Math.max(0, Math.min(150, rawRate));

        return {
            player: playerResult,
            ai: {
                hand: aiBest.hand,
                waits: aiBest.waits,
                furitenWaits: aiBest.furitenWaits ?? [],
                han: aiBest.score.han,
                fu: aiBest.score.fu,
                points: aiBest.score.points,
                yaku: aiBest.score.yaku,
                bestWait: aiBest.score.bestWait
            },
            rate,
            gaveUp,
            description: gaveUp
                ? '포기했습니다. 다음 국에서 다시 도전해 보세요.'
                : (rate >= 100 ? 'AI 수준의 훌륭한 조패입니다!' : `AI 결과 대비 ${100 - rate}% 개선 여지가 있습니다.`)
        };
    }

    private getVisibleTiles(context: GameContext): Tile[] {
        const visible: Tile[] = [];
        Object.values(context.discards).forEach(discards => visible.push(...discards));
        if (context.doraIndicators) visible.push(...context.doraIndicators);
        return visible;
    }
}
