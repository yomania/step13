import { calculateScore, calculateShanten, ScoreOptions } from '@step13/scoring';
import { Tile, Wind } from '@step13/proto';
import { GameContext, GameEvents } from '../messages';
import { RULES, WindSeat } from '../rules';
import { generateTiles, shuffleWithSeed } from '../utils';
import { DealResult, DealerSelection, GameEngine, RoundResult } from './types';

type EngineConfig = {
    scoreOptions: ScoreOptions;
    dealValidationMaxAttempts?: number;
    handSearchShuffles?: number;
    dealValidationDoraSampleSize?: number;
    dealValidationPerPlayerSamples?: number;
    fallbackSearchAttempts?: number;
    fallbackTopK?: number;
    fallbackRandomPickWeight?: number;
};

type HandShapeMetrics = {
    signature: string;
    tripletCount: number;
    pairCount: number;
    sequenceCount: number;
    waitCount: number;
    suitSpread: number;
    honorCount: number;
    templateLike: boolean;
};

type FallbackDealCandidate = {
    deal: DealResult;
    attemptSeed: number;
    profileKey: string;
    handMetrics: HandShapeMetrics[];
    score: number;
};

export function createDefaultEngine({
    scoreOptions,
    dealValidationMaxAttempts = 20,
    handSearchShuffles = 40,
    dealValidationDoraSampleSize = 8,
    dealValidationPerPlayerSamples = 2,
    fallbackSearchAttempts = 400,
    fallbackTopK = 20,
    fallbackRandomPickWeight = 0.35
}: EngineConfig): GameEngine {
    let lastFailedPlayers: string[] = [];

    return {
        buildDealResult(players: string[], seed: number): DealResult {
            for (let attempt = 0; attempt < dealValidationMaxAttempts; attempt++) {
                const attemptSeed = seed + attempt * 7919;
                const deal = buildDealBySeed(players, attemptSeed);
                const failedPlayers = getFailedPlayersForManganValidation(
                    players,
                    deal.dealt,
                    deal.wall,
                    scoreOptions,
                    handSearchShuffles,
                    Math.max(1, dealValidationPerPlayerSamples),
                    Math.max(1, dealValidationDoraSampleSize),
                    attemptSeed
                );
                lastFailedPlayers = failedPlayers;

                if (failedPlayers.length === 0) {
                    return deal;
                }
            }

            const fallbackDeal = buildRandomizedManganFallbackDeal(
                players,
                seed,
                scoreOptions,
                handSearchShuffles,
                Math.max(1, dealValidationPerPlayerSamples),
                Math.max(1, dealValidationDoraSampleSize),
                Math.max(1, fallbackSearchAttempts),
                Math.max(1, fallbackTopK),
                fallbackRandomPickWeight
            );
            if (fallbackDeal) {
                return fallbackDeal;
            }

            throw new Error(
                `[DealValidation] could not satisfy mangan-tenpai for players=${lastFailedPlayers.join(',') || 'unknown'} ` +
                `after initialAttempts=${dealValidationMaxAttempts}, fallbackSearchAttempts=${Math.max(1, fallbackSearchAttempts)} (seed=${seed})`
            );
        },

        selectDealer(players: string[], seed: number): DealerSelection {
            const dealerDice = rollDealerDice(players, seed);
            const dealer = pickDealerFromDice(players, seed, dealerDice);
            return {
                dealer,
                dealerDice,
                seatMap: computeSeatMap(players, dealer)
            };
        },

        getEastPlayer(seatMap: Record<string, WindSeat>): string {
            return Object.keys(seatMap).find((playerId) => seatMap[playerId] === 'EAST') ?? '';
        },

        hasWinningWait(hand: Tile[]): boolean {
            return hasWinningWaitInternal(hand);
        },

        findTenpaiHand(
            tiles: Tile[],
            options?: { doraIndicators?: Tile[]; requireMangan?: boolean }
        ): { hand: Tile[]; pool: Tile[] } {
            const requireMangan = Boolean(options?.requireMangan);
            if (requireMangan) {
                const doraIndicators = options?.doraIndicators ?? [];
                if (tiles.length >= RULES.tiles.handSize) {
                    const directHand = tiles.slice(0, RULES.tiles.handSize);
                    if (isManganTenpai(directHand, doraIndicators, scoreOptions)) {
                        return { hand: directHand, pool: tiles.slice(RULES.tiles.handSize) };
                    }
                }
                const mangan = findManganTenpaiCandidate(tiles, doraIndicators, scoreOptions, handSearchShuffles);
                if (mangan) {
                    return mangan;
                }
            }

            // Use the same win-wait predicate as machine guard to avoid mismatch.
            for (let i = 0; i < 5000; i++) {
                const shuffled = shuffleWithSeed(tiles, i + 1);
                const hand = shuffled.slice(0, RULES.tiles.handSize);
                if (hasWinningWaitInternal(hand)) {
                    return { hand, pool: shuffled.slice(RULES.tiles.handSize) };
                }
            }

            const fallback = [...tiles];
            return {
                hand: fallback.slice(0, RULES.tiles.handSize),
                pool: fallback.slice(RULES.tiles.handSize)
            };
        },

        canSelectDora(context: GameContext, playerId: string, _tileId: string): boolean {
            if (playerId !== context.dealer) {
                return false;
            }
            if ((context.doraIndicators?.length ?? 0) > 0) {
                return false;
            }
            // Accept dealer input as long as there is a selectable wall tile.
            // Some clients may send an empty/stale tileId under reconnect/race conditions.
            return context.wall.length > 0;
        },

        selectDora(context: GameContext, event: Extract<GameEvents, { type: 'SELECT_DORA' }>) {
            const selected = context.wall.find((tile) => tile.id === event.tileId) ?? context.wall[0];
            if (!selected) {
                return {};
            }
            return {
                // Keep wall layout intact so clients can reveal the selected tile in-place.
                wall: context.wall,
                doraIndicators: [selected],
                eventLog: [...context.eventLog, event]
            };
        },

        autoSelectDora(context: GameContext) {
            const selected = context.wall[0];
            if (!selected) {
                return {};
            }
            const timeoutEvent: GameEvents = { type: 'TIMEOUT', playerId: context.dealer, phase: 'DORA_SELECT' };
            const selectEvent: GameEvents = { type: 'SELECT_DORA', playerId: context.dealer, tileId: selected.id ?? '' };
            return {
                // Keep wall layout intact so clients can reveal the selected tile in-place.
                wall: context.wall,
                doraIndicators: [selected],
                eventLog: [...context.eventLog, timeoutEvent, selectEvent]
            };
        },

        canDiscard(context: GameContext, playerId: string, tileId: string): boolean {
            if (context.currentTurn !== playerId) {
                return false;
            }
            const pool = context.pools[playerId] ?? [];
            return pool.some((tile) => tile.id === tileId);
        },

        applyDiscard(context: GameContext, playerId: string, tileId: string): GameContext {
            const pool = context.pools[playerId] ?? [];
            const tile = pool.find((entry) => entry.id === tileId);
            if (!tile) {
                return context;
            }

            const currentDiscards = context.discards[playerId] ?? [];
            const nextPool = pool.filter((entry) => entry.id !== tileId);
            const nextTurn = context.players.find((id) => id !== playerId) ?? null;
            const discardEvent: GameEvents = { type: 'DISCARD', playerId, tileId };

            return {
                ...context,
                pools: {
                    ...context.pools,
                    [playerId]: nextPool
                },
                discards: {
                    ...context.discards,
                    [playerId]: [...currentDiscards, tile]
                },
                currentTurn: nextTurn,
                lastDiscard: { playerId, tile },
                eventLog: [...context.eventLog, discardEvent]
            };
        },

        isDrawReached(context: GameContext): boolean {
            return context.players.every((playerId) => (context.discards[playerId] ?? []).length >= RULES.draw.afterDiscardsEach);
        },

        autoRonWinner(context: GameContext): string | null {
            if (!context.lastDiscard) {
                return null;
            }

            const { playerId: discarderId, tile } = context.lastDiscard;
            const opponentId = context.players.find((id) => id !== discarderId);
            if (!opponentId) {
                return null;
            }

            const hand = context.hands[opponentId];
            if (!hand) {
                return null;
            }
            if (isPlayerFuriten(context, opponentId, hand)) {
                return null;
            }

            const score = calculateScore(hand, tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[opponentId]),
                roundWind: 'EAST'
            });
            if (score.points >= RULES.winConditions.manganMinimumPoints) {
                return opponentId;
            }
            return null;
        },

        canDeclareRon(context: GameContext, playerId: string): boolean {
            if (!context.lastDiscard) {
                return false;
            }
            if (context.lastDiscard.playerId === playerId) {
                return false;
            }
            const hand = context.hands[playerId];
            if (!hand) {
                return false;
            }
            if (isPlayerFuriten(context, playerId, hand)) {
                return false;
            }
            const score = calculateScore(hand, context.lastDiscard.tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[playerId]),
                roundWind: 'EAST'
            });
            return score.points >= RULES.winConditions.manganMinimumPoints;
        },

        resolveRon(context: GameContext, winnerId: string): RoundResult | null {
            if (!context.lastDiscard) {
                return null;
            }
            const loserId = context.lastDiscard.playerId;
            const winResult = calculateScore(context.hands[winnerId], context.lastDiscard.tile, false, context.doraIndicators, {
                ...scoreOptions,
                seatWind: seatToWind(context.seatMap[winnerId]),
                roundWind: 'EAST'
            });

            return {
                winner: winnerId,
                winResult,
                scores: {
                    ...context.scores,
                    [winnerId]: context.scores[winnerId] + winResult.points,
                    [loserId]: context.scores[loserId] - winResult.points
                }
            };
        },

        resolveDraw(context: GameContext): RoundResult {
            const tenpaiPlayers = context.players.filter((playerId) => {
                const hand = context.hands[playerId] ?? [];
                return hasWinningWaitInternal(hand);
            });

            const scores = { ...context.scores };
            if (RULES.draw.notenBappuEnabled && tenpaiPlayers.length === 1) {
                const tenpaiPlayer = tenpaiPlayers[0];
                const notenPlayer = context.players.find((playerId) => playerId !== tenpaiPlayer);
                if (notenPlayer) {
                    scores[tenpaiPlayer] += RULES.draw.notenBappuAmount;
                    scores[notenPlayer] -= RULES.draw.notenBappuAmount;
                }
            }
            return {
                winner: null,
                winResult: null,
                scores
            };
        }
    };
}

