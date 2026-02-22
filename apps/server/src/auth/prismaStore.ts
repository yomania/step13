import {
    AuthStore,
    MatchHistoryEntry,
    MatchSummaryInput,
    ProfileRecord,
    RefreshTokenRecord,
    UserRecord,
    WsTicketRecord
} from './store';

// Placeholder adapter shape for Prisma-backed persistence.
// The runtime currently defaults to InMemoryAuthStore because external packages
// cannot be installed in this environment.
export class PrismaAuthStorePlaceholder implements AuthStore {
    private notImplemented(methodName: string): never {
        throw new Error(`PrismaAuthStorePlaceholder.${methodName} is not implemented in this environment`);
    }

    public async findUserByEmail(_email: string): Promise<UserRecord | null> {
        return this.notImplemented('findUserByEmail');
    }

    public async findUserById(_userId: string): Promise<UserRecord | null> {
        return this.notImplemented('findUserById');
    }

    public async createUserWithProfile(_input: {
        email: string;
        passwordHash: string;
        nickname: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<{ user: UserRecord; profile: ProfileRecord }> {
        return this.notImplemented('createUserWithProfile');
    }

    public async updateUserLastLogin(_userId: string, _at: Date): Promise<void> {
        return this.notImplemented('updateUserLastLogin');
    }

    public async findProfileByUserId(_userId: string): Promise<ProfileRecord | null> {
        return this.notImplemented('findProfileByUserId');
    }

    public async findProfileByNickname(_nickname: string): Promise<ProfileRecord | null> {
        return this.notImplemented('findProfileByNickname');
    }

    public async updateProfile(_userId: string, _patch: {
        nickname?: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<ProfileRecord> {
        return this.notImplemented('updateProfile');
    }

    public async createRefreshToken(_record: RefreshTokenRecord): Promise<void> {
        return this.notImplemented('createRefreshToken');
    }

    public async findRefreshTokenByHash(_tokenHash: string): Promise<RefreshTokenRecord | null> {
        return this.notImplemented('findRefreshTokenByHash');
    }

    public async revokeRefreshToken(_tokenId: string, _revokedAt: Date): Promise<void> {
        return this.notImplemented('revokeRefreshToken');
    }

    public async createWsTicket(_record: WsTicketRecord): Promise<void> {
        return this.notImplemented('createWsTicket');
    }

    public async consumeWsTicket(_ticketHash: string, _now: Date): Promise<WsTicketRecord | null> {
        return this.notImplemented('consumeWsTicket');
    }

    public async createMatchSummary(_input: MatchSummaryInput): Promise<void> {
        return this.notImplemented('createMatchSummary');
    }

    public async listMatchHistoryForUser(_userId: string): Promise<MatchHistoryEntry[]> {
        return this.notImplemented('listMatchHistoryForUser');
    }
}
