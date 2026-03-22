import { GameContext } from '@step13/core';
import type { TenGuessCandidate } from '@step13/core';
import { Tile } from '@step13/proto';

const TEN_GUESS_SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

export type { TenGuessCandidate } from '@step13/core';

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
};

function toTileKey(tile: Tile): string {
    return `${tile.suit}-${tile.rank}`;
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
    const serverCandidates = (
        context.attackDefense as typeof context.attackDefense & { guessCandidates?: TenGuessCandidate[] }
    ).guessCandidates;

    if (Array.isArray(serverCandidates)) {
        return serverCandidates;
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

export function getTenAttackDefenseStageSummary(context: GameContext, viewerId: string): TenAttackDefenseStageSummary {
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isAttackerView = context.attackDefense.attacker === viewerId;
    const isDefenderView = context.attackDefense.defender === viewerId;
    const ownTurnCount = context.attackDefense.ownTurns[viewerId] ?? 0;
    const turnsLeft = Math.max(0, 18 - ownTurnCount);
    const assaultRemaining = Math.max(0, context.attackDefense.assaultRemaining);
    const assaultUsed = Math.max(0, 5 - assaultRemaining);

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
            ? toTileKey(context.attackDefense.pendingDrawTile)
            : null,
        recentGuessLabel: context.attackDefense.lastGuessTileKey
    };
}
