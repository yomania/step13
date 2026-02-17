"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULES = void 0;
exports.RULES = {
    match: {
        handsPerMatch: 4,
        startingPoints: 50000,
        renchan: false,
        roundWind: 'EAST_FIXED'
    },
    timers: {
        doraSelectTimeMs: 15000,
        doraRevealTimeMs: 3000,
        buildTimeMs: 120000,
        turnTimeMs: 5000,
        timeBankMs: 10000
    },
    actions: {
        allowTsumo: false,
        allowCalls: false,
        autoRon: true
    },
    tiles: {
        dealTilesPerPlayer: 34,
        handSize: 13,
        poolSize: 21,
        discardsPerPlayer: 17,
        doraCount: 1,
        redDora: false,
        kanDora: false
    },
    winConditions: {
        ronOnly: true,
        manganMinimumPoints: 8000,
        kiriageMangan: true
    },
    draw: {
        afterDiscardsEach: 17,
        notenBappuEnabled: true,
        notenBappuAmount: 3000
    },
    replay: {
        deterministicSeed: true
    }
};
