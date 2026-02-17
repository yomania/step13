import { useCallback, useEffect, useRef } from 'react';
import { AnyActorRef } from 'xstate';

export function useGameSocket(
    _actor: AnyActorRef,
    onStateChange?: (state: any) => void,
    onAnalysisResult?: (result: any) => void,
    onPersonaListResult?: (result: any) => void
) {
    const socketRef = useRef<WebSocket | null>(null);
    const joinPlayerIdRef = useRef<string | null>(null);
    const pendingEventsRef = useRef<any[]>([]);
    const lastNonJoinEventRef = useRef<any | null>(null);

    const sendRaw = (socket: WebSocket, event: any) => {
        socket.send(JSON.stringify(event));
    };

    useEffect(() => {
        // Determine WS URL (assuming localhost:3001 for dev)
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('Connected to Game Server');

            // Re-bind player to this socket first after reconnect.
            if (joinPlayerIdRef.current) {
                sendRaw(socket, { type: 'JOIN', playerId: joinPlayerIdRef.current });
            }

            if (pendingEventsRef.current.length > 0) {
                const queued = [...pendingEventsRef.current];
                pendingEventsRef.current = [];
                queued.forEach((queuedEvent) => {
                    if (queuedEvent?.type === 'JOIN') {
                        return;
                    }
                    sendRaw(socket, queuedEvent);
                });
            }
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received from Server:', data);

                if (data.type === 'SYNC' || data.type === 'UPDATE') {
                    onStateChange?.(data.state);
                }
                if (data.type === 'ANALYSIS_RESULT') {
                    onAnalysisResult?.(data);
                }
                if (data.type === 'PERSONA_LIST_RESULT') {
                    onPersonaListResult?.(data);
                }
                if (data.type === 'REJECTED_EVENT') {
                    console.warn('Server rejected event:', data.reason);

                    // Automatic recovery when server requires binding a JOIN first.
                    if (data.reason === 'JOIN required first' && joinPlayerIdRef.current && socket.readyState === WebSocket.OPEN) {
                        sendRaw(socket, { type: 'JOIN', playerId: joinPlayerIdRef.current });
                        if (lastNonJoinEventRef.current) {
                            sendRaw(socket, lastNonJoinEventRef.current);
                        }
                    }
                }

            } catch (e) {
                console.error('Failed to parse WS message', event.data);
            }
        };

        socket.onclose = () => {
            console.log('Disconnected from Game Server');
        };

        return () => {
            socket.close();
        };
    }, [onStateChange, onAnalysisResult, onPersonaListResult]);

    const sendEvent = useCallback((event: any) => {
        if (event?.type === 'JOIN' && typeof event.playerId === 'string') {
            joinPlayerIdRef.current = event.playerId;
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
