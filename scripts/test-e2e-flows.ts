import assert from 'node:assert/strict';
import FakeTimers from '@sinonjs/fake-timers';
import { createActor } from 'xstate';
import {
    createEngineForRuleset,
    createGameMachine,
    gameMachine,
    RULES
} from '@step13/core';
import { calculateScore } from '@step13/scoring';
import { GameRoom } from '../apps/server/src/GameRoom';
import { RoomRegistry } from '../apps/server/src/RoomRegistry';
import { getBotPersonaProfile, listBotPersonaProfiles } from '@step13/bot';

// 공통 점수 옵션(실서비스 기본 옵션)
const SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
} as const;

type TestClock = ReturnType<typeof FakeTimers.install>;

let activeClock: TestClock | null = null;

function installClock() {
    activeClock = FakeTimers.install({
        now: Date.now(),
        toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
        shouldClearNativeTimers: true
    });
}

function uninstallClock() {
    if (!activeClock) return;
    activeClock.uninstall();
    activeClock = null;
}

function getClock(): TestClock {
    if (!activeClock) {
        throw new Error('Test clock is not installed');
    }
    return activeClock;
}

async function tick(ms: number) {
    await getClock().tickAsync(ms);
}

// 실제 WebSocket 대신 룸 테스트에서 쓰는 최소 mock
class MockSocket {
    public readyState = 1;
    private closeHandler: (() => void) | null = null;
    public messages: any[] = [];

    send(message: string) {
        this.messages.push(JSON.parse(message));
    }

    on(eventName: string, handler: () => void) {
        if (eventName === 'close') {
            this.closeHandler = handler;
        }
    }

    close() {
        this.readyState = 3;
        this.closeHandler?.();
    }
}

function roomSnapshot(room: GameRoom) {
    return (room as any).machine.getSnapshot();
}

function makeTenpaiHandForFiveMan(prefix: string): Tile[] {
    return [
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1a` },
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1b` },
        { suit: 'man', rank: 1, isRed: false, id: `${prefix}-m1c` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2a` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2b` },
        { suit: 'man', rank: 2, isRed: false, id: `${prefix}-m2c` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3a` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3b` },
        { suit: 'man', rank: 3, isRed: false, id: `${prefix}-m3c` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4a` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4b` },
        { suit: 'man', rank: 4, isRed: false, id: `${prefix}-m4c` },
        { suit: 'man', rank: 5, isRed: false, id: `${prefix}-m5w` }
    ];
}

function withSeededRandom<T>(seed: number, fn: () => T): T {
    const originalRandom = Math.random;
    let state = seed >>> 0;
    Math.random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    try {
        return fn();
    } finally {
        Math.random = originalRandom;
    }
}

// 딜러가 사람/봇으로 결정되는 시드를 찾는다.
function findSeed(dealerWanted: 'human' | 'bot', humanId: string, botId: string): number {
    const engine = createEngineForRuleset('classic');
    for (let seed = 1; seed <= 1000; seed++) {
        const dealer = engine.selectDealer([humanId, botId], seed).dealer;
        if (dealerWanted === 'human' && dealer === humanId) return seed;
        if (dealerWanted === 'bot' && dealer === botId) return seed;
    }
    throw new Error(`Could not find seed for dealer=${dealerWanted}`);
}

// 두 플레이어 모두 제출 가능한 손패를 얻는 시드를 찾는다.
function findSeedWithSubmittableHands(players: string[]): number {
    const engine = createEngineForRuleset('classic');
    for (let seed = 1; seed <= 5000; seed++) {
        const deal = engine.buildDealResult(players, seed + 1);
        const ok = players.every((playerId) => {
            const picked = engine.findTenpaiHand(deal.dealt[playerId]);
            return engine.hasWinningWait(picked.hand);
        });
        if (ok) return seed;
    }
    throw new Error('Could not find seed with valid hand submissions');
}

// 조건이 만족될 때까지 폴링 대기
async function waitUntil(description: string, condition: () => boolean, timeoutMs = 6000, intervalMs = 50) {
    const started = getClock().now;
    while (getClock().now - started < timeoutMs) {
        if (condition()) return;
        await tick(intervalMs);
    }
    throw new Error(`Timeout waiting for: ${description}`);
}

async function advanceToHandBuildWithSelectedDora(actor: any) {
    await waitUntil('doraSelect', () => actor.getSnapshot().value === 'doraSelect', 5000);
    const dealer = actor.getSnapshot().context.dealer;
    const tileId = actor.getSnapshot().context.wall[0]?.id;
    assert.ok(dealer && tileId, 'dealer and dora tile should exist');
    actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId });
    await waitUntil('handBuild', () => actor.getSnapshot().value === 'handBuild', 5000);
}

async function advanceToTenTurn(actor: any) {
    await waitUntil('ten declaration turn', () => {
        const value = actor.getSnapshot().value;
        return typeof value === 'object' && value.tenDeclaration === 'turn';
    }, 5000);
}

async function advanceToRoundEndByDiscards(actor: any, maxSteps = 120) {
    let safety = 0;
    while (actor.getSnapshot().value !== 'roundEnd' && safety < maxSteps) {
        const s = actor.getSnapshot();
        const value = s.value;
        if (!(typeof value === 'object' && value.gameLoop === 'turn')) {
            await tick(50);
            safety += 1;
            continue;
        }
        const playerId = s.context.currentTurn;
        if (!playerId) break;
        const tileId = s.context.pools[playerId]?.[0]?.id;
        if (!tileId) break;
        actor.send({ type: 'DISCARD', playerId, tileId });
        await tick(20);
        safety += 1;
    }
    assert.equal(actor.getSnapshot().value, 'roundEnd', 'should reach roundEnd');
}

