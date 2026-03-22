import { GameContext } from '@step13/core';
import { Tile } from '@step13/proto';

const TEN_GUESS_SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

export type TenGuessCandidateState = 'selectable' | 'blocked_by_opponent_discard' | 'exhausted';
export type TenCallType = 'CHI' | 'PON';

export type TenGuessCandidate = {
    tile: Tile;
    tileKey: string;
    remainingCount: number;
    state: TenGuessCandidateState;
    blockedReason: 'opponent_discard' | 'exhausted' | null;
};

export type TenCallCandidate = {
    type: TenCallType;
    discardTileId: string;
    discardTileKey: string;
    useTileIds: [string, string];
    useTileKeys: [string, string];
    useTiles: [Tile, Tile];
    meldTiles: [Tile, Tile, Tile];
};

export type TenAttackDefenseStageSummary = {
    stageLabel: string;
    modeLabel: string;
    isAttackerView: boolean;
    isDefenderView: boolean;
    turnsLeft: number;
    guessesRemaining: number;
    assaultRemaining: number;
    assaultProgressLabel: string;
    assaultProgressValue: number;
    hasPendingDraw: boolean;
    pendingDrawTileKey: string | null;
    recentGuessLabel: string | null;
    canCallChi: boolean;
    canCallPon: boolean;
    mustDiscardAfterClaim: boolean;
};

type AttackDefenseView = GameContext['attackDefense'] & {
    guessCandidates?: TenGuessCandidate[];
    availableCalls?: TenCallCandidate[];
    pendingClaim?: { type: TenCallType } | null;
    mustDiscardAfterClaim?: boolean;
};

function toTileKey(tile: Tile): string {
    return `${tile.suit}-${tile.rank}`;
}

function sortTilesForMeld(tiles: Tile[]): Tile[] {
    return [...tiles].sort((left, right) => {
        const suitOrder: Record<Tile['suit'], number> = {
            man: 0,
            pin: 1,
            sou: 2,
            z: 3
        };
        const suitDelta = suitOrder[left.suit] - suitOrder[right.suit];
        if (suitDelta !== 0) return suitDelta;
        if (left.rank !== right.rank) return left.rank - right.rank;
        return Number(Boolean(left.isRed)) - Number(Boolean(right.isRed));
    });
}

function getTenTurnTiles(context: GameContext, playerId: string): Tile[] {
    const tiles = [...(context.hands[playerId] ?? [])];
    if (context.attackDefense.pendingDrawTile) {
        tiles.push(context.attackDefense.pendingDrawTile);
    }
    return tiles;
}

export function buildTenGuessTileCatalog(): TenGuessCandidate[] {
    const result: TenGuessCandidate[] = [];

    TEN_GUESS_SUITS.forEach((suit) => {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank += 1) {
            const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            result.push({
                tile,
                tileKey: toTileKey(tile),
                remainingCount: 0,
                state: 'exhausted',
                blockedReason: 'exhausted'
            });
        }
    });

    return result;
}

export function getGuessCandidateStates(context: GameContext, viewerId: string): TenGuessCandidate[] {
    const attackDefense = context.attackDefense as AttackDefenseView;
    if (Array.isArray(attackDefense.guessCandidates)) {
        return attackDefense.guessCandidates;
    }

    const remainingCounts = new Map<string, number>();
    buildTenGuessTileCatalog().forEach((entry) => remainingCounts.set(entry.tileKey, 0));

    context.wall.forEach((tile) => {
        const tileKey = toTileKey(tile);
        remainingCounts.set(tileKey, (remainingCounts.get(tileKey) ?? 0) + 1);
    });

    const attackerId = context.attackDefense.attacker;
    const defenderId = context.attackDefense.defender;
    const opponentId = viewerId === defenderId
        ? attackerId
        : viewerId === attackerId
            ? defenderId
            : attackerId;
    const opponentDiscards = opponentId ? (context.discards[opponentId] ?? []) : [];
    const opponentDiscardKeys = new Set(opponentDiscards.map((tile) => toTileKey(tile)));

    return buildTenGuessTileCatalog().map((entry) => {
        const remainingCount = remainingCounts.get(entry.tileKey) ?? 0;
        if (opponentDiscardKeys.has(entry.tileKey)) {
            return {
                ...entry,
                remainingCount,
                state: 'blocked_by_opponent_discard' as const,
                blockedReason: 'opponent_discard' as const
            };
        }
        if (remainingCount <= 0) {
            return {
                ...entry,
                remainingCount: 0,
                state: 'exhausted' as const,
                blockedReason: 'exhausted' as const
            };
        }
        return {
            ...entry,
            remainingCount,
            state: 'selectable' as const,
            blockedReason: null
        };
    });
}

