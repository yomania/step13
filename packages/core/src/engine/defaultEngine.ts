import { calculateScore, calculateShanten, isTenpai, ScoreOptions } from '@step13/scoring';
import { Tile, Wind } from '@step13/proto';
import { GameContext, GameEvents } from '../messages';
import { RULES, WindSeat } from '../rules';
import { createSeededRng, generateTiles, shuffleWithSeed } from '../utils';
import { DealResult, DealerSelection, GameEngine, RoundResult } from './types';

type EngineConfig = {
    scoreOptions: ScoreOptions;
};

export function createDefaultEngine({ scoreOptions }: EngineConfig): GameEngine {
    return {
        buildDealResult(players: string[], seed: number): DealResult {
            const shuffled = shuffleWithSeed(generateTiles(), seed);
            const dealt: Record<string, Tile[]> = {};
            players.forEach((playerId, index) => {
                dealt[playerId] = shuffled.slice(
                    index * RULES.tiles.dealTilesPerPlayer,
                    (index + 1) * RULES.tiles.dealTilesPerPlayer
                );
            });
            const wallStart = players.length * RULES.tiles.dealTilesPerPlayer;
            return {
                dealt,
                wall: shuffled.slice(wallStart)
            };
        },

        selectDealer(players: string[], seed: number): DealerSelection {
            const dealerDice = rollDealerDice(players, seed);
            const dealer = pickDealerFromDice(players, seed, dealerDice);
            return {
                dealer,
                dealerDice,
                seatMap: computeSeatMap(players, dealer)
            };
        },

        getEastPlayer(seatMap: Record<string, WindSeat>): string {
            return Object.keys(seatMap).find((playerId) => seatMap[playerId] === 'EAST') ?? '';
        },

        hasWinningWait(hand: Tile[]): boolean {
            return hasWinningWaitInternal(hand);
        },

        findTenpaiHand(tiles: Tile[]): { hand: Tile[]; pool: Tile[] } {
            for (let i = 0; i < 500; i++) {
                const shuffled = shuffleWithSeed(tiles, i + 1);
                const hand = shuffled.slice(0, RULES.tiles.handSize);
                if (isTenpai(hand)) {
                    return { hand, pool: shuffled.slice(RULES.tiles.handSize) };
                }
            }

            const fallback = [...tiles];
            return {
                hand: fallback.slice(0, RULES.tiles.handSize),
                pool: fallback.slice(RULES.tiles.handSize)
            };
        },

        canSelectDora(context: GameContext, playerId: string, tileId: string): boolean {
            if (playerId !== context.dealer) {
                return false;
            }
            return context.wall.some((tile) => tile.id === tileId);
        },

        selectDora(context: GameContext, event: Extract<GameEvents, { type: 'SELECT_DORA' }>) {
            const selected = context.wall.find((tile) => tile.id === event.tileId);
            if (!selected) {
                return {};
            }
            return {
                wall: context.wall.filter((tile) => tile.id !== event.tileId),
                doraIndicators: [selected],
                eventLog: [...context.eventLog, event]
            };
        },

        autoSelectDora(context: GameContext) {
            const selected = context.wall[0];
            if (!selected) {
                return {};
            }
            const timeoutEvent: GameEvents = { type: 'TIMEOUT', playerId: context.dealer, phase: 'DORA_SELECT' };
            const selectEvent: GameEvents = { type: 'SELECT_DORA', playerId: context.dealer, tileId: selected.id ?? '' };
            return {
                wall: context.wall.slice(1),
                doraIndicators: [selected],
                eventLog: [...context.eventLog, timeoutEvent, selectEvent]
            };
        },

        canDiscard(context: GameContext, playerId: string, tileId: string): boolean {
            if (context.currentTurn !== playerId) {
                return false;
            }
            const pool = context.pools[playerId] ?? [];
            return pool.some((tile) => tile.id === tileId);
        },

        applyDiscard(context: GameContext, playerId: string, tileId: string): GameContext {
            const pool = context.pools[playerId] ?? [];
            const tile = pool.find((entry) => entry.id === tileId);
            if (!tile) {
                return context;
            }

            const currentDiscards = context.discards[playerId] ?? [];
            const nextPool = pool.filter((entry) => entry.id !== tileId);
            const nextTurn = context.players.find((id) => id !== playerId) ?? null;
            const discardEvent: GameEvents = { type: 'DISCARD', playerId, tileId };

            return {
                ...context,
                pools: {
                    ...context.pools,
                    [playerId]: nextPool
                },
                discards: {
                    ...context.discards,
                    [playerId]: [...currentDiscards, tile]
                },
                currentTurn: nextTurn,
                lastDiscard: { playerId, tile },
                eventLog: [...context.eventLog, discardEvent]
            };
        },

        isDrawReached(context: GameContext): boolean {
            return context.players.every((playerId) => (context.discards[playerId] ?? []).length >= RULES.draw.afterDiscardsEach);
        },

        autoRonWinner(context: GameContext): string | null {
            if (!context.lastDiscard) {
                return null;
            }

            const { playerId: discarderId, tile } = context.lastDiscard;
            const opponentId = context.players.find((id) => id !== discarderId);
            if (!opponentId) {
                return null;
            }

            const hand = context.hands[opponentId];
            if (!hand) {
                return null;
            }

            const score = calculateScore(hand, tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[opponentId]),
                roundWind: 'EAST'
            });
            if (score.points >= RULES.winConditions.manganMinimumPoints) {
                return opponentId;
            }
            return null;
        },

        canDeclareRon(context: GameContext, playerId: string): boolean {
            if (!context.lastDiscard) {
                return false;
            }
            if (context.lastDiscard.playerId === playerId) {
                return false;
            }
            const hand = context.hands[playerId];
            if (!hand) {
                return false;
            }
            const score = calculateScore(hand, context.lastDiscard.tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[playerId]),
                roundWind: 'EAST'
            });
            return score.points >= RULES.winConditions.manganMinimumPoints;
        },

        resolveRon(context: GameContext, winnerId: string): RoundResult | null {
            if (!context.lastDiscard) {
                return null;
            }
            const loserId = context.lastDiscard.playerId;
            const winResult = calculateScore(context.hands[winnerId], context.lastDiscard.tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[winnerId]),
                roundWind: 'EAST'
            });

            return {
                winner: winnerId,
                winResult,
                scores: {
                    ...context.scores,
                    [winnerId]: context.scores[winnerId] + winResult.points,
                    [loserId]: context.scores[loserId] - winResult.points
                }
            };
        },

        resolveDraw(context: GameContext): RoundResult {
            const tenpaiPlayers = context.players.filter((playerId) => {
                const hand = context.hands[playerId] ?? [];
                return hasWinningWaitInternal(hand);
            });

            const scores = { ...context.scores };
            if (RULES.draw.notenBappuEnabled && tenpaiPlayers.length === 1) {
                const tenpaiPlayer = tenpaiPlayers[0];
                const notenPlayer = context.players.find((playerId) => playerId !== tenpaiPlayer);
                if (notenPlayer) {
                    scores[tenpaiPlayer] += RULES.draw.notenBappuAmount;
                    scores[notenPlayer] -= RULES.draw.notenBappuAmount;
                }
            }
            return {
                winner: null,
                winResult: null,
                scores
            };
        }
    };
}

