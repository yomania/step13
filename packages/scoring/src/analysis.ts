
import { Tile } from '@step13/proto';
import { calculateShanten } from './shanten';

export type UkeireResult = {
    shanten: number;
    ukeireCount: number;
    waits: Tile[];
};

const SUITS = ['man', 'pin', 'sou', 'z'] as const;

export function getUkeire(hand: Tile[], visibleTiles: Tile[] = []): UkeireResult {
    const currentShanten = calculateShanten(hand);

    // If already won, no ukeire in the normal sense (or infinite?)
    if (currentShanten < -1) {
        return { shanten: currentShanten, ukeireCount: 0, waits: [] };
    }

    const waits: Tile[] = [];
    let ukeireCount = 0;

    // Count visible tiles to know how many are left
    const visibleCounts = new Map<string, number>();
    for (const t of visibleTiles) {
        const key = `${t.suit}${t.rank}`;
        visibleCounts.set(key, (visibleCounts.get(key) ?? 0) + 1);
    }
    // Also count hand tiles as visible/used
    for (const t of hand) {
        const key = `${t.suit}${t.rank}`;
        visibleCounts.set(key, (visibleCounts.get(key) ?? 0) + 1);
    }

    // Check every possible tile
    for (const suit of SUITS) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const tile: Tile = { suit, rank: rank as any, isRed: false };

            // Try adding this tile
            const nextShanten = calculateShanten([...hand, tile]);

            // If shanten improves (decreases), it's a useful tile
            if (nextShanten < currentShanten) {
                const key = `${suit}${rank}`;
                const used = visibleCounts.get(key) ?? 0;
                const left = Math.max(0, 4 - used);

                if (left > 0) {
                    waits.push(tile);
                    ukeireCount += left;
                }
            }
        }
    }

    return {
        shanten: currentShanten,
        ukeireCount,
        waits
    };
}
