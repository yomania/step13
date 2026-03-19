import { assign, setup } from 'xstate';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { Tile } from '@step13/proto';
import { GameContext, GameEvents } from './messages';
import { RULES } from './rules';
import { createEngineForRuleset, RulesetName } from './engine/rulesets';
import { GameEngine } from './engine/types';

const initialContext: GameContext = {
    players: [],
    scores: {},
    currentTurn: null,
    round: 0,
    dealtTiles: {},
    hands: {},
    pools: {},
    wall: [],
    doraIndicators: [],
    dealerDice: {},
    discards: {},
    phase: 'IDLE',
    winner: null,
    dealer: '',
    winResult: null,
    lastDiscard: null,
    eventLog: [],
    matchHandIndex: 0,
    seatMap: {},
    deterministicSeed: null,
    timeBankRemainingMs: {},
    roundEndConfirmedBy: {},
    ruleset: 'classic',
    attackDefense: {
        stage: 'A',
        attacker: null,
        defender: null,
        declaredBy: null,
        declaredWithRiichi: false,
        declarationType: null,
        ownTurns: {},
        guessesRemaining: 0,
        failedGuesses: 0,
        assaultRemaining: 0,
        lockedWaitTileKeys: [],
        lastGuessTileKey: null,
        lastGuessResult: 'idle',
        kanOption: {
            pending: false,
            tileKey: null
        }
    }
};

export type GameMachineOptions = {
    ruleset?: RulesetName;
    engine?: GameEngine;
};

function toTileKey(tile: Tile): string {
    return `${tile.suit}-${tile.rank}`;
}

function getWinningWaitKeys(hand: Tile[]): string[] {
    if (hand.length !== RULES.tiles.handSize) {
        return [];
    }
    const waits: string[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const wait: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            if (calculateShanten([...hand, wait]) === -1) {
                waits.push(toTileKey(wait));
            }
        }
    }
    return waits;
}

function resolveTenBattleScores(context: GameContext, winner: string | null): Record<string, number> {
    const delta = 12000;
    const next = { ...context.scores };
    if (!winner) {
        return next;
    }
    const loser = context.players.find((id) => id !== winner);
    if (!loser) {
        return next;
    }
    next[winner] = (next[winner] ?? 0) + delta;
    next[loser] = Math.max(0, (next[loser] ?? 0) - delta);
    return next;
}

