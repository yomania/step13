export type ApiErrorDTO = {
    code: string;
    message: string;
    details?: string;
};

export type AuthUserDTO = {
    id: string;
    email: string;
    createdAt: string;
};

export type PublicProfileDTO = {
    userId: string;
    playerId: string;
    nickname: string;
    avatarKey: string;
    bio: string | null;
    leaveCount: number;
    createdAt: string;
    updatedAt: string;
};

export type AuthTokensDTO = {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
};

export type AuthSessionDTO = {
    user: AuthUserDTO;
    profile: PublicProfileDTO;
    tokens: AuthTokensDTO;
};

export type WsAuthTicketDTO = {
    ticket: string;
    expiresAt: string;
};

export type UpdateProfileInputDTO = {
    nickname?: string;
    avatarKey?: string;
    bio?: string | null;
};

export type StatsRecentOpponentDTO = {
    playerId: string;
    userId: string | null;
    nickname: string | null;
    opponentType: 'user' | 'bot';
    finalScore: number;
    isWinner: boolean;
};

export type StatsRecentMatchDTO = {
    matchId: string;
    mode: 'pvp' | 'ai';
    roomId: string;
    endedAt: string;
    totalRounds: number;
    finalScore: number;
    scoreDelta: number;
    isWinner: boolean;
    opponents: StatsRecentOpponentDTO[];
};

export type StatsSummaryDTO = {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
    totalScoreDelta: number;
    recentMatches: StatsRecentMatchDTO[];
};
