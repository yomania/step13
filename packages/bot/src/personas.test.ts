import { describe, expect, it } from 'vitest';
import { getBotPersonaProfile, isBotPersonaProfileId, listBotPersonaProfiles } from './personas';

describe('bot personas', () => {
    it('returns default profile when persona id is missing', () => {
        expect(getBotPersonaProfile(undefined).id).toBe('medium_balanced');
    });

    it('returns explicit persona when id is valid and uses persona difficulty', () => {
        const profile = getBotPersonaProfile('hard_value');
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