function hasWinningWaitInternal(hand: Tile[]): boolean {
    if (hand.length !== RULES.tiles.handSize) {
        return false;
    }
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const winTile: Tile = { suit, rank: rank as any, isRed: false };
            if (calculateShanten([...hand, winTile]) === -1) {
                return true;
            }
        }
    }
    return false;
}

function rollDealerDice(players: string[], seed: number): Record<string, number> {
    const rng = createSeededRng(seed);
    const result: Record<string, number> = {};
    players.forEach((playerId) => {
        result[playerId] = Math.floor(rng() * 6) + 1;
    });
    return result;
}

function pickDealerFromDice(players: string[], seed: number, dealerDice: Record<string, number>): string {
    const sorted = [...players].sort((a, b) => (dealerDice[b] ?? 0) - (dealerDice[a] ?? 0));
    if (sorted.length < 2) return sorted[0] ?? '';

    if ((dealerDice[sorted[0]] ?? 0) !== (dealerDice[sorted[1]] ?? 0)) {
        return sorted[0];
    }

    const tieBreak = shuffleWithSeed(sorted.slice(0, 2), seed + 99);
    return tieBreak[0] ?? sorted[0];
}

function computeSeatMap(players: string[], dealer: string): Record<string, WindSeat> {
    const other = players.find((playerId) => playerId !== dealer) ?? '';
    return {
        [dealer]: 'EAST',
        [other]: 'WEST'
    };
}

function seatToWind(seat?: WindSeat): Wind | undefined {
    if (seat === 'EAST') return 'EAST';
    if (seat === 'WEST') return 'WEST';
    return undefined;
}
