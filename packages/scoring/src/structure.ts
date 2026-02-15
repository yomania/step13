
import { Tile } from '@step13/proto';

export type BlockType = 'sequence' | 'triplet' | 'pair' | 'ryanmen' | 'kanchan' | 'penchan' | 'isolated';

export interface HandBlock {
    type: BlockType;
    tiles: Tile[];
    suit: Tile['suit'];
    /** For sequence/tatsu, the first rank. For triplet/pair, the rank. */
    rank: number;
}

export interface HandStructure {
    shanten: number;
    blocks: HandBlock[];
    remainingTiles: Tile[]; // Isolated or unused tiles
}

// Reuse tileToIndex from shanten.ts (duplicate here for standalone)
function tileToIndex(t: Tile): number {
    const suits = ['man', 'pin', 'sou', 'z'];
    const sIdx = suits.indexOf(t.suit);
    const r = t.rank;
    if (sIdx === 3) return 27 + (r - 1);
    return sIdx * 9 + (r - 1);
}

function indexToTile(idx: number): Tile {
    if (idx >= 27) {
        return { suit: 'z', rank: (idx - 27 + 1) as any, isRed: false };
    }
    const suits = ['man', 'pin', 'sou'] as const;
    const sIdx = Math.floor(idx / 9);
    const rank = (idx % 9) + 1;
    return { suit: suits[sIdx], rank: rank as any, isRed: false };
}

/**
 * Decomposes a hand into its most efficient block structure.
 * This is a simplified structural analysis that prefers completed sets > complex tatsu > pair > isolated.
 * It does NOT guarantee the absolute optimal shanten path if multiple paths exist, 
 * but it tries to find the structure that matches the standard shanten calculation.
 */
