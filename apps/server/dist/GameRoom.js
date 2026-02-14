"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const xstate_1 = require("xstate");
const core_1 = require("@step13/core");
const ws_1 = require("ws");
const Bot_1 = require("./Bot");
class GameRoom {
    constructor(roomId) {
        this.clients = new Map();
        this.bots = [];
        this.roomId = roomId;
        this.machine = (0, xstate_1.createActor)(core_1.gameMachine);
        this.machine.start();
        this.machine.subscribe((snapshot) => {
            this.broadcastState(snapshot);
        });
    }
    join(playerId, socket) {
        this.clients.set(playerId, socket);
        this.machine.send({ type: 'JOIN', playerId });
        socket.on('message', (data) => {
            try {
                const event = JSON.parse(data.toString());
                this.handleMessage(playerId, event);
            }
            catch (e) {
                console.error('Invalid message from', playerId, e);
            }
        });
        socket.on('close', () => {
            console.log(`Player ${playerId} disconnected`);
            this.clients.delete(playerId);
        });
    }
    addBot() {
        const botId = `bot-${Date.now()}`;
        const bot = new Bot_1.Bot(botId, this.machine);
        this.bots.push(bot);
        console.log(`Adding Bot: ${botId}`);
        this.machine.send({ type: 'JOIN', playerId: botId });
    }
    handleMessage(playerId, event) {
        if (event.type === 'ADD_BOT') {
            this.addBot();
            return;
        }
        if (event.playerId && event.playerId !== playerId) {
            console.warn(`Player ${playerId} tried to send event for ${event.playerId}`);
            return;
        }
        console.log(`Processing event from ${playerId}:`, event.type);
        this.machine.send(event);
    }
    broadcastState(snapshot) {
        const state = {
            value: snapshot.value,
            context: snapshot.context,
        };
        const message = JSON.stringify({
            type: 'UPDATE',
            state: state
        });
        this.clients.forEach((ws) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }
}
exports.GameRoom = GameRoom;
//# sourceMappingURL=GameRoom.js.map