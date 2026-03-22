import { Tile } from '@step13/proto';
import { GameContext, GameEvents } from './messages';

const TEN_GUESS_SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

export type TenGuessCandidateState = 'selectable' | 'blocked_by_opponent_discard' | 'exhausted';

export type TenGuessCandidate = {
    tile: Tile;
    tileKey: string;
    remainingCount: number;
    state: TenGuessCandidateState;
    blockedReason: 'opponent_discard' | 'exhausted' | null;
};

export type TenCallType = 'CHI' | 'PON';

export type TenCallCandidate = {
    type: TenCallType;
    discardTileId: string;
    discardTileKey: string;
    useTileIds: [string, string];
    useTileKeys: [string, string];
    useTiles: [Tile, Tile];
    meldTiles: [Tile, Tile, Tile];
};

export type TenClaimSnapshot = {
    type: TenCallType;
    sourcePlayerId: string;
    discardTileId: string;
    discardTileKey: string;
    consumedTileIds: [string, string];
    consumedTileKeys: [string, string];
};

export type TenOpenMeld = {
    type: TenCallType;
    tiles: [Tile, Tile, Tile];
    tileIds: [string, string, string];
    tileKeys: [string, string, string];
    calledTileId: string;
    calledFrom: string;
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

export function toTenTileKey(tile: Tile): string {
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
        if (suitDelta !== 0) {
            return suitDelta;
        }
        if (left.rank !== right.rank) {
            return left.rank - right.rank;
        }
        return Number(Boolean(left.isRed)) - Number(Boolean(right.isRed));
    });
}

export function getTenTurnTiles(context: GameContext, playerId: string): Tile[] {
    const tiles = [...(context.hands[playerId] ?? [])];
    if (context.attackDefense.pendingDrawTile) {
        tiles.push(context.attackDefense.pendingDrawTile);
    }
    return tiles;
}

export function getOpenMeldTiles(context: GameContext, playerId: string): Tile[] {
    return (context.openMelds[playerId] ?? []).flatMap((meld) => meld.tiles);
}

export function getTenDeclarationTiles(context: GameContext, playerId: string): Tile[] {
    return [...getTenTurnTiles(context, playerId), ...getOpenMeldTiles(context, playerId)];
}

export function buildTenGuessTileCatalog(): TenGuessCandidate[] {
    const result: TenGuessCandidate[] = [];

    TEN_GUESS_SUITS.forEach((suit) => {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank += 1) {
            const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            result.push({
                tile,
                tileKey: toTenTileKey(tile),
                remainingCount: 0,
                state: 'exhausted',
                blockedReason: 'exhausted'
            });
        }
    });

    return result;
}

export function getGuessCandidateStates(context: GameContext, viewerId: string): TenGuessCandidate[] {
    const remainingCounts = new Map<string, number>();
    buildTenGuessTileCatalog().forEach((entry) => remainingCounts.set(entry.tileKey, 0));

    context.wall.forEach((tile) => {
        const tileKey = toTenTileKey(tile);
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
    const opponentDiscardKeys = new Set(opponentDiscards.map((tile: Tile) => toTenTileKey(tile)));

    return buildTenGuessTileCatalog().map((entry) => {
        const remainingCount = remainingCounts.get(entry.tileKey) ?? 0;
        if (opponentDiscardKeys.has(entry.tileKey)) {
            return {
                ...entry,
                remainingCount,
                state: 'blocked_by_opponent_discard',
                blockedReason: 'opponent_discard'
            };
        }
        if (remainingCount <= 0) {
            return {
                ...entry,
                remainingCount: 0,
                state: 'exhausted',
                blockedReason: 'exhausted'
            };
        }
        return {
            ...entry,
            remainingCount,
            state: 'selectable',
            blockedReason: null
        };
    });
}

function buildPonCandidates(lastDiscard: Tile, turnTiles: Tile[]): TenCallCandidate[] {
    const matching = turnTiles.filter((tile) => toTenTileKey(tile) === toTenTileKey(lastDiscard) && tile.id);
    if (matching.length < 2 || !lastDiscard.id) {
        return [];
    }

    const result: TenCallCandidate[] = [];
    for (let left = 0; left < matching.length - 1; left += 1) {
        for (let right = left + 1; right < matching.length; right += 1) {
            const useTiles = [matching[left], matching[right]] as [Tile, Tile];
            const meldTiles = [matching[left], matching[right], lastDiscard] as [Tile, Tile, Tile];
            result.push({
                type: 'PON',
                discardTileId: lastDiscard.id,
                discardTileKey: toTenTileKey(lastDiscard),
                useTileIds: [matching[left].id!, matching[right].id!],
                useTileKeys: [toTenTileKey(matching[left]), toTenTileKey(matching[right])],
                useTiles,
                meldTiles: sortTilesForMeld(meldTiles) as [Tile, Tile, Tile]
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
                const useTiles = [firstTile, secondTile] as [Tile, Tile];
                const meldTiles = sortTilesForMeld([firstTile, secondTile, lastDiscard]) as [Tile, Tile, Tile];
                result.push({
                    type: 'CHI',
                    discardTileId: lastDiscard.id!,
                    discardTileKey: toTenTileKey(lastDiscard),
                    useTileIds: [firstTile.id!, secondTile.id!],
                    useTileKeys: [toTenTileKey(firstTile), toTenTileKey(secondTile)],
                    useTiles,
                    meldTiles
                });
            });
        });
    });

    return result;
}

