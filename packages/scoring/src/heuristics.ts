
import { Tile } from '@step13/proto';
import { HandStructure, analyzeStructure, HandBlock } from './structure';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface HeuristicWeights {
    shanten: number;
    ukeire: number;
    efficiency: number;

    // Yaku Potentials
    honitsu: number; // Mixed Flush
    chinitsu: number; // Pure Flush
    sanshoku: number; // Mixed Triple Sequence
    chanta: number; // Terminal/Honor in each set
    dora: number; // Dora value

    // Structure
    koutsu: number; // Triplet
    pair: number; // Pair
    ryanmen: number; // Open Wait

    // General
    speedvsValue: number; // 0 = Speed only, 1 = Value only
    safety: number; // Importance of discarding safe tiles (0 to 1)
}

const WEIGHTS: Record<Difficulty, HeuristicWeights> = {
    EASY: {
        shanten: 10000,
        ukeire: 100,
        efficiency: 1,
        honitsu: 0,
        chinitsu: 0,
        sanshoku: 0,
        chanta: 0,
        dora: 10,
        koutsu: 0,
        pair: 50,
        ryanmen: 10,
        speedvsValue: 0.0,
        safety: 0.1
    },
    MEDIUM: {
        shanten: 5000,
        ukeire: 50,
        efficiency: 1,
        honitsu: 500,
        chinitsu: 800,
        sanshoku: 300,
        chanta: 200,
        dora: 50,
        koutsu: 20,
        pair: 100,
        ryanmen: 30,
        speedvsValue: 0.3,
        safety: 0.4
    },
    HARD: {
        shanten: 4000,
        ukeire: 20,
        efficiency: 1,
        honitsu: 6000, // Very high priority for Yaku potential
        chinitsu: 10000,
        sanshoku: 3000,
        chanta: 2500,
        dora: 300,
        koutsu: 100,
        pair: 500,
        ryanmen: 150,
        speedvsValue: 0.9, // Higher focus on value
        safety: 0.7
    }
};

export function evaluateHandQuality(
    hand: Tile[],
    difficulty: Difficulty = 'MEDIUM',
    doraIndicators: Tile[] = [],
    dangerMap?: Record<string, number>, // Optional: Danger level per tile key (0 to 1)
    scoreDiff?: number // Optional: myScore - opponentScore
): number {
    const baseWeights = WEIGHTS[difficulty];
    const weights: HeuristicWeights = { ...baseWeights };

    // Dynamic weighting based on score difference
    if (scoreDiff !== undefined) {
        if (scoreDiff < -12000) {
            // Losing badly: prioritize high value (han) over speed (shanten)
            weights.speedvsValue = Math.min(1.0, weights.speedvsValue + 0.3);
            weights.safety *= 0.5; // Take more risks
        } else if (scoreDiff > 12000) {
            // Winning safely: prioritize safety and speed
            weights.speedvsValue = Math.max(0.1, weights.speedvsValue - 0.2);
            weights.safety *= 1.4; // Play safer
        }
    }

    const structure = analyzeStructure(hand);

    // 1. Base Score: Shanten (Lower is better)
    // We start with a high base constant to avoid negatives
    let score = (10 - structure.shanten) * weights.shanten;

    // 2. Yaku Potential
    const yakuScore = evaluateYakuPotential(hand, structure, weights);

    score += yakuScore;

    // 3. Structure Quality (Ryanmen vs Penchan etc)
    for (const block of structure.blocks) {
        if (block.type === 'triplet') score += weights.koutsu;
        if (block.type === 'pair') score += weights.pair;
        if (block.type === 'ryanmen') score += weights.ryanmen;
        // Penalties for bad waits?
        if (block.type === 'penchan' || block.type === 'kanchan') score -= 50;
    }

    // 4. Dora
    let doraCount = 0;
    const nextDoras = doraIndicators.map(nextDora);
    for (const t of hand) {
        if (t.isRed) doraCount++;
        for (const d of nextDoras) {
            if (t.suit === d.suit && t.rank === d.rank) doraCount++;
        }
    }
    score += doraCount * weights.dora;

    // 5. Safety (Minefield Mahjong specific)
    // In 17-steps, we discard tiles. The remaining tiles in the 34-tile pool (not in hand) will be discarded.
    // We want to MINIMIZE the danger of tiles that ARE NOT in our hand.
    // However, buildBestCandidates works on the HAND.
    // So we should reward KEEPING dangerous tiles in hand.
    if (dangerMap) {
        let handDangerScore = 0;
        for (const t of hand) {
            const key = `${t.suit}${t.rank}`;
            const danger = dangerMap[key] || 0;
            handDangerScore += danger;
        }
        // Reward keeping dangerous tiles in hand (so they aren't discarded)
        score += handDangerScore * weights.safety * 5000;

        // Defensive "Anko Wall" strategy:
        // Reward keeping Triplets of non-useful tiles to discard them as a safe set (if they are safe)
        // or simply to reduce opponent's resource.
        for (const block of structure.blocks) {
            if (block.type === 'triplet') {
                const key = `${block.suit}${block.rank}`;
                const danger = dangerMap[key] || 0;
                // If the triplet is very safe (danger is low), it's a great defensive wall when discarded.
                if (danger < 0.2) {
                    score += 2000 * weights.safety;
                }
            }
        }
    }

    // 6. Mangan+ Potential Boost (17-bo specialization)
    // Encourage hands that are likely to reach 4+ han
    if (yakuScore > 1000) {
        if (difficulty === 'HARD') {
            score += 15000; // 고타점 역 지향성을 대폭 강화
        } else {
            score += 5000; // Bonus for any solid yaku candidate
        }
    }

    return score;
}

