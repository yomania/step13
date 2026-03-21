import { RulesetName } from '@step13/core';
import { normalizeRuleset } from './rulesetConfig';

export function resolveDisplayedRoomRuleset(
    selectedRuleset: RulesetName,
    roomRuleset: string | null | undefined
): RulesetName {
    if (roomRuleset == null) {
        return selectedRuleset;
    }
    return normalizeRuleset(roomRuleset);
}
