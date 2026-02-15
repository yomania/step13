import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { GameRoom } from './GameRoom';
import { RulesetName } from '@step13/core';

const main = async () => {
    const fastify = Fastify({
        logger: true
    });

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        fastify.log.info(`Received ${signal}. Closing server...`);
        try {
            await fastify.close();
            fastify.log.info('Server closed cleanly');
            process.exit(0);
        } catch (err) {
            fastify.log.error(err, 'Failed to close server cleanly');
            process.exit(1);
        }
    };

    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });

    await fastify.register(cors, {
        origin: '*'
    });

    await fastify.register(websocket);

    // Simple in-memory storage for rooms
    // In a real app, use Redis or DB
    const rooms = new Map<string, GameRoom>();

    // Create a default room for now
    const defaultRoomId = 'lobby';
    const ruleset = (process.env.RULESET ?? 'classic') as RulesetName;
    rooms.set(defaultRoomId, new GameRoom(defaultRoomId, ruleset));

    fastify.get('/', async (_request, _reply) => {
        return { hello: 'world' };
    });

    fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, _req /* FastifyRequest */) => {
        console.log('WebSocket connection attempt from', _req.ip);
        const roomId = defaultRoomId; // Simplified: everyone joins the same room
        const room = rooms.get(roomId);

        if (!room) {
            connection.socket.close();
            return;
        }

        // Handle new connection

        let boundPlayerId: string | null = null;

        connection.socket.on('message', (rawMessage: any) => {
            try {
                const message = JSON.parse(rawMessage.toString());
                if (message.type === 'JOIN') {
                    if (!message.playerId || typeof message.playerId !== 'string') {
                        connection.socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'invalid JOIN payload' }));
                        return;
                    }
                    const joinedId: string = message.playerId;
                    if (!boundPlayerId) {
                        boundPlayerId = joinedId;
                        room.join(joinedId, connection.socket);
                        return;
                    }

                    if (boundPlayerId !== joinedId) {
                        connection.socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'JOIN playerId mismatch' }));
                        return;
                    }

                    // Allow re-join after RESTART while keeping the same socket binding.
                    room.handleMessage(boundPlayerId, { type: 'JOIN', playerId: boundPlayerId });
                    return;
                }

                const senderId = boundPlayerId;
                if (!senderId) {
                    connection.socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'JOIN required first' }));
                    return;
                }
                room.handleMessage(senderId, message);

            } catch (e) {
                console.error('Error parsing message', e);
            }
        });

        connection.socket.on('close', () => {
            boundPlayerId = null;
        });
    });

    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3001');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

main();
