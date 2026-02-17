"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEngineForRuleset = createEngineForRuleset;
const defaultEngine_1 = require("./defaultEngine");
const CLASSIC_SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
};
function createEngineForRuleset(ruleset = 'classic') {
    switch (ruleset) {
        case 'classic':
        default:
            return (0, defaultEngine_1.createDefaultEngine)({ scoreOptions: CLASSIC_SCORE_OPTIONS });
    }
}
