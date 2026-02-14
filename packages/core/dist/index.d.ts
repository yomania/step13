import * as _step13_proto from '@step13/proto';
import { PlayerId, Tile, GamePhase } from '@step13/proto';
import * as xstate from 'xstate';

type GameContext = {
    players: PlayerId[];
    scores: Record<PlayerId, number>;
    currentTurn: PlayerId | null;
    round: number;
    dealtTiles: Record<PlayerId, Tile[]>;
    hands: Record<PlayerId, Tile[]>;
    pools: Record<PlayerId, Tile[]>;
    discards: Record<PlayerId, Tile[]>;
    phase: GamePhase;
    winner: PlayerId | null;
};
type GameEvents = {
    type: 'JOIN';
    playerId: PlayerId;
} | {
    type: 'START_MATCH';
} | {
    type: 'SUBMIT_HAND';
    playerId: PlayerId;
    hand: Tile[];
    pool: Tile[];
} | {
    type: 'DISCARD';
    playerId: PlayerId;
    tileId: string;
} | {
    type: 'RESTART';
} | {
    type: 'ADD_BOT';
};

declare const gameMachine: xstate.StateMachine<GameContext, {
    type: "JOIN";
    playerId: _step13_proto.PlayerId;
} | {
    type: "START_MATCH";
} | {
    type: "SUBMIT_HAND";
    playerId: _step13_proto.PlayerId;
    hand: Tile[];
    pool: Tile[];
} | {
    type: "DISCARD";
    playerId: _step13_proto.PlayerId;
    tileId: string;
} | {
    type: "RESTART";
} | {
    type: "ADD_BOT";
}, {}, never, {
    type: "initializeMatch";
    params: xstate.NonReducibleUnknown;
} | {
    type: "setHand";
    params: xstate.NonReducibleUnknown;
} | {
    type: "handleDiscard";
    params: xstate.NonReducibleUnknown;
}, never, never, "idle" | "matchStart" | "handBuild" | "matchEnd" | {
    gameLoop: "turn";
}, string, xstate.NonReducibleUnknown, xstate.NonReducibleUnknown, xstate.EventObject, xstate.MetaObject, {
    id: "mahjong-17-step";
    states: {
        readonly idle: {};
        readonly matchStart: {};
        readonly handBuild: {};
        readonly gameLoop: {
            states: {
                readonly turn: {};
            };
        };
        readonly matchEnd: {};
    };
}>;

export { type GameContext, type GameEvents, gameMachine };
