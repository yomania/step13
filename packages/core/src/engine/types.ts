import { Tile } from '@step13/proto';
import { ScoreResult } from '@step13/scoring';
import { GameContext, GameEvents } from '../messages';
import { WindSeat } from '../rules';

export type DealerSelection = {
    dealer: string;
    dealerDice: Record<string, number>;
    seatMap: Record<string, WindSeat>;
};

export type DealResult = {
    dealt: Record<string, Tile[]>;
    wall: Tile[];
};

export type RoundResult = {
    winner: string | null;
    winResult: ScoreResult | null;
    scores: Record<string, number>;
};

export interface GameEngine {
    buildDealResult(players: string[], seed: number): DealResult;
    selectDealer(players: string[], seed: number): DealerSelection;
    getEastPlayer(seatMap: Record<string, WindSeat>): string;
    hasWinningWait(hand: Tile[]): boolean;
    findTenpaiHand(
        tiles: Tile[],
        options?: { doraIndicators?: Tile[]; requireMangan?: boolean }
    ): { hand: Tile[]; pool: Tile[] };
    canSelectDora(context: GameContext, playerId: string, tileId: string): boolean;
    selectDora(context: GameContext, event: Extract<GameEvents, { type: 'SELECT_DORA' }>): Partial<GameContext>;
    autoSelectDora(context: GameContext): Partial<GameContext>;
    canDiscard(context: GameContext, playerId: string, tileId: string): boolean;
    applyDiscard(context: GameContext, playerId: string, tileId: string): GameContext;
    isDrawReached(context: GameContext): boolean;
    autoRonWinner(context: GameContext): string | null;
    canDeclareRon(context: GameContext, playerId: string): boolean;
    resolveRon(context: GameContext, winnerId: string): RoundResult | null;
    resolveDraw(context: GameContext): RoundResult;
}