function hasWinningWaitInternal(hand: Tile[]): boolean {
    return getWinningWaits(hand).length > 0;
}

function buildDealBySeed(players: string[], seed: number): DealResult {
    const shuffled = shuffleWithSeed(generateTiles(), seed);
    const dealt: Record<string, Tile[]> = {};
    players.forEach((playerId, index) => {
        dealt[playerId] = shuffled.slice(
            index * RULES.tiles.dealTilesPerPlayer,
            (index + 1) * RULES.tiles.dealTilesPerPlayer
        );
    });
    const wallStart = players.length * RULES.tiles.dealTilesPerPlayer;
    const wall = shuffled.slice(wallStart);
    return { dealt, wall };
}

function getFailedPlayersForManganValidation(
    players: string[],
    dealt: Record<string, Tile[]>,
    wall: Tile[],
    scoreOptions: ScoreOptions,
    handSearchShuffles: number,
    sampleCount: number,
    sampleSize: number,
    seed: number
): string[] {
    const validationDoraCandidates = buildUniqueDoraIndicatorCandidates(wall);
    return players.filter((playerId, playerIndex) => {
        const tiles = dealt[playerId] ?? [];
        return !hasManganTenpaiAcrossValidationSamples(
            tiles,
            validationDoraCandidates,
            scoreOptions,
            handSearchShuffles,
            sampleCount,
            sampleSize,
            seed,
            playerId,
            playerIndex
        );
    });
}

