import assert from 'node:assert/strict';
import WebSocket from 'ws';

const apiBase = process.env.SMOKE_API_BASE?.trim() || 'http://127.0.0.1:3101';
const wsBase = process.env.SMOKE_WS_BASE?.trim() || 'ws://127.0.0.1:3101/ws';
const expectedRuleset = process.env.SMOKE_RULESET?.trim() || 'ten_attack_defense';
const joinDelayMs = parseNumberEnv('SMOKE_JOIN_DELAY_MS', 0);
const timeoutMs = parseNumberEnv('SMOKE_TIMEOUT_MS', 15000);

type AuthSession = {
    profile: {
        playerId: string;
    };
    tokens: {
        accessToken: string;
    };
};

type RoomSummary = {
    roomId: string;
    ruleset: string;
};

type WsTicket = {
    ticket: string;
};

async function main() {
    const seed = Date.now();
    const email = `smoke-${seed}@example.com`;
    const password = 'Test1234!';
    const nickname = `smoke${String(seed).slice(-4)}`;

    const session = await requestJson<AuthSession>(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
    });
    const accessToken = session.tokens.accessToken;
    const playerId = session.profile.playerId;

    const createdRoom = await requestJson<RoomSummary>(`${apiBase}/rooms`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: `Smoke ${nickname}` })
    });

    const roomList = await requestJson<{ rooms: RoomSummary[] }>(`${apiBase}/rooms`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listedRoom = roomList.rooms.find((room) => room.roomId === createdRoom.roomId);
    assert.ok(listedRoom, `created room missing from list: ${createdRoom.roomId}`);
    assert.equal(listedRoom.ruleset, expectedRuleset, 'room list should expose the expected ruleset');

    const ticket = await requestJson<WsTicket>(`${apiBase}/auth/ws-ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    assert.ok(ticket.ticket, 'ws ticket should be issued');

    await runSmokeOverWebSocket({
        ticket: ticket.ticket,
        roomId: createdRoom.roomId,
        playerId,
        joinDelayMs,
        timeoutMs
    });
}

async function runSmokeOverWebSocket(input: {
    ticket: string;
    roomId: string;
    playerId: string;
    joinDelayMs: number;
    timeoutMs: number;
}) {
    await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsBase}?ticket=${encodeURIComponent(input.ticket)}&roomId=${encodeURIComponent(input.roomId)}`);
        let startedMatch = false;
        let selectedDora = false;
        let sawJoinUpdate = false;

        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`Timed out waiting for authenticated smoke flow (joinDelayMs=${input.joinDelayMs})`));
        }, input.timeoutMs);

        ws.on('open', () => {
            setTimeout(() => {
                ws.send(JSON.stringify({ type: 'JOIN' }));
            }, input.joinDelayMs);
        });

        ws.on('message', (raw) => {
            const payload = JSON.parse(raw.toString()) as {
                type: string;
                state?: {
                    value: unknown;
                    context?: Record<string, any>;
                };
                reason?: string;
            };

            if (payload.type === 'REJECTED_EVENT') {
                clearTimeout(timeout);
                ws.close();
                reject(new Error(`WebSocket rejected event: ${payload.reason ?? 'unknown reason'}`));
                return;
            }

            if (payload.type !== 'UPDATE' || !payload.state?.context) {
                return;
            }

            const value = payload.state.value;
            const context = payload.state.context;
            const players = Array.isArray(context.players) ? context.players : [];

            if (!sawJoinUpdate && value === 'idle' && players.includes(input.playerId)) {
                sawJoinUpdate = true;
            }

            if (sawJoinUpdate && !startedMatch && value === 'idle' && players.length === 1) {
                startedMatch = true;
                ws.send(JSON.stringify({ type: 'ADD_BOT' }));
                setTimeout(() => ws.send(JSON.stringify({ type: 'START_MATCH' })), 50);
                return;
            }

            if (value === 'doraSelect' && context.dealer === input.playerId && !selectedDora) {
                const firstWallTileId = context.wall?.[0]?.id;
                assert.ok(firstWallTileId, 'dealer should receive masked wall tile id for dora selection');
                selectedDora = true;
                ws.send(JSON.stringify({ type: 'SELECT_DORA', tileId: firstWallTileId }));
                return;
            }

            if (value === 'handBuild') {
                assert.ok(sawJoinUpdate, 'should receive UPDATE after JOIN before reaching handBuild');
                assert.equal(context.ruleset, expectedRuleset, 'match ruleset should match the target ruleset');
                clearTimeout(timeout);
                ws.close();
                resolve();
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        ws.on('close', () => {
            if (!sawJoinUpdate) {
                return;
            }
        });
    });

    console.log(JSON.stringify({
        ok: true,
        apiBase,
        wsBase,
        expectedRuleset,
        joinDelayMs
    }));
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(`${url} -> ${response.status} ${JSON.stringify(json)}`);
    }
    return json as T;
}

function parseNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
