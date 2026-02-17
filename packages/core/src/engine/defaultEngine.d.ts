import { ScoreOptions } from '@step13/scoring';
import { GameEngine } from './types';
type EngineConfig = {
    scoreOptions: ScoreOptions;
};
export declare function createDefaultEngine({ scoreOptions }: EngineConfig): GameEngine;
export {};