function isPlayerFuriten(context: GameContext, playerId: string, hand: Tile[]): boolean {
    const myDiscards = context.discards[playerId] ?? [];
    if (myDiscards.length === 0) {
        return false;
    }
    const myDiscardKeys = new Set(myDiscards.map((tile) => `${tile.suit}-${tile.rank}`));
    return getWinningWaits(hand).some((wait) => myDiscardKeys.has(`${wait.suit}-${wait.rank}`));
}

function getWinningWaits(hand: Tile[]): Tile[] {
    if (hand.length !== RULES.tiles.handSize) {
        return [];
    }
    const waits: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const winTile: Tile = { suit, rank: rank as any, isRed: false };
            if (calculateShanten([...hand, winTile]) === -1) {
                waits.push(winTile);
            }
        }
    }
    return waits;
}

function findManganTenpaiCandidate(
    tiles: Tile[],
    doraIndicators: Tile[],
    scoreOptions: ScoreOptions,
    handSearchShuffles: number
): { hand: Tile[]; pool: Tile[] } | null {
    for (let i = 0; i < handSearchShuffles; i++) {
        const shuffled = shuffleWithSeed(tiles, i + 1);
        const hand = shuffled.slice(0, RULES.tiles.handSize);
        if (!isManganTenpai(hand, doraIndicators, scoreOptions)) {
            continue;
        }
        return { hand, pool: shuffled.slice(RULES.tiles.handSize) };
    }
    return null;
}

