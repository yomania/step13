import { z } from 'zod';

declare const SuitSchema: z.ZodEnum<["man", "pin", "sou", "z"]>;
type Suit = z.infer<typeof SuitSchema>;
declare const RankSchema: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
type Rank = z.infer<typeof RankSchema>;
declare const TileSchema: z.ZodObject<{
    suit: z.ZodEnum<["man", "pin", "sou", "z"]>;
    rank: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
    isRed: z.ZodDefault<z.ZodBoolean>;
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    suit: "man" | "pin" | "sou" | "z";
    rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
    isRed: boolean;
    id?: string | undefined;
}, {
    suit: "man" | "pin" | "sou" | "z";
    rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
    isRed?: boolean | undefined;
    id?: string | undefined;
}>;
type Tile = z.infer<typeof TileSchema>;
declare const WindSchema: z.ZodEnum<["EAST", "SOUTH", "WEST", "NORTH"]>;
type Wind = z.infer<typeof WindSchema>;
declare const PlayerIdSchema: z.ZodString;
type PlayerId = z.infer<typeof PlayerIdSchema>;
declare const GamePhaseSchema: z.ZodEnum<["IDLE", "MATCH_START", "ROUND_START", "TURN", "ROUND_END", "MATCH_END"]>;
type GamePhase = z.infer<typeof GamePhaseSchema>;
declare const HandSetupSchema: z.ZodObject<{
    hand: z.ZodArray<z.ZodObject<{
        suit: z.ZodEnum<["man", "pin", "sou", "z"]>;
        rank: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
        isRed: z.ZodDefault<z.ZodBoolean>;
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    }, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    }>, "many">;
    discards: z.ZodArray<z.ZodObject<{
        suit: z.ZodEnum<["man", "pin", "sou", "z"]>;
        rank: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
        isRed: z.ZodDefault<z.ZodBoolean>;
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    }, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    hand: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    }[];
    discards: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    }[];
}, {
    hand: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    }[];
    discards: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    }[];
}>;
type HandSetup = z.infer<typeof HandSetupSchema>;
declare const ActionTypeSchema: z.ZodEnum<["DRAW", "DISCARD", "RIICHI", "RON", "TSUMO", "ABORT"]>;
type ActionType = z.infer<typeof ActionTypeSchema>;
declare const GameActionSchema: z.ZodObject<{
    type: z.ZodEnum<["DRAW", "DISCARD", "RIICHI", "RON", "TSUMO", "ABORT"]>;
    playerId: z.ZodString;
    tile: z.ZodOptional<z.ZodObject<{
        suit: z.ZodEnum<["man", "pin", "sou", "z"]>;
        rank: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
        isRed: z.ZodDefault<z.ZodBoolean>;
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    }, {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "DRAW" | "DISCARD" | "RIICHI" | "RON" | "TSUMO" | "ABORT";
    playerId: string;
    tile?: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed: boolean;
        id?: string | undefined;
    } | undefined;
}, {
    type: "DRAW" | "DISCARD" | "RIICHI" | "RON" | "TSUMO" | "ABORT";
    playerId: string;
    tile?: {
        suit: "man" | "pin" | "sou" | "z";
        rank: 4 | 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
        isRed?: boolean | undefined;
        id?: string | undefined;
    } | undefined;
}>;
type GameAction = z.infer<typeof GameActionSchema>;

type ApiErrorDTO = {
    code: string;
    message: string;
    details?: string;
};
type AuthUserDTO = {
    id: string;
    email: string;
    createdAt: string;
};
type PublicProfileDTO = {
    userId: string;
    playerId: string;
    nickname: string;
    avatarKey: string;
    bio: string | null;
    createdAt: string;
    updatedAt: string;
};
type AuthTokensDTO = {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
};
type AuthSessionDTO = {
    user: AuthUserDTO;
    profile: PublicProfileDTO;
    tokens: AuthTokensDTO;
};
type WsAuthTicketDTO = {
    ticket: string;
    expiresAt: string;
};
type UpdateProfileInputDTO = {
    nickname?: string;
    avatarKey?: string;
    bio?: string | null;
};
type StatsRecentOpponentDTO = {
    playerId: string;
    userId: string | null;
    nickname: string | null;
    opponentType: 'user' | 'bot';
    finalScore: number;
    isWinner: boolean;
};
type StatsRecentMatchDTO = {
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
type StatsSummaryDTO = {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
    totalScoreDelta: number;
    recentMatches: StatsRecentMatchDTO[];
};

type PlayerProfileMapDTO = Record<PlayerId, Pick<PublicProfileDTO, 'nickname' | 'avatarKey'>>;
type UpdateEnvelopeDTO = {
    type: 'UPDATE';
    state: any;
    playerProfiles?: PlayerProfileMapDTO;
};
type AnalysisResultEnvelopeDTO = {
    type: 'ANALYSIS_RESULT';
    queryId?: string;
    [key: string]: unknown;
};
type PersonaListEnvelopeDTO = {
    type: 'PERSONA_LIST_RESULT';
    personas: unknown[];
};
type RejectedEventEnvelopeDTO = {
    type: 'REJECTED_EVENT';
    reason: string;
};
type ServerWsEnvelopeDTO = UpdateEnvelopeDTO | AnalysisResultEnvelopeDTO | PersonaListEnvelopeDTO | RejectedEventEnvelopeDTO;

export { type ActionType, ActionTypeSchema, type AnalysisResultEnvelopeDTO, type ApiErrorDTO, type AuthSessionDTO, type AuthTokensDTO, type AuthUserDTO, type GameAction, GameActionSchema, type GamePhase, GamePhaseSchema, type HandSetup, HandSetupSchema, type PersonaListEnvelopeDTO, type PlayerId, PlayerIdSchema, type PlayerProfileMapDTO, type PublicProfileDTO, type Rank, RankSchema, type RejectedEventEnvelopeDTO, type ServerWsEnvelopeDTO, type StatsRecentMatchDTO, type StatsRecentOpponentDTO, type StatsSummaryDTO, type Suit, SuitSchema, type Tile, TileSchema, type UpdateEnvelopeDTO, type UpdateProfileInputDTO, type Wind, WindSchema, type WsAuthTicketDTO };
