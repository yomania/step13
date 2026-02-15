
import { setup, assign, createActor, fromCallback } from 'xstate';
import { GameContext, GameEvents } from './messages';
import { gameMachine } from './machine';

export type ReplayContext = {
    snapshots: GameContext[];
    currentIndex: number;
    totalEvents: GameEvents[];
    isPlaying: boolean;
};

export type ReplayEvents =
    | { type: 'LOAD_LOG'; events: GameEvents[] }
    | { type: 'NEXT' }
    | { type: 'PREV' }
    | { type: 'GOTO'; index: number }
    | { type: 'PLAY' }
    | { type: 'PAUSE' }
    | { type: 'TICK' };

export const replayMachine = setup({
    types: {
        context: {} as ReplayContext,
        events: {} as ReplayEvents
    },
    actors: {
        ticker: fromCallback(({ sendBack }) => {
            const interval = setInterval(() => {
                sendBack({ type: 'TICK' });
            }, 1000);
            return () => clearInterval(interval);
        })
    },
    actions: {
        loadEvents: assign(({ event }) => {
            if (event.type !== 'LOAD_LOG') return {};

            // Pre-calculate all snapshots
            const snapshots: GameContext[] = [];
            let events = [] as GameEvents[];

            if (event.type === 'LOAD_LOG') {
                events = event.events;
            }

            // We need to use the actual gameMachine to transition
            // Since gameMachine usage of 'setup' creates a machine logic,
            // we can use createActor to run it synchronously?
            // Or use machine.transition() if exposed?
            // XState v5 'setup' returns a machine via .createMachine().
            // gameMachine is the machine.

            let actor = createActor(gameMachine);
            actor.start();

            // Initial state
            snapshots.push(actor.getSnapshot().context);

            events.forEach(e => {
                actor.send(e);
                snapshots.push(actor.getSnapshot().context);
            });

            actor.stop();

            return {
                snapshots,
                totalEvents: events,
                currentIndex: 0,
                isPlaying: false
            };
        }),
        nextStep: assign({
            currentIndex: ({ context }) => Math.min(context.currentIndex + 1, context.snapshots.length - 1)
        }),
        prevStep: assign({
            currentIndex: ({ context }) => Math.max(context.currentIndex - 1, 0)
        }),
        gotoStep: assign({
            currentIndex: ({ context, event }) => {
                if (event.type !== 'GOTO') return context.currentIndex;
                return Math.max(0, Math.min(event.index, context.snapshots.length - 1));
            }
        }),
        togglePlay: assign({
            isPlaying: ({ context, event }) => {
                if (event.type === 'PLAY') return true;
                if (event.type === 'PAUSE') return false;
                return context.isPlaying; // Should not happen
            }
        })
    }
}).createMachine({
    id: 'replay',
    initial: 'idle',
    context: {
        snapshots: [],
        currentIndex: 0,
        totalEvents: [],
        isPlaying: false
    },
    states: {
        idle: {
            on: {
                LOAD_LOG: {
                    actions: 'loadEvents',
                    target: 'ready'
                }
            }
        },
        ready: {
            on: {
                NEXT: { actions: 'nextStep' },
                PREV: { actions: 'prevStep' },
                GOTO: { actions: 'gotoStep' },
                PLAY: { target: 'playing', actions: assign({ isPlaying: true }) },
                LOAD_LOG: { actions: 'loadEvents' } // Allow reload
            }
        },
        playing: {
            invoke: {
                src: 'ticker'
            },
            on: {
                TICK: [
                    {
                        actions: 'nextStep',
                        guard: ({ context }) => context.currentIndex < context.snapshots.length - 1
                    },
                    {
                        target: 'ready',
                        actions: assign({ isPlaying: false }) // End of replay
                    }
                ],
                PAUSE: { target: 'ready', actions: assign({ isPlaying: false }) },
                NEXT: { actions: 'nextStep' }, // Allow manual override during play
                PREV: { actions: 'prevStep' },
                GOTO: {
                    target: 'ready',
                    actions: ['gotoStep', assign({ isPlaying: false })]
                }
            }
        }
    }
});