function evaluateYakuPotential(hand: Tile[], structure: HandStructure, weights: HeuristicWeights): number {
    let score = 0;

    // Detect generic blocks from remaining tiles (to catch Tatsus/Pairs that structure decomposition missed due to shanten constraints)
    const extraBlocks = findPotentialBlocks(structure.remainingTiles);
    const allBlocks = [...structure.blocks, ...extraBlocks];

    // Use allBlocks for Yaku detection instead of structure.blocks where applicable

    // Honitsu / Chinitsu
    const suitCounts = { man: 0, pin: 0, sou: 0, z: 0 };
    for (const t of hand) {
        suitCounts[t.suit]++;
    }

    const maxSuit = Math.max(suitCounts.man, suitCounts.pin, suitCounts.sou);
    const honors = suitCounts.z;
    const totalSuited = maxSuit + honors;

    // Heuristic: Honitsu/Chinitsu Gradient
    // Start rewarding from 6 tiles to guide the search
    // Maximize at 10+ tiles
    if (totalSuited >= 6) {
        // Linear ramp: 6->0.1, 7->0.2, 8->0.4, 9->0.7, 10->1.0
        const factor = Math.max(0, (totalSuited - 5) / 5.0); // 1->0.2, 5->1.0

        // Base bonus just for having many suited tiles
        score += weights.honitsu * factor * 0.5;

        // Extra bonus if high concentration
        if (totalSuited >= 9) {
            score += weights.honitsu * (totalSuited - 8);
        }

        // Chinitsu Check
        if (honors === 0 && maxSuit >= 6) {
            const cFactor = Math.max(0, (maxSuit - 5) / 5.0);
            score += weights.chinitsu * cFactor * 0.5;
            if (maxSuit >= 9) {
                score += weights.chinitsu * (maxSuit - 8);
            }
        }
    }

    // Sanshoku
    // Check if we have sequences starting at same rank in different suits
    // Or just partial shapes (e.g. 12m, 12p, 12s)
    const seqStarts = { man: new Set<number>(), pin: new Set<number>(), sou: new Set<number>() };
    for (const block of allBlocks) {
        if (block.type === 'sequence' || block.type === 'ryanmen' || block.type === 'penchan' || block.type === 'kanchan') {
            if (block.suit !== 'z') {
                seqStarts[block.suit as 'man' | 'pin' | 'sou'].add(block.rank);
            }
        }
    }

    let sanshokuMatches = 0;
    for (let r = 1; r <= 7; r++) {
        let count = 0;
        if (seqStarts.man.has(r)) count++;
        if (seqStarts.pin.has(r)) count++;
        if (seqStarts.sou.has(r)) count++;
        if (count >= 2) sanshokuMatches += count; // 2 or 3 suits matching
    }
    if (sanshokuMatches > 0) {
        score += weights.sanshoku * sanshokuMatches;
    }

    // Chanta
    let terminalBlocks = 0;
    for (const block of allBlocks) {
        if (isTerminalBlock(block.type, block.rank, block.suit)) {
            terminalBlocks++;
        }
    }
    // Also check "remaining" remaining tiles (those not even used in extraBlocks)
    // Actually, simply using allBlocks + remaining of remaining is better?
    // But findPotentialBlocks consumes tiles.
    // For simplicitly, we just treat extraBlocks as blocks. 
    // And any tile NOT in extraBlocks (still isolated) should be checked?
    // Correct approach: We decomposed remainingTiles into extraBlocks and "true isolated".
    // We can re-scan remainingTiles, but exclude those used in extraBlocks?
    // Or just scan remainingTiles assuming they are mostly single?
    // Note: isTerminalBlock logic covers Pairs/Tatsus/Seqs.
    // Single tiles must be checked separately.
    // Since we upgraded some singles to blocks, we shouldn't double count.
    // We'll iterate remainingTiles, if a tile was NOT used in extraBlocks, adding 0.5.
    // But this requires tracking usage.
    // Simplification: terminalBlocks += 0.5 * isolatedCount.
    // isolatedCount = structure.remainingTiles.length - (extraBlocks * 2).

    // Count terminals in true isolated
    // We don't know exactly WHICH tiles were used, but basic count helps.
    // Just blindly iterating remainingTiles and adding 0.5 is flawed if they are now Count=1 blocks.
    // But 1 Block (Penchan) = 1.0. 2 Tiles (Iso) = 1.0.
    // So converting 2 Isos to 1 Penchan changes score 1.0 -> 1.0. No change for Chanta!
    // UNLESS the block detection sees 123 as 1 block (1.0).
    // So for Chanta, identifying 89p (Penchan) vs 8p, 9p (Iso) doesn't change score.
    // The previous analysis (Step 319) showed Chanta score was key, but maybe math says it's neutral?
    // If neutral, then Sanshoku is the ONLY differentiator.
    // And Sanshoku relies heavily on block identification.
    // So extraBlocks logic is CRITICAL for Sanshoku.

    // For Chanta, I'll keep the old logic of iterating structure.remainingTiles for partial credit,
    // as extraBlocks just formalize them.
    // Actually, if I count extraBlocks as 1.0, and they consume 2 tiles...
    // 2 Isos = 1.0. 1 Penchan = 1.0. 
    // So it matches.
    // BUT we must NOT count them as Isos again if counted as Blocks.
    // Logic: calculate from allBlocks. Then add 0.5 * (remainingTiles.length - usedInExtra).
    // Approximate remaining count.

    // Assume distribution of terminals in true remaining is regular.
    // Let's just scan all remainingTiles and multiply by (1 - usedRatio)? Too complex.

    // Simple fallback: Just add 0.5 for every terminal in remainingTiles, 
    // BUT subtract 1.0 for every extraBlock that is terminal?
    // Effectively replacing the score contribution.

    // Better: Only count true isolated.
    const remainingCopy = [...structure.remainingTiles];
    // Remove tiles used in extraBlocks (greedy match).
    for (const b of extraBlocks) {
        for (const t of b.tiles) {
            const idx = remainingCopy.findIndex(rt => rt.suit === t.suit && rt.rank === t.rank);
            if (idx !== -1) remainingCopy.splice(idx, 1);
        }
    }
    for (const t of remainingCopy) {
        if (isTerminal(t)) terminalBlocks += 0.5;
    }

    if (terminalBlocks >= 4) {
        score += weights.chanta * (terminalBlocks - 3);
    }

    // Chiitoitsu (7 Pairs)
    // Explicitly check pair count
    let pairCount = 0;
    const counts: Record<string, number> = {};
    for (const t of hand) {
        const key = `${t.suit}${t.rank}`;
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] === 2) pairCount++;
    }
    if (pairCount >= 5) {
        // Boost Chiitoitsu score
        // 5 pairs = 1-shanten to Tenpai (6 pairs). 
        // We want this to be competitive with 2-shanten standard hands.
        score += pairCount * 800;

        if (pairCount >= 6) {
            // Tenpai for Chiitoitsu (6 pairs + single)
            score += 5000;
        }
    }

    return score;
}