export function listTenCallCandidates(context: GameContext, playerId: string): TenCallCandidate[] {
    if (context.ruleset === 'classic') {
        return [];
    }
    if (context.attackDefense.stage !== 'A') {
        return [];
    }
    if (context.currentTurn !== playerId) {
        return [];
    }
    if (context.attackDefense.mustDiscardAfterClaim) {
        return [];
    }

    const lastDiscard = context.lastDiscard;
    if (!lastDiscard || lastDiscard.playerId === playerId) {
        return [];
    }

    const attackerId = context.attackDefense.attacker;
    const defenderId = context.attackDefense.defender;
    if (attackerId && defenderId && (attackerId !== playerId || defenderId !== lastDiscard.playerId)) {
        return [];
    }

    const turnTiles = getTenTurnTiles(context, playerId);
    return [
        ...buildChiCandidates(lastDiscard.tile, turnTiles),
        ...buildPonCandidates(lastDiscard.tile, turnTiles)
    ];
}

function sameTileIdPair(left: [string, string], right: [string, string]): boolean {
    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    return leftSorted[0] === rightSorted[0] && leftSorted[1] === rightSorted[1];
}

export function canApplyTenCall(context: GameContext, event: Extract<GameEvents, { type: 'CALL_CHI' | 'CALL_PON' }>): boolean {
    if (context.ruleset === 'classic') {
        return false;
    }
    return listTenCallCandidates(context, event.playerId).some((candidate) =>
        candidate.type === (event.type === 'CALL_CHI' ? 'CHI' : 'PON')
        && candidate.discardTileId === event.discardTileId
        && sameTileIdPair(candidate.useTileIds, event.useTileIds)
    );
}

function removeTilesById(tiles: Tile[], tileIds: string[]): { removed: Tile[]; remaining: Tile[] } {
    const wanted = [...tileIds];
    const removed: Tile[] = [];
    const remaining = tiles.filter((tile) => {
        const index = tile.id ? wanted.indexOf(tile.id) : -1;
        if (index === -1) {
            return true;
        }
        removed.push(tile);
        wanted.splice(index, 1);
        return false;
    });
    return { removed, remaining };
}

export function applyTenCall(context: GameContext, event: Extract<GameEvents, { type: 'CALL_CHI' | 'CALL_PON' }>): GameContext {
    const candidate = listTenCallCandidates(context, event.playerId).find((entry) =>
        entry.type === (event.type === 'CALL_CHI' ? 'CHI' : 'PON')
        && entry.discardTileId === event.discardTileId
        && sameTileIdPair(entry.useTileIds, event.useTileIds)
    );
    if (!candidate || !context.lastDiscard) {
        return context;
    }

    const turnTiles = getTenTurnTiles(context, event.playerId);
    const { removed, remaining } = removeTilesById(turnTiles, [...candidate.useTileIds]);
    if (removed.length !== 2) {
        return context;
    }

    const openMeld: TenOpenMeld = {
        type: candidate.type,
        tiles: candidate.meldTiles,
        tileIds: [candidate.meldTiles[0].id ?? '', candidate.meldTiles[1].id ?? '', candidate.meldTiles[2].id ?? ''] as [string, string, string],
        tileKeys: [
            toTenTileKey(candidate.meldTiles[0]),
            toTenTileKey(candidate.meldTiles[1]),
            toTenTileKey(candidate.meldTiles[2])
        ] as [string, string, string],
        calledTileId: candidate.discardTileId,
        calledFrom: context.lastDiscard.playerId
    };

    return {
        ...context,
        hands: {
            ...context.hands,
            [event.playerId]: remaining
        },
        openMelds: {
            ...context.openMelds,
            [event.playerId]: [...(context.openMelds[event.playerId] ?? []), openMeld]
        },
        attackDefense: {
            ...context.attackDefense,
            attacker: event.playerId,
            defender: context.lastDiscard.playerId,
            pendingClaim: {
                type: candidate.type,
                sourcePlayerId: context.lastDiscard.playerId,
                discardTileId: candidate.discardTileId,
                discardTileKey: candidate.discardTileKey,
                consumedTileIds: candidate.useTileIds,
                consumedTileKeys: candidate.useTileKeys
            },
            mustDiscardAfterClaim: true,
            pendingDrawTile: null
        },
        currentTurn: event.playerId,
        eventLog: [...context.eventLog, event]
    };
}

export function shouldEnterAssault(guessesRemaining: number): boolean {
    return guessesRemaining <= 0;
}

export function getTenAttackDefenseStageSummary(context: GameContext, viewerId: string): TenAttackDefenseStageSummary {
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isAttackerView = context.attackDefense.attacker === viewerId || context.currentTurn === viewerId;
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
        pendingDrawTileKey: context.attackDefense.pendingDrawTile
            ? toTenTileKey(context.attackDefense.pendingDrawTile)
            : null,
        recentGuessLabel: context.attackDefense.lastGuessTileKey,
        canCallChi: availableCalls.some((candidate) => candidate.type === 'CHI'),
        canCallPon: availableCalls.some((candidate) => candidate.type === 'PON'),
        mustDiscardAfterClaim: context.attackDefense.mustDiscardAfterClaim
    };
}