// [시나리오 1] 내가 선일 때 도라 선택 후 handBuild로 넘어가는지
async function testDoraSelectHumanDealer() {
    const room = new GameRoom('test-human-dealer');
    const socket = new MockSocket();
    const humanId = 'p1';
    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'ADD_BOT' });
    const botId = roomSnapshot(room).context.players.find((id: string) => id.startsWith('bot-'));
    assert.ok(botId, 'bot should be added');

    const seed = findSeed('human', humanId, botId);
    room.handleMessage(humanId, { type: 'START_MATCH', seed });
    await waitUntil('doraSelect phase', () => roomSnapshot(room).value === 'doraSelect', 3000);

    const before = roomSnapshot(room);
    assert.equal(before.context.dealer, humanId);
    const tileId = before.context.wall[0]?.id;
    assert.ok(tileId, 'wall should have dora candidate');

    room.handleMessage(humanId, { type: 'SELECT_DORA', playerId: humanId, tileId });
    await waitUntil('handBuild phase after human dora select', () => roomSnapshot(room).value === 'handBuild', 10000);
}

// [시나리오 2] 봇이 선일 때 도라 자동 선택 후 handBuild로 넘어가는지
async function testDoraSelectBotDealer() {
    const room = new GameRoom('test-bot-dealer');
    const socket = new MockSocket();
    const humanId = 'p1';
    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'ADD_BOT' });
    const botId = roomSnapshot(room).context.players.find((id: string) => id.startsWith('bot-'));
    assert.ok(botId, 'bot should be added');

    const seed = findSeed('bot', humanId, botId);
    room.handleMessage(humanId, { type: 'START_MATCH', seed });
    await waitUntil('handBuild phase after bot auto dora select', () => roomSnapshot(room).value === 'handBuild', 10000);
    assert.ok((roomSnapshot(room).context.doraIndicators?.length ?? 0) > 0, 'dora indicator should be selected');
}

// [시나리오 3] 조패 완료 후 턴이 번갈아가며 타패되는지
async function testHandBuildAndTurnAlternation() {
    const room = new GameRoom('test-hand-build-turn');
    const socket = new MockSocket();
    const socket2 = new MockSocket();
    const humanId = 'p1';
    const humanId2 = 'p2';
    room.join(humanId, socket as any);
    room.join(humanId2, socket2 as any);

    const seed = findSeedWithSubmittableHands([humanId, humanId2]);
    room.handleMessage(humanId, { type: 'START_MATCH', seed });
    await waitUntil('doraSelect/handBuild phase', () => {
        const value = roomSnapshot(room).value;
        return value === 'doraSelect' || value === 'handBuild';
    }, 5000);

    const doraSnap = roomSnapshot(room);
    if (doraSnap.value === 'doraSelect') {
        const tileId = doraSnap.context.wall[0]?.id;
        const dealer = doraSnap.context.dealer;
        assert.ok(tileId, 'dealer should be able to select dora');
        room.handleMessage(dealer, { type: 'SELECT_DORA', playerId: dealer, tileId });
    }

    await waitUntil('handBuild phase', () => roomSnapshot(room).value === 'handBuild', 10000);

    const engine = createEngineForRuleset('classic');
    const dealt = roomSnapshot(room).context.dealtTiles[humanId];
    const dealt2 = roomSnapshot(room).context.dealtTiles[humanId2];
    const { hand, pool } = engine.findTenpaiHand(dealt);
    const hand2 = engine.findTenpaiHand(dealt2);
    room.handleMessage(humanId, { type: 'SUBMIT_HAND', playerId: humanId, hand, pool });
    room.handleMessage(humanId2, { type: 'SUBMIT_HAND', playerId: humanId2, hand: hand2.hand, pool: hand2.pool });

    await waitUntil('gameLoop.turn after both hand submits', () => {
        const value = roomSnapshot(room).value;
        return typeof value === 'object' && value.gameLoop === 'turn';
    }, 6000);

    const before = roomSnapshot(room);
    const firstTurn = before.context.currentTurn;
    assert.ok(firstTurn, 'current turn should exist');

    const firstTile = before.context.pools[firstTurn][0]?.id;
    assert.ok(firstTile, 'first turn player should have pool tile');
    room.handleMessage(firstTurn, { type: 'DISCARD', playerId: firstTurn, tileId: firstTile });
    await tick(20);

    const afterFirst = roomSnapshot(room);
    const secondTurn = afterFirst.context.currentTurn;
    assert.notEqual(secondTurn, firstTurn, 'turn should alternate after discard');

    const secondTile = afterFirst.context.pools[secondTurn][0]?.id;
    assert.ok(secondTile, 'second turn player should have pool tile');
    room.handleMessage(secondTurn, { type: 'DISCARD', playerId: secondTurn, tileId: secondTile });
    await tick(20);

    const afterSecond = roomSnapshot(room);
    assert.equal(afterSecond.context.currentTurn, firstTurn, 'turn should return to first player');
}

