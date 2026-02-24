import { randomUUID } from 'node:crypto';

export type MatchMode = 'pvp' | 'ai';
export type OpponentType = 'user' | 'bot';

export type UserRecord = {
    id: string;
    email: string;
    passwordHash: string;
    mustChangePassword: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
};

export type ProfileRecord = {
    userId: string;
    nickname: string;
    avatarKey: string;
    bio: string | null;
    leaveCount: number;
    createdAt: Date;
    updatedAt: Date;
};

export type RefreshTokenRecord = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    rotatedFromId: string | null;
};

export type WsTicketRecord = {
    id: string;
    userId: string;
    ticketHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
};

export type MatchSummaryRecord = {
    id: string;
    mode: MatchMode;
    roomId: string;
    endedAt: Date;
    totalRounds: number;
    winnerUserId: string | null;
    createdAt: Date;
};

export type MatchParticipantSummaryRecord = {
    id: string;
    matchId: string;
    userId: string | null;
    playerId: string;
    finalScore: number;
    scoreDelta: number;
    isWinner: boolean;
    opponentType: OpponentType;
    createdAt: Date;
};

export type MatchParticipantSummaryInput = {
    userId: string | null;
    playerId: string;
    finalScore: number;
    scoreDelta: number;
    isWinner: boolean;
    opponentType: OpponentType;
};

export type MatchSummaryInput = {
    mode: MatchMode;
    roomId: string;
    endedAt: Date;
    totalRounds: number;
    winnerUserId: string | null;
    participants: MatchParticipantSummaryInput[];
};

export type MatchHistoryEntry = {
    match: MatchSummaryRecord;
    participant: MatchParticipantSummaryRecord;
    opponents: MatchParticipantSummaryRecord[];
};

