import { calculateScore, calculateShanten, ScoreOptions } from '@step13/scoring';
import { Tile, Wind } from '@step13/proto';
import { GameContext, GameEvents } from '../messages';
import { RULES, WindSeat } from '../rules';
import { generateTiles, shuffleWithSeed } from '../utils';
import { DealResult, DealerSelection, GameEngine, RoundResult } from './types';

type EngineConfig = {
    scoreOptions: ScoreOptions;
    dealValidationMaxAttempts?: number;
    handSearchShuffles?: number;
};

export function createDefaultEngine({
    scoreOptions,
    dealValidationMaxAttempts = 20,
    handSearchShuffles = 40
}: EngineConfig): GameEngine {
    let lastFailedPlayers: string[] = [];

    return {
        buildDealResult(players: string[], seed: number): DealResult {
            for (let attempt = 0; attempt < dealValidationMaxAttempts; attempt++) {
                const shuffled = shuffleWithSeed(generateTiles(), seed + attempt * 7919);
                const dealt: Record<string, Tile[]> = {};
                players.forEach((playerId, index) => {
                    dealt[playerId] = shuffled.slice(
                        index * RULES.tiles.dealTilesPerPlayer,
                        (index + 1) * RULES.tiles.dealTilesPerPlayer
                    );
                });
                const wallStart = players.length * RULES.tiles.dealTilesPerPlayer;
                const wall = shuffled.slice(wallStart);
                const doraCandidates = buildAllDoraIndicatorCandidates();

                const failedPlayers = players.filter((playerId) => {
                    const tiles = dealt[playerId] ?? [];
                    return !findManganTenpaiCandidate(tiles, doraCandidates, scoreOptions, handSearchShuffles);
                });
                lastFailedPlayers = failedPlayers;

                if (failedPlayers.length === 0) {
                    return { dealt, wall };
                }
            }

            const fallbackDeal = buildGuaranteedManganDeal(players, seed);
            if (fallbackDeal) {
                return fallbackDeal;
            }

            throw new Error(
                `[DealValidation] could not satisfy mangan-tenpai for players=${lastFailedPlayers.join(',')} after ${dealValidationMaxAttempts} attempts (seed=${seed})`
            );
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

        findTenpaiHand(
            tiles: Tile[],
            options?: { doraIndicators?: Tile[]; requireMangan?: boolean }
        ): { hand: Tile[]; pool: Tile[] } {
            const requireMangan = Boolean(options?.requireMangan);
            if (requireMangan) {
                const doraIndicators = options?.doraIndicators ?? [];
                if (tiles.length >= RULES.tiles.handSize) {
                    const directHand = tiles.slice(0, RULES.tiles.handSize);
                    if (isManganTenpai(directHand, doraIndicators, scoreOptions)) {
                        return { hand: directHand, pool: tiles.slice(RULES.tiles.handSize) };
                    }
                }
                const mangan = findManganTenpaiCandidate(tiles, doraIndicators, scoreOptions, handSearchShuffles);
                if (mangan) {
                    return mangan;
                }
            }

            // Use the same win-wait predicate as machine guard to avoid mismatch.
            for (let i = 0; i < 5000; i++) {
                const shuffled = shuffleWithSeed(tiles, i + 1);
                const hand = shuffled.slice(0, RULES.tiles.handSize);
                if (hasWinningWaitInternal(hand)) {
                    return { hand, pool: shuffled.slice(RULES.tiles.handSize) };
                }
            }

            const fallback = [...tiles];
            return {
                hand: fallback.slice(0, RULES.tiles.handSize),
                pool: fallback.slice(RULES.tiles.handSize)
            };
        },

        canSelectDora(context: GameContext, playerId: string, _tileId: string): boolean {
            if (playerId !== context.dealer) {
                return false;
            }
            if ((context.doraIndicators?.length ?? 0) > 0) {
                return false;
            }
            // Accept dealer input as long as there is a selectable wall tile.
            // Some clients may send an empty/stale tileId under reconnect/race conditions.
            return context.wall.length > 0;
        },

        selectDora(context: GameContext, event: Extract<GameEvents, { type: 'SELECT_DORA' }>) {
            const selected = context.wall.find((tile) => tile.id === event.tileId) ?? context.wall[0];
            if (!selected) {
                return {};
            }
            return {
                // Keep wall layout intact so clients can reveal the selected tile in-place.
                wall: context.wall,
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
                // Keep wall layout intact so clients can reveal the selected tile in-place.
                wall: context.wall,
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
            if (isPlayerFuriten(context, opponentId, hand)) {
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
            if (isPlayerFuriten(context, playerId, hand)) {
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
    return getWinningWaits(hand).length > 0;
}

function isPlayerFuriten(context: GameContext, playerId: string, hand: Tile[]): boolean {
    const myDiscards = context.discards[playerId] ?? [];
    if (myDiscards.length === 0) {
        return false;
    }
    const myDiscardKeys = new Set(myDiscards.map((tile) => `${tile.suit}-${tile.rank}`));
    return getWinningWaits(hand).some((wait) => myDiscardKeys.has(`${wait.suit}-${wait.rank}`));
}

function getWinningWaits(hand: Tile[]): Tile[] {
    if (hand.length !== RULES.tiles.handSize) {
        return [];
    }
    const waits: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const winTile: Tile = { suit, rank: rank as any, isRed: false };
            if (calculateShanten([...hand, winTile]) === -1) {
                waits.push(winTile);
            }
        }
    }
    return waits;
}

function findManganTenpaiCandidate(
    tiles: Tile[],
    doraIndicators: Tile[],
    scoreOptions: ScoreOptions,
    handSearchShuffles: number
): { hand: Tile[]; pool: Tile[] } | null {
    for (let i = 0; i < handSearchShuffles; i++) {
        const shuffled = shuffleWithSeed(tiles, i + 1);
        const hand = shuffled.slice(0, RULES.tiles.handSize);
        if (!isManganTenpai(hand, doraIndicators, scoreOptions)) {
            continue;
        }
        return { hand, pool: shuffled.slice(RULES.tiles.handSize) };
    }
    return null;
}

function isManganTenpai(hand: Tile[], doraIndicators: Tile[], scoreOptions: ScoreOptions): boolean {
    const waits = getWinningWaits(hand);
    if (waits.length === 0) {
        return false;
    }
    const doraIndicatorSet = new Set(doraIndicators.map((indicator) => `${indicator.suit}-${indicator.rank}`));
    for (const wait of waits) {
        const noDoraScore = calculateScore(hand, wait, false, [], scoreOptions);
        if (noDoraScore.points >= RULES.winConditions.manganMinimumPoints) {
            return true;
        }
        if (doraIndicators.length === 0) {
            continue;
        }

        const effectiveIndicators = buildEffectiveIndicatorsForHandWait(hand, wait, doraIndicatorSet);
        for (const indicator of effectiveIndicators) {
            const score = calculateScore(hand, wait, false, [indicator], scoreOptions);
            if (score.points >= RULES.winConditions.manganMinimumPoints) {
                return true;
            }
        }
    }
    return false;
}

function buildAllDoraIndicatorCandidates(): Tile[] {
    const candidates: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            candidates.push({ suit, rank: rank as Tile['rank'], isRed: false });
        }
    }
    return candidates;
}

function buildEffectiveIndicatorsForHandWait(hand: Tile[], wait: Tile, doraIndicatorSet: Set<string>): Tile[] {
    const targets = [...hand, wait];
    const indicators = new Map<string, Tile>();
    for (const tile of targets) {
        const indicator = getIndicatorForDora(tile);
        const key = `${indicator.suit}-${indicator.rank}`;
        if (!doraIndicatorSet.has(key) || indicators.has(key)) {
            continue;
        }
        indicators.set(key, indicator);
    }
    return [...indicators.values()];
}

function getIndicatorForDora(tile: Tile): Tile {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4) {
            const prev = tile.rank === 1 ? 4 : tile.rank - 1;
            return { suit: 'z', rank: prev as Tile['rank'], isRed: false };
        }
        const prev = tile.rank === 5 ? 7 : tile.rank - 1;
        return { suit: 'z', rank: prev as Tile['rank'], isRed: false };
    }
    const prev = tile.rank === 1 ? 9 : tile.rank - 1;
    return { suit: tile.suit, rank: prev as Tile['rank'], isRed: false };
}

