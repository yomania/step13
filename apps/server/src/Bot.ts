
import { AnyActorRef } from 'xstate';
import { PlayerId, Tile } from '@step13/proto';
import { isTenpai, calculateScore } from '@step13/scoring';

const SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
} as const;

export class Bot {
    public id: PlayerId;
    public actor: AnyActorRef;
    private state: any;
    private processing: boolean = false;

    constructor(id: PlayerId, actor: AnyActorRef) {
        this.id = id;
        this.actor = actor;
        this.actor.subscribe((snapshot) => {
            this.state = snapshot;
            this.decide();
        });
    }

    private decide() {
        if (!this.state || this.processing) return;

        const { value, context } = this.state;
        const phase = typeof value === 'string' ? value : Object.keys(value)[0];
        const myTurn = context.currentTurn === this.id;

        // 1. Hand Building Phase
        if (phase === 'handBuild') {
            // Check if I already submitted
            if (!context.hands[this.id]) {
                this.processing = true;
                // Simulate delay
                setTimeout(() => {
                    this.buildHand(context.dealtTiles[this.id]);
                    this.processing = false;
                }, 1000 + Math.random() * 2000);
            }
        }

        // 1.5 Dora Selection Phase
        if (phase === 'doraSelect') {
            const isDealer = context.dealer === this.id;
            const alreadySelected = (context.doraIndicators?.length ?? 0) > 0;
            if (isDealer && !alreadySelected && !this.processing) {
                this.processing = true;
                setTimeout(() => {
                    const wall = context.wall ?? [];
                    const pick = wall[Math.floor(Math.random() * Math.max(1, wall.length))];
                    if (pick?.id) {
                        this.actor.send({ type: 'SELECT_DORA', playerId: this.id, tileId: pick.id });
                    }
                    this.processing = false;
                }, 500 + Math.random() * 700);
            }
        }

        // 2. Game Loop
        if (phase === 'gameLoop') {
            // Check for RON opportunity (regardless of turn, if it's someone else's discard)
            // But usually Ron is possible immediately after DISCARD event.
            // XState might be in 'checkRon' state or 'turn' state.
            // If context.lastDiscard is set and it's NOT me, check Ron.
            if (context.lastDiscard && context.lastDiscard.playerId !== this.id) {
                const score = calculateScore(context.hands[this.id], context.lastDiscard.tile, false, [], SCORE_OPTIONS);
                if (score.points > 0) {
                    // 50% chance to Ron (or 100% for testing)
                    // Let's go for 100% for now to verify logic.
                    console.log(`Bot ${this.id} declares RON on ${context.lastDiscard.tile.suit}${context.lastDiscard.tile.rank}! Points: ${score.points}`);
                    this.actor.send({ type: 'DECLARE_WIN', playerId: this.id });
                    return;
                }
            }

            if (myTurn) {
                // If it's my turn, I must Discard.
                if (!this.processing) {
                    this.processing = true;
                    setTimeout(() => {
                        this.discard(context.hands[this.id]);
                        this.processing = false;
                    }, 1000 + Math.random() * 1000);
                }
            }
        }
    }

    private buildHand(tiles: Tile[]) {
        if (!tiles || tiles.length < 13) return;

        console.log(`Bot ${this.id} building hand...`);

        // Try N times to find a Tenpai hand
        // Heuristic: Shuffle tiles, take first 13, check strict Tenpai.
        // 17-step starting hand (34 tiles) usually guarantees at least one Tenpai combination if we search enough.

        let bestHand: Tile[] | null = null;
        let bestPool: Tile[] | null = null;

        // Try up to 500 shuffles?
        for (let i = 0; i < 500; i++) {
            const shuffled = [...tiles].sort(() => Math.random() - 0.5);
            const hand = shuffled.slice(0, 13);
            if (isTenpai(hand)) {
                bestHand = hand;
                bestPool = shuffled.slice(13);
                console.log(`Bot ${this.id} found Tenpai hand after ${i + 1} attempts`);
                break;
            }
        }

        if (bestHand && bestPool) {
            this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand: bestHand, pool: bestPool });
        } else {
            console.warn(`Bot ${this.id} failed to find Tenpai hand. Submitting random (will likely fail validation or lose).`);
            // Determine behavior: Force submit invalid or just fail?
            // If we fallback to random, game will reject if strict.
            // Let's submit random anyway to prevent deadlock in dev.
            const shuffled = [...tiles].sort(() => Math.random() - 0.5);
            this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand: shuffled.slice(0, 13), pool: shuffled.slice(13) });
        }
    }

    private discard(hand: Tile[]) {
        if (!hand || hand.length === 0) return;

        // Simple Bot: Random Discard
        // Phase 3 Improvement: Use Shanten to discard tile that keeps Shanten low?
        // But for turn-based 17-step, we don't draw. We just discard.
        // So we should pick a tile that is "safe" or "least value"?
        // For MVP, random is fine.

        // Wait: In 17-step, "Hand" is the 13 tiles.
        // "Pool" is the remaining 21 tiles.
        // Discarding checks "Pool"!
        // We shouldn't discard from "Hand" (Locked).
        // Discards come from the "Pool".

        // Wait!! In 17-step, you discard from the POOL (the 21 tiles you didn't choose).
        // You NEVER touch your HAND (the 13 tiles).
        // My previous logic might be flawed if I thought I discard from hand.
        // In `machine.ts`, `SUBMIT_HAND` sets `context.hands`.
        // `DISCARD` takes `tileId`.
        // `handleDiscard` logic: `const pool = context.pools[event.playerId]; const tile = pool.find(...)`.
        // So yes, Discard must be from POOL.

        // Bot needs to look at `context.pools[this.id]`!
        // `decide` passes `context.hands[this.id]` which is wrong for discard source.

        // I need to access `context.pools` in `decide`.
        // `decide` uses `context.hands` currently. I should fix it.
        const pool = this.state.context.pools[this.id];
        if (!pool || pool.length === 0) {
            console.warn(`Bot ${this.id} has no tiles in pool to discard!`);
            return;
        }

        // Pick random from POOL
        const randomIndex = Math.floor(Math.random() * pool.length);
        const tile = pool[randomIndex];

        if (tile && tile.id) {
            console.log(`Bot ${this.id} discarding from pool: ${tile.suit}${tile.rank}`);
            this.actor.send({ type: 'DISCARD', playerId: this.id, tileId: tile.id });
        }
    }
}
