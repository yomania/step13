"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const cors_1 = __importDefault(require("@fastify/cors"));
const GameRoom_1 = require("./GameRoom");
const fastify = (0, fastify_1.default)({
    logger: true
});
fastify.register(cors_1.default, {
    origin: '*'
});
fastify.register(websocket_1.default);
const rooms = new Map();
const defaultRoomId = 'lobby';
rooms.set(defaultRoomId, new GameRoom_1.GameRoom(defaultRoomId));
fastify.get('/', async (_request, _reply) => {
    return { hello: 'world' };
});
fastify.get('/ws', { websocket: true }, (connection, _req) => {
    const roomId = defaultRoomId;
    const room = rooms.get(roomId);
    if (!room) {
        connection.socket.close();
        return;
    }
    connection.socket.on('message', (rawMessage) => {
        try {
            const message = JSON.parse(rawMessage.toString());
            if (message.type === 'JOIN') {
                room.join(message.playerId, connection.socket);
            }
            else {
                if (message.playerId) {
                    room.handleMessage(message.playerId, message);
                }
            }
        }
        catch (e) {
            console.error('Error parsing message', e);
        }
    });
    connection.socket.on('close', () => {
    });
});
const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3001');
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map