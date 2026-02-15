
import { createActor, SnapshotFrom } from 'xstate';
import { createGameMachine, RulesetName } from '@step13/core';
import { PlayerId } from '@step13/proto';
import { WebSocket } from 'ws';
import { Bot } from './Bot';

type MachineLogic = ReturnType<typeof createGameMachine>;

export class GameRoom {
    private machineLogic: MachineLogic;
    private machine;
    private clients: Map<PlayerId, WebSocket> = new Map();
    private bots: Bot[] = [];
    private ruleset: RulesetName;

    public roomId: string;

    constructor(roomId: string, ruleset: RulesetName = 'classic') {
        this.roomId = roomId;
        this.ruleset = ruleset;
        this.machineLogic = createGameMachine({ ruleset });
        this.machine = createActor(this.machineLogic);
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

        socket.on('close', () => {
            console.log(`Player ${playerId} disconnected`);
            this.clients.delete(playerId);
        });
    }

    public addBot() {
        // Generate a bot ID
        const botId = `bot-${Date.now()}`;
        const bot = new Bot(botId, this.machine, this.ruleset);
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

        if (!this.clients.has(playerId) && !playerId.startsWith('bot-')) {
            console.warn(`Unknown player ${playerId} event rejected:`, event.type);
            return;
        }

        console.log(`Processing event from ${playerId}:`, event.type);
        this.machine.send(event);
        this.emitTelemetry(event.type, playerId);
    }

    public hasPlayer(playerId: PlayerId): boolean {
        return this.clients.has(playerId) || this.machine.getSnapshot().context.players.includes(playerId);
    }

    private emitTelemetry(eventType: string, playerId: PlayerId) {
        const allowed = new Set([
            'START_MATCH',
            'SUBMIT_HAND',
            'DISCARD',
            'AUTO_RON',
            'ROUND_END',
            'GUIDE_VIEW'
        ]);
        if (!allowed.has(eventType)) return;
        console.log('[telemetry]', JSON.stringify({ eventType, playerId, at: Date.now(), roomId: this.roomId }));
    }

    private broadcastState(snapshot: SnapshotFrom<MachineLogic>) {
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
