
import { createActor, SnapshotFrom } from 'xstate';
import { createGameMachine, RulesetName } from '@step13/core';
import { PlayerId, Tile } from '@step13/proto';
import { WebSocket } from 'ws';
import { Bot } from './Bot';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { getBotPersonaProfile, isBotPersonaProfileId, listBotPersonaProfiles } from '@step13/bot';
import { MatchSummaryInput } from './auth/store';

const HIDDEN_TILE: Tile = { suit: 'z', rank: 1, isRed: false, id: 'HIDDEN' };

type MachineLogic = ReturnType<typeof createGameMachine>;

type PlayerProfileSnapshot = {
    userId: string | null;
    nickname: string;
    avatarKey: string;
};

type GameRoomOptions = {
    onMatchEnded?: (summary: MatchSummaryInput) => Promise<void> | void;
    onPlayerLeft?: (userId: string) => Promise<void> | void;
};

export class GameRoom {
    private machineLogic: MachineLogic;
    private machine;
    private clients: Map<PlayerId, WebSocket> = new Map();
    private playerProfiles: Map<PlayerId, PlayerProfileSnapshot> = new Map();
    private baselineScoresByPlayer: Map<PlayerId, number> = new Map();
    private bots: Bot[] = [];
    private ruleset: RulesetName;
    private onMatchEnded?: (summary: MatchSummaryInput) => Promise<void> | void;
    private onPlayerLeft?: (userId: string) => Promise<void> | void;
    private previousSnapshotValue: unknown = null;
    private matchSummaryRecorded = false;
    private lastActivityAt = Date.now();

    public roomId: string;

    constructor(roomId: string, ruleset: RulesetName = 'classic', options: GameRoomOptions = {}) {
        this.roomId = roomId;
        this.ruleset = ruleset;
        this.onMatchEnded = options.onMatchEnded;
        this.onPlayerLeft = options.onPlayerLeft;
        this.machineLogic = createGameMachine({ ruleset });
        this.machine = createActor(this.machineLogic);
        this.machine.start();

        // Subscribe to state changes and broadcast to all clients
        this.machine.subscribe((snapshot) => {
            this.handleSnapshotLifecycle(snapshot);
            this.broadcastState(snapshot);
        });
    }

    public join(playerId: PlayerId, socket: WebSocket, profile?: Partial<PlayerProfileSnapshot>) {
        this.clients.set(playerId, socket);
        const existing = this.playerProfiles.get(playerId);
        this.playerProfiles.set(playerId, {
            userId: profile?.userId ?? existing?.userId ?? null,
            nickname: profile?.nickname ?? existing?.nickname ?? playerId,
            avatarKey: profile?.avatarKey ?? existing?.avatarKey ?? 'default'
        });
        this.markActivity();

        // Forward JOIN to machine
        this.machine.send({ type: 'JOIN', playerId });
    }

    public addBot(personaId?: string) {
        // Generate a bot ID
        const botId = `bot-${Date.now()}`;
        const normalizedPersonaId = this.normalizePersonaId(personaId);
        const bot = new Bot(botId, this.machine, this.ruleset, normalizedPersonaId);
        this.bots.push(bot);

        const resolved = getBotPersonaProfile(normalizedPersonaId);
        this.playerProfiles.set(botId, {
            userId: null,
            nickname: resolved.name,
            avatarKey: 'bot-default'
        });
        console.log(`Adding Bot: ${botId} (${resolved.difficulty}, persona=${resolved.id})`);
        this.machine.send({ type: 'JOIN', playerId: botId });
        this.markActivity();
    }

