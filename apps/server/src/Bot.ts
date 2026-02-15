
import { AnyActorRef } from 'xstate';
import { PlayerId, Tile } from '@step13/proto';
import { calculateScore } from '@step13/scoring';
import { createEngineForRuleset, RulesetName } from '@step13/core';

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
    private rulesEngine;
    private preparedHand: Tile[] | null = null;
    private preparedPool: Tile[] | null = null;
    private preparingHand: boolean = false;

    constructor(id: PlayerId, actor: AnyActorRef, ruleset: RulesetName = 'classic') {
        this.id = id;
        this.actor = actor;
        this.rulesEngine = createEngineForRuleset(ruleset);
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
                if (this.preparedHand && this.preparedPool) {
                    this.actor.send({
                        type: 'SUBMIT_HAND',
                        playerId: this.id,
                        hand: this.preparedHand,
                        pool: this.preparedPool
                    });
                    this.preparedHand = null;
                    this.preparedPool = null;
                    return;
                }

                this.processing = true;
                // Simulate delay
                setTimeout(() => {
                    this.buildHand(context.dealtTiles[this.id]);
                    this.processing = false;
                }, 250 + Math.random() * 450);
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

            // While dora is being revealed, precompute hand so handBuild can start immediately.
            if (
                alreadySelected &&
                !context.hands[this.id] &&
                !this.preparingHand &&
                !this.preparedHand &&
                Array.isArray(context.dealtTiles?.[this.id])
            ) {
                this.preparingHand = true;
                setTimeout(() => {
                    // Keep dora-reveal window responsive: only do a light pre-search here.
                    const prepared = this.findValidHandByRandomSampling(context.dealtTiles[this.id], 500);
                    if (prepared) {
                        this.preparedHand = prepared.hand;
                        this.preparedPool = prepared.pool;
                    }
                    this.preparingHand = false;
                }, 80 + Math.random() * 120);
            }
        }

        // 2. Game Loop
        if (phase === 'gameLoop') {
            // Check for RON opportunity (regardless of turn, if it's someone else's discard)
            // But usually Ron is possible immediately after DISCARD event.
            // XState might be in 'checkRon' state or 'turn' state.
            // If context.lastDiscard is set and it's NOT me, check Ron.
            if (context.lastDiscard && context.lastDiscard.playerId !== this.id) {
                const myHand = context.hands[this.id];
                if (!myHand) {
                    return;
                }
                const score = calculateScore(myHand, context.lastDiscard.tile, false, [], SCORE_OPTIONS);
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

        const found = this.findValidHand(tiles);
        if (found) {
            console.log(`Bot ${this.id} found a valid tenpai hand and submits immediately.`);
            this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand: found.hand, pool: found.pool });
            return;
        }

        // If no valid hand is found, do not submit random invalid data.
        // The machine timeout path will auto-submit and progress safely.
        console.warn(`Bot ${this.id} could not build a valid hand. Waiting for machine timeout auto-submit.`);
    }

    private findValidHand(tiles: Tile[]): { hand: Tile[]; pool: Tile[] } | null {
        // Keep search lightweight to avoid blocking game loop responsiveness.
        return this.findValidHandByRandomSampling(tiles, 2500, 120);
    }

    private findValidHandByRandomSampling(tiles: Tile[], attempts: number, maxMs?: number): { hand: Tile[]; pool: Tile[] } | null {
        const startedAt = Date.now();
        for (let i = 0; i < attempts; i++) {
            if (maxMs != null && Date.now() - startedAt > maxMs) {
                break;
            }
            const shuffled = [...tiles];
            for (let j = shuffled.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            const hand = shuffled.slice(0, 13);
            if (this.rulesEngine.hasWinningWait(hand)) {
                return {
                    hand,
                    pool: shuffled.slice(13)
                };
            }
        }
        return null;
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
