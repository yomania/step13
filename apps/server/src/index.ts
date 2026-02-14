import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { GameRoom } from './GameRoom';

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: '*'
});

fastify.register(websocket);

// Simple in-memory storage for rooms
// In a real app, use Redis or DB
const rooms = new Map<string, GameRoom>();

// Create a default room for now
const defaultRoomId = 'lobby';
rooms.set(defaultRoomId, new GameRoom(defaultRoomId));

fastify.get('/', async (_request, _reply) => {
    return { hello: 'world' };
});

fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, _req /* FastifyRequest */) => {
    const roomId = defaultRoomId; // Simplified: everyone joins the same room
    const room = rooms.get(roomId);

    if (!room) {
        connection.socket.close();
        return;
    }

    // Handle new connection

    connection.socket.on('message', (rawMessage: any) => {
        try {
            const message = JSON.parse(rawMessage.toString());

            // Special handling for initial Join if needed, or just forward everything
            // We need to know WHICH player sent this.
            // For this prototype, we'll trust the playerId in the message payload for simplicity.

            if (message.type === 'JOIN') {
                room.join(message.playerId, connection.socket);
            } else {
                if (message.playerId) {
                    room.handleMessage(message.playerId, message);
                }
            }

        } catch (e) {
            console.error('Error parsing message', e);
        }
    });

    connection.socket.on('close', () => {
        // We need to know who disconnected. 
        // For now, we don't have a reverse map of socket -> playerId easily accessible in this scope 
        // unless we store it.
        // room.disconnect(playerId);
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3001');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
