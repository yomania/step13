import { Tile } from '@step13/proto';
import { ScoreOptions, calculateScore, calculateShanten, Difficulty, evaluateHandQuality } from '@step13/scoring';

const SUITS = ['man', 'pin', 'sou', 'z'] as const;

export const SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
} as const;

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

export function getWinningTiles(hand: Tile[]): Tile[] {
    if (hand.length !== 13) return [];

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

export function evaluatePotentialScore(
    hand: Tile[],
    waits: Tile[],
    doraIndicators: Tile[],
    extraScoreOptions: Partial<ScoreOptions> = {}
): PotentialScore | null {
    if (waits.length === 0) return null;

    let bestPoints = -1;
    let bestHan = -1;
    let bestLimit = '';
    let bestYaku: string[] = [];
    let bestWait: Tile | null = null;

    for (const wait of waits) {
        const res = calculateScore(hand, wait, false, doraIndicators, { ...SCORE_OPTIONS, ...extraScoreOptions });
        if (res.points > bestPoints || (res.points === bestPoints && res.han > bestHan)) {
            bestPoints = res.points;
            bestHan = res.han;
            bestLimit = res.limit || '';
            bestYaku = [...res.yaku];
            bestWait = wait;
        }
    }

    return {
        points: Math.max(0, bestPoints),
        han: Math.max(0, bestHan),
        limit: bestLimit,
        yaku: bestYaku,
        bestWait
    };
}

export function buildBestCandidates(
    dealtTiles: Tile[],
    doraIndicators: Tile[],
    maxCount = 8,
    extraScoreOptions: Partial<ScoreOptions> = {},
    difficulty: Difficulty = 'MEDIUM'
): CandidateEvaluation[] {
    if (dealtTiles.length < 13) return [];

    const params = {
        EASY: { attempts: 200, improveSteps: 80, suitSeeds: false },
        MEDIUM: { attempts: 300, improveSteps: 120, suitSeeds: true },
        HARD: { attempts: 400, improveSteps: 150, suitSeeds: true }
    }[difficulty];

    const attempts = params.attempts;
    const improveSteps = params.improveSteps;
    const unique = new Map<string, CandidateEvaluation>();
    const baseIndices = dealtTiles.map((_, index) => index);
    const randomPick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const getHandByIndices = (indices: number[]) => indices.map((index) => dealtTiles[index]);

    const tryAddCandidate = (indices: number[]) => {
        const selected = [...indices].sort((a, b) => a - b);
        const key = selected.join('-');
        if (unique.has(key)) return;

        const hand = getHandByIndices(selected);
        const waits = getWinningTiles(hand);
        if (waits.length === 0) return;

        const score = evaluatePotentialScore(hand, waits, doraIndicators, extraScoreOptions);
        if (!score) return;

        unique.set(key, {
            indices: selected,
            hand,
            waits,
            score
        });
    };

    // Suit-focused seeding for Honitsu/Chinitsu potential
    if (params.suitSeeds) {
        const suits: Tile['suit'][] = ['man', 'pin', 'sou'];
        for (const suit of suits) {
            const suitIndices = baseIndices.filter(idx => dealtTiles[idx].suit === suit || dealtTiles[idx].suit === 'z');
            if (suitIndices.length >= 13) {
                // Initial seed using tiles from this suit + honors
                let selected = suitIndices.slice(0, 13);
                let selectedSet = new Set(selected);
                let currentHand = getHandByIndices(selected);
                let currentScore = evaluateHandQuality(currentHand, difficulty, doraIndicators);

                // Run a quick hill climb from this seed
                for (let step = 0; step < improveSteps; step++) {
                    const waits = getWinningTiles(currentHand);
                    if (waits.length > 0) {
                        tryAddCandidate(selected);
                        break;
                    }

                    const selectedIndex = randomPick(selected);
                    const unselectedPool = baseIndices.filter((index) => !selectedSet.has(index));
                    if (unselectedPool.length === 0) break;
                    const replacementIndex = randomPick(unselectedPool);

                    const nextSelected = selected.map((index) => (index === selectedIndex ? replacementIndex : index));
                    const nextHand = getHandByIndices(nextSelected);
                    const nextScore = evaluateHandQuality(nextHand, difficulty, doraIndicators);

                    if (nextScore >= currentScore || Math.random() < 0.1) {
                        selected = nextSelected;
                        selectedSet = new Set(selected);
                        currentHand = nextHand;
                        currentScore = nextScore;
                    }
                }
            }
        }
    }

    // Standard random starts
    for (let i = 0; i < attempts; i++) {
        const shuffled = [...baseIndices].sort(() => Math.random() - 0.5).slice(0, 13);
        let selected = [...shuffled];
        let selectedSet = new Set(selected);
        let currentHand = getHandByIndices(selected);
        // Use heuristic score instead of raw shanten
        let currentScore = evaluateHandQuality(currentHand, difficulty, doraIndicators);

        for (let step = 0; step < improveSteps; step++) {
            const waits = getWinningTiles(currentHand);
            if (waits.length > 0) {
                tryAddCandidate(selected);
                // Keep searching? In Hill Climbing usually we stop or restart.
                // Original code broke loop here.
                break;
            }

            const selectedIndex = randomPick(selected);
            const unselectedPool = baseIndices.filter((index) => !selectedSet.has(index));
            if (unselectedPool.length === 0) break;
            const replacementIndex = randomPick(unselectedPool);

            const nextSelected = selected.map((index) => (index === selectedIndex ? replacementIndex : index));
            const nextHand = getHandByIndices(nextSelected);
            const nextScore = evaluateHandQuality(nextHand, difficulty, doraIndicators);

            // Maximize score (Higher is better)
            // If difficulty is EASY, we might want to stick to Shanten?
            // currentScore from evaluateHandQuality ALREADY accounts for difficulty weights.
            // So we just maximize it.

            if (nextScore >= currentScore || Math.random() < 0.12) {
                selected = nextSelected;
                selectedSet = new Set(selected);
                currentHand = nextHand;
                currentScore = nextScore;
            }
        }
    }

    tryAddCandidate(baseIndices.slice(0, 13));

    return [...unique.values()]
        .sort((a, b) => compareCandidates(b, a))
        .slice(0, maxCount);
}

function compareCandidates(a: CandidateEvaluation, b: CandidateEvaluation): number {
    if (a.score.han !== b.score.han) return a.score.han - b.score.han;
    if (a.waits.length !== b.waits.length) return a.waits.length - b.waits.length;
    if (a.score.points !== b.score.points) return a.score.points - b.score.points;
    return a.score.yaku.length - b.score.yaku.length;
}

export function scoreCandidateForRate(candidate: { waits: Tile[]; score: PotentialScore }): number {
    return candidate.score.han * 1000 + candidate.waits.length * 120 + candidate.score.points / 100;
}