function buildPonCandidates(lastDiscard: Tile, turnTiles: Tile[]): TenCallCandidate[] {
    const matching = turnTiles.filter((tile) => toTileKey(tile) === toTileKey(lastDiscard) && tile.id);
    if (matching.length < 2 || !lastDiscard.id) {
        return [];
    }

    const result: TenCallCandidate[] = [];
    for (let left = 0; left < matching.length - 1; left += 1) {
        for (let right = left + 1; right < matching.length; right += 1) {
            result.push({
                type: 'PON',
                discardTileId: lastDiscard.id,
                discardTileKey: toTileKey(lastDiscard),
                useTileIds: [matching[left].id!, matching[right].id!],
                useTileKeys: [toTileKey(matching[left]), toTileKey(matching[right])],
                useTiles: [matching[left], matching[right]],
                meldTiles: sortTilesForMeld([matching[left], matching[right], lastDiscard]) as [Tile, Tile, Tile]
            });
        }
    }
    return result;
}

function buildChiCandidates(lastDiscard: Tile, turnTiles: Tile[]): TenCallCandidate[] {
    if (lastDiscard.suit === 'z' || !lastDiscard.id) {
        return [];
    }

    const result: TenCallCandidate[] = [];
    const wantedPatterns: Array<[number, number]> = [
        [lastDiscard.rank - 2, lastDiscard.rank - 1],
        [lastDiscard.rank - 1, lastDiscard.rank + 1],
        [lastDiscard.rank + 1, lastDiscard.rank + 2]
    ];

    wantedPatterns.forEach(([firstRank, secondRank]) => {
        if (firstRank < 1 || secondRank > 9) {
            return;
        }
        const firstTiles = turnTiles.filter((tile) => tile.suit === lastDiscard.suit && tile.rank === firstRank && tile.id);
        const secondTiles = turnTiles.filter((tile) => tile.suit === lastDiscard.suit && tile.rank === secondRank && tile.id);

        firstTiles.forEach((firstTile) => {
            secondTiles.forEach((secondTile) => {
                if (firstTile.id === secondTile.id) {
                    return;
                }
                result.push({
                    type: 'CHI',
                    discardTileId: lastDiscard.id!,
                    discardTileKey: toTileKey(lastDiscard),
                    useTileIds: [firstTile.id!, secondTile.id!],
                    useTileKeys: [toTileKey(firstTile), toTileKey(secondTile)],
                    useTiles: [firstTile, secondTile],
                    meldTiles: sortTilesForMeld([firstTile, secondTile, lastDiscard]) as [Tile, Tile, Tile]
                });
            });
        });
    });

    return result;
}

export function listTenCallCandidates(context: GameContext, viewerId: string): TenCallCandidate[] {
    const attackDefense = context.attackDefense as AttackDefenseView;
    if (Array.isArray(attackDefense.availableCalls)) {
        return attackDefense.availableCalls;
    }
    if (context.ruleset === 'classic' || context.attackDefense.stage !== 'A' || context.currentTurn !== viewerId || attackDefense.mustDiscardAfterClaim) {
        return [];
    }
    if (!context.lastDiscard || context.lastDiscard.playerId === viewerId) {
        return [];
    }

    const turnTiles = getTenTurnTiles(context, viewerId);
    return [...buildChiCandidates(context.lastDiscard.tile, turnTiles), ...buildPonCandidates(context.lastDiscard.tile, turnTiles)];
}

export function getTenAttackDefenseStageSummary(context: GameContext, viewerId: string): TenAttackDefenseStageSummary {
    const attackDefense = context.attackDefense as AttackDefenseView;
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isAttackerView = context.attackDefense.attacker === viewerId || (context.attackDefense.stage === 'A' && context.currentTurn === viewerId);
    const isDefenderView = context.attackDefense.defender === viewerId;
    const ownTurnCount = context.attackDefense.ownTurns[viewerId] ?? 0;
    const turnsLeft = Math.max(0, 18 - ownTurnCount);
    const assaultRemaining = Math.max(0, context.attackDefense.assaultRemaining);
    const assaultUsed = Math.max(0, 5 - assaultRemaining);
    const availableCalls = listTenCallCandidates(context, viewerId);

    return {
        stageLabel: context.attackDefense.stage === 'A'
            ? 'A단계'
            : context.attackDefense.stage === 'B_GUESS'
                ? 'B단계 · 수비 추측'
                : 'B단계 · 공격',
        modeLabel: isEasy ? '텐 공방전 Easy' : '텐 공방전',
        isAttackerView,
        isDefenderView,
        turnsLeft,
        guessesRemaining: context.attackDefense.guessesRemaining,
        assaultRemaining,
        assaultProgressLabel: `${assaultUsed}/5`,
        assaultProgressValue: assaultUsed,
        hasPendingDraw: Boolean(context.attackDefense.pendingDrawTile),
        pendingDrawTileKey: context.attackDefense.pendingDrawTile ? toTileKey(context.attackDefense.pendingDrawTile) : null,
        recentGuessLabel: context.attackDefense.lastGuessTileKey,
        canCallChi: availableCalls.some((candidate) => candidate.type === 'CHI'),
        canCallPon: availableCalls.some((candidate) => candidate.type === 'PON'),
        mustDiscardAfterClaim: Boolean(attackDefense.mustDiscardAfterClaim)
    };
}
