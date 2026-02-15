import { GamePhase, PlayerId, Tile } from '@step13/proto';
import { ScoreResult } from '@step13/scoring';
import { WindSeat } from './rules';

export type GameContext = {
    players: PlayerId[];
    scores: Record<PlayerId, number>;
    currentTurn: PlayerId | null;
    round: number;

    // 17-Step specific
    dealtTiles: Record<PlayerId, Tile[]>; // Initial 34 tiles
    hands: Record<PlayerId, Tile[]>;      // Chosen 13 tiles (Locked)
    pools: Record<PlayerId, Tile[]>;      // Remaining 21 tiles (To discard)
    wall: Tile[];                         // Remaining wall after deal (for dora selection)
    doraIndicators: Tile[];               // Open dora indicators selected before hand build
    dealerDice: Record<PlayerId, number>; // Dice results for dealer selection display

    discards: Record<PlayerId, Tile[]>;   // Discard history
    phase: GamePhase;
    winner: PlayerId | null;
    dealer: PlayerId;                 // New: Dealer ID
    winResult: ScoreResult | null;    // New: Store win details
    lastDiscard: { playerId: PlayerId, tile: Tile } | null; // New: To track what to claims
    eventLog: GameEvents[];           // New: Replay Log
    matchHandIndex: number;
    seatMap: Record<PlayerId, WindSeat>;
    deterministicSeed: number | null;
    timeBankRemainingMs: Record<PlayerId, number>;
};

export type GameEvents =
    | { type: 'JOIN'; playerId: PlayerId }
    | { type: 'START_MATCH'; dealtTiles?: Record<PlayerId, Tile[]>; seed?: number } // Updated for Replay
    | { type: 'SUBMIT_HAND'; playerId: PlayerId; hand: Tile[]; pool: Tile[] }
    | { type: 'SELECT_DORA'; playerId: PlayerId; tileId: string }
    | { type: 'DISCARD'; playerId: PlayerId; tileId: string }
    | { type: 'DECLARE_WIN'; playerId: PlayerId }
    | { type: 'AUTO_DISCARD'; playerId: PlayerId; tileId: string }
    | { type: 'AUTO_RON'; playerId: PlayerId }
    | { type: 'TIMEOUT'; playerId: PlayerId; phase: 'DORA_SELECT' | 'HAND_BUILD' | 'TURN' }
    | { type: 'ROUND_END'; reason: 'RON' | 'DRAW' }
    | { type: 'MATCH_END'; winner: PlayerId | null }
    | { type: 'GUIDE_VIEW'; playerId: PlayerId; step: string }
    | { type: 'RESTART' }
    | { type: 'ADD_BOT' };
