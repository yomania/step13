import { GameContext, GameEvents } from './messages';
export type ReplayContext = {
    snapshots: GameContext[];
    currentIndex: number;
    totalEvents: GameEvents[];
    isPlaying: boolean;
};
export type ReplayEvents = {
    type: 'LOAD_LOG';
    events: GameEvents[];
} | {
    type: 'NEXT';
} | {
    type: 'PREV';
} | {
    type: 'GOTO';
    index: number;
} | {
    type: 'PLAY';
} | {
    type: 'PAUSE';
} | {
    type: 'TICK';
};
export declare const replayMachine: import("xstate").StateMachine<ReplayContext, {
    type: "LOAD_LOG";
    events: GameEvents[];
} | {
    type: "NEXT";
} | {
    type: "PREV";
} | {
    type: "GOTO";
    index: number;
} | {
    type: "PLAY";
} | {
    type: "PAUSE";
} | {
    type: "TICK";
}, {
    [x: string]: import("xstate").ActorRefFromLogic<import("xstate").CallbackActorLogic<import("xstate").EventObject, import("xstate").NonReducibleUnknown, import("xstate").EventObject>> | undefined;
}, {
    src: "ticker";
    logic: import("xstate").CallbackActorLogic<import("xstate").EventObject, import("xstate").NonReducibleUnknown, import("xstate").EventObject>;
    id: string | undefined;
}, {
    type: "loadEvents";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "nextStep";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "prevStep";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "gotoStep";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "togglePlay";
    params: import("xstate").NonReducibleUnknown;
}, never, never, "idle" | "ready" | "playing", string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "replay";
    states: {
        readonly idle: {};
        readonly ready: {};
        readonly playing: {};
    };
}>;
