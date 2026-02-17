import { Tile } from '@step13/proto';
export type UkeireResult = {
    shanten: number;
    ukeireCount: number;
    waits: Tile[];
};
export declare function getUkeire(hand: Tile[], visibleTiles?: Tile[]): UkeireResult;