function isManganTenpai(hand: Tile[], doraIndicators: Tile[], scoreOptions: ScoreOptions): boolean {
    const waits = getWinningWaits(hand);
    if (waits.length === 0) {
        return false;
    }
    const doraIndicatorSet = new Set(doraIndicators.map((indicator) => `${indicator.suit}-${indicator.rank}`));
    for (const wait of waits) {
        const noDoraScore = calculateScore(hand, wait, false, [], scoreOptions);
        if (noDoraScore.points >= RULES.winConditions.manganMinimumPoints) {
            return true;
        }
        if (doraIndicators.length === 0) {
            continue;
        }

        const effectiveIndicators = buildEffectiveIndicatorsForHandWait(hand, wait, doraIndicatorSet);
        for (const indicator of effectiveIndicators) {
            const score = calculateScore(hand, wait, false, [indicator], scoreOptions);
            if (score.points >= RULES.winConditions.manganMinimumPoints) {
                return true;
            }
        }
    }
    return false;
}

function buildUniqueDoraIndicatorCandidates(tiles: Tile[]): Tile[] {
    const unique = new Map<string, Tile>();
    for (const tile of tiles) {
        const key = `${tile.suit}-${tile.rank}`;
        if (unique.has(key)) {
            continue;
        }
        unique.set(key, { suit: tile.suit, rank: tile.rank, isRed: false });
    }
    return [...unique.values()];
}

function hasManganTenpaiAcrossValidationSamples(
    tiles: Tile[],
    doraCandidates: Tile[],
    scoreOptions: ScoreOptions,
    handSearchShuffles: number,
    sampleCount: number,
    sampleSize: number,
    seed: number,
    playerId: string,
    playerIndex: number
): boolean {
    if (doraCandidates.length === 0) {
        return hasDirectOrShuffledManganTenpai(tiles, [], scoreOptions, handSearchShuffles);
    }

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
        const sampledIndicators = sampleDoraIndicatorsForValidation(
            doraCandidates,
            seed,
            playerId,
            playerIndex,
            sampleIndex,
            sampleSize
        );
        if (hasDirectOrShuffledManganTenpai(tiles, sampledIndicators, scoreOptions, handSearchShuffles)) {
            return true;
        }
    }
    return false;
}

function hasDirectOrShuffledManganTenpai(
    tiles: Tile[],
    doraIndicators: Tile[],
    scoreOptions: ScoreOptions,
    handSearchShuffles: number
): boolean {
    if (tiles.length >= RULES.tiles.handSize) {
        const directHand = tiles.slice(0, RULES.tiles.handSize);
        if (isManganTenpai(directHand, doraIndicators, scoreOptions)) {
            return true;
        }
    }
    return Boolean(findManganTenpaiCandidate(tiles, doraIndicators, scoreOptions, handSearchShuffles));
}

function sampleDoraIndicatorsForValidation(
    doraCandidates: Tile[],
    seed: number,
    playerId: string,
    playerIndex: number,
    sampleIndex: number,
    sampleSize: number
): Tile[] {
    const playerHash = stableStringHash(playerId);
    const shuffled = shuffleWithSeed(
        doraCandidates,
        seed + Math.imul(playerHash, 131) + (playerIndex + 1) * 977 + sampleIndex * 17
    );
    const size = Math.max(1, Math.min(sampleSize, shuffled.length));
    return shuffled.slice(0, size);
}