function findKanTileKey(pool: Tile[]): string | null {
    const counts = new Map<string, number>();
    pool.forEach((tile) => {
        const key = toTileKey(tile);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    for (const [key, count] of counts.entries()) {
        if (count >= 4) {
            return key;
        }
    }
    return null;
}

export function createGameMachine(options: GameMachineOptions = {}) {
    const engine = options.engine ?? createEngineForRuleset(options.ruleset ?? 'classic');

    return setup({
        types: {
            context: {} as GameContext,
            events: {} as GameEvents
        },
        guards: {
            canStartMatch: ({ context }) => context.players.length === 2,
            isValidHandSubmit: ({ context, event }) => {
                if (event.type !== 'SUBMIT_HAND') {
                    return false;
                }
                if (!context.players.includes(event.playerId)) {
                    return false;
                }
                if (event.hand.length !== RULES.tiles.handSize || event.pool.length !== RULES.tiles.poolSize) {
                    return false;
                }
                return engine.hasWinningWait(event.hand);
            },
            allHandsSubmitted: ({ context }) => context.players.every((playerId) => Boolean(context.hands[playerId])),
            canSelectDoraIndicator: ({ context, event }) => {
                if (event.type !== 'SELECT_DORA') {
                    return false;
                }
                return engine.canSelectDora(context, event.playerId, event.tileId);
            },
            hasSelectedDoraIndicator: ({ context }) => (context.doraIndicators?.length ?? 0) > 0,
            hasNoSelectedDoraIndicator: ({ context }) => (context.doraIndicators?.length ?? 0) === 0,
            canApplyDiscard: ({ context, event }) => {
                if (event.type !== 'DISCARD' && event.type !== 'AUTO_DISCARD') {
                    return false;
                }
                if (context.ruleset !== 'classic' && context.attackDefense.stage === 'B_GUESS') {
                    return false;
                }
                if (context.ruleset !== 'classic' && context.attackDefense.kanOption.pending) {
                    return false;
                }
                return engine.canDiscard(context, event.playerId, event.tileId);
            },
            hasTurnTimeBank: ({ context }) => {
                if (!context.currentTurn) {
                    return false;
                }
                return (context.timeBankRemainingMs[context.currentTurn] ?? 0) > 0;
            },
            shouldEndAsDraw: ({ context }) => engine.isDrawReached(context),
            hasAutoRonWinner: ({ context }) =>
                context.ruleset === 'classic' && RULES.actions.autoRon && Boolean(engine.autoRonWinner(context)),
            canDeclareRon: ({ context, event }) => {
                if (event.type !== 'DECLARE_WIN') {
                    return false;
                }
                if (context.ruleset !== 'classic') {
                    return false;
                }
                return engine.canDeclareRon(context, event.playerId);
            },
            canDeclareTenpai: ({ context, event }) => {
                if (event.type !== 'DECLARE_TENPAI') {
                    return false;
                }
                if (context.ruleset === 'classic') {
                    return false;
                }
                if (context.attackDefense.stage !== 'A') {
                    return false;
                }
                if (context.currentTurn !== event.playerId) {
                    return false;
                }
                const ownTurns = context.attackDefense.ownTurns[event.playerId] ?? 0;
                if (ownTurns >= 18) {
                    return false;
                }
                if (context.ruleset === 'ten_attack_defense_easy' && event.withRiichi) {
                    return false;
                }
                const hand = context.hands[event.playerId];
                if (!hand) {
                    return false;
                }
                const waits = getWinningWaitKeys(hand);
                if (waits.length === 0) {
                    return false;
                }
                const discardKeys = new Set((context.discards[event.playerId] ?? []).map((tile) => toTileKey(tile)));
                if (waits.some((key) => discardKeys.has(key))) {
                    return false;
                }
                const hasYakuWait = waits.some((key) => {
                    const [suit, rankRaw] = key.split('-');
                    const waitTile: Tile = { suit: suit as Tile['suit'], rank: Number(rankRaw) as Tile['rank'], isRed: false };
                    const score = calculateScore(hand, waitTile, false, context.doraIndicators, {
                        seatWind: context.seatMap[event.playerId] === 'EAST' ? 'EAST' : 'WEST',
                        roundWind: 'EAST'
                    });
                    return score.points > 0 && score.yaku.length > 0;
                });
                return hasYakuWait;
            },
            canDefenderGuess: ({ context, event }) => {
                if (event.type !== 'DEFENDER_GUESS') {
                    return false;
                }
                return (
                    context.ruleset !== 'classic' &&
                    context.attackDefense.stage === 'B_GUESS' &&
                    context.attackDefense.defender === event.playerId &&
                    context.attackDefense.guessesRemaining > 0
                );
            },
            canResolveKanDecision: ({ context, event }) => {
                if (event.type !== 'ATTACKER_KAN' && event.type !== 'ATTACKER_KAN_PASS') {
                    return false;
                }
                return (
                    context.ruleset !== 'classic' &&
                    context.attackDefense.stage === 'B_ASSAULT' &&
                    context.attackDefense.attacker === event.playerId &&
                    context.attackDefense.kanOption.pending
                );
            },
            hasNextHand: ({ context }) => context.matchHandIndex < RULES.match.handsPerMatch,
            hasNoNextHand: ({ context }) => context.matchHandIndex >= RULES.match.handsPerMatch,
            allRoundEndConfirmed: ({ context }) => context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])),
            canForfeitOnLeave: ({ context }) => context.phase !== 'IDLE' && context.phase !== 'MATCH_END'
        },
        actions: {
            initializeMatch: assign(({ context, event }) => {
                const seed = event.type === 'START_MATCH' && typeof event.seed === 'number'
                    ? event.seed
                    : Math.floor(Date.now() % 2147483647);

                const dealerSelection = engine.selectDealer(context.players, seed);
                const generatedDeal = engine.buildDealResult(context.players, seed + 1);
                const dealResult = event.type === 'START_MATCH' && event.dealtTiles
                    ? { dealt: event.dealtTiles, wall: generatedDeal.wall }
                    : generatedDeal;
                const scores: Record<string, number> = {};
                const timeBank: Record<string, number> = {};
                context.players.forEach((playerId) => {
                    scores[playerId] = RULES.match.startingPoints;
                    timeBank[playerId] = RULES.timers.timeBankMs;
                });
                const ownTurns: Record<string, number> = {};
                context.players.forEach((playerId) => {
                    ownTurns[playerId] = 0;
                });

                return {
                    phase: 'MATCH_START',
                    round: 1,
                    matchHandIndex: 1,
                    seatMap: dealerSelection.seatMap,
                    dealer: dealerSelection.dealer,
                    dealerDice: dealerSelection.dealerDice,
                    scores,
                    dealtTiles: dealResult.dealt,
                    hands: {},
                    pools: {},
                    wall: dealResult.wall,
                    doraIndicators: [],
                    discards: {},
                    winner: null,
                    winResult: null,
                    currentTurn: dealerSelection.dealer,
                    lastDiscard: null,
                    deterministicSeed: seed,
                    timeBankRemainingMs: timeBank,
                    roundEndConfirmedBy: {},
                    ruleset: options.ruleset ?? 'classic',
                    attackDefense: {
                        stage: 'A',
                        attacker: null,
                        defender: null,
                        declaredBy: null,
                        declaredWithRiichi: false,
                        declarationType: null,
                        ownTurns,
                        guessesRemaining: 0,
                        failedGuesses: 0,
                        assaultRemaining: 0,
                        lockedWaitTileKeys: [],
                        lastGuessTileKey: null,
                        lastGuessResult: 'idle',
                        kanOption: {
                            pending: false,
                            tileKey: null
                        }
                    },
                    eventLog: [...context.eventLog, { type: 'START_MATCH', seed, dealtTiles: dealResult.dealt, ruleset: options.ruleset ?? 'classic' }]
                };
            }),
            startNextHand: assign(({ context }) => {
                const nextHandIndex = context.matchHandIndex + 1;
                const roundSeed = (context.deterministicSeed ?? 0) + nextHandIndex;
                const dealResult = engine.buildDealResult(context.players, roundSeed);
                const dealer = engine.getEastPlayer(context.seatMap);
                const timeBank: Record<string, number> = {};
                context.players.forEach((playerId) => {
                    timeBank[playerId] = RULES.timers.timeBankMs;
                });
                const ownTurns: Record<string, number> = {};
                context.players.forEach((playerId) => {
                    ownTurns[playerId] = 0;
                });

                return {
                    phase: 'MATCH_START',
                    round: nextHandIndex,
                    matchHandIndex: nextHandIndex,
                    dealtTiles: dealResult.dealt,
                    hands: {},
                    pools: {},
                    wall: dealResult.wall,
                    doraIndicators: [],
                    discards: {},
                    winner: null,
                    winResult: null,
                    currentTurn: dealer,
                    lastDiscard: null,
                    timeBankRemainingMs: timeBank,
                    roundEndConfirmedBy: {},
                    attackDefense: {
                        stage: 'A',
                        attacker: null,
                        defender: null,
                        declaredBy: null,
                        declaredWithRiichi: false,
                        declarationType: null,
                        ownTurns,
                        guessesRemaining: 0,
                        failedGuesses: 0,
                        assaultRemaining: 0,
                        lockedWaitTileKeys: [],
                        lastGuessTileKey: null,
                        lastGuessResult: 'idle',
                        kanOption: {
                            pending: false,
                            tileKey: null
                        }
                    }
                };
            }),
            selectDoraIndicator: assign(({ context, event }) => {
                if (event.type !== 'SELECT_DORA') {
                    return {};
                }
                return engine.selectDora(context, event);
            }),
            autoSelectDoraIndicator: assign(({ context }) => engine.autoSelectDora(context)),
            setHand: assign(({ context, event }) => {
                if (event.type !== 'SUBMIT_HAND') {
                    return {};
                }

                return {
                    hands: {
                        ...context.hands,
                        [event.playerId]: event.hand
                    },
                    pools: {
                        ...context.pools,
                        [event.playerId]: event.pool
                    },
                    eventLog: [...context.eventLog, event]
                };
            }),
            autoSubmitMissingHands: assign(({ context }) => {
                const nextHands = { ...context.hands };
                const nextPools = { ...context.pools };
                const extraEvents: GameEvents[] = [];

                context.players.forEach((playerId) => {
                    if (!nextHands[playerId]) {
                        const dealt = context.dealtTiles[playerId] ?? [];
                        const { hand, pool } = engine.findTenpaiHand(dealt, {
                            doraIndicators: context.doraIndicators,
                            requireMangan: true
                        });
                        nextHands[playerId] = hand;
                        nextPools[playerId] = pool;
                        extraEvents.push({ type: 'TIMEOUT', playerId, phase: 'HAND_BUILD' });
                        extraEvents.push({ type: 'SUBMIT_HAND', playerId, hand, pool });
                    }
                });

                return {
                    hands: nextHands,
                    pools: nextPools,
                    eventLog: [...context.eventLog, ...extraEvents]
                };
            }),
            setTurnPhase: assign({
                phase: () => 'TURN'
            }),
            consumeTurnTimeBank: assign(({ context }) => {
                if (!context.currentTurn) {
                    return {};
                }
                const playerId = context.currentTurn;
                const current = context.timeBankRemainingMs[playerId] ?? RULES.timers.timeBankMs;
                const consumed = Math.min(current, RULES.timers.timeBankMs);
                const timeoutEvent: GameEvents = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                return {
                    timeBankRemainingMs: {
                        ...context.timeBankRemainingMs,
                        [playerId]: current - consumed
                    },
                    eventLog: [...context.eventLog, timeoutEvent]
                };
            }),
            applyDiscard: assign(({ context, event }) => {
                if (event.type !== 'DISCARD' && event.type !== 'AUTO_DISCARD') {
                    return {};
                }
                if (context.ruleset !== 'classic' && context.attackDefense.stage === 'B_ASSAULT') {
                    const attacker = context.attackDefense.attacker;
                    if (!attacker || attacker !== event.playerId) {
                        return {};
                    }
                    const wallTile = context.wall[0];
                    if (!wallTile) {
                        return {
                            phase: 'ROUND_END',
                            winner: null,
                            winResult: null,
                            scores: context.scores,
                            eventLog: [...context.eventLog, event, { type: 'ROUND_END', reason: 'DRAW' }]
                        };
                    }
                    const drawnKey = toTileKey(wallTile);
                    if (context.attackDefense.lockedWaitTileKeys.includes(drawnKey)) {
                        return {
                            phase: 'ROUND_END',
                            winner: attacker,
                            winResult: null,
                            scores: resolveTenBattleScores(context, attacker),
                            wall: context.wall.slice(1),
                            eventLog: [...context.eventLog, event, { type: 'ROUND_END', reason: 'RON' }]
                        };
                    }
                    const withDrawn = {
                        ...context,
                        wall: context.wall.slice(1),
                        pools: {
                            ...context.pools,
                            [attacker]: [...(context.pools[attacker] ?? []), wallTile]
                        }
                    };
                    const canOfferKan = Boolean(context.attackDefense.declaredWithRiichi) &&
                        context.ruleset === 'ten_attack_defense' &&
                        !context.attackDefense.kanOption.pending;
                    if (canOfferKan) {
                        const kanTileKey = findKanTileKey(withDrawn.pools[attacker] ?? []);
                        if (kanTileKey) {
                            return {
                                ...withDrawn,
                                attackDefense: {
                                    ...withDrawn.attackDefense,
                                    kanOption: {
                                        pending: true,
                                        tileKey: kanTileKey
                                    }
                                }
                            };
                        }
                    }
                    const appliedAssault = engine.applyDiscard(withDrawn, event.playerId, event.tileId);
                    const nextAssault = Math.max(0, context.attackDefense.assaultRemaining - 1);
                    if (nextAssault === 0) {
                        return {
                            ...appliedAssault,
                            phase: 'ROUND_END',
                            winner: null,
                            winResult: null,
                            scores: context.scores,
                            currentTurn: null,
                            attackDefense: {
                                ...appliedAssault.attackDefense,
                                assaultRemaining: 0,
                                kanOption: {
                                    pending: false,
                                    tileKey: null
                                }
                            },
                            eventLog: [...appliedAssault.eventLog, { type: 'ROUND_END', reason: 'DRAW' }]
                        };
                    }
                    return {
                        ...appliedAssault,
                        currentTurn: attacker,
                        attackDefense: {
                            ...appliedAssault.attackDefense,
                            assaultRemaining: nextAssault,
                            kanOption: {
                                pending: false,
                                tileKey: null
                            }
                        }
                    };
                }
                const applied = engine.applyDiscard(context, event.playerId, event.tileId);
                if (context.ruleset === 'classic') {
                    return applied;
                }
                return {
                    ...applied,
                    attackDefense: {
                        ...applied.attackDefense,
                        ownTurns: {
                            ...applied.attackDefense.ownTurns,
                            [event.playerId]: (applied.attackDefense.ownTurns[event.playerId] ?? 0) + 1
                        }
                    }
                };
            }),
            declareTenpai: assign(({ context, event }) => {
                if (event.type !== 'DECLARE_TENPAI') {
                    return {};
                }
                const attacker = event.playerId;
                const defender = context.players.find((id) => id !== attacker) ?? null;
                const hand = context.hands[attacker] ?? [];
                return {
                    attackDefense: {
                        ...context.attackDefense,
                        stage: 'B_GUESS',
                        attacker,
                        defender,
                        declaredBy: attacker,
                        declaredWithRiichi: Boolean(event.withRiichi),
                        declarationType: event.withRiichi ? 'RIICHI' : 'TENPAI',
                        guessesRemaining: 2,
                        failedGuesses: 0,
                        assaultRemaining: 0,
                        lockedWaitTileKeys: getWinningWaitKeys(hand),
                        lastGuessTileKey: null,
                        lastGuessResult: 'pending',
                        kanOption: {
                            pending: false,
                            tileKey: null
                        }
                    },
                    currentTurn: defender,
                    eventLog: [...context.eventLog, event]
                };
            }),
            passDeclaration: assign(({ context, event }) => {
                if (event.type !== 'PASS_DECLARATION') {
                    return {};
                }
                return {
                    eventLog: [...context.eventLog, event]
                };
            }),
            applyDefenderGuess: assign(({ context, event }) => {
                if (event.type !== 'DEFENDER_GUESS') {
                    return {};
                }
                const hit = context.attackDefense.lockedWaitTileKeys.includes(event.tileKey);
                const guessesRemaining = Math.max(0, context.attackDefense.guessesRemaining - 1);
                if (hit) {
                    return {
                        phase: 'ROUND_END',
                        winner: event.playerId,
                        winResult: null,
                        scores: resolveTenBattleScores(context, event.playerId),
                        attackDefense: {
                            ...context.attackDefense,
                            guessesRemaining,
                            lastGuessTileKey: event.tileKey,
                            lastGuessResult: 'succeeded'
                        },
                        eventLog: [...context.eventLog, event, { type: 'ROUND_END', reason: 'RON' }]
                    };
                }
                if (guessesRemaining === 0) {
                    return {
                            attackDefense: {
                                ...context.attackDefense,
                                stage: 'B_ASSAULT',
                                guessesRemaining,
                                failedGuesses: context.attackDefense.failedGuesses + 1,
                                assaultRemaining: 5,
                                lastGuessTileKey: event.tileKey,
                                lastGuessResult: 'failed',
                                kanOption: {
                                    pending: false,
                                    tileKey: null
                                }
                            },
                        currentTurn: context.attackDefense.attacker,
                        eventLog: [...context.eventLog, event]
                    };
                }
                return {
                    attackDefense: {
                        ...context.attackDefense,
                        guessesRemaining,
                        failedGuesses: context.attackDefense.failedGuesses + 1,
                        lastGuessTileKey: event.tileKey,
                        lastGuessResult: 'failed'
                    },
                    eventLog: [...context.eventLog, event]
                };
            }),
            resolveKanDecision: assign(({ context, event }) => {
                if (event.type !== 'ATTACKER_KAN' && event.type !== 'ATTACKER_KAN_PASS') {
                    return {};
                }
                const attacker = context.attackDefense.attacker;
                if (!attacker || attacker !== event.playerId) {
                    return {};
                }
                const tileKey = context.attackDefense.kanOption.tileKey;
                if (!tileKey) {
                    return {};
                }
                if (event.type === 'ATTACKER_KAN_PASS') {
                    return {
                        attackDefense: {
                            ...context.attackDefense,
                            kanOption: {
                                pending: false,
                                tileKey: null
                            }
                        },
                        eventLog: [...context.eventLog, event]
                    };
                }
                const [suitRaw, rankRaw] = tileKey.split('-');
                const suit = suitRaw as Tile['suit'];
                const rank = Number(rankRaw) as Tile['rank'];
                const pool = context.pools[attacker] ?? [];
                let removed = 0;
                const nextPool = pool.filter((tile) => {
                    if (removed >= 4) {
                        return true;
                    }
                    if (tile.suit === suit && tile.rank === rank) {
                        removed += 1;
                        return false;
                    }
                    return true;
                });
                return {
                    pools: {
                        ...context.pools,
                        [attacker]: nextPool
                    },
                    attackDefense: {
                        ...context.attackDefense,
                        kanOption: {
                            pending: false,
                            tileKey: null
                        }
                    },
                    eventLog: [...context.eventLog, event]
                };
            }),
            forceDiscardOnTimeout: assign(({ context }) => {
                if (!context.currentTurn) {
                    return {};
                }
                const playerId = context.currentTurn;
                const pool = context.pools[playerId] ?? [];
                const tile = pool[0];
                if (!tile?.id) {
                    const timeoutEvent: GameEvents = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                    return {
                        eventLog: [...context.eventLog, timeoutEvent]
                    };
                }

                const timeoutEvent: GameEvents = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                const timedOutContext = {
                    ...context,
                    eventLog: [...context.eventLog, timeoutEvent]
                };
                return engine.applyDiscard(timedOutContext, playerId, tile.id);
            }),
            refreshTurnTimeBankForCurrent: assign(({ context }) => {
                if (!context.currentTurn) {
                    return {};
                }
                return {
                    timeBankRemainingMs: {
                        ...context.timeBankRemainingMs,
                        [context.currentTurn]: RULES.timers.timeBankMs
                    }
                };
            }),
            applyAutoRon: assign(({ context }) => {
                const winnerId = engine.autoRonWinner(context);
                if (!winnerId) {
                    return {};
                }

                const resolved = engine.resolveRon(context, winnerId);
                if (!resolved) {
                    return {};
                }

                return {
                    phase: 'ROUND_END',
                    winner: resolved.winner,
                    winResult: resolved.winResult,
                    scores: resolved.scores,
                    eventLog: [...context.eventLog, { type: 'AUTO_RON', playerId: winnerId }, { type: 'ROUND_END', reason: 'RON' }]
                };
            }),
            applyManualRon: assign(({ context, event }) => {
                if (event.type !== 'DECLARE_WIN') {
                    return {};
                }

                const resolved = engine.resolveRon(context, event.playerId);
                if (!resolved) {
                    return {};
                }

                return {
                    phase: 'ROUND_END',
                    winner: resolved.winner,
                    winResult: resolved.winResult,
                    scores: resolved.scores,
                    eventLog: [...context.eventLog, event, { type: 'ROUND_END', reason: 'RON' }]
                };
            }),
            applyDrawResult: assign(({ context }) => {
                const resolved = engine.resolveDraw(context);
                return {
                    phase: 'ROUND_END',
                    winner: resolved.winner,
                    winResult: resolved.winResult,
                    scores: resolved.scores,
                    eventLog: [...context.eventLog, { type: 'ROUND_END', reason: 'DRAW' }]
                };
            }),
            finalizeMatch: assign(({ context }) => {
                const [leader] = [...context.players].sort((a, b) => (context.scores[b] ?? 0) - (context.scores[a] ?? 0));
                return {
                    phase: 'MATCH_END',
                    winner: leader ?? null,
                    eventLog: [...context.eventLog, { type: 'MATCH_END', winner: leader ?? null }]
                };
            }),
            logGuideView: assign(({ context, event }) => {
                if (event.type !== 'GUIDE_VIEW') {
                    return {};
                }
                return {
                    eventLog: [...context.eventLog, event]
                };
            }),
            removePlayerFromLobby: assign(({ context, event }) => {
                if (event.type !== 'LEAVE') {
                    return {};
                }
                if (!context.players.includes(event.playerId)) {
                    return {};
                }

                return {
                    players: context.players.filter((playerId) => playerId !== event.playerId),
                    eventLog: [...context.eventLog, event]
                };
            }),
            resetGame: assign(() => initialContext),
            markRoundEndConfirmed: assign(({ context, event }) => {
                if (event.type !== 'CONFIRM_ROUND_END') {
                    return {};
                }
                if (!context.players.includes(event.playerId)) {
                    return {};
                }
                return {
                    roundEndConfirmedBy: {
                        ...context.roundEndConfirmedBy,
                        [event.playerId]: true
                    },
                    eventLog: [...context.eventLog, event]
                };
            }),
            autoConfirmBotsInRoundEnd: assign(({ context }) => {
                const next = { ...context.roundEndConfirmedBy };
                context.players.forEach((playerId) => {
                    if (playerId.startsWith('bot-')) {
                        next[playerId] = true;
                    }
                });
                return {
                    roundEndConfirmedBy: next
                };
            }),
            forfeitMatch: assign(({ context, event }) => {
                if (event.type !== 'LEAVE') {
                    return {};
                }
                const remaining = context.players.filter((playerId) => playerId !== event.playerId);
                const winner = remaining.length === 1 ? remaining[0] : null;
                return {
                    phase: 'MATCH_END',
                    winner,
                    winResult: null,
                    eventLog: [...context.eventLog, event, { type: 'MATCH_END', winner }]
                };
            })
        }
    }).createMachine({
        id: 'mahjong-17-step',
        initial: 'idle',
        context: initialContext,
        states: {
            idle: {
                on: {
                    JOIN: {
                        actions: assign(({ context, event }) => {
                            if (event.type !== 'JOIN') {
                                return {};
                            }
                            if (context.players.includes(event.playerId) || context.players.length >= 2) {
                                return {};
                            }

                            return {
                                players: [...context.players, event.playerId],
                                eventLog: [...context.eventLog, event]
                            };
                        })
                    },
                    LEAVE: {
                        actions: 'removePlayerFromLobby'
                    },
                    START_MATCH: {
                        target: 'matchStart',
                        guard: 'canStartMatch',
                        actions: 'initializeMatch'
                    }
                }
            },
            matchStart: {
                after: {
                    1000: {
                        target: 'doraSelect'
                    }
                }
            },
            doraSelect: {
                entry: assign({
                    phase: () => 'ROUND_START'
                }),
                after: {
                    [RULES.timers.doraRevealTimeMs]: {
                        guard: 'hasSelectedDoraIndicator',
                        target: 'handBuild'
                    },
                    [RULES.timers.doraSelectTimeMs]: {
                        guard: 'hasNoSelectedDoraIndicator',
                        actions: 'autoSelectDoraIndicator'
                    }
                },
                on: {
                    SELECT_DORA: {
                        guard: 'canSelectDoraIndicator',
                        actions: 'selectDoraIndicator',
                        target: 'doraSelect',
                        reenter: true
                    }
                }
            },
            handBuild: {
                entry: assign({
                    phase: () => 'ROUND_START'
                }),
                after: {
                    [RULES.timers.buildTimeMs]: {
                        actions: 'autoSubmitMissingHands'
                    }
                },
                always: {
                    guard: 'allHandsSubmitted',
                    target: 'gameLoop',
                    actions: 'setTurnPhase'
                },
                on: {
                    SUBMIT_HAND: {
                        guard: 'isValidHandSubmit',
                        actions: 'setHand'
                    }
                }
            },
            gameLoop: {
                initial: 'turn',
                states: {
                    turn: {
                        after: {
                            [RULES.timers.turnTimeMs]: [
                                {
                                    guard: 'hasTurnTimeBank',
                                    actions: 'consumeTurnTimeBank',
                                    target: 'turnOvertime'
                                },
                                {
                                    actions: 'forceDiscardOnTimeout',
                                    target: 'checkRon'
                                }
                            ]
                        },
                        on: {
                            DISCARD: {
                                target: 'checkRon',
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard'
                            },
                            AUTO_DISCARD: {
                                target: 'checkRon',
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard'
                            }
                        }
                    },
                    turnOvertime: {
                        after: {
                            [RULES.timers.timeBankMs]: {
                                actions: 'forceDiscardOnTimeout',
                                target: 'checkRon'
                            }
                        },
                        on: {
                            DISCARD: {
                                target: 'checkRon',
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard'
                            },
                            AUTO_DISCARD: {
                                target: 'checkRon',
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard'
                            }
                        }
                    },
                    checkRon: {
                        always: [
                            {
                                guard: 'shouldEndAsDraw',
                                target: '#mahjong-17-step.roundEnd',
                                actions: 'applyDrawResult'
                            },
                            {
                                guard: 'hasAutoRonWinner',
                                target: '#mahjong-17-step.roundEnd',
                                actions: 'applyAutoRon'
                            },
                            {
                                actions: 'refreshTurnTimeBankForCurrent',
                                target: 'turn'
                            }
                        ]
                    }
                },
                on: {
                    DECLARE_WIN: {
                        guard: 'canDeclareRon',
                        actions: 'applyManualRon',
                        target: '#mahjong-17-step.roundEnd'
                    },
                    DECLARE_TENPAI: {
                        guard: 'canDeclareTenpai',
                        actions: 'declareTenpai'
                    },
                    PASS_DECLARATION: {
                        actions: 'passDeclaration'
                    },
                    DEFENDER_GUESS: {
                        guard: 'canDefenderGuess',
                        actions: 'applyDefenderGuess',
                        target: 'checkRon'
                    },
                    ATTACKER_KAN: {
                        guard: 'canResolveKanDecision',
                        actions: 'resolveKanDecision'
                    },
                    ATTACKER_KAN_PASS: {
                        guard: 'canResolveKanDecision',
                        actions: 'resolveKanDecision'
                    }
                }
            },
            roundEnd: {
                entry: [
                    assign({
                        phase: () => 'ROUND_END'
                    }),
                    'autoConfirmBotsInRoundEnd'
                ],
                always: [
                    {
                        guard: ({ context }) =>
                            context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])) &&
                            context.players.some((playerId) => (context.scores[playerId] ?? 0) <= RULES.winConditions.bankruptAtOrBelow),
                        target: 'matchEnd',
                        actions: 'finalizeMatch'
                    },
                    {
                        guard: ({ context }) =>
                            context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])) &&
                            context.matchHandIndex < RULES.match.handsPerMatch,
                        target: 'matchStart',
                        actions: 'startNextHand'
                    },
                    {
                        guard: ({ context }) =>
                            context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])) &&
                            context.matchHandIndex >= RULES.match.handsPerMatch,
                        target: 'matchEnd',
                        actions: 'finalizeMatch'
                    }
                ],
                on: {
                    CONFIRM_ROUND_END: {
                        actions: 'markRoundEndConfirmed'
                    }
                }
            },
            matchEnd: {
                entry: assign({
                    phase: () => 'MATCH_END'
                })
            }
        },
        on: {
            LEAVE: {
                target: '.matchEnd',
                guard: 'canForfeitOnLeave',
                actions: 'forfeitMatch'
            },
            RESTART: {
                target: '.idle',
                actions: 'resetGame'
            },
            GUIDE_VIEW: {
                actions: 'logGuideView'
            }
        }
    });
}

export const gameMachine = createGameMachine();
