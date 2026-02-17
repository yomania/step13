"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shanten_1 = require("./shanten");
const t = (suit, rank) => ({ suit, rank: rank, isRed: false });
function runBenchmark() {
    const hand = [
        t('man', 1), t('man', 2), t('man', 3),
        t('pin', 4), t('pin', 5), t('pin', 6),
        t('sou', 7), t('sou', 8), t('sou', 9),
        t('z', 1), t('z', 1), t('z', 2), t('z', 2)
    ]; // Tenpai or close
    // Run 10000 times
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
        (0, shanten_1.calculateShanten)(hand);
    }
    const end = performance.now();
    console.log(`10000 iterations took ${end - start}ms`);
    console.log(`Average: ${(end - start) / 10000}ms`);
}
runBenchmark();
