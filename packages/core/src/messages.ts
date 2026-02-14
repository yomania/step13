import { GamePhase, PlayerId, Tile } from '@step13/proto';

export type GameContext = {
    players: PlayerId[];
    scores: Record<PlayerId, number>;
    currentTurn: PlayerId | null;
    round: number;

    // 17-Step specific
    dealtTiles: Record<PlayerId, Tile[]>; // Initial 34 tiles
    hands: Record<PlayerId, Tile[]>;      // Chosen 13 tiles (Locked)
    pools: Record<PlayerId, Tile[]>;      // Remaining 21 tiles (To discard)

    discards: Record<PlayerId, Tile[]>;   // Discard history
    phase: GamePhase;
    winner: PlayerId | null;
};

export type GameEvents =
    | { type: 'JOIN'; playerId: PlayerId }
    | { type: 'START_MATCH' }
    | { type: 'SUBMIT_HAND'; playerId: PlayerId; hand: Tile[]; pool: Tile[] }
    | { type: 'DISCARD'; playerId: PlayerId; tileId: string }
    | { type: 'RESTART' }
    | { type: 'ADD_BOT' };
