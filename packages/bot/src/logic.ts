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
    waitBreakdown?: WaitScoreBreakdown[];
    quality?: number; // Internal heuristic score for search
}

export type WaitScoreBreakdown = {
    wait: Tile;
    han: number;
    fu: number;
    points: number;
    doraCount: number;
    limit?: string;
    yaku: string[];
};

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

const YAKUMAN_YAKU = new Set(['KokushiMusou', 'Daisangen', 'Shousushi', 'Daisushi']);

export class BotLogic {
    constructor(private playerId: string, private difficulty: Difficulty = 'HARD') { }

    // Main decision function
    public getBestDiscard(hand: Tile[], context: GameContext): Tile | null {
        if (hand.length === 0) return null;

        type DiscardCandidate = {
            tile: Tile;
            evalScore: number;
            shanten: number;
            ukeireCount: number;
            isIsolatedHonorSingleton: boolean;
        };
        const candidates: DiscardCandidate[] = [];
        const tileCounts: Record<string, number> = {};
        for (const tile of hand) {
            const key = `${tile.suit}${tile.rank}`;
            tileCounts[key] = (tileCounts[key] ?? 0) + 1;
        }

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

            // Lightweight preference: isolated honor tiles are usually the first discard.
            const tileKey = `${tileToDiscard.suit}${tileToDiscard.rank}`;
            const isIsolatedHonorSingleton = tileToDiscard.suit === 'z' && (tileCounts[tileKey] ?? 0) === 1;
            if (isIsolatedHonorSingleton) {
                evalScore += 600;
            }

            candidates.push({
                tile: tileToDiscard,
                evalScore,
                shanten: ukeire.shanten,
                ukeireCount: ukeire.ukeireCount,
                isIsolatedHonorSingleton
            });
        }

        if (candidates.length === 0) return null;

        const pickBest = (pool: DiscardCandidate[]) => pool.reduce((best, current) => {
            if (current.evalScore > best.evalScore) return current;
            if (current.evalScore < best.evalScore) return best;
            return current.ukeireCount > best.ukeireCount ? current : best;
        });

        const bestOverall = pickBest(candidates);

        // Prefer isolated honors only when they do not lose clear speed.
        const competitiveIsolatedHonors = candidates.filter((candidate) =>
            candidate.isIsolatedHonorSingleton &&
            candidate.shanten <= bestOverall.shanten &&
            candidate.ukeireCount + 4 >= bestOverall.ukeireCount
        );
        if (competitiveIsolatedHonors.length > 0) {
            return pickBest(competitiveIsolatedHonors).tile;
        }

        return bestOverall.tile;
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
        const waitBreakdown = this.buildWaitBreakdown(hand, waits, doraIndicators, _options);
        if (waitBreakdown.length === 0) return null;
        const best = waitBreakdown[0];

