"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameMachine = void 0;
exports.createGameMachine = createGameMachine;
const xstate_1 = require("xstate");
const rules_1 = require("./rules");
const rulesets_1 = require("./engine/rulesets");
const initialContext = {
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
    roundEndConfirmedBy: {}
};
function createGameMachine(options = {}) {
    const engine = options.engine ?? (0, rulesets_1.createEngineForRuleset)(options.ruleset ?? 'classic');
    return (0, xstate_1.setup)({
        types: {
            context: {},
            events: {}
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
                if (event.hand.length !== rules_1.RULES.tiles.handSize || event.pool.length !== rules_1.RULES.tiles.poolSize) {
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
                return engine.canDiscard(context, event.playerId, event.tileId);
            },
            hasTurnTimeBank: ({ context }) => {
                if (!context.currentTurn) {
                    return false;
                }
                return (context.timeBankRemainingMs[context.currentTurn] ?? 0) > 0;
            },
            shouldEndAsDraw: ({ context }) => engine.isDrawReached(context),
            hasAutoRonWinner: ({ context }) => rules_1.RULES.actions.autoRon && Boolean(engine.autoRonWinner(context)),
            canDeclareRon: ({ context, event }) => {
                if (event.type !== 'DECLARE_WIN') {
                    return false;
                }
                return engine.canDeclareRon(context, event.playerId);
            },
            hasNextHand: ({ context }) => context.matchHandIndex < rules_1.RULES.match.handsPerMatch,
            hasNoNextHand: ({ context }) => context.matchHandIndex >= rules_1.RULES.match.handsPerMatch,
            allRoundEndConfirmed: ({ context }) => context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId]))
        },
        actions: {
            initializeMatch: (0, xstate_1.assign)(({ context, event }) => {
                const seed = event.type === 'START_MATCH' && typeof event.seed === 'number'
                    ? event.seed
                    : Math.floor(Date.now() % 2147483647);
                const dealerSelection = engine.selectDealer(context.players, seed);
                const generatedDeal = engine.buildDealResult(context.players, seed + 1);
                const dealResult = event.type === 'START_MATCH' && event.dealtTiles
                    ? { dealt: event.dealtTiles, wall: generatedDeal.wall }
                    : generatedDeal;
                const scores = {};
                const timeBank = {};
                context.players.forEach((playerId) => {
                    scores[playerId] = rules_1.RULES.match.startingPoints;
                    timeBank[playerId] = rules_1.RULES.timers.timeBankMs;
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
                    eventLog: [...context.eventLog, { type: 'START_MATCH', seed, dealtTiles: dealResult.dealt }]
                };
            }),
            startNextHand: (0, xstate_1.assign)(({ context }) => {
                const nextHandIndex = context.matchHandIndex + 1;
                const roundSeed = (context.deterministicSeed ?? 0) + nextHandIndex;
                const dealResult = engine.buildDealResult(context.players, roundSeed);
                const dealer = engine.getEastPlayer(context.seatMap);
                const timeBank = {};
                context.players.forEach((playerId) => {
                    timeBank[playerId] = rules_1.RULES.timers.timeBankMs;
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
                    roundEndConfirmedBy: {}
                };
            }),
            selectDoraIndicator: (0, xstate_1.assign)(({ context, event }) => {
                if (event.type !== 'SELECT_DORA') {
                    return {};
                }
                return engine.selectDora(context, event);
            }),
            autoSelectDoraIndicator: (0, xstate_1.assign)(({ context }) => engine.autoSelectDora(context)),
            setHand: (0, xstate_1.assign)(({ context, event }) => {
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
            autoSubmitMissingHands: (0, xstate_1.assign)(({ context }) => {
                const nextHands = { ...context.hands };
                const nextPools = { ...context.pools };
                const extraEvents = [];
                context.players.forEach((playerId) => {
                    if (!nextHands[playerId]) {
                        const dealt = context.dealtTiles[playerId] ?? [];
                        const { hand, pool } = engine.findTenpaiHand(dealt);
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
            setTurnPhase: (0, xstate_1.assign)({
                phase: () => 'TURN'
            }),
            consumeTurnTimeBank: (0, xstate_1.assign)(({ context }) => {
                if (!context.currentTurn) {
                    return {};
                }
                const playerId = context.currentTurn;
                const current = context.timeBankRemainingMs[playerId] ?? rules_1.RULES.timers.timeBankMs;
                const consumed = Math.min(current, rules_1.RULES.timers.turnTimeMs);
                const timeoutEvent = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                return {
                    timeBankRemainingMs: {
                        ...context.timeBankRemainingMs,
                        [playerId]: current - consumed
                    },
                    eventLog: [...context.eventLog, timeoutEvent]
                };
            }),
            applyDiscard: (0, xstate_1.assign)(({ context, event }) => {
                if (event.type !== 'DISCARD' && event.type !== 'AUTO_DISCARD') {
                    return {};
                }
                return engine.applyDiscard(context, event.playerId, event.tileId);
            }),
            forceDiscardOnTimeout: (0, xstate_1.assign)(({ context }) => {
                if (!context.currentTurn) {
                    return {};
                }
                const playerId = context.currentTurn;
                const pool = context.pools[playerId] ?? [];
                const tile = pool[0];
                if (!tile?.id) {
                    const timeoutEvent = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                    return {
                        eventLog: [...context.eventLog, timeoutEvent]
                    };
                }
                const timeoutEvent = { type: 'TIMEOUT', playerId, phase: 'TURN' };
                const timedOutContext = {
                    ...context,
                    eventLog: [...context.eventLog, timeoutEvent]
                };
                return engine.applyDiscard(timedOutContext, playerId, tile.id);
            }),
            applyAutoRon: (0, xstate_1.assign)(({ context }) => {
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
            applyManualRon: (0, xstate_1.assign)(({ context, event }) => {
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
            applyDrawResult: (0, xstate_1.assign)(({ context }) => {
                const resolved = engine.resolveDraw(context);
                return {
                    phase: 'ROUND_END',
                    winner: resolved.winner,
                    winResult: resolved.winResult,
                    scores: resolved.scores,
                    eventLog: [...context.eventLog, { type: 'ROUND_END', reason: 'DRAW' }]
                };
            }),
            finalizeMatch: (0, xstate_1.assign)(({ context }) => {
                const [leader] = [...context.players].sort((a, b) => (context.scores[b] ?? 0) - (context.scores[a] ?? 0));
                return {
                    phase: 'MATCH_END',
                    winner: leader ?? null,
                    eventLog: [...context.eventLog, { type: 'MATCH_END', winner: leader ?? null }]
                };
            }),
            logGuideView: (0, xstate_1.assign)(({ context, event }) => {
                if (event.type !== 'GUIDE_VIEW') {
                    return {};
                }
                return {
                    eventLog: [...context.eventLog, event]
                };
            }),
            resetGame: (0, xstate_1.assign)(() => initialContext),
            markRoundEndConfirmed: (0, xstate_1.assign)(({ context, event }) => {
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
            autoConfirmBotsInRoundEnd: (0, xstate_1.assign)(({ context }) => {
                const next = { ...context.roundEndConfirmedBy };
                context.players.forEach((playerId) => {
                    if (playerId.startsWith('bot-')) {
                        next[playerId] = true;
                    }
                });
                return {
                    roundEndConfirmedBy: next
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
                        actions: (0, xstate_1.assign)(({ context, event }) => {
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
                entry: (0, xstate_1.assign)({
                    phase: () => 'ROUND_START'
                }),
                after: {
                    [rules_1.RULES.timers.doraRevealTimeMs]: {
                        guard: 'hasSelectedDoraIndicator',
                        target: 'handBuild'
                    },
                    [rules_1.RULES.timers.doraSelectTimeMs]: {
                        guard: 'hasNoSelectedDoraIndicator',
                        actions: 'autoSelectDoraIndicator'
                    }
                },
                on: {
                    SELECT_DORA: {
                        guard: 'canSelectDoraIndicator',
                        actions: 'selectDoraIndicator'
                    }
                }
            },
            handBuild: {
                entry: (0, xstate_1.assign)({
                    phase: () => 'ROUND_START'
                }),
                after: {
                    [rules_1.RULES.timers.buildTimeMs]: {
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
                            [rules_1.RULES.timers.turnTimeMs]: [
                                {
                                    guard: 'hasTurnTimeBank',
                                    actions: 'consumeTurnTimeBank',
                                    target: 'turn'
                                },
                                {
                                    actions: 'forceDiscardOnTimeout',
                                    target: 'checkRon'
                                }
                            ]
                        },
                        on: {
                            DISCARD: {
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard',
                                target: 'checkRon'
                            },
                            AUTO_DISCARD: {
                                guard: 'canApplyDiscard',
                                actions: 'applyDiscard',
                                target: 'checkRon'
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
                    }
                }
            },
            roundEnd: {
                entry: [
                    (0, xstate_1.assign)({
                        phase: () => 'ROUND_END'
                    }),
                    'autoConfirmBotsInRoundEnd'
                ],
                always: [
                    {
                        guard: ({ context }) => context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])) &&
                            context.matchHandIndex < rules_1.RULES.match.handsPerMatch,
                        target: 'matchStart',
                        actions: 'startNextHand'
                    },
                    {
                        guard: ({ context }) => context.players.every((playerId) => Boolean(context.roundEndConfirmedBy[playerId])) &&
                            context.matchHandIndex >= rules_1.RULES.match.handsPerMatch,
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
                entry: (0, xstate_1.assign)({
                    phase: () => 'MATCH_END'
                })
            }
        },
        on: {
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
exports.gameMachine = createGameMachine();
