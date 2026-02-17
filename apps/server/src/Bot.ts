import { AnyActorRef } from 'xstate';
import { PlayerId, Tile } from '@step13/proto';
import { calculateScore, calculateShanten } from '@step13/scoring';
import { createEngineForRuleset, RulesetName } from '@step13/core';
import { BotLogic } from '@step13/bot';

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
    private logic: BotLogic;

    constructor(id: PlayerId, actor: AnyActorRef, ruleset: RulesetName = 'classic') {
        this.id = id;
        this.actor = actor;
        this.rulesEngine = createEngineForRuleset(ruleset);
        this.logic = new BotLogic(id, 'HARD');
        this.actor.subscribe((snapshot) => {
            this.state = snapshot;
            this.decide();
        });
    }

    public buildBestCandidatesForQuery(dealtTiles: Tile[], doraIndicators: Tile[], difficulty: any = 'MEDIUM') {
        return this.logic.buildBestCandidates(dealtTiles, doraIndicators, 8, {}, difficulty);
    }

    public getWinningTilesForQuery(hand: Tile[]) {
        return this.logic.getWinningTiles(hand);
    }

    public evaluateMiniGameForQuery(playerHand: Tile[], dealtTiles: Tile[], doraIndicators: Tile[]) {
        return this.logic.evaluateMiniGame(playerHand, dealtTiles, doraIndicators);
    }

    private decide() {
        if (!this.state || this.processing) return;

        const { value, context } = this.state;
        const phase = typeof value === 'string' ? value : Object.keys(value)[0];
        const myTurn = context.currentTurn === this.id;

        if (phase === 'handBuild') {
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
                setTimeout(() => {
                    this.buildHand(context.dealtTiles[this.id], context.doraIndicators ?? []);
                    this.processing = false;
                }, 250 + Math.random() * 450);
            }
        }

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

            if (
                alreadySelected &&
                !context.hands[this.id] &&
                !this.preparingHand &&
                !this.preparedHand &&
                Array.isArray(context.dealtTiles?.[this.id])
            ) {
                this.preparingHand = true;
                setTimeout(() => {
                    const prepared = this.buildBestHand(context.dealtTiles[this.id], context.doraIndicators ?? []);
                    this.preparedHand = prepared.hand;
                    this.preparedPool = prepared.pool;
                    this.preparingHand = false;
                }, 80 + Math.random() * 120);
            }
        }

        if (phase === 'gameLoop') {
            if (context.lastDiscard && context.lastDiscard.playerId !== this.id) {
                const myHand = context.hands[this.id];
                if (!myHand) return;
                const score = calculateScore(myHand, context.lastDiscard.tile, false, [], SCORE_OPTIONS);
                if (score.points > 0) {
                    this.actor.send({ type: 'DECLARE_WIN', playerId: this.id });
                    return;
                }
            }

            if (myTurn) {
                if (!this.processing) {
                    this.processing = true;
                    setTimeout(() => {
                        this.discard();
                        this.processing = false;
                    }, 1000 + Math.random() * 1000);
                }
            }
        }
    }

    private buildHand(tiles: Tile[], doraIndicators: Tile[]) {
        if (!tiles || tiles.length < 13) return;

        const picked = this.buildBestHand(tiles, doraIndicators);
        this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand: picked.hand, pool: picked.pool });
    }

    private buildBestHand(tiles: Tile[], doraIndicators: Tile[]): { hand: Tile[]; pool: Tile[] } {
        const baseline = this.rulesEngine.findTenpaiHand(tiles);
        const baselineIsTenpai = this.rulesEngine.hasWinningWait(baseline.hand);
        const robust = baselineIsTenpai ? baseline : this.findAnyTenpaiHand(tiles, 15000);
        const seedCandidate = robust ?? baseline;
        const seedIsTenpai = this.rulesEngine.hasWinningWait(seedCandidate.hand);
        const baselineScore = seedIsTenpai ? this.evaluateHandPotential(seedCandidate.hand, doraIndicators) : -1;
        let best = seedCandidate;
        let bestScore = baselineScore;

        for (let i = 0; i < 1200; i++) {
            const shuffled = [...tiles];
            for (let j = shuffled.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            const hand = shuffled.slice(0, 13);
            if (!this.rulesEngine.hasWinningWait(hand)) continue;
            const score = this.evaluateHandPotential(hand, doraIndicators);
            if (score > bestScore) {
                bestScore = score;
                best = { hand, pool: shuffled.slice(13) };
            }
        }

        return best;
    }

    private findAnyTenpaiHand(tiles: Tile[], attempts: number): { hand: Tile[]; pool: Tile[] } | null {
        for (let i = 0; i < attempts; i++) {
            const shuffled = [...tiles];
            for (let j = shuffled.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            const hand = shuffled.slice(0, 13);
            if (this.rulesEngine.hasWinningWait(hand)) {
                return { hand, pool: shuffled.slice(13) };
            }
        }
        return null;
    }

    private evaluateHandPotential(hand: Tile[], doraIndicators: Tile[]): number {
        const waits = this.findWinningTiles(hand);
        if (waits.length === 0) return -1;

        let best = -1;
        for (const wait of waits) {
            const strict = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
            const soft = calculateScore(hand, wait, false, doraIndicators, {
                ...SCORE_OPTIONS,
                requireManganMinimum: false
            });
            const weighted = strict.points * 1000 + soft.han * 100 + soft.yaku.length * 10 + waits.length;
            if (weighted > best) best = weighted;
        }
        return best;
    }

    private findWinningTiles(hand: Tile[]): Tile[] {
        if (hand.length !== 13) return [];
        const waits: Tile[] = [];
        const suits: Array<Tile['suit']> = ['man', 'pin', 'sou', 'z'];
        for (const suit of suits) {
            const maxRank = suit === 'z' ? 7 : 9;
            for (let rank = 1; rank <= maxRank; rank++) {
                const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
                if (calculateShanten([...hand, tile]) === -1) {
                    waits.push(tile);
                }
            }
        }
        return waits;
    }

    private discard() {
        const pool = this.state.context.pools[this.id];
        if (!pool || pool.length === 0) return;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const tile = pool[randomIndex];
        if (tile?.id) {
            this.actor.send({ type: 'DISCARD', playerId: this.id, tileId: tile.id });
        }
    }
}
