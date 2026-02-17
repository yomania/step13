"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTiles = generateTiles;
exports.shuffle = shuffle;
exports.createSeededRng = createSeededRng;
exports.shuffleWithSeed = shuffleWithSeed;
function generateTiles() {
    const tiles = [];
    const suits = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            for (let i = 0; i < 4; i++) {
                tiles.push({
                    suit,
                    rank: rank,
                    isRed: false, // Simple for now
                    id: `${suit}${rank}-${i}`
                });
            }
        }
    }
    return tiles;
}
function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
}
function createSeededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
}
function shuffleWithSeed(array, seed) {
    const rng = createSeededRng(seed);
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