export type AuthStore = {
    findUserByEmail(email: string): Promise<UserRecord | null>;
    findUserById(userId: string): Promise<UserRecord | null>;
    createUserWithProfile(input: {
        email: string;
        passwordHash: string;
        nickname: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<{ user: UserRecord; profile: ProfileRecord }>;
    updateUserLastLogin(userId: string, at: Date): Promise<void>;
    updateUserPassword(userId: string, passwordHash: string, at: Date): Promise<void>;
    updateUserMustChangePassword(userId: string, mustChangePassword: boolean, at: Date): Promise<void>;
    findProfileByUserId(userId: string): Promise<ProfileRecord | null>;
    findProfileByNickname(nickname: string): Promise<ProfileRecord | null>;
    updateProfile(userId: string, patch: {
        nickname?: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<ProfileRecord>;
    incrementLeaveCount(userId: string, at: Date): Promise<ProfileRecord>;
    createRefreshToken(record: RefreshTokenRecord): Promise<void>;
    findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
    revokeRefreshToken(tokenId: string, revokedAt: Date): Promise<void>;
    revokeRefreshTokensForUser(userId: string, revokedAt: Date): Promise<void>;
    createWsTicket(record: WsTicketRecord): Promise<void>;
    consumeWsTicket(ticketHash: string, now: Date): Promise<WsTicketRecord | null>;
    createMatchSummary(input: MatchSummaryInput): Promise<void>;
    listMatchHistoryForUser(userId: string): Promise<MatchHistoryEntry[]>;
};

export class InMemoryAuthStore implements AuthStore {
    private usersById = new Map<string, UserRecord>();
    private userIdByEmail = new Map<string, string>();
    private profilesByUserId = new Map<string, ProfileRecord>();
    private userIdByNickname = new Map<string, string>();
    private refreshTokensById = new Map<string, RefreshTokenRecord>();
    private refreshTokenIdByHash = new Map<string, string>();
    private wsTicketsById = new Map<string, WsTicketRecord>();
    private wsTicketIdByHash = new Map<string, string>();
    private matchSummariesById = new Map<string, MatchSummaryRecord>();
    private matchParticipantsByMatchId = new Map<string, MatchParticipantSummaryRecord[]>();

    public async findUserByEmail(email: string): Promise<UserRecord | null> {
        const normalized = normalizeEmail(email);
        const userId = this.userIdByEmail.get(normalized);
        if (!userId) return null;
        return this.usersById.get(userId) ?? null;
    }

    public async findUserById(userId: string): Promise<UserRecord | null> {
        return this.usersById.get(userId) ?? null;
    }

    public async createUserWithProfile(input: {
        email: string;
        passwordHash: string;
        nickname: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<{ user: UserRecord; profile: ProfileRecord }> {
        const normalizedEmail = normalizeEmail(input.email);
        const normalizedNickname = normalizeNickname(input.nickname);

        if (this.userIdByEmail.has(normalizedEmail)) {
            throw new Error('EMAIL_ALREADY_EXISTS');
        }
        if (this.userIdByNickname.has(normalizedNickname)) {
            throw new Error('NICKNAME_ALREADY_EXISTS');
        }

        const now = new Date();
        const userId = randomUUID();
        const user: UserRecord = {
            id: userId,
            email: normalizedEmail,
            passwordHash: input.passwordHash,
            mustChangePassword: false,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now
        };
        const profile: ProfileRecord = {
            userId,
            nickname: normalizedNickname,
            avatarKey: (input.avatarKey ?? 'default').trim() || 'default',
            bio: input.bio ?? null,
            leaveCount: 0,
            createdAt: now,
            updatedAt: now
        };

        this.usersById.set(userId, user);
        this.userIdByEmail.set(normalizedEmail, userId);
        this.profilesByUserId.set(userId, profile);
        this.userIdByNickname.set(normalizedNickname, userId);

        return { user, profile };
    }

    public async updateUserLastLogin(userId: string, at: Date): Promise<void> {
        const user = this.usersById.get(userId);
        if (!user) {
            return;
        }
        user.lastLoginAt = at;
        user.updatedAt = at;
        this.usersById.set(userId, user);
    }

    public async updateUserPassword(userId: string, passwordHash: string, at: Date): Promise<void> {
        const user = this.usersById.get(userId);
        if (!user) {
            return;
        }
        user.passwordHash = passwordHash;
        user.updatedAt = at;
        this.usersById.set(userId, user);
    }

    public async updateUserMustChangePassword(userId: string, mustChangePassword: boolean, at: Date): Promise<void> {
        const user = this.usersById.get(userId);
        if (!user) {
            return;
        }
        user.mustChangePassword = mustChangePassword;
        user.updatedAt = at;
        this.usersById.set(userId, user);
    }

    public async findProfileByUserId(userId: string): Promise<ProfileRecord | null> {
        return this.profilesByUserId.get(userId) ?? null;
    }

    public async findProfileByNickname(nickname: string): Promise<ProfileRecord | null> {
        const normalized = normalizeNickname(nickname);
        const userId = this.userIdByNickname.get(normalized);
        if (!userId) return null;
        return this.profilesByUserId.get(userId) ?? null;
    }

    public async updateProfile(userId: string, patch: {
        nickname?: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<ProfileRecord> {
        const existing = this.profilesByUserId.get(userId);
        if (!existing) {
            throw new Error('PROFILE_NOT_FOUND');
        }

        const nextNickname = patch.nickname !== undefined
            ? normalizeNickname(patch.nickname)
            : existing.nickname;

        if (nextNickname !== existing.nickname) {
            const owner = this.userIdByNickname.get(nextNickname);
            if (owner && owner !== userId) {
                throw new Error('NICKNAME_ALREADY_EXISTS');
            }
            this.userIdByNickname.delete(existing.nickname);
            this.userIdByNickname.set(nextNickname, userId);
        }

        const updated: ProfileRecord = {
            ...existing,
            nickname: nextNickname,
            avatarKey: patch.avatarKey !== undefined
                ? (patch.avatarKey.trim() || 'default')
                : existing.avatarKey,
            bio: patch.bio !== undefined ? patch.bio : existing.bio,
            updatedAt: new Date()
        };

        this.profilesByUserId.set(userId, updated);
        return updated;
    }

    public async incrementLeaveCount(userId: string, at: Date): Promise<ProfileRecord> {
        const existing = this.profilesByUserId.get(userId);
        if (!existing) {
            throw new Error('PROFILE_NOT_FOUND');
        }
        const updated: ProfileRecord = {
            ...existing,
            leaveCount: existing.leaveCount + 1,
            updatedAt: at
        };
        this.profilesByUserId.set(userId, updated);
        return updated;
    }

    public async createRefreshToken(record: RefreshTokenRecord): Promise<void> {
        this.refreshTokensById.set(record.id, record);
        this.refreshTokenIdByHash.set(record.tokenHash, record.id);
    }

    public async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
        const tokenId = this.refreshTokenIdByHash.get(tokenHash);
        if (!tokenId) return null;
        return this.refreshTokensById.get(tokenId) ?? null;
    }

    public async revokeRefreshToken(tokenId: string, revokedAt: Date): Promise<void> {
        const existing = this.refreshTokensById.get(tokenId);
        if (!existing) return;

        const updated: RefreshTokenRecord = {
            ...existing,
            revokedAt
        };
        this.refreshTokensById.set(tokenId, updated);
    }

    public async revokeRefreshTokensForUser(userId: string, revokedAt: Date): Promise<void> {
        this.refreshTokensById.forEach((token, tokenId) => {
            if (token.userId !== userId || token.revokedAt !== null) {
                return;
            }
            this.refreshTokensById.set(tokenId, { ...token, revokedAt });
        });
    }

    public async createWsTicket(record: WsTicketRecord): Promise<void> {
        this.wsTicketsById.set(record.id, record);
        this.wsTicketIdByHash.set(record.ticketHash, record.id);
    }

    public async consumeWsTicket(ticketHash: string, now: Date): Promise<WsTicketRecord | null> {
        const ticketId = this.wsTicketIdByHash.get(ticketHash);
        if (!ticketId) return null;
        const ticket = this.wsTicketsById.get(ticketId);
        if (!ticket) return null;

        if (ticket.usedAt !== null || ticket.expiresAt.getTime() <= now.getTime()) {
            return null;
        }

        const consumed: WsTicketRecord = {
            ...ticket,
            usedAt: now
        };
        this.wsTicketsById.set(ticketId, consumed);
        return consumed;
    }

    public async createMatchSummary(input: MatchSummaryInput): Promise<void> {
        const matchId = randomUUID();
        const summary: MatchSummaryRecord = {
            id: matchId,
            mode: input.mode,
            roomId: input.roomId,
            endedAt: input.endedAt,
            totalRounds: input.totalRounds,
            winnerUserId: input.winnerUserId,
            createdAt: new Date()
        };

        const participants: MatchParticipantSummaryRecord[] = input.participants.map((participant) => ({
            id: randomUUID(),
            matchId,
            userId: participant.userId,
            playerId: participant.playerId,
            finalScore: participant.finalScore,
            scoreDelta: participant.scoreDelta,
            isWinner: participant.isWinner,
            opponentType: participant.opponentType,
            createdAt: new Date()
        }));

        this.matchSummariesById.set(matchId, summary);
        this.matchParticipantsByMatchId.set(matchId, participants);
    }

    public async listMatchHistoryForUser(userId: string): Promise<MatchHistoryEntry[]> {
        const matches: MatchHistoryEntry[] = [];

        this.matchParticipantsByMatchId.forEach((participants, matchId) => {
            const participant = participants.find((item) => item.userId === userId);
            if (!participant) {
                return;
            }

            const summary = this.matchSummariesById.get(matchId);
            if (!summary) {
                return;
            }

            matches.push({
                match: summary,
                participant,
                opponents: participants.filter((item) => item.id !== participant.id)
            });
        });

        matches.sort((a, b) => b.match.endedAt.getTime() - a.match.endedAt.getTime());
        return matches;
    }
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeNickname(nickname: string): string {
    return nickname.trim();
}
