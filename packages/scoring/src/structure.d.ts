import { Tile } from '@step13/proto';
export type BlockType = 'sequence' | 'triplet' | 'pair' | 'ryanmen' | 'kanchan' | 'penchan' | 'isolated';
export interface HandBlock {
    type: BlockType;
    tiles: Tile[];
    suit: Tile['suit'];
    /** For sequence/tatsu, the first rank. For triplet/pair, the rank. */
    rank: number;
}
export interface HandStructure {
    shanten: number;
    blocks: HandBlock[];
    remainingTiles: Tile[];
}
/**
 * Decomposes a hand into its most efficient block structure.
 * This is a simplified structural analysis that prefers completed sets > complex tatsu > pair > isolated.
 * It does NOT guarantee the absolute optimal shanten path if multiple paths exist,
 * but it tries to find the structure that matches the standard shanten calculation.
 */
export declare function analyzeStructure(hand: Tile[]): HandStructure;
