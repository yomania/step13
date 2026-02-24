import { randomBytes, randomUUID } from 'node:crypto';
import {
    AuthSessionDTO,
    AuthTokensDTO,
    AuthUserDTO,
    PublicProfileDTO,
    StatsRecentMatchDTO,
    StatsRecentOpponentDTO,
    StatsSummaryDTO,
    UpdateProfileInputDTO,
    WsAuthTicketDTO
} from '@step13/proto';
import {
    AuthStore,
    MatchSummaryInput,
    ProfileRecord,
    UserRecord
} from './store';
import { hashPassword, verifyPassword } from './password';
import { AuthError } from './errors';
import { signJwt, verifyJwt } from './jwt';
import { sha256 } from './hash';

export type AuthServiceConfig = {
    store: AuthStore;
    jwtSecret: string;
    accessTokenTtlSec: number;
    refreshTokenTtlSec: number;
    wsTicketTtlSec: number;
};

export class AuthService {
    private readonly store: AuthStore;
    private readonly jwtSecret: string;
    private readonly accessTokenTtlSec: number;
    private readonly refreshTokenTtlSec: number;
    private readonly wsTicketTtlSec: number;

    constructor(config: AuthServiceConfig) {
        this.store = config.store;
        this.jwtSecret = config.jwtSecret;
        this.accessTokenTtlSec = config.accessTokenTtlSec;
        this.refreshTokenTtlSec = config.refreshTokenTtlSec;
        this.wsTicketTtlSec = config.wsTicketTtlSec;
    }

    public static toPlayerId(userId: string): string {
        return `user:${userId}`;
    }

    public static parseUserIdFromPlayerId(playerId: string): string | null {
        if (!playerId.startsWith('user:')) {
            return null;
        }
        const value = playerId.slice('user:'.length).trim();
        if (!value) return null;
        return value;
    }

    public async register(input: { email: string; password: string; nickname: string }): Promise<AuthSessionDTO> {
        const email = normalizeEmail(input.email);
        const password = input.password;
        const nickname = normalizeNickname(input.nickname);

        validateEmail(email);
        validatePassword(password);
        validateNickname(nickname);

        const existingUser = await this.store.findUserByEmail(email);
        if (existingUser) {
            throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email is already registered', 409);
        }

        const existingNickname = await this.store.findProfileByNickname(nickname);
        if (existingNickname) {
            throw new AuthError('NICKNAME_ALREADY_EXISTS', 'Nickname is already in use', 409);
        }

        const passwordHash = hashPassword(password);

        let userAndProfile: { user: UserRecord; profile: ProfileRecord };
        try {
            userAndProfile = await this.store.createUserWithProfile({
                email,
                passwordHash,
                nickname
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
                throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email is already registered', 409);
            }
            if (error instanceof Error && error.message === 'NICKNAME_ALREADY_EXISTS') {
                throw new AuthError('NICKNAME_ALREADY_EXISTS', 'Nickname is already in use', 409);
            }
            throw error;
        }

        const tokens = await this.issueTokens(userAndProfile.user.id, null);
        return {
            user: toAuthUserDTO(userAndProfile.user),
            profile: toPublicProfileDTO(userAndProfile.profile),
            tokens
        };
    }

    public async login(input: { email: string; password: string }): Promise<AuthSessionDTO> {
        const email = normalizeEmail(input.email);
        const password = input.password;

        validateEmail(email);
        validatePassword(password);

        const user = await this.store.findUserByEmail(email);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            throw new AuthError('INVALID_CREDENTIALS', 'Email or password is invalid', 401);
        }

        const profile = await this.store.findProfileByUserId(user.id);
        if (!profile) {
            throw new AuthError('PROFILE_NOT_FOUND', 'Profile is missing for this account', 500);
        }

        const now = new Date();
        await this.store.updateUserLastLogin(user.id, now);

        const tokens = await this.issueTokens(user.id, null);
        return {
            user: toAuthUserDTO({ ...user, lastLoginAt: now, updatedAt: now }),
            profile: toPublicProfileDTO(profile),
            tokens
        };
    }

