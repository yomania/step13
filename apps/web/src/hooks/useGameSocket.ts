import { useEffect, useRef } from 'react';
import { AnyActorRef } from 'xstate';

export function useGameSocket(actor: AnyActorRef, onStateChange?: (state: any) => void) {
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Determine WS URL (assuming localhost:3001 for dev)
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('Connected to Game Server');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received from Server:', data);

                if (data.type === 'SYNC' || data.type === 'UPDATE') {
                    onStateChange?.(data.state);
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
    }, [actor, onStateChange]);

    const sendEvent = (event: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(event));
        } else {
            console.warn('Socket not open, cannot send:', event);
        }
    };

    return { sendEvent };
}