function buildEffectiveIndicatorsForHandWait(hand: Tile[], wait: Tile, doraIndicatorSet: Set<string>): Tile[] {
    const targets = [...hand, wait];
    const indicators = new Map<string, Tile>();
    for (const tile of targets) {
        const indicator = getIndicatorForDora(tile);
        const key = `${indicator.suit}-${indicator.rank}`;
        if (!doraIndicatorSet.has(key) || indicators.has(key)) {
            continue;
        }
        indicators.set(key, indicator);
    }
    return [...indicators.values()];
}

function getIndicatorForDora(tile: Tile): Tile {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4) {
            const prev = tile.rank === 1 ? 4 : tile.rank - 1;
            return { suit: 'z', rank: prev as Tile['rank'], isRed: false };
        }
        const prev = tile.rank === 5 ? 7 : tile.rank - 1;
        return { suit: 'z', rank: prev as Tile['rank'], isRed: false };
    }
    const prev = tile.rank === 1 ? 9 : tile.rank - 1;
    return { suit: tile.suit, rank: prev as Tile['rank'], isRed: false };
}

function buildRandomizedManganFallbackDeal(
    players: string[],
    seed: number,
    scoreOptions: ScoreOptions,
    handSearchShuffles: number,
    sampleCount: number,
    sampleSize: number,
    fallbackSearchAttempts: number,
    fallbackTopK: number,
    fallbackRandomPickWeight: number
): DealResult | null {
    const candidates: FallbackDealCandidate[] = [];
    const targetCandidateCount = Math.max(
        1,
        Math.min(fallbackSearchAttempts, Math.max(1, fallbackTopK))
    );

    for (let attempt = 0; attempt < fallbackSearchAttempts; attempt++) {
        const attemptSeed = seed + 104729 + attempt * 7919;
        const deal = buildStructuredFallbackDeal(players, attemptSeed);
        if (!deal) {
            continue;
        }
        const failedPlayers = getFailedPlayersForManganValidation(
            players,
            deal.dealt,
            deal.wall,
            scoreOptions,
            handSearchShuffles,
            sampleCount,
            sampleSize,
            attemptSeed
        );
        if (failedPlayers.length > 0) {
            continue;
        }

        const handMetrics = players.map((playerId) => buildHandShapeMetrics(
            deal.dealt[playerId]?.slice(0, RULES.tiles.handSize) ?? []
        ));
        const profileKey = handMetrics.map((metrics) => metrics.signature).join('|');

        candidates.push({
            deal,
            attemptSeed,
            profileKey,
            handMetrics,
            score: 0
        });
        if (candidates.length >= targetCandidateCount) {
            break;
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    const profileFrequency = new Map<string, number>();
    for (const candidate of candidates) {
        profileFrequency.set(candidate.profileKey, (profileFrequency.get(candidate.profileKey) ?? 0) + 1);
    }

    for (const candidate of candidates) {
        const frequency = profileFrequency.get(candidate.profileKey) ?? 1;
        candidate.score = scoreFallbackCandidate(candidate.handMetrics, frequency);
    }

    const ranked = [...candidates].sort((a, b) => (b.score - a.score) || (a.attemptSeed - b.attemptSeed));
    const topCandidates = ranked.slice(0, Math.max(1, Math.min(fallbackTopK, ranked.length)));
    const picked = pickWeightedFallbackCandidate(topCandidates, seed, fallbackRandomPickWeight);
    if (picked) {
        return picked.deal;
    }

    const best = ranked[0];
    if (best) {
        return best.deal;
    }
    return null;
}

function buildStructuredFallbackDeal(players: string[], seed: number): DealResult | null {
    const deck = generateTiles();
    const dealt: Record<string, Tile[]> = {};

    for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const playerId = players[playerIndex];
        const playerSeed = seed + (playerIndex + 1) * 4051 + stableStringHash(playerId);
        let mandatory: Tile[] | null = null;

        for (let variant = 0; variant < 8; variant++) {
            const variantSeed = playerSeed + variant * 137;
            const preferChiitoi = (deterministicUInt(variantSeed, 23) % 2) === 0;
            const preferredArchetype = preferChiitoi ? 'chiitoiHonitsu' : 'toitoi';
            const alternateArchetype = preferChiitoi ? 'toitoi' : 'chiitoiHonitsu';
            const archetype = (variant % 2) === 0 ? preferredArchetype : alternateArchetype;
            mandatory = buildMandatoryFallbackHand(deck, variantSeed, archetype);
            if (mandatory) {
                break;
            }
        }

        if (!mandatory) {
            return null;
        }
        dealt[playerId] = shuffleWithSeed(mandatory, playerSeed + 97);
    }

    const shuffledRest = shuffleWithSeed(deck, seed + 9161);
    for (const playerId of players) {
        const current = dealt[playerId] ?? [];
        const needed = RULES.tiles.dealTilesPerPlayer - current.length;
        if (needed < 0 || shuffledRest.length < needed) {
            return null;
        }
        dealt[playerId] = [...current, ...shuffledRest.splice(0, needed)];
    }

    return { dealt, wall: shuffledRest };
}

function buildMandatoryFallbackHand(
    deck: Tile[],
    seed: number,
    archetype: 'toitoi' | 'chiitoiHonitsu'
): Tile[] | null {
    if (archetype === 'toitoi') {
        const primary = buildToitoiFallbackMandatory(deck, seed + 17);
        if (primary) {
            return primary;
        }
        return buildChiitoitsuHonitsuFallbackMandatory(deck, seed + 53);
    }

    const primary = buildChiitoitsuHonitsuFallbackMandatory(deck, seed + 31);
    if (primary) {
        return primary;
    }
    return buildToitoiFallbackMandatory(deck, seed + 67);
}

function buildToitoiFallbackMandatory(deck: Tile[], seed: number): Tile[] | null {
    const snapshot = [...deck];
    const tripletKinds = pickTileKinds(deck, 4, 3, seed + 11);
    if (!tripletKinds) {
        return null;
    }

    const mandatory: Tile[] = [];
    const tripletKeys = new Set<string>();
    for (const kind of tripletKinds) {
        tripletKeys.add(tileKindKey(kind.suit, kind.rank));
        const pulled = pullTileCopies(deck, kind.suit, kind.rank, 3);
        if (!pulled) {
            restoreDeck(deck, snapshot);
            return null;
        }
        mandatory.push(...pulled);
    }

    const singletonKinds = pickTileKinds(
        deck,
        1,
        1,
        seed + 29,
        (kind) => !tripletKeys.has(tileKindKey(kind.suit, kind.rank))
    );
    if (!singletonKinds) {
        restoreDeck(deck, snapshot);
        return null;
    }

    const singleton = singletonKinds[0];
    const singletonTile = pullTileCopies(deck, singleton.suit, singleton.rank, 1);
    if (!singletonTile) {
        restoreDeck(deck, snapshot);
        return null;
    }
    mandatory.push(...singletonTile);
    return mandatory;
}

function buildChiitoitsuHonitsuFallbackMandatory(deck: Tile[], seed: number): Tile[] | null {
    const baseline = [...deck];
    const suits = shuffleWithSeed(['man', 'pin', 'sou'] as const, seed + 5);

    for (let suitIndex = 0; suitIndex < suits.length; suitIndex++) {
        const suit = suits[suitIndex];
        restoreDeck(deck, baseline);
        const mandatory: Tile[] = [];
        const basePairCount = 3 + (deterministicUInt(seed + suitIndex * 97, 29) % 3);
        const honorPairCount = 6 - basePairCount;

        const basePairs = pickTileKinds(
            deck,
            basePairCount,
            2,
            seed + suitIndex * 131 + 11,
            (kind) => kind.suit === suit
        );
        const honorPairs = pickTileKinds(
            deck,
            honorPairCount,
            2,
            seed + suitIndex * 131 + 43,
            (kind) => kind.suit === 'z'
        );
        if (!basePairs || !honorPairs) {
            continue;
        }

        const usedPairKeys = new Set<string>();
        let failed = false;
        for (const pair of [...basePairs, ...honorPairs]) {
            usedPairKeys.add(tileKindKey(pair.suit, pair.rank));
            const pulled = pullTileCopies(deck, pair.suit, pair.rank, 2);
            if (!pulled) {
                failed = true;
                break;
            }
            mandatory.push(...pulled);
        }
        if (failed) {
            continue;
        }

        const singletonKinds = pickTileKinds(
            deck,
            1,
            1,
            seed + suitIndex * 131 + 79,
            (kind) => (
                (kind.suit === suit || kind.suit === 'z')
                && !usedPairKeys.has(tileKindKey(kind.suit, kind.rank))
            )
        );
        if (!singletonKinds) {
            continue;
        }

        const singleton = singletonKinds[0];
        const pulledSingleton = pullTileCopies(deck, singleton.suit, singleton.rank, 1);
        if (!pulledSingleton) {
            continue;
        }

        mandatory.push(...pulledSingleton);
        if (mandatory.length === RULES.tiles.handSize) {
            return mandatory;
        }
    }

    restoreDeck(deck, baseline);
    return null;
}

function pickTileKinds(
    deck: Tile[],
    kindCount: number,
    minCopies: number,
    seed: number,
    predicate?: (kind: { suit: Tile['suit']; rank: Tile['rank'] }) => boolean
): Array<{ suit: Tile['suit']; rank: Tile['rank'] }> | null {
    const countMap = new Map<string, { suit: Tile['suit']; rank: Tile['rank']; count: number }>();
    for (const tile of deck) {
        const key = tileKindKey(tile.suit, tile.rank);
        const existing = countMap.get(key);
        if (existing) {
            existing.count++;
        } else {
            countMap.set(key, { suit: tile.suit, rank: tile.rank, count: 1 });
        }
    }

    const candidates = [...countMap.values()]
        .filter((entry) => entry.count >= minCopies)
        .map((entry) => ({ suit: entry.suit, rank: entry.rank }))
        .filter((kind) => (predicate ? predicate(kind) : true));
    if (candidates.length < kindCount) {
        return null;
    }
    return shuffleWithSeed(candidates, seed).slice(0, kindCount);
}

function pullTileCopies(
    deck: Tile[],
    suit: Tile['suit'],
    rank: Tile['rank'],
    copies: number
): Tile[] | null {
    const pulled: Tile[] = [];
    for (let count = 0; count < copies; count++) {
        const index = deck.findIndex((tile) => tile.suit === suit && tile.rank === rank);
        if (index < 0) {
            return null;
        }
        const [tile] = deck.splice(index, 1);
        pulled.push(tile);
    }
    return pulled;
}

function tileKindKey(suit: Tile['suit'], rank: Tile['rank']): string {
    return `${suit}-${rank}`;
}

function restoreDeck(deck: Tile[], snapshot: Tile[]) {
    deck.splice(0, deck.length, ...snapshot);
}

function buildHandShapeMetrics(hand: Tile[]): HandShapeMetrics {
    const counts = new Map<string, number>();
    const suitCounts: Record<'man' | 'pin' | 'sou', number[]> = {
        man: Array(10).fill(0),
        pin: Array(10).fill(0),
        sou: Array(10).fill(0)
    };
    let honorCount = 0;

    for (const tile of hand) {
        const key = `${tile.suit}-${tile.rank}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (tile.suit === 'z') {
            honorCount++;
        } else {
            suitCounts[tile.suit][tile.rank] += 1;
        }
    }

    const pairCount = [...counts.values()].filter((count) => count >= 2).length;
    const tripletCount = [...counts.values()].filter((count) => count >= 3).length;
    const suitSpread = (['man', 'pin', 'sou'] as const).filter((suit) => suitCounts[suit].some((count) => count > 0)).length;

    let sequenceCount = 0;
    for (const suit of ['man', 'pin', 'sou'] as const) {
        const bucket = [...suitCounts[suit]];
        for (let rank = 1; rank <= 7; rank++) {
            while (bucket[rank] > 0 && bucket[rank + 1] > 0 && bucket[rank + 2] > 0) {
                sequenceCount++;
                bucket[rank]--;
                bucket[rank + 1]--;
                bucket[rank + 2]--;
            }
        }
    }

    const waitCount = getWinningWaits(hand).length;
    const waitBucket = waitCount === 0 ? '0' : waitCount === 1 ? '1' : waitCount === 2 ? '2' : '3+';
    const singletons = [...counts.values()].filter((count) => count === 1).length;
    const templateLike = tripletCount >= 4 && singletons <= 2 && waitCount <= 2;
    const signature = `t${tripletCount}-p${pairCount}-s${sequenceCount}-h${honorCount}-u${suitSpread}-w${waitBucket}`;

    return {
        signature,
        tripletCount,
        pairCount,
        sequenceCount,
        waitCount,
        suitSpread,
        honorCount,
        templateLike
    };
}

function scoreFallbackCandidate(handMetrics: HandShapeMetrics[], frequency: number): number {
    const rarityBoost = 1 / Math.max(1, frequency);
    const templatePenalty = handMetrics.reduce((sum, metrics) => sum + (metrics.templateLike ? 1 : 0), 0);
    const tripletBias = handMetrics.reduce((sum, metrics) => sum + Math.max(0, metrics.tripletCount - 2), 0) / Math.max(1, handMetrics.length);
    const shapeVariety = new Set(handMetrics.map((metrics) => metrics.signature)).size / Math.max(1, handMetrics.length);
    const waitRichness = handMetrics.reduce((sum, metrics) => sum + Math.min(4, metrics.waitCount), 0) / Math.max(1, handMetrics.length * 4);

    return rarityBoost * 2 + shapeVariety * 0.75 + waitRichness * 0.5 - templatePenalty * 1.75 - tripletBias * 0.5;
}

function pickWeightedFallbackCandidate(
    candidates: FallbackDealCandidate[],
    seed: number,
    fallbackRandomPickWeight: number
): FallbackDealCandidate | null {
    if (candidates.length === 0) {
        return null;
    }
    if (candidates.length === 1) {
        return candidates[0];
    }

    const clampedWeight = Math.max(0, Math.min(1, fallbackRandomPickWeight));
    let minScore = candidates[0].score;
    for (let index = 1; index < candidates.length; index++) {
        minScore = Math.min(minScore, candidates[index].score);
    }

    const weights = candidates.map((candidate) => {
        const qualityWeight = Math.max(0.001, candidate.score - minScore + 0.05);
        return qualityWeight * (1 - clampedWeight) + clampedWeight;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
        return candidates[0];
    }

    let cursor = deterministicUnit(seed, 31337) * totalWeight;
    for (let index = 0; index < candidates.length; index++) {
        cursor -= weights[index];
        if (cursor <= 0) {
            return candidates[index];
        }
    }
    return candidates[candidates.length - 1];
}

function stableStringHash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function rollDealerDice(players: string[], seed: number): Record<string, number> {
    const result: Record<string, number> = {};
    players.forEach((playerId, index) => {
        result[playerId] = deterministicDice(seed, index + 1);
    });
    return result;
}

function deterministicUInt(seed: number, salt: number): number {
    let x = (seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
}

function deterministicUnit(seed: number, salt: number): number {
    return deterministicUInt(seed, salt) / 0x100000000;
}

function deterministicDice(seed: number, salt: number): number {
    return (deterministicUInt(seed, salt) % 6) + 1;
}

function pickDealerFromDice(players: string[], seed: number, dealerDice: Record<string, number>): string {
    const sorted = [...players].sort((a, b) => (dealerDice[b] ?? 0) - (dealerDice[a] ?? 0));
    if (sorted.length < 2) return sorted[0] ?? '';

    if ((dealerDice[sorted[0]] ?? 0) !== (dealerDice[sorted[1]] ?? 0)) {
        return sorted[0];
    }

    const tieBreak = shuffleWithSeed(sorted.slice(0, 2), seed + 99);
    return tieBreak[0] ?? sorted[0];
}

function computeSeatMap(players: string[], dealer: string): Record<string, WindSeat> {
    const other = players.find((playerId) => playerId !== dealer) ?? '';
    return {
        [dealer]: 'EAST',
        [other]: 'WEST'
    };
}

function seatToWind(seat?: WindSeat): Wind | undefined {
    if (seat === 'EAST') return 'EAST';
    if (seat === 'WEST') return 'WEST';
    return undefined;
}
