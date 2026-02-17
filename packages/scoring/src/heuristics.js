"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateHandQuality = evaluateHandQuality;
const structure_1 = require("./structure");
const WEIGHTS = {
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
        shanten: 2000, // Reduced penalty for high shanten if value is high
        ukeire: 20,
        efficiency: 1,
        honitsu: 2500, // High value for Honitsu
        chinitsu: 4000,
        sanshoku: 1500,
        chanta: 1200,
        dora: 200,
        koutsu: 50,
        pair: 300,
        ryanmen: 80,
        speedvsValue: 0.8,
        safety: 0.7
    }
};
function evaluateHandQuality(hand, difficulty = 'MEDIUM', doraIndicators = [], dangerMap, // Optional: Danger level per tile key (0 to 1)
scoreDiff // Optional: myScore - opponentScore
) {
    const baseWeights = WEIGHTS[difficulty];
    const weights = { ...baseWeights };
    // Dynamic weighting based on score difference
    if (scoreDiff !== undefined) {
        if (scoreDiff < -12000) {
            // Losing badly: prioritize high value (han) over speed (shanten)
            weights.speedvsValue = Math.min(1.0, weights.speedvsValue + 0.3);
            weights.safety *= 0.5; // Take more risks
        }
        else if (scoreDiff > 12000) {
            // Winning safely: prioritize safety and speed
            weights.speedvsValue = Math.max(0.1, weights.speedvsValue - 0.2);
            weights.safety *= 1.4; // Play safer
        }
    }
    const structure = (0, structure_1.analyzeStructure)(hand);
    // 1. Base Score: Shanten (Lower is better)
    // We start with a high base constant to avoid negatives
    let score = (10 - structure.shanten) * weights.shanten;
    // 2. Yaku Potential
    const yakuScore = evaluateYakuPotential(hand, structure, weights);
    score += yakuScore;
    // 3. Structure Quality (Ryanmen vs Penchan etc)
    for (const block of structure.blocks) {
        if (block.type === 'triplet')
            score += weights.koutsu;
        if (block.type === 'pair')
            score += weights.pair;
        if (block.type === 'ryanmen')
            score += weights.ryanmen;
        // Penalties for bad waits?
        if (block.type === 'penchan' || block.type === 'kanchan')
            score -= 50;
    }
    // 4. Dora
    let doraCount = 0;
    const nextDoras = doraIndicators.map(nextDora);
    for (const t of hand) {
        if (t.isRed)
            doraCount++;
        for (const d of nextDoras) {
            if (t.suit === d.suit && t.rank === d.rank)
                doraCount++;
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
        score += 5000; // Bonus for any solid yaku candidate
    }
    return score;
}
function evaluateYakuPotential(hand, structure, weights) {
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
    // Heuristic: If we have > 9 tiles of one suit+honors, strongly encourage Honitsu
    if (totalSuited >= 10) {
        score += weights.honitsu * (totalSuited - 9); // Scaled bonus
        if (honors === 0 && maxSuit >= 10) {
            score += weights.chinitsu * (maxSuit - 9);
        }
    }
    // Sanshoku
    // Check if we have sequences starting at same rank in different suits
    // Or just partial shapes (e.g. 12m, 12p, 12s)
    const seqStarts = { man: new Set(), pin: new Set(), sou: new Set() };
    for (const block of allBlocks) {
        if (block.type === 'sequence' || block.type === 'ryanmen' || block.type === 'penchan' || block.type === 'kanchan') {
            if (block.suit !== 'z') {
                seqStarts[block.suit].add(block.rank);
            }
        }
    }
    let sanshokuMatches = 0;
    for (let r = 1; r <= 7; r++) {
        let count = 0;
        if (seqStarts.man.has(r))
            count++;
        if (seqStarts.pin.has(r))
            count++;
        if (seqStarts.sou.has(r))
            count++;
        if (count >= 2)
            sanshokuMatches += count; // 2 or 3 suits matching
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
            if (idx !== -1)
                remainingCopy.splice(idx, 1);
        }
    }
    for (const t of remainingCopy) {
        if (isTerminal(t))
            terminalBlocks += 0.5;
    }
    if (terminalBlocks >= 4) {
        score += weights.chanta * (terminalBlocks - 3);
    }
    // Chiitoitsu (7 Pairs)
    // Explicitly check pair count
    let pairCount = 0;
    const counts = {};
    for (const t of hand) {
        const key = `${t.suit}${t.rank}`;
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] === 2)
            pairCount++;
    }
    if (pairCount >= 5) {
        // Boost Chiitoitsu score
        score += pairCount * 300;
    }
    return score;
}
function findPotentialBlocks(tiles) {
    const blocks = [];
    const pool = [...tiles].sort((a, b) => {
        if (a.suit !== b.suit)
            return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });
    const used = new Array(pool.length).fill(false);
    // 1. Find Pairs
    for (let i = 0; i < pool.length - 1; i++) {
        if (used[i])
            continue;
        if (pool[i].suit === pool[i + 1].suit && pool[i].rank === pool[i + 1].rank) {
            used[i] = true;
            used[i + 1] = true;
            blocks.push({ type: 'pair', tiles: [pool[i], pool[i + 1]], suit: pool[i].suit, rank: pool[i].rank });
        }
    }
    // 2. Find Tatsus (Ryanmen, Penchan, Kanchan)
    // Reset usage for non-pairs? No, pure greedy. Pairs are valuable.
    // Actually, for block potential, Tatsu might be better for Shanten, but Pair is good for structure.
    for (let i = 0; i < pool.length - 1; i++) {
        if (used[i])
            continue;
        const current = pool[i];
        if (current.suit === 'z')
            continue; // Honor Tatsus not possible (unless pair, handled above)
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
                }
                else {
                    blocks.push({ type: 'ryanmen', tiles: [current, next], suit: current.suit, rank: current.rank });
                }
            }
            else if (diff === 2) {
                blocks.push({ type: 'kanchan', tiles: [current, next], suit: current.suit, rank: current.rank });
            }
        }
    }
    return blocks;
}
function isTerminal(t) {
    return t.suit === 'z' || t.rank === 1 || t.rank === 9;
}
function isTerminalBlock(type, rank, suit) {
    if (suit === 'z')
        return true;
    if (type === 'sequence')
        return rank === 1 || rank === 7; // 123 or 789
    if (type === 'triplet' || type === 'pair')
        return rank === 1 || rank === 9;
    if (type === 'ryanmen')
        return false; // Ryanmen usually middle
    if (type === 'penchan')
        return rank === 1 || rank === 8; // 12 or 89
    return false;
}
function nextDora(tile) {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4)
            return { suit: 'z', rank: (tile.rank === 4 ? 1 : tile.rank + 1), isRed: false };
        if (tile.rank >= 5 && tile.rank <= 7)
            return { suit: 'z', rank: (tile.rank === 7 ? 5 : tile.rank + 1), isRed: false };
    }
    return { suit: tile.suit, rank: (tile.rank === 9 ? 1 : tile.rank + 1), isRed: false };
}
