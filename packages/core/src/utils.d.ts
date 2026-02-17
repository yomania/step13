import { Tile } from '@step13/proto';
export declare function generateTiles(): Tile[];
export declare function shuffle<T>(array: T[]): T[];
export declare function createSeededRng(seed: number): () => number;
export declare function shuffleWithSeed<T>(array: T[], seed: number): T[];