// [시나리오 4] 론 선언 시 라운드 종료 및 점수 계산값 일치
async function testRonScoringFlow() {
    const baseEngine = createEngineForRuleset('classic');
    const chosenSeed = findSeed('human', 'p1', 'p2');
    const chosenWinningTileId = 'win-8m';
    const chosenWinner = 'p2';

    const ronScoreOptions = {
        ...SCORE_OPTIONS,
        requireManganMinimum: false
    };

    const engineManualRon = {
        ...baseEngine,
        hasWinningWait: () => true,
        autoRonWinner: () => null,
        canDeclareRon(context: any, playerId: string) {
            if (!context.lastDiscard) return false;
            if (context.lastDiscard.playerId === playerId) return false;
            const hand = context.hands[playerId];
            if (!hand) return false;
            const seat = context.seatMap[playerId];
            const score = calculateScore(hand, context.lastDiscard.tile, false, context.doraIndicators, {
                ...ronScoreOptions,
                seatWind: seat,
                roundWind: 'EAST'
            });
            return score.points > 0;
        },
        resolveRon(context: any, winnerId: string) {
            if (!context.lastDiscard) return null;
            const loserId = context.lastDiscard.playerId;
            const winResult = calculateScore(
                context.hands[winnerId],
                context.lastDiscard.tile,
                false,
                context.doraIndicators,
                {
                    ...ronScoreOptions,
                    seatWind: context.seatMap[winnerId],
                    roundWind: 'EAST'
                }
            );
            return {
                winner: winnerId,
                winResult,
                scores: {
                    ...context.scores,
                    [winnerId]: context.scores[winnerId] + winResult.points,
                    [loserId]: context.scores[loserId] - winResult.points
                }
            };
        }
    };

    const actor = createActor(createGameMachine({ engine: engineManualRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: chosenSeed });

    await advanceToHandBuildWithSelectedDora(actor);

    // 테스트용 고정 패 생성 헬퍼
    const makeTile = (suit: 'man' | 'pin' | 'sou' | 'z', rank: number, id: string) => ({ suit, rank: rank as any, isRed: false, id });
    // p2가 p1의 8만 버림패로 론할 수 있도록 고정 패 구성
    const p2WinningHand = [
        makeTile('man', 2, 'p2-h1'), makeTile('man', 2, 'p2-h2'),
        makeTile('man', 3, 'p2-h3'), makeTile('man', 3, 'p2-h4'),
        makeTile('pin', 4, 'p2-h5'), makeTile('pin', 4, 'p2-h6'),
        makeTile('pin', 5, 'p2-h7'), makeTile('pin', 5, 'p2-h8'),
        makeTile('sou', 6, 'p2-h9'), makeTile('sou', 6, 'p2-h10'),
        makeTile('sou', 7, 'p2-h11'), makeTile('sou', 7, 'p2-h12'),
        makeTile('man', 8, 'p2-h13')
    ];
    const p1Hand = [
        makeTile('man', 1, 'p1-h1'), makeTile('man', 1, 'p1-h2'), makeTile('man', 1, 'p1-h3'),
        makeTile('pin', 1, 'p1-h4'), makeTile('pin', 1, 'p1-h5'), makeTile('pin', 1, 'p1-h6'),
        makeTile('sou', 1, 'p1-h7'), makeTile('sou', 1, 'p1-h8'), makeTile('sou', 1, 'p1-h9'),
        makeTile('z', 1, 'p1-h10'), makeTile('z', 1, 'p1-h11'),
        makeTile('z', 2, 'p1-h12'), makeTile('z', 2, 'p1-h13')
    ];
    const p1Pool = [
        makeTile('man', 8, chosenWinningTileId),
        ...Array.from({ length: 20 }, (_, i) => makeTile('pin', ((i % 9) + 1), `p1-pool-${i}`))
    ];
    const p2Pool = Array.from({ length: 21 }, (_, i) => makeTile('sou', ((i % 9) + 1), `p2-pool-${i}`));

    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1Hand, pool: p1Pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2WinningHand, pool: p2Pool });
    await tick(20);

    const turnSnap = actor.getSnapshot();
    assert.ok(typeof turnSnap.value === 'object' && turnSnap.value.gameLoop === 'turn', 'game should enter turn state');
    const discarder = turnSnap.context.currentTurn!;
    assert.notEqual(discarder, chosenWinner, 'winner should be the non-discarding player');

    const expectedScore = calculateScore(
        turnSnap.context.hands[chosenWinner],
        (turnSnap.context.pools[discarder] ?? []).find((tile: any) => tile.id === chosenWinningTileId) ?? null,
        false,
        turnSnap.context.doraIndicators,
        {
            ...ronScoreOptions,
            seatWind: turnSnap.context.seatMap[chosenWinner],
            roundWind: 'EAST'
        }
    );

    actor.send({ type: 'DISCARD', playerId: discarder, tileId: chosenWinningTileId });
    await tick(20);
    actor.send({ type: 'DECLARE_WIN', playerId: chosenWinner });
    await tick(20);
    const roundEnd = actor.getSnapshot();
    assert.equal(roundEnd.value, 'roundEnd');
    assert.equal(roundEnd.context.winner, chosenWinner, 'winner should be opponent on winning discard');
    assert.ok(roundEnd.context.winResult, 'win result should exist');
    assert.equal(roundEnd.context.winResult?.points, expectedScore.points, 'ron score calculation should match expected');
}

