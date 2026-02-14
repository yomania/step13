import { setup, assign } from 'xstate';
import { GameContext, GameEvents } from './messages';
import { generateTiles, shuffle } from './utils';
import { Tile } from '@step13/proto';
import { isTenpai } from '@step13/scoring';

export const gameMachine = setup({
    types: {
        context: {} as GameContext,
        events: {} as GameEvents,
    },
    actions: {
        initializeMatch: assign({
            phase: 'MATCH_START',
            round: 1,
            scores: ({ context }) => {
                const initialScores: Record<string, number> = {};
                context.players.forEach(p => initialScores[p] = 50000);
                return initialScores;
            },
            dealtTiles: ({ context }) => {
                const tiles = shuffle(generateTiles());
                const dealt: Record<string, Tile[]> = {};
                // Deal 34 to each player
                context.players.forEach((p, i) => {
                    dealt[p] = tiles.slice(i * 34, (i + 1) * 34);
                });
                return dealt;
            },
            hands: {},
            pools: {},
            discards: () => ({})
        }),
        setHand: assign({
            hands: ({ context, event }) => {
                if (event.type !== 'SUBMIT_HAND') return context.hands;
                return {
                    ...context.hands,
                    [event.playerId]: event.hand
                };
            },
            pools: ({ context, event }) => {
                if (event.type !== 'SUBMIT_HAND') return context.pools;
                return {
                    ...context.pools,
                    [event.playerId]: event.pool
                };
            }
        }),
        handleDiscard: assign({
            discards: ({ context, event }) => {
                if (event.type !== 'DISCARD') return context.discards;
                const currentDiscards = context.discards[event.playerId] || [];
                // Find tile in pool
                const pool = context.pools[event.playerId];
                const tile = pool.find(t => t.id === event.tileId);
                if (!tile) return context.discards;

                return {
                    ...context.discards,
                    [event.playerId]: [...currentDiscards, tile]
                };
            },
            pools: ({ context, event }) => {
                if (event.type !== 'DISCARD') return context.pools;
                const pool = context.pools[event.playerId];
                return {
                    ...context.pools,
                    [event.playerId]: pool.filter(t => t.id !== event.tileId)
                };
            },
            currentTurn: ({ context }) => {
                // Toggle turn
                const currentIndex = context.players.indexOf(context.currentTurn!);
                return context.players[(currentIndex + 1) % 2];
            }
        })
    }
}).createMachine({
    id: 'mahjong-17-step',
    initial: 'idle',
    context: {
        players: [],
        scores: {},
        currentTurn: null,
        round: 0,
        dealtTiles: {},
        hands: {},
        pools: {},
        discards: {},
        phase: 'IDLE',
        winner: null,
        dealer: ''
    },
    states: {
        idle: {
            on: {
                JOIN: {
                    actions: assign({
                        players: ({ context, event }) => {
                            if (context.players.includes(event.playerId)) return context.players;
                            return [...context.players, event.playerId];
                        }
                    })
                },
                START_MATCH: {
                    target: 'matchStart',
                    guard: ({ context }) => context.players.length === 2
                }
            }
        },
        matchStart: {
            entry: 'initializeMatch',
            after: {
                1000: 'handBuild'
            }
        },
        handBuild: {
            on: {
                SUBMIT_HAND: {
                    actions: 'setHand',
                    target: 'gameLoop', // Should wait for BOTH players
                    guard: ({ event }) => {
                        if (event.type !== 'SUBMIT_HAND') return false;
                        // Validate Tenpai
                        return isTenpai(event.hand) && event.hand.length === 13;
                    }
                }
            }
        },
        gameLoop: {
            initial: 'turn',
            states: {
                turn: {
                    on: {
                        DISCARD: {
                            actions: 'handleDiscard',
                            // Check Win Logic Here?
                            target: 'turn' // Loop
                        }
                    }
                }
            }
        },
        matchEnd: {}
    }
});
