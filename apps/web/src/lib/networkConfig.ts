const DEFAULT_LOCAL_API_BASE = 'http://localhost:3001';
const DEFAULT_LOCAL_WS_BASE = 'ws://localhost:3001/ws';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(explicitBase?: string): string {
    const envBase = import.meta.env.VITE_API_URL as string | undefined;
    const base = explicitBase ?? envBase ?? getDefaultApiBase();
    return trimTrailingSlash(base);
}

export function resolveWsBaseUrl(): string {
    const envBase = import.meta.env.VITE_WS_URL as string | undefined;
    if (envBase) {
        return envBase;
    }

    if (!import.meta.env.DEV && typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    return DEFAULT_LOCAL_WS_BASE;
}

function getDefaultApiBase(): string {
    if (import.meta.env.DEV) {
        return DEFAULT_LOCAL_API_BASE;
    }

    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return DEFAULT_LOCAL_API_BASE;
}