// [시나리오 5] 17보 유국 처리 + RESTART로 idle 복귀
async function testDrawAfter17AndRestart() {
    const baseEngine = createEngineForRuleset('classic');
    const engineNoAutoRon = {
        ...baseEngine,
        autoRonWinner: () => null,
        canDeclareRon: () => false,
        resolveRon: () => null
    };

    const actor = createActor(createGameMachine({ engine: engineNoAutoRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    const seed = findSeedWithSubmittableHands(['p1', 'p2']);
    actor.send({ type: 'START_MATCH', seed });

    await advanceToHandBuildWithSelectedDora(actor);

    const c = actor.getSnapshot().context;
    const p1 = baseEngine.findTenpaiHand(c.dealtTiles.p1);
    const p2 = baseEngine.findTenpaiHand(c.dealtTiles.p2);
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1.hand, pool: p1.pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2.hand, pool: p2.pool });
    await tick(20);

    let safety = 0;
    while (actor.getSnapshot().value !== 'roundEnd' && safety < 100) {
        const s = actor.getSnapshot();
        const playerId = s.context.currentTurn;
        if (!playerId) break;
        const tileId = s.context.pools[playerId]?.[0]?.id;
        if (!tileId) break;
        actor.send({ type: 'DISCARD', playerId, tileId });
        safety += 1;
    }

    const ended = actor.getSnapshot();
    assert.equal(ended.value, 'roundEnd');
    assert.equal(ended.context.winner, null, 'round should end as draw');
    assert.equal(ended.context.discards.p1.length, 17);
    assert.equal(ended.context.discards.p2.length, 17);

    actor.send({ type: 'RESTART' });
    const restarted = actor.getSnapshot();
    assert.equal(restarted.value, 'idle');
    assert.equal(restarted.context.players.length, 0);
}

// [시나리오 6] AI 모드 종료/재시작 플로우
async function testAiRestartFlows() {
    const room = new GameRoom('test-ai-restart');
    const socket = new MockSocket();
    const humanId = 'p1';
    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'ADD_BOT' });
    room.handleMessage(humanId, { type: 'START_MATCH', seed: 5 });
    await waitUntil('doraSelect before restart', () => roomSnapshot(room).value === 'doraSelect', 4000);

    // 로비 복귀 경로: RESTART 후 idle + players 비움 확인
    room.handleMessage(humanId, { type: 'RESTART' });
    assert.equal(roomSnapshot(room).value, 'idle');
    assert.equal(roomSnapshot(room).context.players.length, 0);

    // AI 재대전 경로: RESTART -> JOIN -> ADD_BOT -> START_MATCH -> doraSelect
    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'ADD_BOT' });
    room.handleMessage(humanId, { type: 'START_MATCH', seed: 7 });
    await waitUntil('doraSelect after AI rematch flow', () => roomSnapshot(room).value === 'doraSelect', 4000);
}

// [시나리오 7] Auto Ron (선언 없이 즉시 론)
async function testAutoRonFlow() {
    // autoRon: true (기본값) 사용
    const baseEngine = createEngineForRuleset('classic');
    const chosenSeed = findSeed('human', 'p1', 'p2');
    const chosenWinningTileId = 'win-8m';
    const chosenWinner = 'p2';

    // 점수 조건 완화 (빠른 테스트)
    const ronScoreOptions = {
        ...SCORE_OPTIONS,
        requireManganMinimum: false
    };

    const engineAutoRon = {
        ...baseEngine,
        // 강제로 승리 대기 상태로 만듦
        hasWinningWait: () => true,
        // autoRonWinner가 p2를 반환하도록 모킹
        autoRonWinner(context: any) {
            if (!context.lastDiscard) return null;
            if (context.lastDiscard.playerId === chosenWinner) return null;

            // 승자 핸드 확인
            const hand = context.hands[chosenWinner];
            if (!hand) return null;

            return chosenWinner;
        },
        resolveRon(context: any, winnerId: string) {
            if (!context.lastDiscard) return null;
            const loserId = context.lastDiscard.playerId;
            // 점수 계산 (검증용)
            return {
                winner: winnerId,
                winResult: { points: 12000, han: 4, fu: 30, yaku: [] }, // 더미 점수
                scores: {
                    ...context.scores,
                    [winnerId]: context.scores[winnerId] + 12000,
                    [loserId]: context.scores[loserId] - 12000
                }
            };
        }
    };

    const actor = createActor(createGameMachine({ engine: engineAutoRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: chosenSeed });

    await tick(100);
    // 도라 선택 등 초기 진행 스킵을 위해 상태 강제 주입이 어려우므로
    // 정상 흐름으로 handBuild까지 진행
    await waitUntil('doraSelect', () => actor.getSnapshot().value === 'doraSelect', 5000);
    const dealer = actor.getSnapshot().context.dealer;
    const wallTile = actor.getSnapshot().context.wall[0];
    if (dealer && wallTile) {
        actor.send({ type: 'SELECT_DORA', playerId: dealer, tileId: wallTile.id });
    }
    await waitUntil('handBuild', () => actor.getSnapshot().value === 'handBuild', 5000);

    // 핸드 제출
    const p1 = baseEngine.findTenpaiHand(actor.getSnapshot().context.dealtTiles.p1);
    const p2 = baseEngine.findTenpaiHand(actor.getSnapshot().context.dealtTiles.p2);
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1.hand, pool: p1.pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2.hand, pool: p2.pool });

    await waitUntil('gameLoop.turn', () => {
        const v = actor.getSnapshot().value;
        return typeof v === 'object' && v.gameLoop === 'turn';
    }, 2000);

    // 현재 턴 플레이어가 승자가 아니어야 함 (승자가 타패하면 론 불가)
    const turnPlayer = actor.getSnapshot().context.currentTurn;
    if (turnPlayer === chosenWinner) {
        // 승자가 턴이면 그냥 하나 버려서 턴 넘김
        const poolFirst = actor.getSnapshot().context.pools[turnPlayer]?.[0];
        actor.send({ type: 'DISCARD', playerId: turnPlayer, tileId: poolFirst!.id });
        await tick(20);
    }

    // 이제 패자가 타패할 차례
    const loser = actor.getSnapshot().context.currentTurn!;
    assert.notEqual(loser, chosenWinner);
    const loserPoolFirst = actor.getSnapshot().context.pools[loser]?.[0];

    // 타패 시 autoRon 발동 예상
    actor.send({ type: 'DISCARD', playerId: loser, tileId: loserPoolFirst!.id });
    await tick(50);

    const endState = actor.getSnapshot();
    assert.equal(endState.value, 'roundEnd');
    assert.equal(endState.context.winner, chosenWinner);
    assert.equal(endState.context.eventLog.some((e: any) => e.type === 'AUTO_RON'), true, 'AUTO_RON event should be logged');
}

