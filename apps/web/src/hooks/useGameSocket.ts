import { useCallback, useEffect, useRef } from 'react';
import { AnyActorRef } from 'xstate';
import { resolveApiBaseUrl, resolveWsBaseUrl } from '../lib/networkConfig';

type PlayerProfileMap = Record<string, { nickname: string; avatarKey: string }>;

type UseGameSocketOptions = {
    accessToken?: string | null;
    apiBaseUrl?: string;
    roomId?: string | null;
    roomPassword?: string | null;
    onAuthExpired?: () => void;
    onRejectedEvent?: (reason: string) => void;
};

export function useGameSocket(
    _actor: AnyActorRef,
    onStateChange?: (state: any, playerProfiles?: PlayerProfileMap) => void,
    onAnalysisResult?: (result: any) => void,
    onPersonaListResult?: (result: any) => void,
    options: UseGameSocketOptions = {}
) {
    const socketRef = useRef<WebSocket | null>(null);
    const joinPlayerIdRef = useRef<string | null>(null);
    const pendingEventsRef = useRef<any[]>([]);
    const lastNonJoinEventRef = useRef<any | null>(null);

    const accessToken = options.accessToken ?? null;

    const sendRaw = (socket: WebSocket, event: any) => {
        if (event?.type === 'JOIN') {
            socket.send(JSON.stringify({ type: 'JOIN' }));
            return;
        }
        socket.send(JSON.stringify(event));
    };

    useEffect(() => {
        if (!accessToken) {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            joinPlayerIdRef.current = null;
            pendingEventsRef.current = [];
            lastNonJoinEventRef.current = null;
            return;
        }

        const abort = new AbortController();
        let socket: WebSocket | null = null;
        let cancelled = false;

        const connect = async () => {
            try {
                const ticket = await requestWsTicket(accessToken, options.apiBaseUrl, abort.signal);
                if (cancelled) return;

                const wsBaseUrl = resolveWsBaseUrl();
                const separator = wsBaseUrl.includes('?') ? '&' : '?';
                const roomId = options.roomId?.trim();
                const roomParam = roomId ? `&roomId=${encodeURIComponent(roomId)}` : '';
                const roomPassword = options.roomPassword?.trim();
                const roomPasswordParam = roomPassword ? `&roomPassword=${encodeURIComponent(roomPassword)}` : '';
                const wsUrl = `${wsBaseUrl}${separator}ticket=${encodeURIComponent(ticket)}${roomParam}${roomPasswordParam}`;

                socket = new WebSocket(wsUrl);
                socketRef.current = socket;

                socket.onopen = () => {
                    console.log('Connected to Game Server');

                    if (joinPlayerIdRef.current) {
                        sendRaw(socket!, { type: 'JOIN' });
                    }

                    if (pendingEventsRef.current.length > 0) {
                        const queued = [...pendingEventsRef.current];
                        pendingEventsRef.current = [];
                        queued.forEach((queuedEvent) => {
                            if (queuedEvent?.type === 'JOIN') {
                                return;
                            }
                            sendRaw(socket!, queuedEvent);
                        });
                    }
                };

                socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('Received from Server:', data);

                        if (data.type === 'SYNC' || data.type === 'UPDATE') {
                            onStateChange?.(data.state, data.playerProfiles);
                        }
                        if (data.type === 'ANALYSIS_RESULT') {
                            onAnalysisResult?.(data);
                        }
                        if (data.type === 'PERSONA_LIST_RESULT') {
                            onPersonaListResult?.(data);
                        }
                        if (data.type === 'REJECTED_EVENT') {
                            console.warn('Server rejected event:', data.reason);
                            if (typeof data.reason === 'string') {
                                options.onRejectedEvent?.(data.reason);
                            }

                            // Automatic recovery when server requires binding a JOIN first.
                            if (data.reason === 'JOIN required first' && joinPlayerIdRef.current && socket?.readyState === WebSocket.OPEN) {
                                sendRaw(socket, { type: 'JOIN' });
                                if (lastNonJoinEventRef.current) {
                                    sendRaw(socket, lastNonJoinEventRef.current);
                                }
                            }
                        }
                    } catch {
                        console.error('Failed to parse WS message', event.data);
                    }
                };

                socket.onclose = () => {
                    console.log('Disconnected from Game Server');
                    if (socketRef.current === socket) {
                        socketRef.current = null;
                    }
                };
            } catch (error) {
                const status = error instanceof HttpError ? error.status : 0;
                if (status === 401 || status === 403) {
                    options.onAuthExpired?.();
                }
                console.error('Failed to establish authenticated WebSocket connection', error);
            }
        };

        void connect();

        return () => {
            cancelled = true;
            abort.abort();
            if (socket) {
                socket.close();
            }
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [accessToken, onAnalysisResult, onPersonaListResult, onStateChange, options]);

    const sendEvent = useCallback((event: any) => {
        if (event?.type === 'JOIN') {
            if (typeof event.playerId === 'string') {
                joinPlayerIdRef.current = event.playerId;
            } else if (!joinPlayerIdRef.current) {
                joinPlayerIdRef.current = 'me';
            }
        } else if (event?.type === 'LEAVE' && typeof event.playerId === 'string' && joinPlayerIdRef.current === event.playerId) {
            joinPlayerIdRef.current = null;
        } else {
            lastNonJoinEventRef.current = event;
        }

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            sendRaw(socketRef.current, event);
        } else {
            console.warn('Socket not open, cannot send:', event);
            pendingEventsRef.current.push(event);
        }
    }, []);

    const queryAnalysis = useCallback((query: any) => {
        const queryPlayerId = typeof query?.playerId === 'string' ? query.playerId : null;
        if (!joinPlayerIdRef.current && queryPlayerId) {
            joinPlayerIdRef.current = queryPlayerId;
            sendEvent({ type: 'JOIN', playerId: queryPlayerId });
        }
        sendEvent({
            ...query,
            type: 'QUERY_ANALYSIS',
            queryId: query?.queryId ?? Math.random().toString(36).substring(7)
        });
    }, [sendEvent]);

    const queryPersonas = useCallback((payload?: { playerId?: string }) => {
        const queryPlayerId = typeof payload?.playerId === 'string' ? payload.playerId : null;
        if (!joinPlayerIdRef.current && queryPlayerId) {
            joinPlayerIdRef.current = queryPlayerId;
            sendEvent({ type: 'JOIN', playerId: queryPlayerId });
        }
        sendEvent({
            type: 'QUERY_PERSONAS',
            playerId: queryPlayerId ?? joinPlayerIdRef.current
        });
    }, [sendEvent]);

    return { sendEvent, queryAnalysis, queryPersonas };
}

class HttpError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

async function requestWsTicket(
    accessToken: string,
    apiBaseUrl: string | undefined,
    signal: AbortSignal
): Promise<string> {
    const apiBase = resolveApiBaseUrl(apiBaseUrl);
    const response = await fetch(`${apiBase}/auth/ws-ticket`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        signal
    });

    if (!response.ok) {
        const text = await response.text();
        throw new HttpError(text || 'Failed to issue ws ticket', response.status);
    }

    const json = await response.json() as { ticket?: string };
    if (!json.ticket) {
        throw new HttpError('ws ticket payload missing', 500);
    }

    return json.ticket;
}
