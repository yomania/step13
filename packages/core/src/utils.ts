import { Tile, Suit } from '@step13/proto';

export function generateTiles(): Tile[] {
    const tiles: Tile[] = [];
    const suits: Suit[] = ['man', 'pin', 'sou', 'z'];

    // ID Generator
    let idCounter = 0;

    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            for (let i = 0; i < 4; i++) {
                tiles.push({
                    suit,
                    rank: rank as any,
                    isRed: false, // Simple for now
                    id: `${suit}${rank}-${i}`
                });
            }
        }
    }
    return tiles;
}

export function shuffle<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5);
}
