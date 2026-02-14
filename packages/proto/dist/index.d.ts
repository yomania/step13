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

export { type ActionType, ActionTypeSchema, type GameAction, GameActionSchema, type GamePhase, GamePhaseSchema, type HandSetup, HandSetupSchema, type PlayerId, PlayerIdSchema, type Rank, RankSchema, type Suit, SuitSchema, type Tile, TileSchema, type Wind, WindSchema };
