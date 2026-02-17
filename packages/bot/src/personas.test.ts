import { describe, expect, it } from 'vitest';
import { getBotPersonaProfile, isBotPersonaProfileId, listBotPersonaProfiles } from './personas';

describe('bot personas', () => {
    it('returns fallback profile by difficulty when persona id is missing', () => {
        expect(getBotPersonaProfile(undefined, 'EASY').id).toBe('easy_relaxed');
        expect(getBotPersonaProfile(undefined, 'MEDIUM').id).toBe('medium_balanced');
        expect(getBotPersonaProfile(undefined, 'HARD').id).toBe('hard_defensive');
    });

    it('returns explicit persona when id is valid', () => {
        const profile = getBotPersonaProfile('hard_value', 'EASY');
        expect(profile.id).toBe('hard_value');
        expect(profile.difficulty).toBe('HARD');
        expect(profile.discard.style).toBe('aggressive');
    });

    it('validates known persona ids', () => {
        expect(isBotPersonaProfileId('medium_flush')).toBe(true);
        expect(isBotPersonaProfileId('unknown_persona')).toBe(false);
        expect(listBotPersonaProfiles().length).toBeGreaterThanOrEqual(5);
    });
});

