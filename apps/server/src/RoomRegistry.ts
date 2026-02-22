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

export class RoomRegistry {
    private readonly rooms = new Map<string, GameRoom>();
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

        this.getOrCreateRoom(this.defaultRoomId);
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

    public isDefaultRoom(roomId: string): boolean {
        return roomId === this.defaultRoomId;
    }

    public getOrCreateRoom(roomId: string): GameRoom {
        const existing = this.rooms.get(roomId);
        if (existing) return existing;

        return this.createRoom(roomId);
    }

    public createRoom(roomId: string): GameRoom {
        if (this.rooms.has(roomId)) {
            throw new Error('ROOM_ALREADY_EXISTS');
        }
        const room = new GameRoom(roomId, this.ruleset, {
            onMatchEnded: this.onMatchEnded,
            onPlayerLeft: this.onPlayerLeft
        });
        this.rooms.set(roomId, room);
        return room;
    }

    public removeRoom(roomId: string): boolean {
        if (roomId === this.defaultRoomId) {
            return false;
        }
        return this.rooms.delete(roomId);
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
