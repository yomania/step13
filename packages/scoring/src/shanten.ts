import { Tile } from '@step13/proto';

// ---------------------------------------------------------
// Better Implementation for "Is Tenpai" / "Is Win"
// ---------------------------------------------------------

export function calculateShanten(hand: Tile[]): number {
    const indices = new Array(34).fill(0);
    for (const t of hand) {
        indices[tileToIndex(t)]++;
    }

    // 1. Chiitoitsu (7 pairs)
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
        if (indices[i] >= 2) pairs++;
    }
    const shanten7 = 6 - pairs; // 6 pairs needed for tenpai (waiting for 7th)

    // 2. Kokushi (13 Orphans)
    // (Skipping for simplified MVP)

    // 3. Standard
    // Min shanten of 4 sets + 1 pair
    const shantenStandard = getStandardShanten(indices);

    return Math.min(shanten7, shantenStandard);
}

function getStandardShanten(indices: number[]): number {
    // Initial shanten is 8
    let minShanten = 8;

    // Iterate all possible pair candidates
    for (let i = 0; i < 34; i++) {
        if (indices[i] >= 2) {
            indices[i] -= 2;
            const m_t = solveMentsu(indices);
            // Shanten = 8 - (Mentsu*2) - Tatsu - 1(Head)
            // Note: solveMentsu returns (M*2 + T).
            // But we need to distinguish M vs T for accurate shanten?
            // Actually standard shanten formula: 8 - 2*M - T - H
            // solveMentsu returns a "score" which is roughly comparable.
            // Let's refine solveMentsu to return {m, t} or just calculated value.
            // For now, assuming solveMentsu returns (M*2 + T) where T <= 4-M is enforced.

            const s = 8 - m_t - 1;
            if (s < minShanten) minShanten = s;
            indices[i] += 2;
        }
    }

    // Case without pair (waiting for pair)
    const m_t_noHead = solveMentsu(indices);
    const s_noHead = 8 - m_t_noHead;
    if (s_noHead < minShanten) minShanten = s_noHead;

    return minShanten;
}

function solveMentsu(indices: number[]): number {
    // Clone indices to avoid mutation issues during recursion if we modify in place
    // But since we backtrack, it's fine.
    // However, JS arrays are passed by reference.
    // We need to be careful. recursive calls modify 'indices'? 
    // Yes, 'recurseM' below modifies 'deck'. 'deck' is 'indices'.
    // Wait, 'getStandardShanten' calls 'solveMentsu(indices)'.
    // If 'solveMentsu' modifies 'indices', the loop in 'getStandardShanten' will be broken!
    // FIX: Clone indices.

    return recurseM([...indices], 0, 0, 0);
}

function recurseM(deck: number[], idx: number, m: number, t: number): number {
    if (idx >= 34) {
        // Upper limit for groups is 4
        if (m + t > 4) {
            // Prefer Mentsu
            return m * 2 + (4 - m);
        }
        return m * 2 + t;
    }

    if (deck[idx] === 0) return recurseM(deck, idx + 1, m, t);

    let bestScore = 0;

    // 1. Koutsu
    if (deck[idx] >= 3) {
        deck[idx] -= 3;
        bestScore = Math.max(bestScore, recurseM(deck, idx, m + 1, t));
        deck[idx] += 3;
    }

    // 2. Shuntsu
    if (idx < 27 && idx % 9 < 7) {
        if (deck[idx] > 0 && deck[idx + 1] > 0 && deck[idx + 2] > 0) {
            deck[idx]--; deck[idx + 1]--; deck[idx + 2]--;
            // Shuntsu consumes 1 of each. We might form another Shuntsu starting here?
            // Yes, e.g. 2,2,3,3,4,4.
            bestScore = Math.max(bestScore, recurseM(deck, idx, m + 1, t));
            deck[idx]++; deck[idx + 1]++; deck[idx + 2]++;
        }
    }

    // 3. Tatsu (Count at current idx)
    // Pair
    if (deck[idx] >= 2) {
        deck[idx] -= 2;
        bestScore = Math.max(bestScore, recurseM(deck, idx, m, t + 1));
        deck[idx] += 2;
    }
    // Penchan/Kanchan/Ryanmen (Neighbor)
    if (idx < 27 && idx % 9 < 8) {
        if (deck[idx] > 0 && deck[idx + 1] > 0) {
            deck[idx]--; deck[idx + 1]--;
            bestScore = Math.max(bestScore, recurseM(deck, idx, m, t + 1));
            deck[idx]++; deck[idx + 1]++;
        }
        // Skip gap (Kanchan) 1,3
        if (idx % 9 < 7 && deck[idx] > 0 && deck[idx + 2] > 0) {
            deck[idx]--; deck[idx + 2]--;
            bestScore = Math.max(bestScore, recurseM(deck, idx, m, t + 1));
            deck[idx]++; deck[idx + 2]++;
        }
    }

    // 4. Skip (Don't use this instance of tile for anything)
    // We treat it as isolated.
    // If we just skip 'idx', we move to 'idx+1' but the tile at 'idx' remains in 'deck'.
    // Wait, if we don't use the tile at 'idx', we should conceptually 'discard' it from consideration?
    // If we pass 'deck' (which has count > 0 at idx) to 'idx+1', we effectively ignore those tiles?
    // Yes, that's what we want for "partial match".

    bestScore = Math.max(bestScore, recurseM(deck, idx + 1, m, t));

    return bestScore;
}


// Utils
function tileToIndex(t: Tile): number {
    const suits = ['man', 'pin', 'sou', 'z'];
    const sIdx = suits.indexOf(t.suit);
    const r = t.rank; // number 1-9

    if (sIdx === 3) {
        // Honors: z1-z7
        return 27 + (r - 1);
    }
    // m,p,s: 1-9 -> 0-8
    return sIdx * 9 + (r - 1);
}

export function isTenpai(hand: Tile[]): boolean {
    return calculateShanten(hand) <= 0;
}
