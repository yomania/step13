import { Tile } from '@step13/proto';

declare function calculateShanten(hand: Tile[]): number;
declare function isTenpai(hand: Tile[]): boolean;

export { calculateShanten, isTenpai };