function buildGuaranteedManganDeal(players: string[], seed: number): DealResult | null {
    if (players.length !== 2) {
        return null;
    }

    const templateByPlayer: Record<string, Array<{ suit: Tile['suit']; rank: number }>> = {
        [players[0]]: [
            { suit: 'man', rank: 1 }, { suit: 'man', rank: 1 }, { suit: 'man', rank: 1 },
            { suit: 'man', rank: 2 }, { suit: 'man', rank: 2 }, { suit: 'man', rank: 2 },
            { suit: 'man', rank: 3 }, { suit: 'man', rank: 3 }, { suit: 'man', rank: 3 },
            { suit: 'man', rank: 4 }, { suit: 'man', rank: 4 }, { suit: 'man', rank: 4 },
            { suit: 'man', rank: 5 }
        ],
        [players[1]]: [
            { suit: 'pin', rank: 1 }, { suit: 'pin', rank: 1 }, { suit: 'pin', rank: 1 },
            { suit: 'pin', rank: 2 }, { suit: 'pin', rank: 2 }, { suit: 'pin', rank: 2 },
            { suit: 'pin', rank: 3 }, { suit: 'pin', rank: 3 }, { suit: 'pin', rank: 3 },
            { suit: 'pin', rank: 4 }, { suit: 'pin', rank: 4 }, { suit: 'pin', rank: 4 },
            { suit: 'pin', rank: 5 }
        ]
    };

    const deck = generateTiles();
    const dealt: Record<string, Tile[]> = {};

    for (const playerId of players) {
        const template = templateByPlayer[playerId];
        const mandatory = takeTiles(deck, template);
        if (!mandatory) {
            return null;
        }
        dealt[playerId] = mandatory;
    }

    const shuffledRest = shuffleWithSeed(deck, seed + 104729);
    for (const playerId of players) {
        const needed = RULES.tiles.dealTilesPerPlayer - dealt[playerId].length;
        dealt[playerId] = [...dealt[playerId], ...shuffledRest.splice(0, needed)];
    }

    return {
        dealt,
        wall: shuffledRest
    };
}

function takeTiles(deck: Tile[], specs: Array<{ suit: Tile['suit']; rank: number }>): Tile[] | null {
    const picked: Tile[] = [];
    for (const spec of specs) {
        const index = deck.findIndex((tile) => tile.suit === spec.suit && tile.rank === spec.rank);
        if (index < 0) {
            return null;
        }
        const [tile] = deck.splice(index, 1);
        picked.push(tile);
    }
    return picked;
}

function rollDealerDice(players: string[], seed: number): Record<string, number> {
    const result: Record<string, number> = {};
    players.forEach((playerId, index) => {
        result[playerId] = deterministicDice(seed, index + 1);
    });
    return result;
}

function deterministicDice(seed: number, salt: number): number {
    // Murmur-inspired finalizer for stable, per-player pseudo-randomness.
    let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return (x % 6) + 1;
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
