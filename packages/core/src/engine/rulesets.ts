import { ScoreOptions } from '@step13/scoring';
import { createDefaultEngine } from './defaultEngine';
import { GameEngine } from './types';

export type RulesetName = 'classic' | 'ten_attack_defense' | 'ten_attack_defense_easy';

const CLASSIC_SCORE_OPTIONS: ScoreOptions = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
};

export function createEngineForRuleset(ruleset: RulesetName = 'classic'): GameEngine {
    switch (ruleset) {
        case 'ten_attack_defense':
        case 'ten_attack_defense_easy':
        case 'classic':
        default:
            return createDefaultEngine({ scoreOptions: CLASSIC_SCORE_OPTIONS });
    }
}
