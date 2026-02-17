"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameActionSchema = exports.ActionTypeSchema = exports.HandSetupSchema = exports.GamePhaseSchema = exports.PlayerIdSchema = exports.WindSchema = exports.TileSchema = exports.RankSchema = exports.SuitSchema = void 0;
const zod_1 = require("zod");
// Basic Types
exports.SuitSchema = zod_1.z.enum(['man', 'pin', 'sou', 'z']);
exports.RankSchema = zod_1.z.union([
    zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3),
    zod_1.z.literal(4), zod_1.z.literal(5), zod_1.z.literal(6),
    zod_1.z.literal(7), zod_1.z.literal(8), zod_1.z.literal(9)
]);
// Tile Representation: "1m", "5p", "9s", "1z" (East), ... "7z" (Chun)
// z: 1=East, 2=South, 3=West, 4=North, 5=Haku, 6=Hatsu, 7=Chun
exports.TileSchema = zod_1.z.object({
    suit: exports.SuitSchema,
    rank: exports.RankSchema,
    isRed: zod_1.z.boolean().default(false),
    id: zod_1.z.string().optional(), // Unique ID for tracking specific tiles in UI
});
// Wind
exports.WindSchema = zod_1.z.enum(['EAST', 'SOUTH', 'WEST', 'NORTH']);
// Player ID
exports.PlayerIdSchema = zod_1.z.string();
// Game Phase
exports.GamePhaseSchema = zod_1.z.enum([
    'IDLE',
    'MATCH_START',
    'ROUND_START', // Selecting 13 tiles from 34
    'TURN', // Draw -> Discard
    'ROUND_END',
    'MATCH_END'
]);
// 17-Step Specific: Hand Setup
exports.HandSetupSchema = zod_1.z.object({
    hand: zod_1.z.array(exports.TileSchema).length(13),
    discards: zod_1.z.array(exports.TileSchema).length(0), // Starts empty
});
// Action Types
exports.ActionTypeSchema = zod_1.z.enum([
    'DRAW',
    'DISCARD',
    'RIICHI',
    'RON',
    'TSUMO', // 17-step usually no tsumo but for correctness
    'ABORT'
]);
exports.GameActionSchema = zod_1.z.object({
    type: exports.ActionTypeSchema,
    playerId: exports.PlayerIdSchema,
    tile: exports.TileSchema.optional(),
});
