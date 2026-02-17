"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
const shanten_1 = require("./shanten");
const DEFAULT_OPTIONS = {
    requireManganMinimum: false,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: false,
    seatWind: undefined,
    roundWind: undefined
};
function calculateScore(hand, winTile, isTsumo, doraIndicators = [], options = {}) {
    if (isTsumo) {
        // PRD is ron-only. Kept for API compatibility.
    }
    const resolved = { ...DEFAULT_OPTIONS, ...options };
    const fullHand = winTile ? [...hand, winTile] : [...hand];
    if ((0, shanten_1.calculateShanten)(fullHand) > -1) {
        return {
            han: 0,
            fu: 0,
            points: 0,
            yaku: [],
            isMangan: false,
            doraCount: 0,
            pointsDelta: 0,
            limitCategory: undefined,
            limit: undefined
        };
    }
    const counts = countTiles(fullHand);
    const isChiitoi = isChiitoitsu(fullHand, counts);
    const decompositions = isChiitoi ? [] : enumerateStandardHandDecompositions(counts);
    const yaku = [];
    let yakuHan = 0;
    if (isChiitoi) {
        yaku.push('Chiitoitsu');
        yakuHan += 2;
    }
    const isTanyao = fullHand.every((tile) => tile.suit !== 'z' && tile.rank > 1 && tile.rank < 9);
    if (isTanyao) {
        yaku.push('Tanyao');
        yakuHan += 1;
    }
    const suits = new Set(fullHand.map((tile) => tile.suit));
    const hasHonor = fullHand.some((tile) => tile.suit === 'z');
    if (!hasHonor && suits.size === 1) {
        yaku.push('Chinitsu');
        yakuHan += 6;
    }
    else if (hasHonor && suits.size === 2) {
        yaku.push('Honitsu');
        yakuHan += 3;
    }
    if (!isChiitoi) {
        if (hasPinfu(decompositions, winTile, resolved.seatWind, resolved.roundWind)) {
            yaku.push('Pinfu');
            yakuHan += 1;
        }
        if (hasSanshokuDoujun(decompositions)) {
            yaku.push('SanshokuDoujun');
            yakuHan += 2;
        }
        if (hasSanshokuDoukou(counts)) {
            yaku.push('SanshokuDoukou');
            yakuHan += 2;
        }
        if (hasToitoi(decompositions)) {
            yaku.push('Toitoi');
            yakuHan += 2;
        }
        if (hasSanankou(decompositions)) {
            yaku.push('Sanankou');
            yakuHan += 2;
        }
        if (hasJunchan(decompositions, fullHand)) {
            yaku.push('Junchan');
            yakuHan += 3;
        }
        else if (hasChanta(decompositions, fullHand)) {
            yaku.push('Chanta');
            yakuHan += 2;
        }
        if (hasHonroutou(fullHand)) {
            yaku.push('Honroutou');
            yakuHan += 2;
        }
        if (hasShousangen(decompositions)) {
            yaku.push('Shousangen');
            yakuHan += 2;
        }
        if (hasIttsuu(counts)) {
            yaku.push('Ittsuu');
            yakuHan += 2;
        }
        if (hasIipeikou(counts)) {
            yaku.push('Iipeikou');
            yakuHan += 1;
        }
    }
    for (const dragon of ['z5', 'z6', 'z7']) {
        if ((counts[dragon] || 0) >= 3) {
            yaku.push(`Yakuhai: ${dragon}`);
            yakuHan += 1;
        }
    }
    const seatWindTile = resolved.seatWind ? windToHonorTileKey(resolved.seatWind) : null;
    if (seatWindTile && (counts[seatWindTile] || 0) >= 3) {
        yaku.push(`Yakuhai(Seat): ${seatWindTile}`);
        yakuHan += 1;
    }
    const roundWindTile = resolved.roundWind ? windToHonorTileKey(resolved.roundWind) : null;
    if (roundWindTile && (counts[roundWindTile] || 0) >= 3) {
        yaku.push(`Yakuhai(Round): ${roundWindTile}`);
        yakuHan += 1;
    }
    const doraCount = countDora(fullHand, doraIndicators);
    if (doraCount > 0) {
        yaku.push(`Dora ${doraCount}`);
    }
    if (resolved.autoRiichiFallback) {
        yaku.push('Riichi (Auto)');
        yakuHan += 1;
    }
    const han = yakuHan + doraCount;
    const fu = isChiitoi ? 25 : 30;
    const fullScore = calculatePointByHanFu(han, fu, resolved.kiriageMangan);
    const hanForMinimum = resolved.includeOmoteDoraInMinimum
        ? han
        : yakuHan;
    const minimumEval = calculatePointByHanFu(hanForMinimum, fu, resolved.kiriageMangan);
    if (resolved.requireManganMinimum && minimumEval.points < 8000) {
        return {
            han,
            fu,
            points: 0,
            yaku,
            isMangan: false,
            doraCount,
            pointsDelta: 0,
            limitCategory: undefined,
            limit: undefined
        };
    }
    return {
        han,
        fu,
        points: fullScore.points,
        yaku,
        isMangan: fullScore.points >= 8000,
        doraCount,
        limitCategory: fullScore.limitCategory,
        pointsDelta: fullScore.points,
        limit: fullScore.limitCategory
    };
}
function calculatePointByHanFu(han, fu, kiriageMangan) {
    if (han <= 0) {
        return { points: 0, limitCategory: undefined };
    }
    const basicPoints = fu * Math.pow(2, 2 + han);
    const isKiriage = kiriageMangan && han === 3 && fu === 60;
    if (han >= 13)
        return { points: 32000, limitCategory: 'Yakuman' };
    if (han >= 11)
        return { points: 24000, limitCategory: 'Sanbaiman' };
    if (han >= 8)
        return { points: 16000, limitCategory: 'Baiman' };
    if (han >= 6)
        return { points: 12000, limitCategory: 'Haneman' };
    if (han >= 5 || basicPoints >= 2000 || isKiriage)
        return { points: 8000, limitCategory: 'Mangan' };
    return {
        points: Math.ceil((basicPoints * 4) / 100) * 100,
        limitCategory: undefined
    };
}
function countDora(fullHand, indicators) {
    if (indicators.length === 0)
        return 0;
    const counts = countTiles(fullHand);
    let total = 0;
    for (const indicator of indicators) {
        const dora = getNextTile(indicator);
        total += counts[tileKey(dora)] || 0;
    }
    return total;
}
function isChiitoitsu(fullHand, counts) {
    if (fullHand.length !== 14) {
        return false;
    }
    const values = Object.values(counts);
    return values.length === 7 && values.every((count) => count === 2);
}
function hasIttsuu(counts) {
    for (const suit of ['man', 'pin', 'sou']) {
        let ok = true;
        for (let rank = 1; rank <= 9; rank++) {
            if ((counts[`${suit}${rank}`] || 0) < 1) {
                ok = false;
                break;
            }
        }
        if (ok)
            return true;
    }
    return false;
}
function hasIipeikou(counts) {
    for (const suit of ['man', 'pin', 'sou']) {
        for (let start = 1; start <= 7; start++) {
            if ((counts[`${suit}${start}`] || 0) >= 2 &&
                (counts[`${suit}${start + 1}`] || 0) >= 2 &&
                (counts[`${suit}${start + 2}`] || 0) >= 2) {
                return true;
            }
        }
    }
    return false;
}
function hasSanshokuDoukou(counts) {
    for (let rank = 1; rank <= 9; rank++) {
        if ((counts[`man${rank}`] ?? 0) >= 3 &&
            (counts[`pin${rank}`] ?? 0) >= 3 &&
            (counts[`sou${rank}`] ?? 0) >= 3) {
            return true;
        }
    }
    return false;
}
function hasPinfu(decompositions, winTile, seatWind, roundWind) {
    if (!winTile)
        return false;
    const seatWindTile = seatWind ? windToHonorTileKey(seatWind) : '';
    const roundWindTile = roundWind ? windToHonorTileKey(roundWind) : '';
    return decompositions.some((decomp) => {
        if (decomp.melds.some((meld) => meld.type !== 'sequence'))
            return false;
        if (decomp.pairKey === seatWindTile || decomp.pairKey === roundWindTile)
            return false;
        if (decomp.pairKey === 'z5' || decomp.pairKey === 'z6' || decomp.pairKey === 'z7')
            return false;
        const sequences = decomp.melds;
        return hasRyanmenWin(sequences, winTile);
    });
}
function hasSanshokuDoujun(decompositions) {
    for (const decomp of decompositions) {
        const startsBySuit = {
            man: new Set(),
            pin: new Set(),
            sou: new Set()
        };
        for (const meld of decomp.melds) {
            if (meld.type === 'sequence') {
                startsBySuit[meld.suit].add(meld.start);
            }
        }
        for (let start = 1; start <= 7; start++) {
            if (startsBySuit.man.has(start) && startsBySuit.pin.has(start) && startsBySuit.sou.has(start)) {
                return true;
            }
        }
    }
    return false;
}
function hasToitoi(decompositions) {
    return decompositions.some((decomp) => decomp.melds.every((meld) => meld.type === 'triplet'));
}
function hasSanankou(decompositions) {
    return decompositions.some((decomp) => decomp.melds.filter((meld) => meld.type === 'triplet').length >= 3);
}
function hasChanta(decompositions, fullHand) {
    return decompositions.some((decomp) => {
        const pairTile = parseTileKey(decomp.pairKey);
        if (!isTerminalOrHonor(pairTile))
            return false;
        if (!decomp.melds.every((meld) => meldHasTerminalOrHonor(meld)))
            return false;
        const hasSequence = decomp.melds.some((meld) => meld.type === 'sequence');
        const hasHonor = fullHand.some((tile) => tile.suit === 'z');
        return hasSequence && hasHonor;
    });
}
function hasJunchan(decompositions, fullHand) {
    if (fullHand.some((tile) => tile.suit === 'z'))
        return false;
    return decompositions.some((decomp) => {
        const pairTile = parseTileKey(decomp.pairKey);
        if (!isTerminal(pairTile))
            return false;
        if (!decomp.melds.every((meld) => meldHasTerminal(meld)))
            return false;
        return decomp.melds.some((meld) => meld.type === 'sequence');
    });
}
function hasHonroutou(fullHand) {
    return fullHand.every((tile) => isTerminalOrHonor(tile));
}
function hasShousangen(decompositions) {
    return decompositions.some((decomp) => {
        const dragonTriplets = decomp.melds.filter((meld) => meld.type === 'triplet' &&
            meld.suit === 'z' &&
            meld.rank >= 5 &&
            meld.rank <= 7).length;
        const pairTile = parseTileKey(decomp.pairKey);
        const dragonPair = pairTile.suit === 'z' && pairTile.rank >= 5 && pairTile.rank <= 7;
        return dragonTriplets >= 2 && dragonPair;
    });
}
function meldHasTerminalOrHonor(meld) {
    if (meld.type === 'triplet') {
        return isTerminalOrHonor({ suit: meld.suit, rank: meld.rank, isRed: false });
    }
    // Sequence includes terminal only if 123 or 789.
    return meld.start === 1 || meld.start === 7;
}
function meldHasTerminal(meld) {
    if (meld.type === 'triplet') {
        return meld.rank === 1 || meld.rank === 9;
    }
    return meld.start === 1 || meld.start === 7;
}
function isTerminal(tile) {
    return tile.suit !== 'z' && (tile.rank === 1 || tile.rank === 9);
}
function isTerminalOrHonor(tile) {
    return tile.suit === 'z' || isTerminal(tile);
}
function enumerateStandardHandDecompositions(counts) {
    const decomps = [];
    for (const [pairKey, count] of Object.entries(counts)) {
        if (count < 2)
            continue;
        const remaining = { ...counts, [pairKey]: count - 2 };
        const melds = [];
        collectMeldDecompositions(remaining, melds, decomps, pairKey);
    }
    return dedupeDecompositions(decomps);
}
function collectMeldDecompositions(counts, melds, output, pairKey) {
    const next = findFirstRemainingTile(counts);
    if (!next) {
        if (melds.length === 4) {
            output.push({ pairKey, melds: [...melds] });
        }
        return;
    }
    const key = `${next.suit}${next.rank}`;
    if ((counts[key] ?? 0) >= 3) {
        counts[key] -= 3;
        melds.push({ type: 'triplet', suit: next.suit, rank: next.rank });
        collectMeldDecompositions(counts, melds, output, pairKey);
        melds.pop();
        counts[key] += 3;
    }
    if (next.suit !== 'z' && next.rank <= 7) {
        const k1 = `${next.suit}${next.rank + 1}`;
        const k2 = `${next.suit}${next.rank + 2}`;
        if ((counts[key] ?? 0) > 0 && (counts[k1] ?? 0) > 0 && (counts[k2] ?? 0) > 0) {
            counts[key] -= 1;
            counts[k1] -= 1;
            counts[k2] -= 1;
            melds.push({ type: 'sequence', suit: next.suit, start: next.rank });
            collectMeldDecompositions(counts, melds, output, pairKey);
            melds.pop();
            counts[key] += 1;
            counts[k1] += 1;
            counts[k2] += 1;
        }
    }
}
function dedupeDecompositions(decomps) {
    const unique = new Map();
    for (const decomp of decomps) {
        const meldKey = decomp.melds
            .map((meld) => (meld.type === 'sequence'
            ? `S-${meld.suit}-${meld.start}`
            : `T-${meld.suit}-${meld.rank}`))
            .sort()
            .join('|');
        const key = `${decomp.pairKey}#${meldKey}`;
        if (!unique.has(key)) {
            unique.set(key, decomp);
        }
    }
    return [...unique.values()];
}
function findFirstRemainingTile(counts) {
    for (const suit of ['man', 'pin', 'sou', 'z']) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            if ((counts[`${suit}${rank}`] ?? 0) > 0) {
                return { suit, rank };
            }
        }
    }
    return null;
}
function hasRyanmenWin(sequences, winTile) {
    if (winTile.suit === 'z')
        return false;
    for (const seq of sequences) {
        if (seq.suit !== winTile.suit)
            continue;
        const start = seq.start;
        const end = start + 2;
        if (winTile.rank !== start && winTile.rank !== end)
            continue; // middle = kanchan
        // Edge waits are not pinfu waits: 1-2 waiting 3, or 8-9 waiting 7.
        if (winTile.rank === end && start === 1)
            continue;
        if (winTile.rank === start && start === 7)
            continue;
        return true;
    }
    return false;
}
function parseTileKey(key) {
    let suit;
    let rankPart;
    if (key.startsWith('man')) {
        suit = 'man';
        rankPart = key.slice(3);
    }
    else if (key.startsWith('pin')) {
        suit = 'pin';
        rankPart = key.slice(3);
    }
    else if (key.startsWith('sou')) {
        suit = 'sou';
        rankPart = key.slice(3);
    }
    else {
        suit = 'z';
        rankPart = key.slice(1);
    }
    const rank = Number(rankPart);
    return { suit, rank, isRed: false };
}
function countTiles(tiles) {
    const result = {};
    for (const tile of tiles) {
        const key = tileKey(tile);
        result[key] = (result[key] || 0) + 1;
    }
    return result;
}
function tileKey(tile) {
    return `${tile.suit}${tile.rank}`;
}
function getNextTile(tile) {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4)
            return { suit: 'z', rank: tile.rank === 4 ? 1 : tile.rank + 1 };
        if (tile.rank >= 5 && tile.rank <= 7)
            return { suit: 'z', rank: tile.rank === 7 ? 5 : tile.rank + 1 };
    }
    return {
        suit: tile.suit,
        rank: tile.rank === 9 ? 1 : tile.rank + 1
    };
}
function windToHonorTileKey(wind) {
    const map = {
        EAST: 'z1',
        SOUTH: 'z2',
        WEST: 'z3',
        NORTH: 'z4'
    };
    return map[wind];
}
