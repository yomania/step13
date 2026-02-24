import { PrismaClient } from '@prisma/client';
import {
    AuthStore,
    MatchHistoryEntry,
    MatchSummaryInput,
    ProfileRecord,
    RefreshTokenRecord,
    UserRecord,
    WsTicketRecord
} from './store';

export class PrismaAuthStore implements AuthStore {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    public async findUserByEmail(email: string): Promise<UserRecord | null> {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        return user || null;
    }

    public async findUserById(userId: string): Promise<UserRecord | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });
        return user || null;
    }

    public async createUserWithProfile(input: {
        email: string;
        passwordHash: string;
        nickname: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<{ user: UserRecord; profile: ProfileRecord }> {
        const result = await this.prisma.user.create({
            data: {
                email: input.email.toLowerCase(),
                passwordHash: input.passwordHash,
                mustChangePassword: false,
                profile: {
                    create: {
                        nickname: input.nickname,
                        avatarKey: input.avatarKey || 'default',
                        bio: input.bio
                    }
                }
            },
            include: {
                profile: true
            }
        });

        if (!result.profile) {
            throw new Error('Failed to create profile for user');
        }

        return {
            user: result,
            profile: result.profile
        };
    }

    public async updateUserLastLogin(userId: string, at: Date): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: at }
        });
    }

    public async updateUserPassword(userId: string, passwordHash: string, at: Date): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                updatedAt: at
            }
        });
    }

    public async updateUserMustChangePassword(userId: string, mustChangePassword: boolean, at: Date): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                mustChangePassword,
                updatedAt: at
            }
        });
    }

    public async findProfileByUserId(userId: string): Promise<ProfileRecord | null> {
        const profile = await this.prisma.profile.findUnique({
            where: { userId }
        });
        return profile || null;
    }

    public async findProfileByNickname(nickname: string): Promise<ProfileRecord | null> {
        const profile = await this.prisma.profile.findUnique({
            where: { nickname }
        });
        return profile || null;
    }

    public async updateProfile(userId: string, patch: {
        nickname?: string;
        avatarKey?: string;
        bio?: string | null;
    }): Promise<ProfileRecord> {
        const updated = await this.prisma.profile.update({
            where: { userId },
            data: {
                nickname: patch.nickname,
                avatarKey: patch.avatarKey,
                bio: patch.bio
            }
        });
        return updated;
    }

    public async incrementLeaveCount(userId: string, at: Date): Promise<ProfileRecord> {
        const updated = await this.prisma.profile.update({
            where: { userId },
            data: {
                leaveCount: { increment: 1 },
                updatedAt: at
            }
        });
        return updated;
    }

    public async createRefreshToken(record: RefreshTokenRecord): Promise<void> {
        await this.prisma.refreshToken.create({
            data: {
                id: record.id,
                userId: record.userId,
                tokenHash: record.tokenHash,
                expiresAt: record.expiresAt,
                revokedAt: record.revokedAt,
                createdAt: record.createdAt,
                rotatedFromId: record.rotatedFromId
            }
        });
    }

    public async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
        const token = await this.prisma.refreshToken.findUnique({
            where: { tokenHash }
        });
        return token || null;
    }

    public async revokeRefreshToken(tokenId: string, revokedAt: Date): Promise<void> {
        await this.prisma.refreshToken.update({
            where: { id: tokenId },
            data: { revokedAt }
        });
    }

    public async revokeRefreshTokensForUser(userId: string, revokedAt: Date): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: {
                userId,
                revokedAt: null
            },
            data: { revokedAt }
        });
    }

    public async createWsTicket(record: WsTicketRecord): Promise<void> {
        await this.prisma.wsTicket.create({
            data: {
                id: record.id,
                userId: record.userId,
                ticketHash: record.ticketHash,
                expiresAt: record.expiresAt,
                usedAt: record.usedAt,
                createdAt: record.createdAt
            }
        });
    }

    public async consumeWsTicket(ticketHash: string, now: Date): Promise<WsTicketRecord | null> {
        const ticket = await this.prisma.wsTicket.findUnique({
            where: { ticketHash }
        });

        if (!ticket || ticket.usedAt !== null || ticket.expiresAt.getTime() <= now.getTime()) {
            return null;
        }

        const consumed = await this.prisma.wsTicket.update({
            where: { id: ticket.id },
            data: { usedAt: now }
        });

        return consumed;
    }

    public async createMatchSummary(input: MatchSummaryInput): Promise<void> {
        await this.prisma.matchSummary.create({
            data: {
                mode: input.mode,
                roomId: input.roomId,
                endedAt: input.endedAt,
                totalRounds: input.totalRounds,
                winnerUserId: input.winnerUserId,
                participants: {
                    create: input.participants.map(p => ({
                        userId: p.userId,
                        playerId: p.playerId,
                        finalScore: p.finalScore,
                        scoreDelta: p.scoreDelta,
                        isWinner: p.isWinner,
                        opponentType: p.opponentType
                    }))
                }
            }
        });
    }

    public async listMatchHistoryForUser(userId: string): Promise<MatchHistoryEntry[]> {
        const history = await this.prisma.matchParticipantSummary.findMany({
            where: { userId },
            include: {
                match: {
                    include: {
                        participants: true
                    }
                }
            },
            orderBy: {
                match: {
                    endedAt: 'desc'
                }
            }
        });

        return history.map(item => ({
            match: {
                ...item.match,
                mode: item.match.mode as any
            },
            participant: {
                id: item.id,
                matchId: item.matchId,
                userId: item.userId,
                playerId: item.playerId,
                finalScore: item.finalScore,
                scoreDelta: item.scoreDelta,
                isWinner: item.isWinner,
                opponentType: item.opponentType as any,
                createdAt: item.createdAt
            },
            opponents: item.match.participants
                .filter(p => p.id !== item.id)
                .map(p => ({
                    id: p.id,
                    matchId: p.matchId,
                    userId: p.userId,
                    playerId: p.playerId,
                    finalScore: p.finalScore,
                    scoreDelta: p.scoreDelta,
                    isWinner: p.isWinner,
                    opponentType: p.opponentType as any,
                    createdAt: p.createdAt
                }))
        }));
    }
}
