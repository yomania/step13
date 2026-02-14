import { z } from 'zod';

// Basic Types
export const SuitSchema = z.enum(['man', 'pin', 'sou', 'z']);
export type Suit = z.infer<typeof SuitSchema>;

export const RankSchema = z.union([
    z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
    z.literal(7), z.literal(8), z.literal(9)
]);
export type Rank = z.infer<typeof RankSchema>;

// Tile Representation: "1m", "5p", "9s", "1z" (East), ... "7z" (Chun)
// z: 1=East, 2=South, 3=West, 4=North, 5=Haku, 6=Hatsu, 7=Chun
export const TileSchema = z.object({
    suit: SuitSchema,
    rank: RankSchema,
    isRed: z.boolean().default(false),
    id: z.string().optional(), // Unique ID for tracking specific tiles in UI
});
export type Tile = z.infer<typeof TileSchema>;

// Wind
export const WindSchema = z.enum(['EAST', 'SOUTH', 'WEST', 'NORTH']);
export type Wind = z.infer<typeof WindSchema>;

// Player ID
export const PlayerIdSchema = z.string();
export type PlayerId = z.infer<typeof PlayerIdSchema>;

// Game Phase
export const GamePhaseSchema = z.enum([
    'IDLE',
    'MATCH_START',
    'ROUND_START', // Selecting 13 tiles from 34
    'TURN',        // Draw -> Discard
    'ROUND_END',
    'MATCH_END'
]);
export type GamePhase = z.infer<typeof GamePhaseSchema>;

// 17-Step Specific: Hand Setup
export const HandSetupSchema = z.object({
    hand: z.array(TileSchema).length(13),
    discards: z.array(TileSchema).length(0), // Starts empty
});
export type HandSetup = z.infer<typeof HandSetupSchema>;

// Action Types
export const ActionTypeSchema = z.enum([
    'DRAW',
    'DISCARD',
    'RIICHI',
    'RON',
    'TSUMO', // 17-step usually no tsumo but for correctness
    'ABORT'
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const GameActionSchema = z.object({
    type: ActionTypeSchema,
    playerId: PlayerIdSchema,
    tile: TileSchema.optional(),
});
export type GameAction = z.infer<typeof GameActionSchema>;