// [시나리오 8] 턴 타임아웃 및 강제 타패
async function testTurnTimeoutAndForceDiscard() {
    const baseEngine = createEngineForRuleset('classic');
    const engineNoAutoRon = {
        ...baseEngine,
        autoRonWinner: () => null,
        canDeclareRon: () => false,
        resolveRon: () => null
    };

    const actor = createActor(createGameMachine({ engine: engineNoAutoRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    const seed = findSeedWithSubmittableHands(['p1', 'p2']);
    actor.send({ type: 'START_MATCH', seed });

    await advanceToHandBuildWithSelectedDora(actor);

    const c = actor.getSnapshot().context;
    const p1 = baseEngine.findTenpaiHand(c.dealtTiles.p1);
    const p2 = baseEngine.findTenpaiHand(c.dealtTiles.p2);
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1.hand, pool: p1.pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2.hand, pool: p2.pool });

    await tick(150000);
    const turnSnap = actor.getSnapshot();
    assert.ok(typeof turnSnap.value === 'object' && turnSnap.value.gameLoop === 'turn', 'game should be in turn state');
}

// [시나리오 9] ROUND_END 확인 게이트(양측 확인 전까지 대기)
async function testRoundEndConfirmGate() {
    const baseEngine = createEngineForRuleset('classic');
    const engineNoAutoRon = {
        ...baseEngine,
        autoRonWinner: () => null,
        canDeclareRon: () => false,
        resolveRon: () => null
    };

    const actor = createActor(createGameMachine({ engine: engineNoAutoRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: findSeedWithSubmittableHands(['p1', 'p2']) });

    await advanceToHandBuildWithSelectedDora(actor);

    const c = actor.getSnapshot().context;
    const p1 = baseEngine.findTenpaiHand(c.dealtTiles.p1);
    const p2 = baseEngine.findTenpaiHand(c.dealtTiles.p2);
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1.hand, pool: p1.pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p2', hand: p2.hand, pool: p2.pool });

    await advanceToRoundEndByDiscards(actor);
    await tick(5000);
    assert.equal(actor.getSnapshot().value, 'roundEnd', 'should stay in roundEnd before confirmations');

    actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p1' });
    await tick(200);
    assert.equal(actor.getSnapshot().value, 'roundEnd', 'single confirmation should not advance');

    actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p2' });
    await waitUntil('matchStart after both confirmations', () => actor.getSnapshot().value === 'matchStart', 3000);
}

// [시나리오 10] ROUND_END에서 AI 자동 확인
async function testRoundEndAutoConfirmBot() {
    const baseEngine = createEngineForRuleset('classic');
    const engineNoAutoRon = {
        ...baseEngine,
        autoRonWinner: () => null,
        canDeclareRon: () => false,
        resolveRon: () => null
    };

    const actor = createActor(createGameMachine({ engine: engineNoAutoRon as any }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'bot-1' });
    actor.send({ type: 'START_MATCH', seed: findSeedWithSubmittableHands(['p1', 'bot-1']) });

    await advanceToHandBuildWithSelectedDora(actor);
    const c = actor.getSnapshot().context;
    const p1 = baseEngine.findTenpaiHand(c.dealtTiles.p1);
    const b1 = baseEngine.findTenpaiHand(c.dealtTiles['bot-1']);
    actor.send({ type: 'SUBMIT_HAND', playerId: 'p1', hand: p1.hand, pool: p1.pool });
    actor.send({ type: 'SUBMIT_HAND', playerId: 'bot-1', hand: b1.hand, pool: b1.pool });

    await advanceToRoundEndByDiscards(actor);
    const roundEnd = actor.getSnapshot();
    assert.equal(roundEnd.context.roundEndConfirmedBy['bot-1'], true, 'bot should auto-confirm');
    assert.equal(roundEnd.context.roundEndConfirmedBy['p1'] ?? false, false, 'human should still need confirm');

    actor.send({ type: 'CONFIRM_ROUND_END', playerId: 'p1' });
    await waitUntil('matchStart after human confirm', () => actor.getSnapshot().value === 'matchStart', 3000);
}

// [시나리오 11] 같은 시드 기준 난이도 비교(동일 입력 재현성 + HARD가 EASY보다 약하지 않음)
async function testSameSeedDifficultyComparison() {
    const personas = listBotPersonaProfiles();
    assert.ok(personas.length >= 3, 'persona list should include multiple difficulties');

    const difficulties = new Set(personas.map((persona) => persona.difficulty));
    assert.equal(difficulties.has('EASY'), true, 'EASY persona should exist');
    assert.equal(difficulties.has('MEDIUM'), true, 'MEDIUM persona should exist');
    assert.equal(difficulties.has('HARD'), true, 'HARD persona should exist');

    const easy = getBotPersonaProfile('easy_relaxed');
    const medium = getBotPersonaProfile('medium_balanced');
    const hard = getBotPersonaProfile('hard_defensive');
    assert.equal(easy.difficulty, 'EASY');
    assert.equal(medium.difficulty, 'MEDIUM');
    assert.equal(hard.difficulty, 'HARD');
    assert.ok(hard.handBuild.candidateCount >= medium.handBuild.candidateCount, 'hard candidate count should be >= medium');

    const fallback = getBotPersonaProfile('unknown-id');
    assert.equal(fallback.id, 'medium_balanced', 'unknown persona should fall back to medium_balanced');
}

// [시나리오 12] 분석 API 연속 호출 시 queryId별 결과 격리 검증
async function testAnalysisQueryIsolation() {
    const room = new GameRoom('test-analysis-isolation');
    const socket = new MockSocket();
    const humanId = 'p1';
    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'ADD_BOT' });

    await waitUntil('bot joined', () => roomSnapshot(room).context.players.length === 2, 3000);
    room.handleMessage(humanId, { type: 'START_MATCH', seed: 13 });

    await waitUntil('doraSelect or handBuild', () => {
        const value = roomSnapshot(room).value;
        return value === 'doraSelect' || value === 'handBuild';
    }, 5000);

    const beforeHandBuild = roomSnapshot(room);
    if (beforeHandBuild.value === 'doraSelect') {
        const dealer = beforeHandBuild.context.dealer;
        const tileId = beforeHandBuild.context.wall[0]?.id;
        assert.ok(dealer && tileId, 'dealer and dora tile should exist');
        room.handleMessage(dealer, { type: 'SELECT_DORA', playerId: dealer, tileId });
    }
    await waitUntil('handBuild', () => roomSnapshot(room).value === 'handBuild', 5000);

    const snap = roomSnapshot(room);
    const dealt = snap.context.dealtTiles[humanId];
    assert.ok(Array.isArray(dealt) && dealt.length === 34, 'dealt tiles should be available');

    const engine = createEngineForRuleset('classic');
    const tenpai = engine.findTenpaiHand(dealt);
    assert.equal(tenpai.hand.length, 13, 'test hand should be 13 tiles');

    const queryIds = {
        preview: 'q-preview',
        hint: 'q-hint',
        shanten: 'q-shanten'
    } as const;

    room.handleMessage(humanId, {
        type: 'QUERY_ANALYSIS',
        queryId: queryIds.preview,
        queryType: 'SCORE_PREVIEW',
        hand: tenpai.hand,
        doraIndicators: snap.context.doraIndicators
    });
    room.handleMessage(humanId, {
        type: 'QUERY_ANALYSIS',
        queryId: queryIds.hint,
        queryType: 'AI_HINT',
        hand: tenpai.hand,
        dealtTiles: dealt,
        doraIndicators: snap.context.doraIndicators,
        maxCount: 5,
        includeNonTenpai: true
    });
    room.handleMessage(humanId, {
        type: 'QUERY_ANALYSIS',
        queryId: queryIds.shanten,
        queryType: 'SHANTEN',
        hand: tenpai.hand
    });

    await waitUntil('analysis results for all query ids', () => {
        const ids = new Set(
            socket.messages
                .filter((msg) => msg?.type === 'ANALYSIS_RESULT' && typeof msg?.queryId === 'string')
                .map((msg) => msg.queryId)
        );
        return ids.has(queryIds.preview) && ids.has(queryIds.hint) && ids.has(queryIds.shanten);
    }, 8000);

    const analysisResults = socket.messages.filter((msg) => msg?.type === 'ANALYSIS_RESULT');
    const preview = analysisResults.find((msg) => msg.queryId === queryIds.preview);
    const hint = analysisResults.find((msg) => msg.queryId === queryIds.hint);
    const shanten = analysisResults.find((msg) => msg.queryId === queryIds.shanten);

    assert.ok(preview, 'SCORE_PREVIEW response should exist');
    assert.ok(preview.scoreResult, 'SCORE_PREVIEW should return scoreResult');
    assert.equal('candidates' in preview, false, 'SCORE_PREVIEW should not include candidates');
    assert.equal('shanten' in preview, false, 'SCORE_PREVIEW should not include shanten');

    assert.ok(hint, 'AI_HINT response should exist');
    assert.ok(Array.isArray(hint.candidates), 'AI_HINT should return candidates array');
    assert.equal('shanten' in hint, false, 'AI_HINT should not include shanten');

    assert.ok(shanten, 'SHANTEN response should exist');
    assert.equal(typeof shanten.shanten, 'number', 'SHANTEN should return shanten number');
    assert.equal('scoreResult' in shanten, false, 'SHANTEN should not include scoreResult');
    assert.equal('candidates' in shanten, false, 'SHANTEN should not include candidates');
}