export function analyzeStructure(hand: Tile[]): HandStructure {
    const indices = new Array(34).fill(0);
    for (const t of hand) indices[tileToIndex(t)]++;

    // We will attempt to extract blocks greedily but with backtracking?
    // Given we want "Yaku Potential", we want to know what we have.
    // Let's use a standard 4-mentsu + 1-head target decomposition.

    // Since we need this for heuristics, strict shanten optimality isn't the ONLY goal,
    // but identifying "We have a sequence 123m" is important.

    // Strategy:
    // 1. Calculate Shanten (we can use the existing function or re-derive).
    // 2. We want the structure that yields that shanten (or close to it) AND maximizes value?
    // Actually, for "Structure", we just want "What are the components?".

    // Let's implement a recursive solver that collects blocks.

    const bestResult: { shanten: number, blocks: HandBlock[], remaining: Tile[] } = {
        shanten: 8,
        blocks: [],
        remaining: []
    };

    function solve(currentIndices: number[], currentBlocks: HandBlock[]) {
        // Find first non-zero index
        let idx = 0;
        while (idx < 34 && currentIndices[idx] === 0) idx++;

        if (idx === 34) {
            // Finished. Calculate shanten of this configuration.
            // Shanten = 8 - (M * 2) - T - Pairs? 
            // Standard: 8 - 2*Set - Tatsu - Pair
            // But we must respect the "4 sets + 1 pair" limit for standard shanten.

            let m = 0; // sets
            let t = 0; // tatsu
            let p = 0; // pair

            for (const b of currentBlocks) {
                if (b.type === 'sequence' || b.type === 'triplet') m++;
                else if (b.type === 'pair') p++;
                else if (['ryanmen', 'kanchan', 'penchan'].includes(b.type)) t++;
            }

            // Standard Shanten Check
            // Based on simple formula (ignoring complex overlap logic for now, assumed handled by decomposition)
            // Limit sets+tatsu to 4.
            // If we have >4 blocks? We keep best ones.
            // But here we just want to classify.

            // Count sets
            let sets = m;
            // Count effective tatsu/pairs
            // We need 1 pair.
            let hasHead = p > 0;
            let effectiveTatsu = t + (hasHead ? p - 1 : p); // Extra pairs act as tatsu

            if (sets + effectiveTatsu > 4) {
                effectiveTatsu = 4 - sets;
            }

            const score = 8 - (sets * 2) - effectiveTatsu - (hasHead ? 1 : 0);

            // Prefer lower shanten, then more blocks (sets > tatsu)
            if (score < bestResult.shanten || (score === bestResult.shanten && currentBlocks.length > bestResult.blocks.length)) {
                bestResult.shanten = score;
                bestResult.blocks = [...currentBlocks];
                bestResult.remaining = []; // All consumed? No, indices check was 0.
            }
            return;
        }

        // Try Koutsu
        if (currentIndices[idx] >= 3) {
            currentIndices[idx] -= 3;
            const tile = indexToTile(idx);
            solve(currentIndices, [...currentBlocks, {
                type: 'triplet',
                tiles: [tile, tile, tile],
                suit: tile.suit,
                rank: tile.rank
            }]);
            currentIndices[idx] += 3;
        }

        // Try Shuntsu
        if (idx < 27 && idx % 9 < 7) {
            if (currentIndices[idx] > 0 && currentIndices[idx + 1] > 0 && currentIndices[idx + 2] > 0) {
                currentIndices[idx]--; currentIndices[idx + 1]--; currentIndices[idx + 2]--;
                const t1 = indexToTile(idx);
                const t2 = indexToTile(idx + 1);
                const t3 = indexToTile(idx + 2);
                solve(currentIndices, [...currentBlocks, {
                    type: 'sequence',
                    tiles: [t1, t2, t3],
                    suit: t1.suit,
                    rank: t1.rank
                }]);
                currentIndices[idx]++; currentIndices[idx + 1]++; currentIndices[idx + 2]++;
            }
        }

        // Try Pair
        if (currentIndices[idx] >= 2) {
            currentIndices[idx] -= 2;
            const tile = indexToTile(idx);
            solve(currentIndices, [...currentBlocks, {
                type: 'pair',
                tiles: [tile, tile],
                suit: tile.suit,
                rank: tile.rank
            }]);
            currentIndices[idx] += 2;
        }

        // Try Tatsu
        // Ryanmen/Penchan
        if (idx < 27 && idx % 9 < 8) {
            if (currentIndices[idx] > 0 && currentIndices[idx + 1] > 0) {
                currentIndices[idx]--; currentIndices[idx + 1]--;
                const t1 = indexToTile(idx);
                const t2 = indexToTile(idx + 1);
                // Determine loop (Ryanmen) or Penchan (1-2 or 8-9)
                let type: BlockType = 'ryanmen';
                if (t1.rank === 1 || t1.rank === 8) type = 'penchan';

                solve(currentIndices, [...currentBlocks, {
                    type,
                    tiles: [t1, t2],
                    suit: t1.suit,
                    rank: t1.rank
                }]);
                currentIndices[idx]++; currentIndices[idx + 1]++;
            }
        }
        // Kanchan
        if (idx < 27 && idx % 9 < 7) {
            if (currentIndices[idx] > 0 && currentIndices[idx + 2] > 0) {
                currentIndices[idx]--; currentIndices[idx + 2]--;
                const t1 = indexToTile(idx);
                const t3 = indexToTile(idx + 2);
                solve(currentIndices, [...currentBlocks, {
                    type: 'kanchan',
                    tiles: [t1, t3],
                    suit: t1.suit,
                    rank: t1.rank
                }]);
                currentIndices[idx]++; currentIndices[idx + 2]++;
            }
        }

        // Skip (Treat as isolated)
        // Backtracking optimization: Only skip if we tried possible structures and they failed? 
        // Or strictly if we assume this tile is isolated.
        // If we treat it as isolated, we just move to next index.
        const isoTile = indexToTile(idx);
        // We temporarily conceptually remove it from "indices" to move forward, 
        // but we add it to "remaining" in the end result if this path is chosen.
        // Actually, let's just decrement and re-add?
        // No, if we decrement, we are saying "we used it".
        // Here "used" means "added to blocks" OR "identified as isolated".

        currentIndices[idx]--;
        solve(currentIndices, [...currentBlocks, {
            type: 'isolated',
            tiles: [isoTile],
            suit: isoTile.suit,
            rank: isoTile.rank
        }]);
        currentIndices[idx]++;
    }

    solve([...indices], []);

    return {
        shanten: bestResult.shanten,
        blocks: bestResult.blocks.filter(b => b.type !== 'isolated'),
        remainingTiles: bestResult.blocks.filter(b => b.type === 'isolated').flatMap(b => b.tiles)
    };
}
