"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultEngine = createDefaultEngine;
const scoring_1 = require("@step13/scoring");
const rules_1 = require("../rules");
const utils_1 = require("../utils");
function createDefaultEngine({ scoreOptions }) {
    return {
        buildDealResult(players, seed) {
            const shuffled = (0, utils_1.shuffleWithSeed)((0, utils_1.generateTiles)(), seed);
            const dealt = {};
            players.forEach((playerId, index) => {
                dealt[playerId] = shuffled.slice(index * rules_1.RULES.tiles.dealTilesPerPlayer, (index + 1) * rules_1.RULES.tiles.dealTilesPerPlayer);
            });
            const wallStart = players.length * rules_1.RULES.tiles.dealTilesPerPlayer;
            return {
                dealt,
                wall: shuffled.slice(wallStart)
            };
        },
        selectDealer(players, seed) {
            const dealerDice = rollDealerDice(players, seed);
            const dealer = pickDealerFromDice(players, seed, dealerDice);
            return {
                dealer,
                dealerDice,
                seatMap: computeSeatMap(players, dealer)
            };
        },
        getEastPlayer(seatMap) {
            return Object.keys(seatMap).find((playerId) => seatMap[playerId] === 'EAST') ?? '';
        },
        hasWinningWait(hand) {
            return hasWinningWaitInternal(hand);
        },
        findTenpaiHand(tiles) {
            // Use the same win-wait predicate as machine guard to avoid mismatch.
            for (let i = 0; i < 5000; i++) {
                const shuffled = (0, utils_1.shuffleWithSeed)(tiles, i + 1);
                const hand = shuffled.slice(0, rules_1.RULES.tiles.handSize);
                if (hasWinningWaitInternal(hand)) {
                    return { hand, pool: shuffled.slice(rules_1.RULES.tiles.handSize) };
                }
            }
            const fallback = [...tiles];
            return {
                hand: fallback.slice(0, rules_1.RULES.tiles.handSize),
                pool: fallback.slice(rules_1.RULES.tiles.handSize)
            };
        },
        canSelectDora(context, playerId, _tileId) {
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
        selectDora(context, event) {
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
        autoSelectDora(context) {
            const selected = context.wall[0];
            if (!selected) {
                return {};
            }
            const timeoutEvent = { type: 'TIMEOUT', playerId: context.dealer, phase: 'DORA_SELECT' };
            const selectEvent = { type: 'SELECT_DORA', playerId: context.dealer, tileId: selected.id ?? '' };
            return {
                // Keep wall layout intact so clients can reveal the selected tile in-place.
                wall: context.wall,
                doraIndicators: [selected],
                eventLog: [...context.eventLog, timeoutEvent, selectEvent]
            };
        },
        canDiscard(context, playerId, tileId) {
            if (context.currentTurn !== playerId) {
                return false;
            }
            const pool = context.pools[playerId] ?? [];
            return pool.some((tile) => tile.id === tileId);
        },
        applyDiscard(context, playerId, tileId) {
            const pool = context.pools[playerId] ?? [];
            const tile = pool.find((entry) => entry.id === tileId);
            if (!tile) {
                return context;
            }
            const currentDiscards = context.discards[playerId] ?? [];
            const nextPool = pool.filter((entry) => entry.id !== tileId);
            const nextTurn = context.players.find((id) => id !== playerId) ?? null;
            const discardEvent = { type: 'DISCARD', playerId, tileId };
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
        isDrawReached(context) {
            return context.players.every((playerId) => (context.discards[playerId] ?? []).length >= rules_1.RULES.draw.afterDiscardsEach);
        },
        autoRonWinner(context) {
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
            const score = (0, scoring_1.calculateScore)(hand, tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[opponentId]),
                roundWind: 'EAST'
            });
            if (score.points >= rules_1.RULES.winConditions.manganMinimumPoints) {
                return opponentId;
            }
            return null;
        },
        canDeclareRon(context, playerId) {
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
            const score = (0, scoring_1.calculateScore)(hand, context.lastDiscard.tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[playerId]),
                roundWind: 'EAST'
            });
            return score.points >= rules_1.RULES.winConditions.manganMinimumPoints;
        },
        resolveRon(context, winnerId) {
            if (!context.lastDiscard) {
                return null;
            }
            const loserId = context.lastDiscard.playerId;
            const winResult = (0, scoring_1.calculateScore)(context.hands[winnerId], context.lastDiscard.tile, false, context.doraIndicators, {
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
        resolveDraw(context) {
            const tenpaiPlayers = context.players.filter((playerId) => {
                const hand = context.hands[playerId] ?? [];
                return hasWinningWaitInternal(hand);
            });
            const scores = { ...context.scores };
            if (rules_1.RULES.draw.notenBappuEnabled && tenpaiPlayers.length === 1) {
                const tenpaiPlayer = tenpaiPlayers[0];
                const notenPlayer = context.players.find((playerId) => playerId !== tenpaiPlayer);
                if (notenPlayer) {
                    scores[tenpaiPlayer] += rules_1.RULES.draw.notenBappuAmount;
                    scores[notenPlayer] -= rules_1.RULES.draw.notenBappuAmount;
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
function hasWinningWaitInternal(hand) {
    if (hand.length !== rules_1.RULES.tiles.handSize) {
        return false;
    }
    const suits = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const winTile = { suit, rank: rank, isRed: false };
            if ((0, scoring_1.calculateShanten)([...hand, winTile]) === -1) {
                return true;
            }
        }
    }
    return false;
}
function rollDealerDice(players, seed) {
    const result = {};
    players.forEach((playerId, index) => {
        result[playerId] = deterministicDice(seed, index + 1);
    });
    return result;
}
function deterministicDice(seed, salt) {
    // Murmur-inspired finalizer for stable, per-player pseudo-randomness.
    let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return (x % 6) + 1;
}
function pickDealerFromDice(players, seed, dealerDice) {
    const sorted = [...players].sort((a, b) => (dealerDice[b] ?? 0) - (dealerDice[a] ?? 0));
    if (sorted.length < 2)
        return sorted[0] ?? '';
    if ((dealerDice[sorted[0]] ?? 0) !== (dealerDice[sorted[1]] ?? 0)) {
        return sorted[0];
    }
    const tieBreak = (0, utils_1.shuffleWithSeed)(sorted.slice(0, 2), seed + 99);
    return tieBreak[0] ?? sorted[0];
}
function computeSeatMap(players, dealer) {
    const other = players.find((playerId) => playerId !== dealer) ?? '';
    return {
        [dealer]: 'EAST',
        [other]: 'WEST'
    };
}
function seatToWind(seat) {
    if (seat === 'EAST')
        return 'EAST';
    if (seat === 'WEST')
        return 'WEST';
    return undefined;
}