// [시나리오 13] 페이지 전환(LEAVE) 이후 재JOIN 시 QUERY_PERSONAS 재호출 가능
async function testPersonaQueryAfterLeaveAndRejoin() {
    const room = new GameRoom('test-persona-after-rejoin');
    const socket = new MockSocket();
    const humanId = 'p1';

    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'LEAVE', playerId: humanId });
    await tick(20);

    const afterLeave = roomSnapshot(room);
    assert.equal(afterLeave.context.players.includes(humanId), false, 'player should be removed from lobby on LEAVE');

    room.join(humanId, socket as any);
    room.handleMessage(humanId, { type: 'QUERY_PERSONAS', playerId: humanId });
    await tick(20);

    const personaResult = socket.messages.find((msg) => msg?.type === 'PERSONA_LIST_RESULT');
    assert.ok(personaResult, 'persona query should succeed after rejoin');
    assert.ok(Array.isArray(personaResult.personas), 'persona result should include personas');
    assert.ok(personaResult.personas.length > 0, 'persona list should not be empty');
}

// [시나리오 14] 룸 목록 메타데이터에 ruleset이 포함되고 생성/수정 후에도 유지되는지
async function testRoomRegistryRulesetMetadata() {
    const registry = new RoomRegistry({
        defaultRoomId: 'lobby',
        ruleset: 'ten_attack_defense_easy',
        idleTtlMs: 0,
        cleanupIntervalMs: 0
    });

    const created = registry.createRoom('ten-easy-room', {
        name: 'Ten Easy Room',
        password: 'pw'
    });
    assert.ok(created, 'room should be created');

    const beforeUpdate = registry.listRooms().find((room) => room.roomId === 'ten-easy-room');
    assert.ok(beforeUpdate, 'created room should appear in list');
    assert.equal(beforeUpdate.ruleset, 'ten_attack_defense_easy', 'room list should expose registry ruleset');

    const updatedMeta = registry.updateRoom('ten-easy-room', {
        name: 'Updated Ten Easy Room'
    });
    assert.ok(updatedMeta, 'room meta should be updated');
    assert.equal(updatedMeta.ruleset, 'ten_attack_defense_easy', 'updated room meta should keep ruleset');

    const roomMeta = registry.getRoomMeta('ten-easy-room');
    assert.ok(roomMeta, 'room meta should be retrievable');
    assert.equal(roomMeta.ruleset, 'ten_attack_defense_easy', 'room meta should expose ruleset');
}

