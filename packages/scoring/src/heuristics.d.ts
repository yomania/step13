import { Tile } from '@step13/proto';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export interface HeuristicWeights {
    shanten: number;
    ukeire: number;
    efficiency: number;
    honitsu: number;
    chinitsu: number;
    sanshoku: number;
    chanta: number;
    dora: number;
    koutsu: number;
    pair: number;
    ryanmen: number;
    speedvsValue: number;
    safety: number;
}
export declare function evaluateHandQuality(hand: Tile[], difficulty?: Difficulty, doraIndicators?: Tile[], dangerMap?: Record<string, number>, // Optional: Danger level per tile key (0 to 1)
scoreDiff?: number): number;
