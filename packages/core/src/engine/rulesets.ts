import { ScoreOptions } from '@step13/scoring';
import { createDefaultEngine } from './defaultEngine';
import { GameEngine } from './types';

export type RulesetName = 'classic';

const CLASSIC_SCORE_OPTIONS: ScoreOptions = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
};

export function createEngineForRuleset(ruleset: RulesetName = 'classic'): GameEngine {
    switch (ruleset) {
        case 'classic':
        default:
            return createDefaultEngine({ scoreOptions: CLASSIC_SCORE_OPTIONS });
    }
}
