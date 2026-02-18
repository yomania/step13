
import { createActor, SnapshotFrom } from 'xstate';
import { createGameMachine, RulesetName } from '@step13/core';
import { PlayerId, Tile } from '@step13/proto';
import { WebSocket } from 'ws';
import { Bot } from './Bot';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { getBotPersonaProfile, isBotPersonaProfileId, listBotPersonaProfiles } from '@step13/bot';

const HIDDEN_TILE: Tile = { suit: 'z', rank: 1, isRed: false, id: 'HIDDEN' };

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

    public addBot(personaId?: string) {
        // Generate a bot ID
        const botId = `bot-${Date.now()}`;
        const normalizedPersonaId = this.normalizePersonaId(personaId);
        const bot = new Bot(botId, this.machine, this.ruleset, normalizedPersonaId);
        this.bots.push(bot);

        const resolved = getBotPersonaProfile(normalizedPersonaId);
        console.log(`Adding Bot: ${botId} (${resolved.difficulty}, persona=${resolved.id})`);
        this.machine.send({ type: 'JOIN', playerId: botId });
    }

    public handleMessage(playerId: PlayerId, event: any) {
        if (event.type === 'ADD_BOT') {
            this.addBot(this.normalizePersonaId(event?.personaId));
            return;
        }

        // Translation for Hidden Wall Tiles (Fog of War)
        if (event.type === 'SELECT_DORA' && typeof event.tileId === 'string' && event.tileId.startsWith('wall-')) {
            const index = parseInt(event.tileId.split('-')[1], 10);
            const currentContext = this.machine.getSnapshot().context;
            const realTile = currentContext.wall?.[index];
            if (realTile && realTile.id) {
                console.log(`[Security] Translating wall index ${index} to tileId ${realTile.id}`);
                event.tileId = realTile.id;
            } else {
                console.warn(`[Security] Invalid wall index in SELECT_DORA: ${event.tileId}`);
            }
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

        if (event.type === 'QUERY_ANALYSIS') {
            this.handleAnalysisQuery(playerId, event);
            return;
        }
        if (event.type === 'QUERY_PERSONAS') {
            this.handlePersonaListQuery(playerId);
            return;
        }

        console.log(`Processing event from ${playerId}:`, event.type);
        this.machine.send(event);
        this.emitTelemetry(event.type, playerId);
    }

    private async handleAnalysisQuery(playerId: PlayerId, event: any) {
        const { queryId, hand, doraIndicators, options } = event;
        const result: any = { type: 'ANALYSIS_RESULT', queryId };
        let tempBot: Bot | undefined;

        try {
            if (event.queryType === 'SHANTEN') {
                result.shanten = calculateShanten(hand);
            } else if (event.queryType === 'SCORE') {
                const wait = event.wait;
                result.scoreResult = calculateScore(hand, wait, false, doraIndicators || [], options || {});
            } else if (event.queryType === 'SCORE_PREVIEW') {
                // Query-only bot must not subscribe to room actor updates.
                tempBot = new Bot('temp', this.machine as any, this.ruleset, undefined, false);
                if (Array.isArray(hand) && hand.length === 13) {
                    result.scoreResult = tempBot.evaluateHandScoreForQuery(hand, doraIndicators || []);
                } else {
                    result.scoreResult = null;
                }
            } else if (event.queryType === 'AI_HINT') {
                // Use bot's evaluation logic for hints
                tempBot = new Bot('temp', this.machine as any, this.ruleset, undefined, false);
                if (Array.isArray(hand) && hand.length === 13) {
                    result.scoreResult = tempBot.evaluateHandScoreForQuery(hand, doraIndicators || []);
                }
                const candidates = await tempBot.buildBestCandidatesForQuery(
                    event.dealtTiles || hand, // Use full pool if available (for mini-game/debug), otherwise just hand
                    doraIndicators || [],
                    this.normalizePersonaId(event?.personaId),
                    typeof event?.maxCount === 'number' ? event.maxCount : undefined,
                    Boolean(event?.includeNonTenpai),
                    Boolean(event?.multiDifficulty)
                );
                result.candidates = candidates;
            } else if (event.queryType === 'MINI_GAME_EVAL') {
                tempBot = new Bot('temp', this.machine as any, this.ruleset, undefined, false);
                const miniResult = await tempBot.evaluateMiniGameForQuery(hand, event.dealtTiles || [], doraIndicators || []);
                result.miniResult = miniResult;
            }

            const ws = this.clients.get(playerId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(result));
            }
        } catch (e) {
            console.error('Analysis query failed:', e);
        } finally {
            tempBot?.dispose();
        }
    }

    private handlePersonaListQuery(playerId: PlayerId) {
        const ws = this.clients.get(playerId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        ws.send(JSON.stringify({
            type: 'PERSONA_LIST_RESULT',
            personas: listBotPersonaProfiles().map((persona) => ({
                id: persona.id,
                name: persona.name,
                difficulty: persona.difficulty,
                handBuild: persona.handBuild,
                discard: persona.discard
            }))
        }));
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

    private normalizePersonaId(raw: unknown): string | undefined {
        if (isBotPersonaProfileId(raw)) {
            return raw;
        }
        return undefined;
    }

    private sanitizeState(snapshot: SnapshotFrom<MachineLogic>, playerId: PlayerId) {
        // Deep copy context to ensure we don't mutate the original state or shared references
        const context = JSON.parse(JSON.stringify(snapshot.context));
        const isRoundEnd = context.phase === 'ROUND_END' || context.phase === 'MATCH_END';

        // 1. Mask Wall (Fog of War)
        // Reveal only tiles that are already public (in doraIndicators)
        if (context.wall) {
            const revealedIds = new Set((context.doraIndicators || []).map((t: Tile) => t.id));
            context.wall = context.wall.map((t: Tile, idx: number) => {
                if (t.id && revealedIds.has(t.id)) {
                    return t;
                }
                // Mask hidden tiles, but provide a predictable ID for interaction (e.g. discard/select)
                // Note: For SELECT_DORA, we explicitly translate 'wall-{idx}' back to real ID in handleMessage
                return { ...HIDDEN_TILE, id: `wall-${idx}` };
            });
        }

        // 2. Mask Opponent Hands & Pools
        if (context.hands) {
            Object.keys(context.hands).forEach((pid) => {
                if (pid !== playerId && !isRoundEnd) {
                    context.hands[pid] = context.hands[pid].map((_: Tile, idx: number) => ({
                        ...HIDDEN_TILE,
                        id: `hidden-hand-${pid}-${idx}`
                    }));
                }
            });
        }
        if (context.pools) {
            Object.keys(context.pools).forEach((pid) => {
                if (pid !== playerId && !isRoundEnd) {
                    context.pools[pid] = context.pools[pid].map((_: Tile, idx: number) => ({
                        ...HIDDEN_TILE,
                        id: `hidden-pool-${pid}-${idx}`
                    }));
                }
            });
        }

        // 3. Mask Opponent Dealt Tiles (Hand Building Phase)
        if (context.dealtTiles) {
            Object.keys(context.dealtTiles).forEach((pid) => {
                if (pid !== playerId) {
                    // Just show count/hidden tiles
                    context.dealtTiles[pid] = context.dealtTiles[pid].map((_: Tile, idx: number) => ({
                        ...HIDDEN_TILE,
                        id: `hidden-dealt-${pid}-${idx}`
                    }));
                }
            });
        }

        // 4. Sanitize Event Log (Prevent history leaks)
        if (context.eventLog) {
            context.eventLog = context.eventLog.map((event: any) => {
                // Mask START_MATCH details
                if (event.type === 'START_MATCH') {
                    const sanitizedEvent = { ...event };

                    // Mask seed
                    if (sanitizedEvent.seed !== undefined) {
                        sanitizedEvent.seed = 0;
                    }

                    // Mask dealtTiles
                    if (sanitizedEvent.dealtTiles) {
                        const sanitizedDealt = { ...sanitizedEvent.dealtTiles };
                        Object.keys(sanitizedDealt).forEach((pid) => {
                            if (pid !== playerId) {
                                sanitizedDealt[pid] = sanitizedDealt[pid].map((_: Tile, idx: number) => ({
                                    ...HIDDEN_TILE,
                                    id: `hidden-dealt-log-${pid}-${idx}`
                                }));
                            }
                        });
                        sanitizedEvent.dealtTiles = sanitizedDealt;
                    }
                    return sanitizedEvent;
                }

                // Mask SUBMIT_HAND details for opponents until round end
                if (event.type === 'SUBMIT_HAND' && event.playerId !== playerId && !isRoundEnd) {
                    return {
                        ...event,
                        hand: event.hand.map((_: Tile, idx: number) => ({ ...HIDDEN_TILE, id: `hidden-hand-log-${idx}` })),
                        pool: event.pool.map((_: Tile, idx: number) => ({ ...HIDDEN_TILE, id: `hidden-pool-log-${idx}` }))
                    };
                }

                return event;
            });
        }

        // 5. Mask Seeds & Sensitive Metadata
        if (context.deterministicSeed !== undefined) {
            context.deterministicSeed = null;
        }

        return {
            value: snapshot.value,
            context: context
        };
    }

    private broadcastState(snapshot: SnapshotFrom<MachineLogic>) {
        this.clients.forEach((ws, playerId) => {
            if (ws.readyState === WebSocket.OPEN) {
                const sanitizedState = this.sanitizeState(snapshot, playerId);
                ws.send(JSON.stringify({
                    type: 'UPDATE',
                    state: sanitizedState
                }));
            }
        });
    }
}
