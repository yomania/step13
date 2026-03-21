import { describe, expect, it } from 'vitest';
import {
    isRulesetConfiguredForEnv,
    resolveRulesetApiBaseUrlFromEnv,
    resolveRulesetWsBaseUrlFromEnv
} from '../../../apps/web/src/lib/rulesetConfig';

describe('rulesetConfig env resolution', () => {
    it('does not fall back to classic API/WS for ten rulesets', () => {
        const env = {
            VITE_API_URL: 'http://localhost:3001',
            VITE_WS_URL: 'ws://localhost:3001/ws'
        };

        expect(resolveRulesetApiBaseUrlFromEnv('ten_attack_defense', env)).toBeNull();
        expect(resolveRulesetWsBaseUrlFromEnv('ten_attack_defense', env)).toBeNull();
        expect(isRulesetConfiguredForEnv('ten_attack_defense', env)).toBe(false);
    });

    it('reuses ten endpoints for easy mode when explicit easy endpoints are missing', () => {
        const env = {
            VITE_TEN_API_URL: 'http://localhost:3002',
            VITE_TEN_WS_URL: 'ws://localhost:3002/ws'
        };

        expect(resolveRulesetApiBaseUrlFromEnv('ten_attack_defense_easy', env)).toBe('http://localhost:3002');
        expect(resolveRulesetWsBaseUrlFromEnv('ten_attack_defense_easy', env)).toBe('ws://localhost:3002/ws');
        expect(isRulesetConfiguredForEnv('ten_attack_defense_easy', env)).toBe(true);
    });
});
