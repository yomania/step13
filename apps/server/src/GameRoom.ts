
import { createActor, SnapshotFrom } from 'xstate';
import { gameMachine } from '@step13/core';
import { PlayerId } from '@step13/proto';
import { WebSocket } from 'ws';
import { Bot } from './Bot';

export class GameRoom {
    private machine;
    private clients: Map<PlayerId, WebSocket> = new Map();
    private bots: Bot[] = [];

    public roomId: string;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.machine = createActor(gameMachine);
        this.machine.start();

        // Subscribe to state changes and broadcast to all clients
        this.machine.subscribe((snapshot) => {
            this.broadcastState(snapshot);
        });
    }

    public join(playerId: PlayerId, socket: WebSocket) {
        this.clients.set(playerId, socket);

        // Forward JOIN to machine
        this.machine.send({ type: 'JOIN', playerId });

        // setup socket listeners
        socket.on('message', (data) => {
            try {
                const event = JSON.parse(data.toString());
                this.handleMessage(playerId, event);
            } catch (e) {
                console.error('Invalid message from', playerId, e);
            }
        });

        socket.on('close', () => {
            console.log(`Player ${playerId} disconnected`);
            this.clients.delete(playerId);
        });
    }

    public addBot() {
        // Generate a bot ID
        const botId = `bot-${Date.now()}`;
        const bot = new Bot(botId, this.machine);
        this.bots.push(bot);

        console.log(`Adding Bot: ${botId}`);
        this.machine.send({ type: 'JOIN', playerId: botId });
    }

    public handleMessage(playerId: PlayerId, event: any) {
        if (event.type === 'ADD_BOT') {
            this.addBot();
            return;
        }

        // Basic validation: Ensure event comes from the claimed player
        if (event.playerId && event.playerId !== playerId) {
            console.warn(`Player ${playerId} tried to send event for ${event.playerId}`);
            return;
        }

        console.log(`Processing event from ${playerId}:`, event.type);
        this.machine.send(event);
    }

    private broadcastState(snapshot: SnapshotFrom<typeof gameMachine>) {
        const state = {
            value: snapshot.value,
            context: snapshot.context,
            // Add other needed metadata
        };

        const message = JSON.stringify({
            type: 'UPDATE',
            state: state
        });

        this.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }
}
