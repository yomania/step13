import { Tile, Suit } from '@step13/proto';

export function generateTiles(): Tile[] {
    const tiles: Tile[] = [];
    const suits: Suit[] = ['man', 'pin', 'sou', 'z'];

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

export function createSeededRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
}

export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
    const rng = createSeededRng(seed);
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
