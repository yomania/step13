import { GamePhase, PlayerId, Tile } from '@step13/proto';
import { ScoreResult } from '@step13/scoring';
import { WindSeat } from './rules';
export type GameContext = {
    players: PlayerId[];
    scores: Record<PlayerId, number>;
    currentTurn: PlayerId | null;
    round: number;
    dealtTiles: Record<PlayerId, Tile[]>;
    hands: Record<PlayerId, Tile[]>;
    pools: Record<PlayerId, Tile[]>;
    wall: Tile[];
    doraIndicators: Tile[];
    dealerDice: Record<PlayerId, number>;
    discards: Record<PlayerId, Tile[]>;
    phase: GamePhase;
    winner: PlayerId | null;
    dealer: PlayerId;
    winResult: ScoreResult | null;
    lastDiscard: {
        playerId: PlayerId;
        tile: Tile;
    } | null;
    eventLog: GameEvents[];
    matchHandIndex: number;
    seatMap: Record<PlayerId, WindSeat>;
    deterministicSeed: number | null;
    timeBankRemainingMs: Record<PlayerId, number>;
    roundEndConfirmedBy: Record<PlayerId, boolean>;
};
export type GameEvents = {
    type: 'JOIN';
    playerId: PlayerId;
} | {
    type: 'START_MATCH';
    dealtTiles?: Record<PlayerId, Tile[]>;
    seed?: number;
} | {
    type: 'SUBMIT_HAND';
    playerId: PlayerId;
    hand: Tile[];
    pool: Tile[];
} | {
    type: 'SELECT_DORA';
    playerId: PlayerId;
    tileId: string;
} | {
    type: 'DISCARD';
    playerId: PlayerId;
    tileId: string;
} | {
    type: 'DECLARE_WIN';
    playerId: PlayerId;
} | {
    type: 'AUTO_DISCARD';
    playerId: PlayerId;
    tileId: string;
} | {
    type: 'AUTO_RON';
    playerId: PlayerId;
} | {
    type: 'TIMEOUT';
    playerId: PlayerId;
    phase: 'DORA_SELECT' | 'HAND_BUILD' | 'TURN';
} | {
    type: 'ROUND_END';
    reason: 'RON' | 'DRAW';
} | {
    type: 'MATCH_END';
    winner: PlayerId | null;
} | {
    type: 'GUIDE_VIEW';
    playerId: PlayerId;
    step: string;
} | {
    type: 'CONFIRM_ROUND_END';
    playerId: PlayerId;
} | {
    type: 'RESTART';
} | {
    type: 'ADD_BOT';
};
