import { RulesetName } from '@step13/core';

export type PublicRuleset = 'classic' | 'ten';
export type TenMode = 'normal' | 'easy';

export type RulesetPresentation = {
    publicRuleset: PublicRuleset;
    tenMode: TenMode;
    title: string;
    shortTitle: string;
    onlineBadge: string;
    description: string;
    guideTitle: string;
    guideSubtitle: string;
    isTenAttackDefense: boolean;
    isEasy: boolean;
};

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function readEnv(name: string): string | null {
    const value = import.meta.env[name] as string | undefined;
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getDefaultClassicApiBase(): string {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001';
    }
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return 'http://localhost:3001';
}

function getDefaultClassicWsBase(): string {
    if (!import.meta.env.DEV && typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }
    return 'ws://localhost:3001/ws';
}

export function deriveRuleset(publicRuleset: PublicRuleset, tenMode: TenMode): RulesetName {
    if (publicRuleset === 'classic') {
        return 'classic';
    }
    return tenMode === 'easy' ? 'ten_attack_defense_easy' : 'ten_attack_defense';
}

export function normalizeRuleset(raw: string | null | undefined): RulesetName {
    if (raw === 'ten_attack_defense' || raw === 'ten_attack_defense_easy' || raw === 'classic') {
        return raw;
    }
    return 'classic';
}

export function deriveRulesetSelection(ruleset: RulesetName): { publicRuleset: PublicRuleset; tenMode: TenMode } {
    if (ruleset === 'classic') {
        return {
            publicRuleset: 'classic',
            tenMode: 'normal'
        };
    }
    return {
        publicRuleset: 'ten',
        tenMode: ruleset === 'ten_attack_defense_easy' ? 'easy' : 'normal'
    };
}

export function getRulesetPresentation(ruleset: RulesetName): RulesetPresentation {
    switch (ruleset) {
        case 'ten_attack_defense_easy':
            return {
                publicRuleset: 'ten',
                tenMode: 'easy',
                title: '텐 공방전 Easy',
                shortTitle: '2인 공방전',
                onlineBadge: 'TEN EASY',
                description: '공격/수비 단계는 유지하고 리치 선택은 제거한 입문용 텐 공방전입니다.',
                guideTitle: '텐 공방전 가이드',
                guideSubtitle: 'Stage A 선언과 Stage B 추측 흐름을 빠르게 확인합니다.',
                isTenAttackDefense: true,
                isEasy: true
            };
        case 'ten_attack_defense':
            return {
                publicRuleset: 'ten',
                tenMode: 'normal',
                title: '텐 공방전',
                shortTitle: '2인 공방전',
                onlineBadge: 'TEN',
                description: '텐파이 선언, 수비 추측, 공격 라운드가 이어지는 2인 공방전입니다.',
                guideTitle: '텐 공방전 가이드',
                guideSubtitle: 'Stage A 선언과 Stage B 추측/공격 흐름을 빠르게 확인합니다.',
                isTenAttackDefense: true,
                isEasy: false
            };
        case 'classic':
        default:
            return {
                publicRuleset: 'classic',
                tenMode: 'normal',
                title: '17보 마작',
                shortTitle: '17보 마작',
                onlineBadge: '17STEP',
                description: '기존 17보 룰셋입니다.',
                guideTitle: '17보 역정보',
                guideSubtitle: '로비/조패 단계에서 참고하는 핵심 역 요약',
                isTenAttackDefense: false,
                isEasy: false
            };
    }
}

export function resolveRulesetApiBaseUrl(ruleset: RulesetName, explicitBase?: string): string {
    const fallback = readEnv('VITE_API_URL') ?? getDefaultClassicApiBase();
    if (explicitBase) {
        return trimTrailingSlash(explicitBase);
    }
    switch (ruleset) {
        case 'ten_attack_defense':
            return trimTrailingSlash(readEnv('VITE_TEN_API_URL') ?? fallback);
        case 'ten_attack_defense_easy':
            return trimTrailingSlash(readEnv('VITE_TEN_EASY_API_URL') ?? readEnv('VITE_TEN_API_URL') ?? fallback);
        case 'classic':
        default:
            return trimTrailingSlash(readEnv('VITE_CLASSIC_API_URL') ?? fallback);
    }
}

export function resolveRulesetWsBaseUrl(ruleset: RulesetName): string {
    const fallback = readEnv('VITE_WS_URL') ?? getDefaultClassicWsBase();
    switch (ruleset) {
        case 'ten_attack_defense':
            return readEnv('VITE_TEN_WS_URL') ?? fallback;
        case 'ten_attack_defense_easy':
            return readEnv('VITE_TEN_EASY_WS_URL') ?? readEnv('VITE_TEN_WS_URL') ?? fallback;
        case 'classic':
        default:
            return readEnv('VITE_CLASSIC_WS_URL') ?? fallback;
    }
}

export function isRulesetConfigured(ruleset: RulesetName): boolean {
    if (ruleset === 'classic') {
        return true;
    }
    if (ruleset === 'ten_attack_defense') {
        return Boolean(readEnv('VITE_TEN_API_URL') && readEnv('VITE_TEN_WS_URL'));
    }
    return Boolean(
        (readEnv('VITE_TEN_EASY_API_URL') ?? readEnv('VITE_TEN_API_URL'))
        && (readEnv('VITE_TEN_EASY_WS_URL') ?? readEnv('VITE_TEN_WS_URL'))
    );
}
