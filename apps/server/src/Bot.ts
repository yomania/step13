import { AnyActorRef } from 'xstate';
import { PlayerId, Tile } from '@step13/proto';
import { calculateScore, calculateShanten, Difficulty } from '@step13/scoring';
import { createEngineForRuleset, RulesetName } from '@step13/core';
import { BotLogic, BotPersonaProfile, CandidateEvaluation, getBotPersonaProfile } from '@step13/bot';

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
    private difficulty: Difficulty;
    private persona: BotPersonaProfile;

    constructor(
        id: PlayerId,
        actor: AnyActorRef,
        ruleset: RulesetName = 'classic',
        personaId?: string
    ) {
        this.id = id;
        this.actor = actor;
        this.rulesEngine = createEngineForRuleset(ruleset);
        this.persona = getBotPersonaProfile(personaId);
        this.difficulty = this.persona.difficulty;
        this.logic = new BotLogic(id, this.difficulty);
        this.actor.subscribe((snapshot) => {
            this.state = snapshot;
            this.decide();
        });
    }

    public buildBestCandidatesForQuery(
        dealtTiles: Tile[],
        doraIndicators: Tile[],
        personaId?: string,
        maxCount?: number,
        includeNonTenpai?: boolean,
        multiDifficulty?: boolean
    ) {
        const profile = getBotPersonaProfile(personaId);
        const targetCount = maxCount ?? profile.handBuild.candidateCount;
        const includeFallback = includeNonTenpai ?? false;
        if (!multiDifficulty) {
            return this.logic.buildBestCandidates(
                dealtTiles,
                doraIndicators,
                targetCount,
                {},
                profile.difficulty,
                undefined,
                includeFallback
            );
        }

        const perDifficultyCount = Math.max(targetCount, 8);
        const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
        const unique = new Map<string, CandidateEvaluation>();

        for (const difficulty of difficulties) {
            const candidates = this.logic.buildBestCandidates(
                dealtTiles,
                doraIndicators,
                perDifficultyCount,
                {},
                difficulty,
                undefined,
                includeFallback
            );
            for (const candidate of candidates) {
                const key = candidate.indices.join('-');
                const existing = unique.get(key);
                if (!existing || this.compareCandidateStrength(candidate, existing) > 0) {
                    unique.set(key, candidate);
                }
            }
        }

        return [...unique.values()]
            .sort((a, b) => this.compareCandidateStrength(b, a))
            .slice(0, targetCount);
    }

    public getWinningTilesForQuery(hand: Tile[]) {
        return this.logic.getWinningTiles(hand);
    }

    public evaluateHandScoreForQuery(hand: Tile[], doraIndicators: Tile[]) {
        const waits = this.logic.getWinningTiles(hand);
        if (waits.length === 0) return null;

        const waitBreakdown = waits
            .map((wait) => {
                const score = calculateScore(hand, wait, false, doraIndicators, SCORE_OPTIONS);
                return {
                    wait,
                    han: score.han,
                    fu: score.fu,
                    points: score.points,
                    doraCount: score.doraCount,
                    limit: score.limit,
                    yaku: score.yaku
                };
            })
            .sort((a, b) => b.points - a.points || b.han - a.han || b.fu - a.fu);

        const bestWaitScore = waitBreakdown[0];
        if (!bestWaitScore) return null;
        const best = calculateScore(hand, bestWaitScore.wait, false, doraIndicators, SCORE_OPTIONS);
        return {
            ...best,
            bestWait: bestWaitScore.wait,
            waitBreakdown
        };
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

        // Some personas intentionally fail to submit occasionally (training wheels behavior).
        if (Math.random() < this.persona.handBuild.submitSkipChance) {
            return;
        }

        const picked = this.buildBestHand(tiles, doraIndicators);
        this.actor.send({ type: 'SUBMIT_HAND', playerId: this.id, hand: picked.hand, pool: picked.pool });
    }

    private buildBestHand(tiles: Tile[], doraIndicators: Tile[]): { hand: Tile[]; pool: Tile[] } {
        const byPersona = this.buildBestHandByPersona(tiles, doraIndicators);
        if (byPersona) return byPersona;

        return this.buildBestHandLegacy(tiles, doraIndicators);
    }

    private buildBestHandByPersona(tiles: Tile[], doraIndicators: Tile[]): { hand: Tile[]; pool: Tile[] } | null {
        const candidates = this.logic.buildBestCandidates(
            tiles,
            doraIndicators,
            this.persona.handBuild.candidateCount,
            {},
            this.persona.difficulty
        );
        if (candidates.length === 0) return null;

        const pick = this.pickHandBuildCandidateByStyle(candidates);
        if (!pick) return null;
        return { hand: pick.hand, pool: this.buildPoolFromChosenHand(tiles, pick.hand) };
    }

    private pickHandBuildCandidateByStyle(candidates: CandidateEvaluation[]): CandidateEvaluation | null {
        const style = this.persona.handBuild.style;
        if (candidates.length === 0) return null;

        if (style === 'value') {
            const prioritized = this.pickHardBestCandidate(candidates);
            return prioritized ?? [...candidates].sort((a, b) => this.compareCandidateStrength(b, a))[0];
        }

        if (style === 'stability') {
            return [...candidates].sort((a, b) => {
                const waitDiff = this.getEffectiveWaitCount(b) - this.getEffectiveWaitCount(a);
                if (waitDiff !== 0) return waitDiff;
                return this.compareCandidateStrength(b, a);
            })[0];
        }

        if (style === 'flush') {
            return [...candidates].sort((a, b) => {
                const suitDiff = this.getPrimarySuitConcentration(b.hand) - this.getPrimarySuitConcentration(a.hand);
                if (suitDiff !== 0) return suitDiff;
                return this.compareCandidateStrength(b, a);
            })[0];
        }

        if (style === 'pairs') {
            return [...candidates].sort((a, b) => {
                const pairDiff = this.countPairs(b.hand) - this.countPairs(a.hand);
                if (pairDiff !== 0) return pairDiff;
                return this.compareCandidateStrength(b, a);
            })[0];
        }

        if (style === 'chaotic') {
            const randomIndex = Math.floor(Math.random() * candidates.length);
            return candidates[randomIndex];
        }

        const topSlice = Math.max(1, Math.min(this.persona.handBuild.topSlice, candidates.length));
        const top = [...candidates]
            .sort((a, b) => this.compareCandidateStrength(b, a))
            .slice(0, topSlice);
        return top[Math.floor(Math.random() * top.length)];
    }

    private buildBestHandLegacy(tiles: Tile[], doraIndicators: Tile[]): { hand: Tile[]; pool: Tile[] } {
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

    private pickHardBestCandidate(candidates: CandidateEvaluation[]): CandidateEvaluation | null {
        const multiWaitCandidates = candidates.filter((candidate) => this.getEffectiveWaitCount(candidate) >= 2);
        const target = multiWaitCandidates.length > 0 ? multiWaitCandidates : candidates;
        if (target.length === 0) return null;
        return [...target].sort((a, b) => this.compareCandidateStrength(b, a))[0];
    }

    private compareCandidateStrength(a: CandidateEvaluation, b: CandidateEvaluation): number {
        const aEffective = this.getEffectiveWaitCount(a);
        const bEffective = this.getEffectiveWaitCount(b);
        if (a.score.points !== b.score.points) return a.score.points - b.score.points;
        if (a.score.han !== b.score.han) return a.score.han - b.score.han;
        if (aEffective !== bEffective) return aEffective - bEffective;
        if (a.waits.length !== b.waits.length) return a.waits.length - b.waits.length;
        return (a.score.yaku?.length ?? 0) - (b.score.yaku?.length ?? 0);
    }

    private getEffectiveWaitCount(candidate: CandidateEvaluation): number {
        const furitenSet = new Set((candidate.furitenWaits ?? []).map((tile) => `${tile.suit}-${tile.rank}`));
        return candidate.waits.filter((tile) => !furitenSet.has(`${tile.suit}-${tile.rank}`)).length;
    }

    private getPrimarySuitConcentration(hand: Tile[]): number {
        const counts = { man: 0, pin: 0, sou: 0, z: 0 };
        hand.forEach((tile) => {
            counts[tile.suit] += 1;
        });
        return Math.max(counts.man, counts.pin, counts.sou) + counts.z;
    }

    private countPairs(hand: Tile[]): number {
        const map = new Map<string, number>();
        for (const tile of hand) {
            const key = `${tile.suit}-${tile.rank}`;
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        let pairs = 0;
        map.forEach((count) => {
            if (count >= 2) pairs += 1;
        });
        return pairs;
    }

    private buildPoolFromChosenHand(tiles: Tile[], hand: Tile[]): Tile[] {
        const remaining = [...tiles];

        for (const chosen of hand) {
            const byId = chosen.id ? remaining.findIndex((tile) => tile.id === chosen.id) : -1;
            if (byId >= 0) {
                remaining.splice(byId, 1);
                continue;
            }

            const byShape = remaining.findIndex((tile) =>
                tile.suit === chosen.suit &&
                tile.rank === chosen.rank &&
                Boolean(tile.isRed) === Boolean(chosen.isRed)
            );
            if (byShape >= 0) {
                remaining.splice(byShape, 1);
            }
        }

        return remaining;
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

        const preference = this.persona.discard;
        let tile: Tile | null = null;

        if (preference.style === 'defensive') {
            tile = this.pickBetaoriTile(pool);
        } else if (preference.style === 'aggressive') {
            tile = Math.random() < preference.pushDangerousChance ? this.pickMostDangerousTile(pool) : this.pickSafestTile(pool);
        } else if (preference.style === 'chaotic') {
            if (Math.random() < preference.randomDiscardChance) {
                tile = pool[Math.floor(Math.random() * pool.length)];
            } else {
                tile = Math.random() < preference.pushDangerousChance ? this.pickMostDangerousTile(pool) : this.pickSafestTile(pool);
            }
        } else {
            tile = Math.random() < preference.pushDangerousChance ? this.pickMostDangerousTile(pool) : this.pickSafestTile(pool);
        }

        if (!tile) return;
        if (tile?.id) {
            this.actor.send({ type: 'DISCARD', playerId: this.id, tileId: tile.id });
        }
    }

    private pickBetaoriTile(pool: Tile[]): Tile | null {
        if (pool.length === 0) return null;

        let best = pool[0];
        let bestClass = this.getSafetyClass(best);
        let bestRisk = this.calculateDiscardRisk(best);
        for (let i = 1; i < pool.length; i++) {
            const candidate = pool[i];
            const cls = this.getSafetyClass(candidate);
            const risk = this.calculateDiscardRisk(candidate);
            if (cls < bestClass || (cls === bestClass && risk < bestRisk)) {
                best = candidate;
                bestClass = cls;
                bestRisk = risk;
            }
        }
        return best;
    }

    private getSafetyClass(tile: Tile): number {
        const context = this.state?.context;
        if (!context) return 99;
        const key = this.baseTileKey(tile);
        const visible = this.buildVisibleMap(context);
        const visibleCount = visible.get(key) ?? 0;
        if (visibleCount >= 4) return 0; // complete safe tile

        const players = (context.players ?? []) as PlayerId[];
        const opponentId = players.find((playerId) => playerId !== this.id);
        const opponentDiscards = opponentId ? ((context.discards?.[opponentId] ?? []) as Tile[]) : [];

        const isGenbutsu = opponentDiscards.some((discarded) => discarded.suit === tile.suit && discarded.rank === tile.rank);
        if (isGenbutsu) return 1;

        const sujiLevel = this.getSujiLevel(tile, opponentDiscards);
        if (sujiLevel === 'double') return 2;
        if (sujiLevel === 'single') return 3;

        const neighborDead = this.getMaxNeighborDeadCount(tile, visible);
        if (neighborDead >= 4) return 3;
        if (neighborDead >= 3) return 4;

        if (tile.suit === 'z' && visibleCount >= 2) return 4;
        return 5;
    }

    private pickSafestTile(pool: Tile[]): Tile | null {
        if (pool.length === 0) return null;
        let best = pool[0];
        let bestRisk = this.calculateDiscardRisk(best);
        for (let i = 1; i < pool.length; i++) {
            const candidate = pool[i];
            const risk = this.calculateDiscardRisk(candidate);
            if (risk < bestRisk) {
                best = candidate;
                bestRisk = risk;
            }
        }
        return best;
    }

    private pickMostDangerousTile(pool: Tile[]): Tile | null {
        if (pool.length === 0) return null;
        let worst = pool[0];
        let worstRisk = this.calculateDiscardRisk(worst);
        for (let i = 1; i < pool.length; i++) {
            const candidate = pool[i];
            const risk = this.calculateDiscardRisk(candidate);
            if (risk > worstRisk) {
                worst = candidate;
                worstRisk = risk;
            }
        }
        return worst;
    }

    private calculateDiscardRisk(tile: Tile): number {
        const context = this.state?.context;
        if (!context) return 100;

        const key = this.baseTileKey(tile);
        const myDiscards = (context.discards?.[this.id] ?? []) as Tile[];
        const opponentId = (context.players as PlayerId[]).find((playerId) => playerId !== this.id);
        const opponentDiscards = opponentId ? ((context.discards?.[opponentId] ?? []) as Tile[]) : [];

        const visible = this.buildVisibleMap(context);

        const visibleCount = visible.get(key) ?? 0;
        const liveCopies = Math.max(0, 4 - visibleCount);

        // Absolute safe: all 4 copies are already visible.
        if (liveCopies === 0) {
            return 0;
        }

        // Genbutsu: already discarded by opponent, usually safest.
        const isOpponentGenbutsu = opponentDiscards.some((discarded: Tile) =>
            discarded.suit === tile.suit && discarded.rank === tile.rank
        );
        if (isOpponentGenbutsu) {
            return 0.2 + liveCopies * 0.05;
        }

        // Tile danger baseline by shape.
        let shapeRisk = this.getShapeRisk(tile);
        const stage = Math.max(myDiscards.length, opponentDiscards.length);
        const stageFactor = 1 + Math.max(0, stage - 6) * 0.08;

        // Honor tiles: danger mostly driven by how many are dead.
        if (tile.suit === 'z') {
            if (visibleCount >= 3) {
                shapeRisk = 0.4;
            } else if (visibleCount === 2) {
                shapeRisk = 1.2;
            } else if (visibleCount === 1) {
                shapeRisk = 2.1;
            } else {
                shapeRisk = 3.0;
            }
            return shapeRisk * stageFactor + liveCopies * 0.4;
        }

        let risk = (liveCopies * 1.1 + shapeRisk) * stageFactor;

        const sujiLevel = this.getSujiLevel(tile, opponentDiscards);
        if (sujiLevel === 'double') {
            risk *= 0.5;
        } else if (sujiLevel === 'single') {
            risk *= 0.62;
        }

        // Kabe / one-chance approximation by dead-neighbor counts.
        const neighborDead = this.getMaxNeighborDeadCount(tile, visible);
        if (neighborDead >= 4) {
            risk *= 0.5;
        } else if (neighborDead >= 3) {
            risk *= 0.72;
        }

        // Dora tiles are dangerous to push.
        if (this.isDoraTile(tile, (context.doraIndicators ?? []) as Tile[])) {
            risk += 1.4;
        }
        if (tile.isRed) {
            risk += 0.5;
        }

        return risk;
    }

    private baseTileKey(tile: Tile): string {
        return `${tile.suit}-${tile.rank}`;
    }

    private buildVisibleMap(context: any): Map<string, number> {
        const visible = new Map<string, number>();
        const addVisible = (tiles: Tile[] = []) => {
            for (const t of tiles) {
                const k = this.baseTileKey(t);
                visible.set(k, (visible.get(k) ?? 0) + 1);
            }
        };

        addVisible((context.doraIndicators ?? []) as Tile[]);
        const allDiscards = Object.values((context.discards ?? {}) as Record<string, Tile[]>);
        allDiscards.forEach((discards) => addVisible(discards));
        addVisible(context.hands?.[this.id] ?? []);
        addVisible(context.pools?.[this.id] ?? []);
        return visible;
    }

    private getShapeRisk(tile: Tile): number {
        if (tile.suit === 'z') return 2.0;
        if (tile.rank >= 4 && tile.rank <= 6) return 2.3;
        if (tile.rank === 3 || tile.rank === 7) return 1.8;
        if (tile.rank === 2 || tile.rank === 8) return 1.2;
        return 0.9;
    }

    private getSujiLevel(tile: Tile, opponentDiscards: Tile[]): 'none' | 'single' | 'double' {
        if (tile.suit === 'z') return 'none';

        const ranks = new Set(
            opponentDiscards
                .filter((discarded) => discarded.suit === tile.suit)
                .map((discarded) => discarded.rank)
        );

        const checks: number[] = [];
        if (tile.rank - 3 >= 1) checks.push(tile.rank - 3);
        if (tile.rank + 3 <= 9) checks.push(tile.rank + 3);
        const hitCount = checks.filter((rank) => ranks.has(rank as Tile['rank'])).length;
        if (hitCount >= 2) return 'double';
        if (hitCount === 1) return 'single';
        return 'none';
    }

    private getMaxNeighborDeadCount(tile: Tile, visible: Map<string, number>): number {
        if (tile.suit === 'z') return 0;

        const leftRank = tile.rank - 1;
        const rightRank = tile.rank + 1;
        const counts: number[] = [];
        if (leftRank >= 1) {
            counts.push(visible.get(`${tile.suit}-${leftRank}`) ?? 0);
        }
        if (rightRank <= 9) {
            counts.push(visible.get(`${tile.suit}-${rightRank}`) ?? 0);
        }
        if (counts.length === 0) return 0;
        return Math.max(...counts);
    }

    private isDoraTile(tile: Tile, indicators: Tile[]): boolean {
        if (indicators.length === 0) return false;
        return indicators.some((indicator) => {
            const next = this.nextDora(indicator);
            return next.suit === tile.suit && next.rank === tile.rank;
        });
    }

    private nextDora(indicator: Tile): Tile {
        if (indicator.suit === 'z') {
            if (indicator.rank >= 1 && indicator.rank <= 4) {
                const nextWind = indicator.rank === 4 ? 1 : (indicator.rank + 1);
                return { suit: 'z', rank: nextWind as Tile['rank'], isRed: false };
            }
            const nextDragon = indicator.rank === 7 ? 5 : (indicator.rank + 1);
            return { suit: 'z', rank: nextDragon as Tile['rank'], isRed: false };
        }

        const next = indicator.rank === 9 ? 1 : indicator.rank + 1;
        return { suit: indicator.suit, rank: next as Tile['rank'], isRed: false };
    }
}