function findPotentialBlocks(tiles: Tile[]): HandBlock[] {
    const blocks: HandBlock[] = [];
    const pool = [...tiles].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });

    const used = new Array(pool.length).fill(false);

    // 1. Find Pairs
    for (let i = 0; i < pool.length - 1; i++) {
        if (used[i]) continue;
        if (pool[i].suit === pool[i + 1].suit && pool[i].rank === pool[i + 1].rank) {
            used[i] = true; used[i + 1] = true;
            blocks.push({ type: 'pair', tiles: [pool[i], pool[i + 1]], suit: pool[i].suit, rank: pool[i].rank });
        }
    }

    // 2. Find Tatsus (Ryanmen, Penchan, Kanchan)
    // Reset usage for non-pairs? No, pure greedy. Pairs are valuable.
    // Actually, for block potential, Tatsu might be better for Shanten, but Pair is good for structure.
    for (let i = 0; i < pool.length - 1; i++) {
        if (used[i]) continue;
        const current = pool[i];
        if (current.suit === 'z') continue; // Honor Tatsus not possible (unless pair, handled above)

        // Look for neighbor
        const nextIdx = pool.findIndex((t, idx) => idx > i && !used[idx] && t.suit === current.suit && (t.rank === current.rank + 1 || t.rank === current.rank + 2));

        if (nextIdx !== -1) {
            const next = pool[nextIdx];
            used[i] = true;
            used[nextIdx] = true;

            const diff = next.rank - current.rank;
            if (diff === 1) {
                // Ryanmen or Penchan
                if (current.rank === 1 || next.rank === 9) {
                    blocks.push({ type: 'penchan', tiles: [current, next], suit: current.suit, rank: current.rank });
                } else {
                    blocks.push({ type: 'ryanmen', tiles: [current, next], suit: current.suit, rank: current.rank });
                }
            } else if (diff === 2) {
                blocks.push({ type: 'kanchan', tiles: [current, next], suit: current.suit, rank: current.rank });
            }
        }
    }

    return blocks;
}

function isTerminal(t: Tile) {
    return t.suit === 'z' || t.rank === 1 || t.rank === 9;
}

function isTerminalBlock(type: string, rank: number, suit: Tile['suit']) {
    if (suit === 'z') return true;
    if (type === 'sequence') return rank === 1 || rank === 7; // 123 or 789
    if (type === 'triplet' || type === 'pair') return rank === 1 || rank === 9;
    if (type === 'ryanmen') return false; // Ryanmen usually middle
    if (type === 'penchan') return rank === 1 || rank === 8; // 12 or 89
    return false;
}

function nextDora(tile: Tile): Tile {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4) return { suit: 'z', rank: (tile.rank === 4 ? 1 : tile.rank + 1) as any, isRed: false };
        if (tile.rank >= 5 && tile.rank <= 7) return { suit: 'z', rank: (tile.rank === 7 ? 5 : tile.rank + 1) as any, isRed: false };
    }
    return { suit: tile.suit, rank: (tile.rank === 9 ? 1 : tile.rank + 1) as any, isRed: false };
}
