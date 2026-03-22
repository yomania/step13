import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { RoomRegistry } from './RoomRegistry';
import { RulesetName } from '@step13/core';
import { AuthError, AuthService, PrismaAuthStore } from './auth';
import { PrismaClient } from '@prisma/client';
import { UpdateProfileInputDTO } from '@step13/proto';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const ACCESS_TOKEN_TTL_SEC = 15 * 60;
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;
const WS_TICKET_TTL_SEC = 30;
const ROOM_IDLE_TTL_MS = 15 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000;

const main = async () => {
    const fastify = Fastify({
        logger: true
    });

    const prisma = new PrismaClient();
    const authStore = new PrismaAuthStore(prisma);
    const isProduction = process.env.NODE_ENV === 'production';
    const jwtSecretFromEnv = process.env.JWT_SECRET?.trim();
    if (!jwtSecretFromEnv) {
        if (isProduction) {
            throw new Error('JWT_SECRET must be set in production.');
        }
        fastify.log.warn('JWT_SECRET not set. Using insecure development default.');
    }
    const jwtSecret = jwtSecretFromEnv || 'dev-insecure-jwt-secret-change-me';
    const authService = new AuthService({
        store: authStore,
        jwtSecret,
        accessTokenTtlSec: ACCESS_TOKEN_TTL_SEC,
        refreshTokenTtlSec: REFRESH_TOKEN_TTL_SEC,
        wsTicketTtlSec: WS_TICKET_TTL_SEC
    });

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        fastify.log.info(`Received ${signal}. Closing server...`);
        try {
            roomRegistry.shutdown();
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

    const corsOriginsFromEnv = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
    const defaultDevOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];
    if (isProduction && corsOriginsFromEnv.length === 0) {
        throw new Error('CORS_ORIGINS must be set in production.');
    }
    const allowedCorsOrigins = isProduction
        ? corsOriginsFromEnv
        : Array.from(new Set([...defaultDevOrigins, ...corsOriginsFromEnv]));
    if (allowedCorsOrigins.includes('*')) {
        if (isProduction) {
            throw new Error('CORS_ORIGINS must not include "*" in production.');
        }
        fastify.log.warn('CORS_ORIGINS includes "*"; allowing all origins in development.');
    }

    await fastify.register(cors, {
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }
            if (allowedCorsOrigins.includes('*') || allowedCorsOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS origin not allowed: ${origin}`), false);
        }
    });

    await fastify.register(websocket);

    const webDistDir = path.resolve(__dirname, '../../web/dist');
    const hasWebDist = fs.existsSync(webDistDir);
    if (hasWebDist) {
        await fastify.register(fastifyStatic, {
            root: webDistDir,
            prefix: '/'
        });
    } else {
        fastify.log.warn(`Web dist not found at ${webDistDir}. Static hosting disabled.`);
    }

    // Simple in-memory room registry.
    // In a production system, replace with Redis + persistent DB-backed room state.
    const defaultRoomId = 'lobby';
    const ruleset = (process.env.RULESET ?? 'classic') as RulesetName;
    const roomIdleTtlMs = parseEnvNumber('ROOM_IDLE_TTL_MS', ROOM_IDLE_TTL_MS);
    const roomCleanupIntervalMs = parseEnvNumber('ROOM_CLEANUP_INTERVAL_MS', ROOM_CLEANUP_INTERVAL_MS);
    const roomRegistry = new RoomRegistry({
        defaultRoomId,
        ruleset,
        idleTtlMs: roomIdleTtlMs,
        cleanupIntervalMs: roomCleanupIntervalMs,
        onMatchEnded: async (summary) => {
            await authService.recordMatchSummary(summary);
        },
        onPlayerLeft: async (userId) => {
            await authService.recordLeave(userId);
        }
    });

    fastify.get('/', async (_request, reply) => {
        if (hasWebDist) {
            return reply.sendFile('index.html');
        }
        return { hello: 'world' };
    });

    if (hasWebDist) {
        fastify.setNotFoundHandler((request, reply) => {
            if (request.method === 'GET') {
                const accept = request.headers.accept ?? '';
                if (accept.includes('text/html')) {
                    return reply.sendFile('index.html');
                }
            }
            return reply.status(404).send({ code: 'NOT_FOUND', message: 'Route not found' });
        });
    }

    fastify.post('/auth/register', async (request, reply) => {
        try {
            const body = request.body as Partial<{ email: string; password: string; nickname: string }> | undefined;
            if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || typeof body.nickname !== 'string') {
                return reply.status(400).send({ code: 'INVALID_PAYLOAD', message: 'email, password, nickname are required' });
            }

            const session = await authService.register({
                email: body.email,
                password: body.password,
                nickname: body.nickname
            });
            return reply.status(201).send(session);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/auth/login', async (request, reply) => {
        try {
            const body = request.body as Partial<{ email: string; password: string }> | undefined;
            if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
                return reply.status(400).send({ code: 'INVALID_PAYLOAD', message: 'email and password are required' });
            }

            const session = await authService.login({
                email: body.email,
                password: body.password
            });
            return reply.send(session);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/auth/refresh', async (request, reply) => {
        try {
            const body = request.body as Partial<{ refreshToken: string }> | undefined;
            if (!body || typeof body.refreshToken !== 'string') {
                return reply.status(400).send({ code: 'INVALID_PAYLOAD', message: 'refreshToken is required' });
            }

            const session = await authService.refreshSession(body.refreshToken);
            return reply.send(session);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/auth/logout', async (request, reply) => {
        try {
            const body = request.body as Partial<{ refreshToken: string }> | undefined;
            if (body?.refreshToken && typeof body.refreshToken === 'string') {
                await authService.logout(body.refreshToken);
            }
            return reply.send({ ok: true });
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/auth/change-password', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }

            const body = request.body as Partial<{ newPassword: string }> | undefined;
            if (!body || typeof body.newPassword !== 'string') {
                return reply.status(400).send({ code: 'INVALID_PAYLOAD', message: 'newPassword is required' });
            }

            const session = await authService.changePassword(accessToken, { newPassword: body.newPassword });
            return reply.send(session);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/auth/ws-ticket', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }

            const ticket = await authService.issueWsTicket(accessToken);
            return reply.send(ticket);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });


    fastify.get('/me', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }

            const identity = await authService.authenticateAccessToken(accessToken);
            return reply.send(identity);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.patch('/me/profile', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }

            const body = (request.body ?? {}) as UpdateProfileInputDTO;
            const profile = await authService.updateProfile(accessToken, body);
            return reply.send({ profile });
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.get('/me/stats/summary', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }

            const stats = await authService.getStatsSummary(accessToken);
            return reply.send(stats);
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.post('/rooms', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }
            const identity = await authService.authenticateAccessToken(accessToken);
            const body = request.body as Partial<{ roomId?: string; name?: string; password?: string | null }> | undefined;
            const normalizedRoomId = normalizeRoomId(body?.roomId);
            if (body?.roomId && !normalizedRoomId) {
                return reply.status(400).send({ code: 'INVALID_ROOM_ID', message: 'roomId must be 1-64 chars of [A-Za-z0-9_-]' });
            }
            const normalizedRoomName = normalizeRoomName(body?.name);
            if (body?.name !== undefined && !normalizedRoomName) {
                return reply.status(400).send({ code: 'INVALID_ROOM_NAME', message: 'name must be 1-40 non-empty characters' });
            }
            const normalizedRoomPassword = normalizeRoomPassword(body?.password);
            if (body?.password !== undefined && body?.password !== null && !normalizedRoomPassword) {
                return reply.status(400).send({ code: 'INVALID_ROOM_PASSWORD', message: 'password must be 1-64 non-empty characters' });
            }

            const roomId = normalizedRoomId ?? randomUUID();
            if (roomRegistry.hasRoom(roomId)) {
                return reply.status(409).send({ code: 'ROOM_ALREADY_EXISTS', message: 'roomId already exists' });
            }
            roomRegistry.createRoom(roomId, {
                ownerUserId: identity.profile.userId,
                ownerNickname: identity.profile.nickname,
                name: normalizedRoomName ?? roomId,
                password: normalizedRoomPassword
            });
            const created = roomRegistry.listRooms().find((room) => room.roomId === roomId);
            return reply.status(201).send(created ?? {
                roomId,
                name: normalizedRoomName ?? roomId,
                ownerUserId: identity.profile.userId,
                ownerNickname: identity.profile.nickname,
                hasPassword: Boolean(normalizedRoomPassword),
                connectedCount: 0,
                participants: [],
                ruleset
            });
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.get('/rooms', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }
            await authService.authenticateAccessToken(accessToken);
            return reply.send({ rooms: roomRegistry.listRooms() });
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.patch('/rooms/:roomId', async (request, reply) => {
        try {
            const accessToken = extractBearerToken(request.headers.authorization);
            if (!accessToken) {
                return reply.status(401).send({ code: 'MISSING_ACCESS_TOKEN', message: 'Authorization Bearer token is required' });
            }
            const identity = await authService.authenticateAccessToken(accessToken);
            const params = request.params as { roomId?: string } | undefined;
            const normalizedRoomId = normalizeRoomId(params?.roomId);
            if (!normalizedRoomId) {
                return reply.status(400).send({ code: 'INVALID_ROOM_ID', message: 'roomId must be 1-64 chars of [A-Za-z0-9_-]' });
            }
            const roomMeta = roomRegistry.getRoomMeta(normalizedRoomId);
            if (!roomMeta) {
                return reply.status(404).send({ code: 'ROOM_NOT_FOUND', message: 'room not found' });
            }
            if (roomMeta.ownerUserId !== identity.profile.userId) {
                return reply.status(403).send({ code: 'FORBIDDEN', message: 'only room owner can modify room settings' });
            }

            const body = request.body as Partial<{ name?: string; password?: string | null }> | undefined;
            const hasName = body && Object.prototype.hasOwnProperty.call(body, 'name');
            const hasPassword = body && Object.prototype.hasOwnProperty.call(body, 'password');
            if (!hasName && !hasPassword) {
                return reply.status(400).send({ code: 'INVALID_PAYLOAD', message: 'name or password patch is required' });
            }

            let nextName: string | undefined = undefined;
            let nextPassword: string | null | undefined = undefined;

            if (hasName) {
                const normalizedRoomName = normalizeRoomName(body?.name);
                if (!normalizedRoomName) {
                    return reply.status(400).send({ code: 'INVALID_ROOM_NAME', message: 'name must be 1-40 non-empty characters' });
                }
                nextName = normalizedRoomName;
            }

            if (hasPassword) {
                if (body?.password === null) {
                    nextPassword = null;
                } else if (typeof body?.password === 'string') {
                    const trimmedPassword = body.password.trim();
                    if (!trimmedPassword) {
                        nextPassword = null;
                    } else {
                        const normalizedRoomPassword = normalizeRoomPassword(trimmedPassword);
                        if (!normalizedRoomPassword) {
                            return reply.status(400).send({ code: 'INVALID_ROOM_PASSWORD', message: 'password must be 1-64 non-empty characters' });
                        }
                        nextPassword = normalizedRoomPassword;
                    }
                } else {
                    return reply.status(400).send({ code: 'INVALID_ROOM_PASSWORD', message: 'password must be string or null' });
                }
            }

            roomRegistry.updateRoom(normalizedRoomId, {
                name: nextName,
                password: nextPassword
            });
            const updated = roomRegistry.listRooms().find((room) => room.roomId === normalizedRoomId);
            return reply.send(updated ?? {
                roomId: normalizedRoomId,
                name: nextName ?? roomMeta.name,
                ownerUserId: roomMeta.ownerUserId,
                ownerNickname: roomMeta.ownerNickname,
                hasPassword: nextPassword !== undefined ? Boolean(nextPassword) : false,
                connectedCount: roomRegistry.getRoom(normalizedRoomId)?.getConnectedClientCount() ?? 0,
                participants: roomRegistry.getRoom(normalizedRoomId)?.getConnectedParticipants() ?? [],
                ruleset
            });
        } catch (error) {
            return handleRouteError(reply, error);
        }
    });

    fastify.get('/ws', { websocket: true }, (connection, request) => {
        void bindAuthenticatedWebSocket(connection.socket, request.raw.url ?? '/ws');
    });

    async function bindAuthenticatedWebSocket(socket: { on: any; close: any; send: any }, rawUrl: string): Promise<void> {
        const roomId = extractRoomId(rawUrl, defaultRoomId);
        if (!roomId) {
            socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'invalid roomId' }));
            socket.close();
            return;
        }
        const room = roomRegistry.isDefaultRoom(roomId)
            ? roomRegistry.getOrCreateRoom(roomId)
            : roomRegistry.getRoom(roomId);
        if (!room) {
            socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'room not found' }));
            socket.close();
            return;
        }

        const ticket = extractTicket(rawUrl);
        if (!ticket) {
            socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'missing WS ticket' }));
            socket.close();
            return;
        }

        const roomPassword = extractRoomPassword(rawUrl);
        if (!roomRegistry.canJoin(roomId, roomPassword)) {
            socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'invalid room password' }));
            socket.close();
            return;
        }

        let joined = false;
        let closed = false;
        let ready = false;
        let boundServerPlayerId: string | null = null;
        let identity: Awaited<ReturnType<typeof authService.consumeWsTicket>> | null = null;
        const pendingMessages: string[] = [];

        const processMessage = (rawMessage: string) => {
            if (!ready || !identity || !boundServerPlayerId || closed) {
                pendingMessages.push(rawMessage);
                return;
            }

            try {
                const message = JSON.parse(rawMessage) as Record<string, unknown>;
                if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
                    socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'invalid event payload' }));
                    return;
                }

                if (message.type === 'JOIN') {
                    joined = true;
                    room.join(boundServerPlayerId, socket as any, {
                        userId: identity.profile.userId,
                        nickname: identity.profile.nickname,
                        avatarKey: identity.profile.avatarKey
                    });
                    return;
                }

                if (!joined) {
                    socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'JOIN required first' }));
                    return;
                }

                const normalized = normalizeIncomingEvent(message, boundServerPlayerId);
                room.handleMessage(boundServerPlayerId, normalized);
            } catch (e) {
                fastify.log.error(e, 'Error parsing websocket message');
            }
        };

        socket.on('message', (rawMessage: any) => {
            const serialized = rawMessage.toString();
            if (!ready) {
                pendingMessages.push(serialized);
                return;
            }
            processMessage(serialized);
        });

        socket.on('close', () => {
            closed = true;
            const wasJoined = joined;
            joined = false;
            if (wasJoined && boundServerPlayerId) {
                room.handleDisconnect(boundServerPlayerId);
            }
        });

        try {
            identity = await authService.consumeWsTicket(ticket);
        } catch {
            socket.send(JSON.stringify({ type: 'REJECTED_EVENT', reason: 'invalid WS ticket' }));
            socket.close();
            return;
        }

        if (closed) {
            return;
        }

        boundServerPlayerId = identity.profile.playerId;
        ready = true;

        const queued = pendingMessages.splice(0);
        queued.forEach((message) => processMessage(message));
    }

    try {
        const port = Number(process.env.PORT) || 3001;
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on http://localhost:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

main();

function normalizeIncomingEvent(
    incoming: Record<string, unknown>,
    playerId: string
): Record<string, unknown> {
    const event = { ...incoming };
    const type = typeof event.type === 'string' ? event.type : '';

    const playerBoundEvents = new Set([
        'LEAVE',
        'SUBMIT_HAND',
        'SELECT_DORA',
        'DISCARD',
        'DECLARE_WIN',
        'AUTO_DISCARD',
        'AUTO_RON',
        'TIMEOUT',
        'GUIDE_VIEW',
        'CONFIRM_ROUND_END',
        'QUERY_ANALYSIS',
        'QUERY_PERSONAS',
        'DECLARE_TENPAI',
        'CALL_CHI',
        'CALL_PON',
        'PASS_DECLARATION',
        'DEFENDER_GUESS',
        'ATTACKER_KAN',
        'ATTACKER_KAN_PASS'
    ]);

    if (playerBoundEvents.has(type)) {
        event.playerId = playerId;
    }

    return event;
}

function extractBearerToken(rawAuthorizationHeader: string | undefined): string | null {
    if (!rawAuthorizationHeader) {
        return null;
    }
    const [scheme, token] = rawAuthorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }
    return token.trim() || null;
}

function extractTicket(rawUrl: string): string | null {
    const url = new URL(rawUrl, 'http://localhost');
    const ticket = url.searchParams.get('ticket');
    return ticket && ticket.trim().length > 0 ? ticket.trim() : null;
}

function extractRoomPassword(rawUrl: string): string | null {
    const url = new URL(rawUrl, 'http://localhost');
    const password = url.searchParams.get('roomPassword');
    if (!password) {
        return null;
    }
    const trimmed = password.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function extractRoomId(rawUrl: string, fallback: string): string | null {
    const url = new URL(rawUrl, 'http://localhost');
    const raw = url.searchParams.get('roomId');
    if (!raw) {
        return fallback;
    }
    return normalizeRoomId(raw);
}

function handleRouteError(
    reply: {
        status: (code: number) => { send: (body: unknown) => unknown };
        log?: { error: (error: unknown, message?: string) => void };
    },
    error: unknown
) {
    if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    if (reply.log?.error) {
        reply.log.error(error, 'Unhandled route error');
    }
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
}

function normalizeRoomId(raw: unknown): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!value || value.length > 64) {
        return null;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        return null;
    }
    return value;
}

function normalizeRoomName(raw: unknown): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!value || value.length > 40) {
        return null;
    }
    return value;
}

function normalizeRoomPassword(raw: unknown): string | null {
    if (raw === undefined || raw === null) {
        return null;
    }
    if (typeof raw !== 'string') {
        return null;
    }
    const value = raw.trim();
    if (!value || value.length > 64) {
        return null;
    }
    return value;
}

function parseEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}
