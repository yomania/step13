import { RulesetName } from '@step13/core';
import { resolveRulesetApiBaseUrl, resolveRulesetWsBaseUrl } from './rulesetConfig';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(explicitBase?: string, ruleset: RulesetName = 'classic'): string {
    return trimTrailingSlash(resolveRulesetApiBaseUrl(ruleset, explicitBase));
}

export function resolveWsBaseUrl(ruleset: RulesetName = 'classic'): string {
    return resolveRulesetWsBaseUrl(ruleset);
}
