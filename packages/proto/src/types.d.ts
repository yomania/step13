import { z } from 'zod';
export declare const SuitSchema: z.ZodEnum<["man", "pin", "sou", "z"]>;
export type Suit = z.infer<typeof SuitSchema>;
export declare const RankSchema: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>, z.ZodLiteral<9>]>;
export type Rank = z.infer<typeof RankSchema>;
export declare const TileSchema: z.ZodObject<{
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
export type Tile = z.infer<typeof TileSchema>;
export declare const WindSchema: z.ZodEnum<["EAST", "SOUTH", "WEST", "NORTH"]>;
export type Wind = z.infer<typeof WindSchema>;
export declare const PlayerIdSchema: z.ZodString;
export type PlayerId = z.infer<typeof PlayerIdSchema>;
export declare const GamePhaseSchema: z.ZodEnum<["IDLE", "MATCH_START", "ROUND_START", "TURN", "ROUND_END", "MATCH_END"]>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
export declare const HandSetupSchema: z.ZodObject<{
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
export type HandSetup = z.infer<typeof HandSetupSchema>;
export declare const ActionTypeSchema: z.ZodEnum<["DRAW", "DISCARD", "RIICHI", "RON", "TSUMO", "ABORT"]>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export declare const GameActionSchema: z.ZodObject<{
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
export type GameAction = z.infer<typeof GameActionSchema>;
