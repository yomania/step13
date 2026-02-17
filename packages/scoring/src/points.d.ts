import { Tile, Wind } from '@step13/proto';
export type ScoreResult = {
    han: number;
    fu: number;
    points: number;
    yaku: string[];
    isMangan: boolean;
    doraCount: number;
    limitCategory?: string;
    pointsDelta: number;
    limit?: string;
};
export type ScoreOptions = {
    requireManganMinimum?: boolean;
    includeOmoteDoraInMinimum?: boolean;
    kiriageMangan?: boolean;
    autoRiichiFallback?: boolean;
    seatWind?: Wind;
    roundWind?: Wind;
};
export declare function calculateScore(hand: Tile[], winTile: Tile | null, isTsumo: boolean, doraIndicators?: Tile[], options?: ScoreOptions): ScoreResult;