    public async refreshSession(refreshToken: string): Promise<AuthSessionDTO> {
        const payload = verifyJwt(refreshToken, this.jwtSecret, 'refresh');
        if (!payload) {
            throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired', 401);
        }

        const now = new Date();
        const tokenHash = sha256(refreshToken);
        const stored = await this.store.findRefreshTokenByHash(tokenHash);

        if (!stored) {
            throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token not recognized', 401);
        }
        if (stored.userId !== payload.sub || stored.id !== payload.jti) {
            throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token signature mismatch', 401);
        }
        if (stored.revokedAt !== null || stored.expiresAt.getTime() <= now.getTime()) {
            throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is revoked or expired', 401);
        }

        await this.store.revokeRefreshToken(stored.id, now);

        const user = await this.store.findUserById(stored.userId);
        const profile = await this.store.findProfileByUserId(stored.userId);
        if (!user || !profile) {
            throw new AuthError('ACCOUNT_NOT_FOUND', 'Account no longer exists', 401);
        }

        const tokens = await this.issueTokens(stored.userId, stored.id);
        return {
            user: toAuthUserDTO(user),
            profile: toPublicProfileDTO(profile),
            tokens
        };
    }

    public async logout(refreshToken: string): Promise<void> {
        const payload = verifyJwt(refreshToken, this.jwtSecret, 'refresh');
        if (!payload) {
            return;
        }

        const tokenHash = sha256(refreshToken);
        const stored = await this.store.findRefreshTokenByHash(tokenHash);
        if (!stored) {
            return;
        }

        await this.store.revokeRefreshToken(stored.id, new Date());
    }

    public async adminResetPassword(input: { email: string; newPassword?: string }): Promise<{ userId: string; email: string; temporaryPassword?: string }> {
        const email = normalizeEmail(input.email);
        validateEmail(email);

        const user = await this.store.findUserByEmail(email);
        if (!user) {
            throw new AuthError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
        }

        const shouldGenerate = !input.newPassword;
        const nextPassword = shouldGenerate
            ? generateTemporaryPassword()
            : input.newPassword;

        validatePassword(nextPassword);

        const now = new Date();
        const passwordHash = hashPassword(nextPassword);
        await this.store.updateUserPassword(user.id, passwordHash, now);
        await this.store.revokeRefreshTokensForUser(user.id, now);

        return {
            userId: user.id,
            email: user.email,
            temporaryPassword: shouldGenerate ? nextPassword : undefined
        };
    }

    public async authenticateAccessToken(accessToken: string): Promise<{ user: AuthUserDTO; profile: PublicProfileDTO }> {
        const payload = verifyJwt(accessToken, this.jwtSecret, 'access');
        if (!payload) {
            throw new AuthError('INVALID_ACCESS_TOKEN', 'Access token is invalid or expired', 401);
        }

        const user = await this.store.findUserById(payload.sub);
        const profile = await this.store.findProfileByUserId(payload.sub);
        if (!user || !profile) {
            throw new AuthError('ACCOUNT_NOT_FOUND', 'Account no longer exists', 401);
        }

        return {
            user: toAuthUserDTO(user),
            profile: toPublicProfileDTO(profile)
        };
    }

    public async issueWsTicket(accessToken: string): Promise<WsAuthTicketDTO> {
        const { user } = await this.authenticateAccessToken(accessToken);

        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.wsTicketTtlSec * 1000);
        const ticket = randomBytes(32).toString('base64url');

        await this.store.createWsTicket({
            id: randomUUID(),
            userId: user.id,
            ticketHash: sha256(ticket),
            expiresAt,
            usedAt: null,
            createdAt: now
        });

