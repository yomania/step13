export declare const RULES: {
    readonly match: {
        readonly handsPerMatch: 4;
        readonly startingPoints: 50000;
        readonly renchan: false;
        readonly roundWind: "EAST_FIXED";
    };
    readonly timers: {
        readonly doraSelectTimeMs: 15000;
        readonly doraRevealTimeMs: 3000;
        readonly buildTimeMs: 120000;
        readonly turnTimeMs: 5000;
        readonly timeBankMs: 10000;
    };
    readonly actions: {
        readonly allowTsumo: false;
        readonly allowCalls: false;
        readonly autoRon: true;
    };
    readonly tiles: {
        readonly dealTilesPerPlayer: 34;
        readonly handSize: 13;
        readonly poolSize: 21;
        readonly discardsPerPlayer: 17;
        readonly doraCount: 1;
        readonly redDora: false;
        readonly kanDora: false;
    };
    readonly winConditions: {
        readonly ronOnly: true;
        readonly manganMinimumPoints: 8000;
        readonly kiriageMangan: true;
    };
    readonly draw: {
        readonly afterDiscardsEach: 17;
        readonly notenBappuEnabled: true;
        readonly notenBappuAmount: 3000;
    };
    readonly replay: {
        readonly deterministicSeed: true;
    };
};
export type WindSeat = 'EAST' | 'WEST';