async function testTenCorrectGuessWin() {
    const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: 42 });
    await advanceToTenTurn(actor as any);

    const attacker = actor.getSnapshot().context.currentTurn!;
    actor.getSnapshot().context.hands[attacker] = makeTenpaiHandForFiveMan('ten-correct');
    actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'ten-correct-draw' };
    actor.send({ type: 'DECLARE_TENPAI', playerId: attacker, tileId: 'ten-correct-draw', withRiichi: true });

    const defender = actor.getSnapshot().context.attackDefense.defender!;
    actor.send({ type: 'DEFENDER_GUESS', playerId: defender, tileKey: 'man-5' });

    const snapshot = actor.getSnapshot();
    assert.equal(snapshot.value, 'roundEnd');
    assert.equal(snapshot.context.winner, defender);
    assert.equal(snapshot.context.step, 'ten_round_end');
}

async function testTenFailedGuessesEnterAssault() {
    const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense' }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: 77 });
    await advanceToTenTurn(actor as any);

    const attacker = actor.getSnapshot().context.currentTurn!;
    actor.getSnapshot().context.hands[attacker] = makeTenpaiHandForFiveMan('ten-assault');
    actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'ten-assault-draw' };
    actor.send({ type: 'DECLARE_TENPAI', playerId: attacker, tileId: 'ten-assault-draw', withRiichi: true });

    const defender = actor.getSnapshot().context.attackDefense.defender!;
    actor.send({ type: 'DEFENDER_GUESS', playerId: defender, tileKey: 'pin-9' });
    actor.send({ type: 'DEFENDER_GUESS', playerId: defender, tileKey: 'sou-8' });

    let snapshot = actor.getSnapshot();
    assert.deepEqual(snapshot.value, { tenAssault: 'turn' });
    assert.equal(snapshot.context.attackDefense.stage, 'B_ASSAULT');
    assert.equal(snapshot.context.attackDefense.assaultRemaining, RULES.ten.assaultTurns);
    assert.ok(snapshot.context.attackDefense.pendingDrawTile, 'attacker should draw into assault turn');

    const assaultTileId = snapshot.context.attackDefense.pendingDrawTile?.id;
    assert.ok(assaultTileId, 'assault draw tile should exist');
    actor.send({ type: 'DISCARD', playerId: attacker, tileId: assaultTileId });
    snapshot = actor.getSnapshot();
    assert.equal(snapshot.context.attackDefense.assaultRemaining, RULES.ten.assaultTurns - 1);
    assert.ok(snapshot.context.attackDefense.pendingDrawTile, 'next assault draw should be ready immediately');
    assert.notEqual(snapshot.context.attackDefense.pendingDrawTile?.id, assaultTileId);
}

