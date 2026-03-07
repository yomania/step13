import {
    AuthSessionDTO,
    PublicProfileDTO,
    StatsSummaryDTO,
    UpdateProfileInputDTO
} from '@step13/proto';
import { resolveApiBaseUrl } from './networkConfig';

export type MeResponseDTO = {
    user: {
        id: string;
        email: string;
        createdAt: string;
    };
    profile: PublicProfileDTO;
};

export class ApiError extends Error {
    public readonly status: number;
    public readonly code: string;

    constructor(message: string, status: number, code = 'API_ERROR') {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

export async function registerApi(
    payload: { email: string; password: string; nickname: string },
    apiBaseUrl?: string
): Promise<AuthSessionDTO> {
    return requestJson<AuthSessionDTO>(`${resolveApiBase(apiBaseUrl)}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

export async function loginApi(
    payload: { email: string; password: string },
    apiBaseUrl?: string
): Promise<AuthSessionDTO> {
    return requestJson<AuthSessionDTO>(`${resolveApiBase(apiBaseUrl)}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

export async function refreshApi(refreshToken: string, apiBaseUrl?: string): Promise<AuthSessionDTO> {
    return requestJson<AuthSessionDTO>(`${resolveApiBase(apiBaseUrl)}/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
    });
}

export async function changePasswordApi(
    accessToken: string,
    payload: { newPassword: string },
    apiBaseUrl?: string
): Promise<AuthSessionDTO> {
    return requestJson<AuthSessionDTO>(`${resolveApiBase(apiBaseUrl)}/auth/change-password`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

export async function logoutApi(refreshToken: string | null, apiBaseUrl?: string): Promise<void> {
    await requestJson(`${resolveApiBase(apiBaseUrl)}/auth/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
    });
}

export async function getMeApi(accessToken: string, apiBaseUrl?: string): Promise<MeResponseDTO> {
    return requestJson<MeResponseDTO>(`${resolveApiBase(apiBaseUrl)}/me`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
}

export async function updateProfileApi(
    accessToken: string,
    payload: UpdateProfileInputDTO,
    apiBaseUrl?: string
): Promise<{ profile: PublicProfileDTO }> {
    return requestJson<{ profile: PublicProfileDTO }>(`${resolveApiBase(apiBaseUrl)}/me/profile`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

export async function getStatsSummaryApi(accessToken: string, apiBaseUrl?: string): Promise<StatsSummaryDTO> {
    return requestJson<StatsSummaryDTO>(`${resolveApiBase(apiBaseUrl)}/me/stats/summary`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
}

export async function createRoomApi(
    payload?: { roomId?: string },
    apiBaseUrl?: string
): Promise<{ roomId: string }> {
    return requestJson<{ roomId: string }>(`${resolveApiBase(apiBaseUrl)}/rooms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload ?? {})
    });
}

function resolveApiBase(apiBaseUrl?: string): string {
    return resolveApiBaseUrl(apiBaseUrl);
}

async function requestJson<T = unknown>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    const json = parseJson(text);

    if (!response.ok) {
        const code = typeof json?.code === 'string' ? json.code : 'API_ERROR';
        const message = typeof json?.message === 'string' ? json.message : `Request failed: ${response.status}`;
        throw new ApiError(message, response.status, code);
    }

    return json as T;
}

function parseJson(raw: string): any {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
