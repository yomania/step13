import { GameContext } from './messages';
import { RulesetName } from './engine/rulesets';
import { GameEngine } from './engine/types';
export type GameMachineOptions = {
    ruleset?: RulesetName;
    engine?: GameEngine;
};
export declare function createGameMachine(options?: GameMachineOptions): import("xstate").StateMachine<GameContext, {
    type: "JOIN";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "START_MATCH";
    dealtTiles?: Record<import("@step13/proto").PlayerId, import("@step13/proto").Tile[]>;
    seed?: number;
} | {
    type: "SUBMIT_HAND";
    playerId: import("@step13/proto").PlayerId;
    hand: import("@step13/proto").Tile[];
    pool: import("@step13/proto").Tile[];
} | {
    type: "SELECT_DORA";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "DISCARD";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "DECLARE_WIN";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "AUTO_DISCARD";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "AUTO_RON";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "TIMEOUT";
    playerId: import("@step13/proto").PlayerId;
    phase: "DORA_SELECT" | "HAND_BUILD" | "TURN";
} | {
    type: "ROUND_END";
    reason: "RON" | "DRAW";
} | {
    type: "MATCH_END";
    winner: import("@step13/proto").PlayerId | null;
} | {
    type: "GUIDE_VIEW";
    playerId: import("@step13/proto").PlayerId;
    step: string;
} | {
    type: "CONFIRM_ROUND_END";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "RESTART";
} | {
    type: "ADD_BOT";
}, {}, never, {
    type: "initializeMatch";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "startNextHand";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "selectDoraIndicator";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoSelectDoraIndicator";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setHand";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoSubmitMissingHands";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setTurnPhase";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "consumeTurnTimeBank";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyDiscard";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "forceDiscardOnTimeout";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyAutoRon";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyManualRon";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyDrawResult";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "finalizeMatch";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "logGuideView";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "resetGame";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "markRoundEndConfirmed";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoConfirmBotsInRoundEnd";
    params: import("xstate").NonReducibleUnknown;
}, {
    type: "canStartMatch";
    params: unknown;
} | {
    type: "isValidHandSubmit";
    params: unknown;
} | {
    type: "allHandsSubmitted";
    params: unknown;
} | {
    type: "canSelectDoraIndicator";
    params: unknown;
} | {
    type: "hasSelectedDoraIndicator";
    params: unknown;
} | {
    type: "hasNoSelectedDoraIndicator";
    params: unknown;
} | {
    type: "canApplyDiscard";
    params: unknown;
} | {
    type: "hasTurnTimeBank";
    params: unknown;
} | {
    type: "shouldEndAsDraw";
    params: unknown;
} | {
    type: "hasAutoRonWinner";
    params: unknown;
} | {
    type: "canDeclareRon";
    params: unknown;
} | {
    type: "hasNextHand";
    params: unknown;
} | {
    type: "hasNoNextHand";
    params: unknown;
} | {
    type: "allRoundEndConfirmed";
    params: unknown;
}, never, "idle" | "matchStart" | "doraSelect" | "handBuild" | "roundEnd" | "matchEnd" | {
    gameLoop: "turn" | "checkRon";
}, string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "mahjong-17-step";
    states: {
        readonly idle: {};
        readonly matchStart: {};
        readonly doraSelect: {};
        readonly handBuild: {};
        readonly gameLoop: {
            states: {
                readonly turn: {};
                readonly checkRon: {};
            };
        };
        readonly roundEnd: {};
        readonly matchEnd: {};
    };
}>;
export declare const gameMachine: import("xstate").StateMachine<GameContext, {
    type: "JOIN";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "START_MATCH";
    dealtTiles?: Record<import("@step13/proto").PlayerId, import("@step13/proto").Tile[]>;
    seed?: number;
} | {
    type: "SUBMIT_HAND";
    playerId: import("@step13/proto").PlayerId;
    hand: import("@step13/proto").Tile[];
    pool: import("@step13/proto").Tile[];
} | {
    type: "SELECT_DORA";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "DISCARD";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "DECLARE_WIN";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "AUTO_DISCARD";
    playerId: import("@step13/proto").PlayerId;
    tileId: string;
} | {
    type: "AUTO_RON";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "TIMEOUT";
    playerId: import("@step13/proto").PlayerId;
    phase: "DORA_SELECT" | "HAND_BUILD" | "TURN";
} | {
    type: "ROUND_END";
    reason: "RON" | "DRAW";
} | {
    type: "MATCH_END";
    winner: import("@step13/proto").PlayerId | null;
} | {
    type: "GUIDE_VIEW";
    playerId: import("@step13/proto").PlayerId;
    step: string;
} | {
    type: "CONFIRM_ROUND_END";
    playerId: import("@step13/proto").PlayerId;
} | {
    type: "RESTART";
} | {
    type: "ADD_BOT";
}, {}, never, {
    type: "initializeMatch";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "startNextHand";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "selectDoraIndicator";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoSelectDoraIndicator";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setHand";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoSubmitMissingHands";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setTurnPhase";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "consumeTurnTimeBank";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyDiscard";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "forceDiscardOnTimeout";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyAutoRon";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyManualRon";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "applyDrawResult";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "finalizeMatch";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "logGuideView";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "resetGame";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "markRoundEndConfirmed";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "autoConfirmBotsInRoundEnd";
    params: import("xstate").NonReducibleUnknown;
}, {
    type: "canStartMatch";
    params: unknown;
} | {
    type: "isValidHandSubmit";
    params: unknown;
} | {
    type: "allHandsSubmitted";
    params: unknown;
} | {
    type: "canSelectDoraIndicator";
    params: unknown;
} | {
    type: "hasSelectedDoraIndicator";
    params: unknown;
} | {
    type: "hasNoSelectedDoraIndicator";
    params: unknown;
} | {
    type: "canApplyDiscard";
    params: unknown;
} | {
    type: "hasTurnTimeBank";
    params: unknown;
} | {
    type: "shouldEndAsDraw";
    params: unknown;
} | {
    type: "hasAutoRonWinner";
    params: unknown;
} | {
    type: "canDeclareRon";
    params: unknown;
} | {
    type: "hasNextHand";
    params: unknown;
} | {
    type: "hasNoNextHand";
    params: unknown;
} | {
    type: "allRoundEndConfirmed";
    params: unknown;
}, never, "idle" | "matchStart" | "doraSelect" | "handBuild" | "roundEnd" | "matchEnd" | {
    gameLoop: "turn" | "checkRon";
}, string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "mahjong-17-step";
    states: {
        readonly idle: {};
        readonly matchStart: {};
        readonly doraSelect: {};
        readonly handBuild: {};
        readonly gameLoop: {
            states: {
                readonly turn: {};
                readonly checkRon: {};
            };
        };
        readonly roundEnd: {};
        readonly matchEnd: {};
    };
}>;
