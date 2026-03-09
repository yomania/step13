import { GameRoom } from './GameRoom';
import { RulesetName } from '@step13/core';
import { MatchSummaryInput } from './auth/store';

type RoomRegistryOptions = {
    defaultRoomId: string;
    ruleset: RulesetName;
    onMatchEnded?: (summary: MatchSummaryInput) => Promise<void> | void;
    onPlayerLeft?: (userId: string) => Promise<void> | void;
    idleTtlMs?: number;
    cleanupIntervalMs?: number;
};

type CreateRoomInput = {
    ownerUserId?: string | null;
    ownerNickname?: string | null;
    name?: string;
    password?: string | null;
};

type UpdateRoomInput = {
    name?: string;
    password?: string | null;
};

type RoomMeta = {
    roomId: string;
    ownerUserId: string | null;
    ownerNickname: string | null;
    name: string;
    password: string | null;
    createdAt: number;
};

export type RoomListItem = {
    roomId: string;
    name: string;
    ownerUserId: string | null;
    ownerNickname: string | null;
    hasPassword: boolean;
    connectedCount: number;
    participants: Array<{
        playerId: string;
        userId: string | null;
        nickname: string;
        avatarKey: string;
    }>;
};

export class RoomRegistry {
    private readonly rooms = new Map<string, GameRoom>();
    private readonly roomMetas = new Map<string, RoomMeta>();
    private readonly defaultRoomId: string;
    private readonly ruleset: RulesetName;
    private readonly onMatchEnded?: (summary: MatchSummaryInput) => Promise<void> | void;
    private readonly onPlayerLeft?: (userId: string) => Promise<void> | void;
    private readonly idleTtlMs: number;
    private readonly cleanupIntervalMs: number;
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(options: RoomRegistryOptions) {
        this.defaultRoomId = options.defaultRoomId;
        this.ruleset = options.ruleset;
        this.onMatchEnded = options.onMatchEnded;
        this.onPlayerLeft = options.onPlayerLeft;
        this.idleTtlMs = options.idleTtlMs ?? 15 * 60 * 1000;
        this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 1000;

        this.createRoom(this.defaultRoomId, {
            name: '기본 대기실',
            ownerUserId: null,
            ownerNickname: null,
            password: null
        });
        if (this.cleanupIntervalMs > 0 && this.idleTtlMs > 0) {
            this.startCleanupLoop();
        }
    }

    public getRoom(roomId: string): GameRoom | undefined {
        return this.rooms.get(roomId);
    }

    public hasRoom(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    public getRoomMeta(roomId: string): Omit<RoomMeta, 'password'> | null {
        const meta = this.roomMetas.get(roomId);
        if (!meta) return null;
        return {
            roomId: meta.roomId,
            ownerUserId: meta.ownerUserId,
            ownerNickname: meta.ownerNickname,
            name: meta.name,
            createdAt: meta.createdAt
        };
    }

    public isDefaultRoom(roomId: string): boolean {
        return roomId === this.defaultRoomId;
    }

    public getOrCreateRoom(roomId: string): GameRoom {
        const existing = this.rooms.get(roomId);
        if (existing) return existing;

        return this.createRoom(roomId, {
            name: roomId === this.defaultRoomId ? '기본 대기실' : roomId
        });
    }

    public createRoom(roomId: string, input: CreateRoomInput = {}): GameRoom {
        if (this.rooms.has(roomId)) {
            throw new Error('ROOM_ALREADY_EXISTS');
        }
        const room = new GameRoom(roomId, this.ruleset, {
            onMatchEnded: this.onMatchEnded,
            onPlayerLeft: this.onPlayerLeft
        });
        this.rooms.set(roomId, room);
        this.roomMetas.set(roomId, {
            roomId,
            ownerUserId: input.ownerUserId ?? null,
            ownerNickname: input.ownerNickname ?? null,
            name: input.name?.trim() || roomId,
            password: input.password?.trim() || null,
            createdAt: Date.now()
        });
        return room;
    }

    public updateRoom(roomId: string, input: UpdateRoomInput): Omit<RoomMeta, 'password'> | null {
        const meta = this.roomMetas.get(roomId);
        if (!meta) {
            return null;
        }
        if (input.name !== undefined) {
            meta.name = input.name;
        }
        if (input.password !== undefined) {
            meta.password = input.password;
        }
        this.roomMetas.set(roomId, meta);
        return {
            roomId: meta.roomId,
            ownerUserId: meta.ownerUserId,
            ownerNickname: meta.ownerNickname,
            name: meta.name,
            createdAt: meta.createdAt
        };
    }

    public canJoin(roomId: string, password: string | null): boolean {
        const meta = this.roomMetas.get(roomId);
        if (!meta) return false;
        if (!meta.password) return true;
        return meta.password === (password?.trim() || null);
    }

    public listRooms(): RoomListItem[] {
        const items: RoomListItem[] = [];
        this.rooms.forEach((room, roomId) => {
            const meta = this.roomMetas.get(roomId);
            const participants = room.getConnectedParticipants();
            items.push({
                roomId,
                name: meta?.name ?? roomId,
                ownerUserId: meta?.ownerUserId ?? null,
                ownerNickname: meta?.ownerNickname ?? null,
                hasPassword: Boolean(meta?.password),
                connectedCount: participants.length,
                participants: participants.map((participant) => ({
                    playerId: participant.playerId,
                    userId: participant.userId,
                    nickname: participant.nickname,
                    avatarKey: participant.avatarKey
                }))
            });
        });
        return items.sort((a, b) => {
            if (a.roomId === this.defaultRoomId) return -1;
            if (b.roomId === this.defaultRoomId) return 1;
            if (b.connectedCount !== a.connectedCount) {
                return b.connectedCount - a.connectedCount;
            }
            return a.name.localeCompare(b.name);
        });
    }

    public removeRoom(roomId: string): boolean {
        if (roomId === this.defaultRoomId) {
            return false;
        }
        const deleted = this.rooms.delete(roomId);
        this.roomMetas.delete(roomId);
        return deleted;
    }

    public cleanupEmptyRooms(): void {
        const now = Date.now();
        this.rooms.forEach((room, roomId) => {
            if (roomId === this.defaultRoomId) {
                return;
            }
            if (room.getConnectedClientCount() > 0) {
                return;
            }
            if (now - room.getLastActivityAt() < this.idleTtlMs) {
                return;
            }
            this.rooms.delete(roomId);
            this.roomMetas.delete(roomId);
        });
    }

    public shutdown(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    private startCleanupLoop(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupEmptyRooms();
        }, this.cleanupIntervalMs);
        this.cleanupTimer.unref?.();
    }
}