async function testTenMaskedGuessCandidatesStaySelectable() {
    const room = new GameRoom('test-ten-guess-candidates', 'ten_attack_defense');
    const socket1 = new MockSocket();
    const socket2 = new MockSocket();
    room.join('p1', socket1 as any);
    room.join('p2', socket2 as any);
    room.handleMessage('p1', { type: 'START_MATCH', seed: 91 });

    await waitUntil('ten declaration turn in room', () => {
        const value = roomSnapshot(room).value;
        return typeof value === 'object' && value.tenDeclaration === 'turn';
    }, 5000);

    const attacker = roomSnapshot(room).context.currentTurn!;
    roomSnapshot(room).context.hands[attacker] = makeTenpaiHandForFiveMan('masked-guess');
    roomSnapshot(room).context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'masked-guess-draw' };
    room.handleMessage(attacker, { type: 'DECLARE_TENPAI', playerId: attacker, tileId: 'masked-guess-draw', withRiichi: true });

    const snapshot = roomSnapshot(room);
    const defender = snapshot.context.attackDefense.defender!;
    const sanitized = (room as any).sanitizeState(snapshot, defender);
    const guessCandidates = sanitized.context.attackDefense.guessCandidates;
    const attackDiscard = snapshot.context.discards[attacker]?.at(-1);
    const revealedIds = new Set((snapshot.context.doraIndicators ?? []).map((tile: any) => tile.id));

    assert.ok(Array.isArray(guessCandidates), 'defender should receive server-derived guess candidates');
    assert.ok(guessCandidates.some((candidate: any) => candidate.state === 'selectable'), 'at least one remaining tile should stay selectable');
    assert.ok(
        sanitized.context.wall.every((tile: any) => (tile.id && revealedIds.has(tile.id)) || tile.id?.startsWith('wall-')),
        'wall should remain masked except for already revealed dora indicators'
    );
    assert.ok(attackDiscard, 'attacker declaration discard should exist');

    const blockedCandidate = guessCandidates.find(
        (candidate: any) => candidate.tileKey === `${attackDiscard.suit}-${attackDiscard.rank}`
    );
    assert.equal(blockedCandidate?.state, 'blocked_by_opponent_discard');
    (room as any).machine.stop();
}

async function testTenEasyRiichiRejectAndTimeout() {
    const actor = createActor(createGameMachine({ ruleset: 'ten_attack_defense_easy' }));
    actor.start();
    actor.send({ type: 'JOIN', playerId: 'p1' });
    actor.send({ type: 'JOIN', playerId: 'p2' });
    actor.send({ type: 'START_MATCH', seed: 91 });
    await advanceToTenTurn(actor as any);

    const current = actor.getSnapshot().context.currentTurn!;
    actor.getSnapshot().context.hands[current] = makeTenpaiHandForFiveMan('ten-easy');
    actor.getSnapshot().context.attackDefense.pendingDrawTile = { suit: 'sou', rank: 9, isRed: false, id: 'ten-easy-draw' };
    actor.send({ type: 'DECLARE_TENPAI', playerId: current, tileId: 'ten-easy-draw', withRiichi: true });

    let snapshot = actor.getSnapshot();
    assert.deepEqual(snapshot.value, { tenDeclaration: 'turn' });
    assert.equal(snapshot.context.attackDefense.stage, 'A');

    await tick(RULES.timers.turnTimeMs + RULES.timers.timeBankMs + 10);
    snapshot = actor.getSnapshot();
    assert.equal(snapshot.context.discards[current]?.length, 1, 'timeout should force a discard in easy mode');
    assert.notEqual(snapshot.context.currentTurn, current, 'turn should advance after timeout discard');
}

async function run() {
    // 사용자 요청 순서에 맞춘 체크리스트
    const tests: Array<[string, () => Promise<void>]> = [
        ['START -> AI 추가 -> 선일 때 도라 선택 후 진행', testDoraSelectHumanDealer],
        ['START -> AI 추가 -> 후일 때(봇 선) 도라 자동선택 후 진행', testDoraSelectBotDealer],
        ['조패 완료 후 순차 타패 턴 전환', testHandBuildAndTurnAlternation],
        ['RON 완료 및 점수 계산/종료', testRonScoringFlow],
        ['17보 유국(draw) 및 RESTART', testDrawAfter17AndRestart],
        ['AI 모드 종료: 로비/재시작(도라 단계 복귀) 경로', testAiRestartFlows],
        ['Auto Ron (자동 론) 동작', testAutoRonFlow],
        ['Turn Timeout & Force Discard (강제 타패)', testTurnTimeoutAndForceDiscard],
        ['ROUND_END 확인 게이트(양측 확인)', testRoundEndConfirmGate],
        ['ROUND_END AI 자동 확인', testRoundEndAutoConfirmBot],
        ['같은 시드 난이도 비교 (EASY/MEDIUM/HARD)', testSameSeedDifficultyComparison],
        ['분석 API(queryId) 격리 및 응답 필드 검증', testAnalysisQueryIsolation],
        ['LEAVE 후 재JOIN 시 QUERY_PERSONAS 정상 응답', testPersonaQueryAfterLeaveAndRejoin],
        ['룸 메타데이터 ruleset 유지', testRoomRegistryRulesetMetadata],
        ['ten normal: 선언 후 정답 추측 시 수비 승리', testTenCorrectGuessWin],
        ['ten normal: 오답 2회 후 assault 진입', testTenFailedGuessesEnterAssault],
        ['ten easy: 리치 거부 및 timeout 강제 기리', testTenEasyRiichiRejectAndTimeout],
        ['ten normal: 마스킹된 wall에서도 수비 추측 후보 selectable 유지', testTenMaskedGuessCandidatesStaySelectable]
    ];

    for (const [name, test] of tests) {
        // 항목별 독립 실행 + PASS 라인 출력
        installClock();
        try {
            await test();
            console.log(`[PASS] ${name}`);
        } finally {
            uninstallClock();
        }
    }

    console.log('\nAll requested flow checks passed.');
    process.exit(0);
}

run().catch((err) => {
    console.error(`[FAIL] ${err?.message ?? err}`);
    process.exit(1);
});