        return {
            ticket,
            expiresAt: expiresAt.toISOString()
        };
    }

    public async consumeWsTicket(ticket: string): Promise<{ user: AuthUserDTO; profile: PublicProfileDTO }> {
        if (!ticket || typeof ticket !== 'string') {
            throw new AuthError('INVALID_WS_TICKET', 'WebSocket ticket is missing', 401);
        }

        const stored = await this.store.consumeWsTicket(sha256(ticket), new Date());
        if (!stored) {
            throw new AuthError('INVALID_WS_TICKET', 'WebSocket ticket is invalid or expired', 401);
        }

        const user = await this.store.findUserById(stored.userId);
        const profile = await this.store.findProfileByUserId(stored.userId);
        if (!user || !profile) {
            throw new AuthError('ACCOUNT_NOT_FOUND', 'Account no longer exists', 401);
        }

        return {
            user: toAuthUserDTO(user),
            profile: toPublicProfileDTO(profile)
        };
    }

    public async updateProfile(accessToken: string, patch: UpdateProfileInputDTO): Promise<PublicProfileDTO> {
        const { user } = await this.authenticateAccessToken(accessToken);

        const nextPatch: UpdateProfileInputDTO = {};

        if (patch.nickname !== undefined) {
            const nickname = normalizeNickname(patch.nickname);
            validateNickname(nickname);
            nextPatch.nickname = nickname;
        }

        if (patch.avatarKey !== undefined) {
            const avatarKey = patch.avatarKey.trim();
            if (avatarKey.length === 0 || avatarKey.length > 64) {
                throw new AuthError('INVALID_AVATAR_KEY', 'avatarKey must be 1~64 chars', 400);
            }
            nextPatch.avatarKey = avatarKey;
        }

        if (patch.bio !== undefined) {
            if (patch.bio !== null && patch.bio.length > 280) {
                throw new AuthError('INVALID_BIO', 'bio must be <= 280 chars', 400);
            }
            nextPatch.bio = patch.bio;
        }

        let profile: ProfileRecord;
        try {
            profile = await this.store.updateProfile(user.id, nextPatch);
        } catch (error) {
            if (error instanceof Error && error.message === 'NICKNAME_ALREADY_EXISTS') {
                throw new AuthError('NICKNAME_ALREADY_EXISTS', 'Nickname is already in use', 409);
            }
            if (error instanceof Error && error.message === 'PROFILE_NOT_FOUND') {
                throw new AuthError('PROFILE_NOT_FOUND', 'Profile not found', 404);
            }
            throw error;
        }

        return toPublicProfileDTO(profile);
    }

    public async getStatsSummary(accessToken: string): Promise<StatsSummaryDTO> {
        const { user } = await this.authenticateAccessToken(accessToken);
        return this.getStatsSummaryByUserId(user.id);
    }

    public async getStatsSummaryByUserId(userId: string): Promise<StatsSummaryDTO> {
        const history = await this.store.listMatchHistoryForUser(userId);
        const totalMatches = history.length;
        const wins = history.filter((entry) => entry.participant.isWinner).length;
        const losses = totalMatches - wins;
        const totalScoreDelta = history.reduce((sum, entry) => sum + entry.participant.scoreDelta, 0);

        const recentMatches: StatsRecentMatchDTO[] = [];
        for (const entry of history.slice(0, 10)) {
            const opponents: StatsRecentOpponentDTO[] = [];
            for (const opponent of entry.opponents) {
                let nickname: string | null = null;
                if (opponent.userId) {
                    const profile = await this.store.findProfileByUserId(opponent.userId);
                    nickname = profile?.nickname ?? null;
                }

                opponents.push({
                    playerId: opponent.playerId,
                    userId: opponent.userId,
                    nickname,
                    opponentType: opponent.opponentType,
                    finalScore: opponent.finalScore,
                    isWinner: opponent.isWinner
                });
            }

            recentMatches.push({
                matchId: entry.match.id,
                mode: entry.match.mode,
                roomId: entry.match.roomId,
                endedAt: entry.match.endedAt.toISOString(),
                totalRounds: entry.match.totalRounds,
                finalScore: entry.participant.finalScore,
                scoreDelta: entry.participant.scoreDelta,
                isWinner: entry.participant.isWinner,
                opponents
            });
        }

        return {
            totalMatches,
            wins,
            losses,
            winRate: totalMatches === 0 ? 0 : Number((wins / totalMatches).toFixed(4)),
            totalScoreDelta,
            recentMatches
        };
    }

    public async getProfileByUserId(userId: string): Promise<PublicProfileDTO | null> {
        const profile = await this.store.findProfileByUserId(userId);
        if (!profile) {
            return null;
        }
        return toPublicProfileDTO(profile);
    }

    public async getProfileByPlayerId(playerId: string): Promise<PublicProfileDTO | null> {
        const userId = AuthService.parseUserIdFromPlayerId(playerId);
        if (!userId) {
            return null;
        }
        return this.getProfileByUserId(userId);
    }

    public async recordMatchSummary(input: MatchSummaryInput): Promise<void> {
        await this.store.createMatchSummary(input);
    }

    public async recordLeave(userId: string): Promise<void> {
        try {
            await this.store.incrementLeaveCount(userId, new Date());
        } catch (error) {
            if (error instanceof Error && error.message === 'PROFILE_NOT_FOUND') {
                return;
            }
            throw error;
        }
    }

    private async issueTokens(userId: string, rotatedFromId: string | null): Promise<AuthTokensDTO> {
        const now = new Date();
        const accessExpiresAt = new Date(now.getTime() + this.accessTokenTtlSec * 1000);
        const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSec * 1000);

        const accessToken = signJwt(
            {
                sub: userId,
                type: 'access',
                jti: randomUUID()
            },
            this.jwtSecret,
            this.accessTokenTtlSec
        );

        const refreshTokenId = randomUUID();
        const refreshToken = signJwt(
            {
                sub: userId,
                type: 'refresh',
                jti: refreshTokenId
            },
            this.jwtSecret,
            this.refreshTokenTtlSec
        );

        await this.store.createRefreshToken({
            id: refreshTokenId,
            userId,
            tokenHash: sha256(refreshToken),
            expiresAt: refreshExpiresAt,
            revokedAt: null,
            createdAt: now,
            rotatedFromId
        });

        return {
            accessToken,
            refreshToken,
            accessTokenExpiresAt: accessExpiresAt.toISOString(),
            refreshTokenExpiresAt: refreshExpiresAt.toISOString()
        };
    }
}

function toAuthUserDTO(user: UserRecord): AuthUserDTO {
    return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString()
    };
}

function toPublicProfileDTO(profile: ProfileRecord): PublicProfileDTO {
    return {
        userId: profile.userId,
        playerId: AuthService.toPlayerId(profile.userId),
        nickname: profile.nickname,
        avatarKey: profile.avatarKey,
        bio: profile.bio,
        leaveCount: profile.leaveCount,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString()
    };
}

function validateEmail(email: string): void {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
        throw new AuthError('INVALID_EMAIL', 'Email format is invalid', 400);
    }
    if (email.length > 254) {
        throw new AuthError('INVALID_EMAIL', 'Email is too long', 400);
    }
}

function validatePassword(password: string): void {
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
        throw new AuthError('INVALID_PASSWORD', 'Password must be 8~72 chars', 400);
    }
}

function validateNickname(nickname: string): void {
    if (nickname.length < 2 || nickname.length > 20) {
        throw new AuthError('INVALID_NICKNAME', 'Nickname must be 2~20 chars', 400);
    }
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeNickname(nickname: string): string {
    return nickname.trim();
}

function generateTemporaryPassword(): string {
    return randomBytes(9).toString('base64url');
}