    public handleMessage(playerId: PlayerId, event: any) {
        if (event.type === 'ADD_BOT') {
            this.addBot(this.normalizePersonaId(event?.personaId));
            return;
        }
        if (event.type === 'LEAVE') {
            const hadClient = this.clients.has(playerId);
            const hadProfile = this.playerProfiles.has(playerId);
            this.playerProfiles.delete(playerId);
            this.clients.delete(playerId);
            if (hadClient || hadProfile) {
                this.recordPlayerLeave(playerId);
            }
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
        this.markActivity();
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
            this.markActivity();
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
        this.markActivity();
    }

    public hasPlayer(playerId: PlayerId): boolean {
        return this.clients.has(playerId) || this.machine.getSnapshot().context.players.includes(playerId);
    }

    public getConnectedClientCount(): number {
        return this.clients.size;
    }

    public getLastActivityAt(): number {
        return this.lastActivityAt;
    }

    public handleDisconnect(playerId: PlayerId): void {
        if (!this.clients.has(playerId) && !this.playerProfiles.has(playerId)) {
            return;
        }
        this.clients.delete(playerId);
        this.playerProfiles.delete(playerId);
        this.recordPlayerLeave(playerId);
        const snapshot = this.machine.getSnapshot();
        if (!isStateValue(snapshot.value, 'matchEnd')) {
            this.machine.send({ type: 'LEAVE', playerId });
        }
        this.markActivity();
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

    private markActivity(): void {
        this.lastActivityAt = Date.now();
    }

    private recordPlayerLeave(playerId: PlayerId): void {
        const userId = parseUserIdFromPlayerId(playerId);
        if (!userId || !this.onPlayerLeft) {
            return;
        }
        void this.onPlayerLeft(userId);
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
                    state: sanitizedState,
                    playerProfiles: this.getPlayerProfileMapForSnapshot(snapshot)
                }));
            }
        });
    }

    private getPlayerProfileMapForSnapshot(snapshot: SnapshotFrom<MachineLogic>): Record<PlayerId, { nickname: string; avatarKey: string }> {
        const result: Record<PlayerId, { nickname: string; avatarKey: string }> = {} as Record<PlayerId, { nickname: string; avatarKey: string }>;
        const players = snapshot.context.players ?? [];
        players.forEach((playerId) => {
            const profile = this.playerProfiles.get(playerId);
            result[playerId] = {
                nickname: profile?.nickname ?? playerId,
                avatarKey: profile?.avatarKey ?? 'default'
            };
        });
        return result;
    }

    private handleSnapshotLifecycle(snapshot: SnapshotFrom<MachineLogic>) {
        const currentValue = snapshot.value;
        if (isStateValue(currentValue, 'matchStart') && !isStateValue(this.previousSnapshotValue, 'matchStart')) {
            if (this.baselineScoresByPlayer.size === 0) {
                const scores = snapshot.context.scores ?? {};
                Object.keys(scores).forEach((playerId) => {
                    this.baselineScoresByPlayer.set(playerId, scores[playerId] ?? 0);
                });
            }
            this.matchSummaryRecorded = false;
        }

        if (isStateValue(currentValue, 'matchEnd') && !isStateValue(this.previousSnapshotValue, 'matchEnd')) {
            if (!this.matchSummaryRecorded) {
                this.matchSummaryRecorded = true;
                void this.persistMatchSummary(snapshot);
            }
        }

        if (isStateValue(currentValue, 'idle') && isStateValue(this.previousSnapshotValue, 'matchEnd')) {
            this.baselineScoresByPlayer.clear();
            this.matchSummaryRecorded = false;
        }

        this.previousSnapshotValue = currentValue;
    }

    private async persistMatchSummary(snapshot: SnapshotFrom<MachineLogic>) {
        if (!this.onMatchEnded) {
            return;
        }

        const context = snapshot.context;
        const players = context.players ?? [];
        if (players.length === 0) {
            return;
        }

        const mode: MatchSummaryInput['mode'] = players.some((playerId) => playerId.startsWith('bot-')) ? 'ai' : 'pvp';
        const winnerUserId = context.winner ? parseUserIdFromPlayerId(context.winner) : null;

        const participants = players.map((playerId) => {
            const baselineScore = this.baselineScoresByPlayer.get(playerId) ?? 60000;
            const finalScore = context.scores?.[playerId] ?? baselineScore;
            const hasBotOpponent = players.some((otherId) => otherId !== playerId && otherId.startsWith('bot-'));

            return {
                userId: parseUserIdFromPlayerId(playerId),
                playerId,
                finalScore,
                scoreDelta: finalScore - baselineScore,
                isWinner: context.winner === playerId,
                opponentType: hasBotOpponent ? 'bot' : 'user'
            } as MatchSummaryInput['participants'][number];
        });

        const summary: MatchSummaryInput = {
            mode,
            roomId: this.roomId,
            endedAt: new Date(),
            totalRounds: Math.max(1, context.matchHandIndex ?? 1),
            winnerUserId,
            participants
        };

        try {
            await this.onMatchEnded(summary);
        } catch (error) {
            console.error('Failed to persist match summary:', error);
        }
    }
}

function parseUserIdFromPlayerId(playerId: string): string | null {
    if (!playerId.startsWith('user:')) {
        return null;
    }
    const userId = playerId.slice('user:'.length).trim();
    return userId.length > 0 ? userId : null;
}

function isStateValue(value: unknown, expected: string): boolean {
    if (typeof value === 'string') {
        return value === expected;
    }
    if (value && typeof value === 'object') {
        return Object.prototype.hasOwnProperty.call(value, expected);
    }
    return false;
}
