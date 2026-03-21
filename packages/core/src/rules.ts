export const RULES = {
    match: {
        handsPerMatch: 4,
        startingPoints: 60000,
        renchan: false,
        roundWind: 'EAST_FIXED'
    },
    timers: {
        doraSelectTimeMs: 15000,
        doraRevealTimeMs: 3000,
        buildTimeMs: 120000,
        turnTimeMs: 10000,
        tenTurnTimeMs: 30000,
        timeBankMs: 3000
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
    ten: {
        initialHandSize: 13,
        maxOwnTurns: 18,
        guessCount: 2,
        assaultTurns: 5
    },
    winConditions: {
        ronOnly: true,
        manganMinimumPoints: 8000,
        kiriageMangan: true,
        bankruptAtOrBelow: 0
    },
    draw: {
        afterDiscardsEach: 17,
        notenBappuEnabled: true,
        notenBappuAmount: 3000
    },
    replay: {
        deterministicSeed: true
    }
} as const;

export type WindSeat = 'EAST' | 'WEST';