        return {
            points: best.points,
            han: best.han,
            fu: best.fu,
            limit: best.limit || '',
            yaku: [...best.yaku],
            bestWait: best.wait,
            waitBreakdown
        };
    }

    private buildWaitBreakdown(
        hand: Tile[],
        waits: Tile[],
        doraIndicators: Tile[],
        options?: { seatWind?: string; roundWind?: string }
    ): WaitScoreBreakdown[] {
        return waits
            .map((wait) => {
                const res = calculateScore(hand, wait, false, doraIndicators, {
                    ...SCORE_OPTIONS,
                    seatWind: options?.seatWind as any,
                    roundWind: options?.roundWind as any
                });
                return {
                    wait,
                    han: res.han,
                    fu: res.fu,
                    points: res.points,
                    doraCount: res.doraCount,
                    limit: res.limit,
                    yaku: [...res.yaku]
                };
            })
            .sort((a, b) => b.points - a.points || b.han - a.han || b.fu - a.fu);
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
        // 패 구성(suit+rank 정렬) 기반 중복 제거용 Set - 동일한 패 조합이 다른 인덱스로 중복 등록되는 것을 방지
        const uniqueHandCompositions = new Set<string>();
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

            // 패 구성(suit+rank 정렬) 기반 중복 제거: 같은 종류의 패가 여러 장 있을 때
            // 다른 인덱스로 동일한 패 조합이 중복 등록되는 것을 방지
            const handCompositionKey = [...hand]
                .map(t => `${t.suit}${t.rank}`)
                .sort()
                .join(',');
            if (uniqueHandCompositions.has(handCompositionKey)) return;

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
            uniqueHandCompositions.add(handCompositionKey);
        };

        const byTileKey = new Map<string, number[]>();
        for (const idx of baseIndices) {
            const tile = dealtTiles[idx];
            const key = `${tile.suit}${tile.rank}`;
            const bucket = byTileKey.get(key);
            if (bucket) {
                bucket.push(idx);
            } else {
                byTileKey.set(key, [idx]);
            }
        }

        const buildMandatoryIndices = (specs: Array<{ key: string; count: number }>): number[] | null => {
            const selected: number[] = [];
            for (const spec of specs) {
                const bucket = byTileKey.get(spec.key) ?? [];
                if (bucket.length < spec.count) {
                    return null;
                }
                selected.push(...bucket.slice(0, spec.count));
            }
            if (selected.length > 13) {
                return null;
            }
            return selected;
        };

        const addCandidatesFromMandatory = (mandatory: number[], pickCount: number, maxCombos: number) => {
            const mandatorySet = new Set(mandatory);
            const remaining = baseIndices.filter((idx) => !mandatorySet.has(idx));
            if (pickCount < 0 || mandatory.length + pickCount !== 13) {
                return;
            }
            if (pickCount === 0) {
                tryAddCandidate(mandatory);
                return;
            }
            if (remaining.length < pickCount) {
                return;
            }

            let tested = 0;
            const picked = new Array<number>(pickCount);
            const dfs = (depth: number, start: number) => {
                if (tested >= maxCombos) {
                    return;
                }
                if (depth === pickCount) {
                    tested += 1;
                    tryAddCandidate([...mandatory, ...picked]);
                    return;
                }
                for (let i = start; i <= remaining.length - (pickCount - depth); i++) {
                    picked[depth] = remaining[i];
                    dfs(depth + 1, i + 1);
                    if (tested >= maxCombos) {
                        return;
                    }
                }
            };
            dfs(0, 0);
        };

        const seedYakumanCandidates = () => {
            const kokushi = buildMandatoryIndices([
                { key: 'man1', count: 1 }, { key: 'man9', count: 1 },
                { key: 'pin1', count: 1 }, { key: 'pin9', count: 1 },
                { key: 'sou1', count: 1 }, { key: 'sou9', count: 1 },
                { key: 'z1', count: 1 }, { key: 'z2', count: 1 }, { key: 'z3', count: 1 }, { key: 'z4', count: 1 },
                { key: 'z5', count: 1 }, { key: 'z6', count: 1 }, { key: 'z7', count: 1 }
            ]);
            if (kokushi) {
                addCandidatesFromMandatory(kokushi, 0, 1);
            }

            const daisangen = buildMandatoryIndices([
                { key: 'z5', count: 3 },
                { key: 'z6', count: 3 },
                { key: 'z7', count: 3 }
            ]);
            if (daisangen) {
                addCandidatesFromMandatory(daisangen, 4, 240);
            }

            const daisushi = buildMandatoryIndices([
                { key: 'z1', count: 3 },
                { key: 'z2', count: 3 },
                { key: 'z3', count: 3 },
                { key: 'z4', count: 3 }
            ]);
            if (daisushi) {
                addCandidatesFromMandatory(daisushi, 1, 64);
            }

            const windKeys = ['z1', 'z2', 'z3', 'z4'] as const;
            for (const pairWind of windKeys) {
                const specs = windKeys.map((key) => ({
                    key,
                    count: key === pairWind ? 2 : 3
                }));
                const shousushi = buildMandatoryIndices(specs);
                if (shousushi) {
                    addCandidatesFromMandatory(shousushi, 2, 160);
                }
            }
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

        seedYakumanCandidates();

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

        const compareCandidates = (a: CandidateEvaluation, b: CandidateEvaluation) => {
            const aTotal = a.score.points + (a.score.quality ?? 0);
            const bTotal = b.score.points + (b.score.quality ?? 0);
            const aEffectiveWaits = a.waits.length - (a.furitenWaits?.length ?? 0);
            const bEffectiveWaits = b.waits.length - (b.furitenWaits?.length ?? 0);
            return bTotal - aTotal || bEffectiveWaits - aEffectiveWaits;
        };
        const getPrimaryYaku = (candidate: CandidateEvaluation) =>
            candidate.score.yaku.find((yaku) => yaku !== 'Riichi (Auto)' && !yaku.startsWith('Dora')) ?? 'RiichiOnly';

        const sorted = [...unique.values()].sort(compareCandidates);
        if (maxCount <= 0) return [];
        if (sorted.length <= maxCount) return sorted;

        const selected = sorted.slice(0, maxCount);
        const yakuCounts = new Map<string, number>();
        for (const candidate of selected) {
            const key = getPrimaryYaku(candidate);
            yakuCounts.set(key, (yakuCounts.get(key) ?? 0) + 1);
        }

        for (const candidate of sorted.slice(maxCount)) {
            const incomingKey = getPrimaryYaku(candidate);
            if (yakuCounts.has(incomingKey)) continue;

            let replaceIndex = -1;
            for (let i = selected.length - 1; i >= 0; i--) {
                const currentKey = getPrimaryYaku(selected[i]);
                const count = yakuCounts.get(currentKey) ?? 0;
                if (count > 1 || currentKey === 'RiichiOnly') {
                    replaceIndex = i;
                    break;
                }
            }
            if (replaceIndex < 0) {
                break;
            }

            const removedKey = getPrimaryYaku(selected[replaceIndex]);
            const removedCount = (yakuCounts.get(removedKey) ?? 1) - 1;
            if (removedCount <= 0) {
                yakuCounts.delete(removedKey);
            } else {
                yakuCounts.set(removedKey, removedCount);
            }

            selected[replaceIndex] = candidate;
            yakuCounts.set(incomingKey, (yakuCounts.get(incomingKey) ?? 0) + 1);
        }

        return selected.sort(compareCandidates);
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
        const waitFlexibilityWeight = difficulty === 'HARD' ? 1000 : (difficulty === 'MEDIUM' ? 700 : 300);
        quality += waits.length * waitFlexibilityWeight;

        // Pinfu tends to be undervalued by pure shape scoring; lift it slightly so
        // practical ryanmen-based hands are retained in top candidates.
        if (bestYaku.includes('Pinfu')) {
            quality += difficulty === 'HARD' ? 3500 : (difficulty === 'MEDIUM' ? 2500 : 800);
        }

        if (bestLimit === 'Yakuman' || bestYaku.some((yaku) => YAKUMAN_YAKU.has(yaku))) {
            quality += 200000 + waits.length * 10000;
        }

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
                    bestWait: score.bestWait,
                    waitBreakdown: score.waitBreakdown ?? this.buildWaitBreakdown(playerHand, rawWaits, doraIndicators, {
                        seatWind: 'EAST',
                        roundWind: 'EAST'
                    })
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
                bestWait: null,
                waitBreakdown: []
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
                bestWait: aiBest.score.bestWait,
                waitBreakdown: this.buildWaitBreakdown(aiBest.hand, aiBest.waits, doraIndicators, {
                    seatWind: 'EAST',
                    roundWind: 'EAST'
                })
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
