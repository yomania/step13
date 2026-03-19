
import { setup, assign, createActor, fromCallback } from 'xstate';
import { GameContext, GameEvents } from './messages';
import { createGameMachine } from './machine';

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

type ScheduledTask = {
    id: number;
    due: number;
    callback: () => void;
};

function createReplayClock() {
    let now = 0;
    let nextId = 1;
    const tasks: ScheduledTask[] = [];

    const sortTasks = () => {
        tasks.sort((a, b) => a.due - b.due || a.id - b.id);
    };

    return {
        clock: {
            setTimeout: (callback: () => void, timeout: number) => {
                const task: ScheduledTask = {
                    id: nextId++,
                    due: now + Math.max(0, timeout),
                    callback
                };
                tasks.push(task);
                sortTasks();
                return task.id;
            },
            clearTimeout: (id: number) => {
                const index = tasks.findIndex((task) => task.id === Number(id));
                if (index >= 0) {
                    tasks.splice(index, 1);
                }
            }
        },
        advanceToNextTask: () => {
            if (tasks.length === 0) {
                return false;
            }
            const next = tasks.shift();
            if (!next) {
                return false;
            }
            now = next.due;
            next.callback();
            return true;
        }
    };
}

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
            const events = event.events;
            const replayClock = createReplayClock();
            const startMatch = events.find((entry) => entry.type === 'START_MATCH') as Extract<GameEvents, { type: 'START_MATCH' }> | undefined;
            const replayRuleset = startMatch?.ruleset ?? 'classic';
            const actor = createActor(createGameMachine({ ruleset: replayRuleset }), { clock: replayClock.clock as any });
            actor.start();

            // Initial state
            snapshots.push(actor.getSnapshot().context);

            events.forEach((loggedEvent) => {
                // Advance delayed transitions until the next logged event becomes sendable.
                // This keeps replay aligned with timer-based phase changes.
                let advanceSafety = 0;
                while (advanceSafety < 1000) {
                    const snapshot: any = actor.getSnapshot();
                    if (typeof snapshot.can !== 'function' || snapshot.can(loggedEvent)) {
                        break;
                    }
                    if (!replayClock.advanceToNextTask()) {
                        break;
                    }
                    advanceSafety += 1;
                }

                actor.send(loggedEvent);
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
