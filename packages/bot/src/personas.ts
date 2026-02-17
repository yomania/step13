import { Difficulty } from '@step13/scoring';

export type HandBuildStyle = 'balanced' | 'value' | 'stability' | 'flush' | 'pairs' | 'chaotic';
export type DiscardStyle = 'defensive' | 'balanced' | 'aggressive' | 'chaotic';

export type HandBuildPreference = {
    style: HandBuildStyle;
    candidateCount: number;
    topSlice: number;
    submitSkipChance: number;
};

export type DiscardPreference = {
    style: DiscardStyle;
    pushDangerousChance: number;
    randomDiscardChance: number;
};

export type BotPersonaFlavor = {
    archetype: string;
    temperament: string;
    speechStyleHint?: string;
    tags?: string[];
};

export type BotPersonaProfile = {
    id: string;
    name: string;
    difficulty: Difficulty;
    handBuild: HandBuildPreference;
    discard: DiscardPreference;
    flavor: BotPersonaFlavor;
};

const BOT_PERSONA_PROFILES: Record<string, BotPersonaProfile> = {
    easy_relaxed: {
        id: 'easy_relaxed',
        name: '느긋한 입문자',
        difficulty: 'EASY',
        handBuild: { style: 'chaotic', candidateCount: 8, topSlice: 8, submitSkipChance: 0.22 },
        discard: { style: 'chaotic', pushDangerousChance: 0.6, randomDiscardChance: 0.45 },
        flavor: {
            archetype: 'beginner',
            temperament: 'relaxed',
            speechStyleHint: '가볍고 실수도 인정하는 말투',
            tags: ['casual', 'training']
        }
    },
    medium_balanced: {
        id: 'medium_balanced',
        name: '균형형 실전파',
        difficulty: 'MEDIUM',
        handBuild: { style: 'balanced', candidateCount: 12, topSlice: 3, submitSkipChance: 0.0 },
        discard: { style: 'balanced', pushDangerousChance: 0.22, randomDiscardChance: 0.0 },
        flavor: {
            archetype: 'all-rounder',
            temperament: 'calm',
            speechStyleHint: '정보 위주로 담백하게 설명',
            tags: ['standard']
        }
    },
    medium_flush: {
        id: 'medium_flush',
        name: '염색 선호가',
        difficulty: 'MEDIUM',
        handBuild: { style: 'flush', candidateCount: 14, topSlice: 4, submitSkipChance: 0.0 },
        discard: { style: 'aggressive', pushDangerousChance: 0.35, randomDiscardChance: 0.0 },
        flavor: {
            archetype: 'specialist',
            temperament: 'focused',
            speechStyleHint: '한 가지 플랜을 밀어붙이는 말투',
            tags: ['honitsu', 'chinitsu']
        }
    },
    hard_defensive: {
        id: 'hard_defensive',
        name: '철벽 수비가',
        difficulty: 'HARD',
        handBuild: { style: 'stability', candidateCount: 24, topSlice: 1, submitSkipChance: 0.0 },
        discard: { style: 'defensive', pushDangerousChance: 0.02, randomDiscardChance: 0.0 },
        flavor: {
            archetype: 'guardian',
            temperament: 'stoic',
            speechStyleHint: '짧고 단정한 말투',
            tags: ['betaori', 'risk-averse']
        }
    },
    hard_value: {
        id: 'hard_value',
        name: '고타점 헌터',
        difficulty: 'HARD',
        handBuild: { style: 'value', candidateCount: 26, topSlice: 2, submitSkipChance: 0.0 },
        discard: { style: 'aggressive', pushDangerousChance: 0.4, randomDiscardChance: 0.0 },
        flavor: {
            archetype: 'sniper',
            temperament: 'bold',
            speechStyleHint: '공격적인 자신감 있는 말투',
            tags: ['high-value', 'push']
        }
    }
};

const DEFAULT_PERSONA_BY_DIFFICULTY: Record<Difficulty, string> = {
    EASY: 'easy_relaxed',
    MEDIUM: 'medium_balanced',
    HARD: 'hard_defensive'
};

export function listBotPersonaProfiles(): BotPersonaProfile[] {
    return Object.values(BOT_PERSONA_PROFILES);
}

export function isBotPersonaProfileId(value: unknown): value is string {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BOT_PERSONA_PROFILES, value);
}

export function getBotPersonaProfile(personaId?: string, fallbackDifficulty: Difficulty = 'MEDIUM'): BotPersonaProfile {
    if (personaId && BOT_PERSONA_PROFILES[personaId]) {
        return BOT_PERSONA_PROFILES[personaId];
    }
    return BOT_PERSONA_PROFILES[DEFAULT_PERSONA_BY_DIFFICULTY[fallbackDifficulty]];
}

