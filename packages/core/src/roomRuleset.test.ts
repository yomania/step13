import { describe, expect, it } from 'vitest';
import { resolveDisplayedRoomRuleset } from '../../../apps/web/src/lib/roomRuleset';

describe('resolveDisplayedRoomRuleset', () => {
    it('prefers the room ruleset when room metadata mismatches', () => {
        expect(resolveDisplayedRoomRuleset('ten_attack_defense_easy', 'classic')).toBe('classic');
    });

    it('keeps the room ruleset when it matches the selected server', () => {
        expect(resolveDisplayedRoomRuleset('ten_attack_defense_easy', 'ten_attack_defense_easy')).toBe('ten_attack_defense_easy');
    });

    it('falls back to the selected ruleset when room metadata is missing', () => {
        expect(resolveDisplayedRoomRuleset('ten_attack_defense_easy', undefined)).toBe('ten_attack_defense_easy');
    });
});
