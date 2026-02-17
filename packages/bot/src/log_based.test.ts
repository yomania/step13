import { describe, it, expect } from 'vitest';
import { Tile } from '@step13/proto';
import { evaluateHandQuality, Difficulty } from '@step13/scoring';
import { BotLogic } from './logic';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 게임 로그 인터페이스
 */
interface GameLog {
    description: string;
    playerHandIds: string[];
    aiHandIds: string[];
    dealtTileIds: string[];
    doraIndicatorIds: string[];
    expectedResult: {
        playerShouldWin?: boolean;
        minPlayerHan?: number;
        minAiHan?: number;
        expectedYaku?: string[];
    };
}

function isGameLog(value: unknown): value is GameLog {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<GameLog>;
    return Array.isArray(candidate.playerHandIds)
        && Array.isArray(candidate.aiHandIds)
        && Array.isArray(candidate.dealtTileIds)
        && Array.isArray(candidate.doraIndicatorIds)
        && typeof candidate.expectedResult === 'object'
        && candidate.expectedResult !== null;
}

/**
 * 타일 ID를 Tile 객체로 파싱
 * @param id - "pin1", "z6", "man5" 형식의 타일 ID
 */
function parseTile(id: string): Tile {
    const match = id.match(/([a-z]+)(\d+)/);
    if (!match) throw new Error(`Invalid tile id: ${id}`);
    const suit = match[1] as any;
    const rank = parseInt(match[2], 10) as any;
    return { suit, rank, isRed: false };
}

/**
 * 로그 디렉토리에서 모든 JSON 로그 파일 읽기
 */
function loadGameLogs(): GameLog[] {
    const logsDir = path.join(__dirname, '../test-data/logs');

    if (!fs.existsSync(logsDir)) {
        console.warn(`로그 디렉토리가 존재하지 않습니다: ${logsDir}`);
        return [];
    }

    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.json'));
    const logs: GameLog[] = [];

    for (const file of files) {
        const filePath = path.join(logsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
            const parsed = JSON.parse(content) as unknown;
            if (!isGameLog(parsed)) {
                console.warn(`로그 스키마가 달라 건너뜁니다: ${file}`);
                continue;
            }
            const log = parsed as GameLog;
            logs.push(log);
        } catch (error) {
            console.error(`로그 파일 파싱 실패: ${file}`, error);
        }
    }

    return logs;
}

describe('로그 기반 AI vs User 조패 테스트', () => {
    const difficulty: Difficulty = 'HARD';
    const botLogic = new BotLogic('test-bot', difficulty);

    const gameLogs = loadGameLogs();

    if (gameLogs.length === 0) {
        it.skip('로그 파일이 없습니다', () => { });
        return;
    }

    gameLogs.forEach((log, index) => {
        describe(`게임 로그 ${index + 1}: ${log.description}`, () => {
            const playerHand = log.playerHandIds.map(parseTile);
            const aiHand = log.aiHandIds.map(parseTile);
            const dealtTiles = log.dealtTileIds.map(parseTile);
            const doraIndicators = log.doraIndicatorIds.map(parseTile);

            it('Player와 AI의 직접 핸드 점수 비교', () => {
                const playerScore = evaluateHandQuality(playerHand, difficulty, doraIndicators);
                const aiScore = evaluateHandQuality(aiHand, difficulty, doraIndicators);

                console.log(`\n[${log.description}]`);
                console.log(`Player Hand Quality: ${playerScore}`);
                console.log(`AI Hand Quality: ${aiScore}`);

                if (log.expectedResult.playerShouldWin) {
                    expect(playerScore).toBeGreaterThan(aiScore);
                }
            });

            it('AI가 dealt tiles로부터 최적의 조패를 찾는지 검증', () => {
                const candidates = botLogic.buildBestCandidates(
                    dealtTiles,
                    doraIndicators,
                    8,
                    { seatWind: 'EAST', roundWind: 'EAST' },
                    difficulty,
                    0
                );

                console.log(`\n[${log.description}] - AI 후보 조패`);
                console.log(`총 ${candidates.length}개의 후보 발견`);

                candidates.slice(0, 3).forEach((c, idx) => {
                    console.log(`  후보 ${idx + 1}: ${c.score.han}한, ${c.score.points}점`);
                    console.log(`    역: ${c.score.yaku.join(', ')}`);
                    console.log(`    대기: ${c.waits.length}개`);
                });

                expect(candidates.length).toBeGreaterThan(0);

                const bestCandidate = candidates[0];

                // 최소 한 수 검증
                if (log.expectedResult.minAiHan !== undefined) {
                    expect(bestCandidate.score.han).toBeGreaterThanOrEqual(log.expectedResult.minAiHan);
                }

                // 기대 역 검증
                if (log.expectedResult.expectedYaku && log.expectedResult.expectedYaku.length > 0) {
                    const hasExpectedYaku = log.expectedResult.expectedYaku.some(yaku =>
                        bestCandidate.score.yaku.includes(yaku)
                    );
                    expect(hasExpectedYaku).toBe(true);
                }
            });

            it('AI 조패가 User 조패보다 우수한지 검증', () => {
                // AI 최적 조패 찾기
                const aiCandidates = botLogic.buildBestCandidates(
                    dealtTiles,
                    doraIndicators,
                    1,
                    { seatWind: 'EAST', roundWind: 'EAST' },
                    difficulty,
                    0
                );

                expect(aiCandidates.length).toBeGreaterThan(0);

                const aiBest = aiCandidates[0];

                // Player 조패 평가
                const playerWaits = botLogic.getWinningTiles(playerHand);

                console.log(`\n[${log.description}] - 최종 비교`);
                console.log(`Player: ${playerWaits.length}개 대기, 역: ${log.expectedResult.expectedYaku?.join(', ') || 'N/A'}`);
                console.log(`AI Best: ${aiBest.waits.length}개 대기, ${aiBest.score.han}한, ${aiBest.score.points}점`);
                console.log(`AI 역: ${aiBest.score.yaku.join(', ')}`);

                // 기대 결과에 따라 검증
                if (log.expectedResult.playerShouldWin) {
                    // Player가 이겨야 하는 경우
                    if (log.expectedResult.minPlayerHan) {
                        // Player의 기대 한 수가 AI보다 높아야 함
                        expect(log.expectedResult.minPlayerHan).toBeGreaterThanOrEqual(aiBest.score.han);
                    }
                } else {
                    // AI가 이겨야 하는 경우
                    expect(aiBest.score.points).toBeGreaterThan(0);
                    if (playerWaits.length > 0) {
                        // Player도 텐파이인 경우, AI가 더 높은 점수를 가져야 함
                        const playerQuality = evaluateHandQuality(playerHand, difficulty, doraIndicators);
                        const aiQuality = evaluateHandQuality(aiBest.hand, difficulty, doraIndicators);
                        expect(aiQuality).toBeGreaterThanOrEqual(playerQuality);
                    }
                }
            });

            it('AI가 Honitsu/Chinitsu 같은 고득점 패턴을 인식하는지 검증', () => {
                if (!log.expectedResult.expectedYaku) return;

                const highValueYaku = ['Honitsu', 'Chinitsu', 'Toitoi', 'Sanankou'];
                const hasHighValueYaku = log.expectedResult.expectedYaku.some(yaku =>
                    highValueYaku.includes(yaku)
                );

                if (!hasHighValueYaku) return;

                const candidates = botLogic.buildBestCandidates(
                    dealtTiles,
                    doraIndicators,
                    5,
                    { seatWind: 'EAST', roundWind: 'EAST' },
                    difficulty,
                    0
                );

                const foundHighValue = candidates.some(c =>
                    c.score.yaku.some(yaku => highValueYaku.includes(yaku))
                );

                console.log(`\n[${log.description}] - 고득점 패턴 인식`);
                console.log(`기대 역: ${log.expectedResult.expectedYaku.join(', ')}`);
                console.log(`AI가 고득점 패턴 발견: ${foundHighValue ? '예' : '아니오'}`);

                if (log.expectedResult.playerShouldWin) {
                    expect(foundHighValue).toBe(true);
                }
            });
        });
    });

    it('통합 테스트: 모든 로그에서 AI가 유효한 조패를 찾는지 검증', () => {
        let totalLogs = 0;
        let successfulFinds = 0;

        gameLogs.forEach(log => {
            totalLogs++;
            const dealtTiles = log.dealtTileIds.map(parseTile);
            const doraIndicators = log.doraIndicatorIds.map(parseTile);

            const candidates = botLogic.buildBestCandidates(
                dealtTiles,
                doraIndicators,
                1,
                { seatWind: 'EAST', roundWind: 'EAST' },
                difficulty,
                0
            );

            if (candidates.length > 0 && candidates[0].waits.length > 0) {
                successfulFinds++;
            }
        });

        console.log(`\n[통합 테스트 결과]`);
        console.log(`총 로그 수: ${totalLogs}`);
        console.log(`성공적인 조패 발견: ${successfulFinds}`);
        console.log(`성공률: ${totalLogs > 0 ? ((successfulFinds / totalLogs) * 100).toFixed(1) : 0}%`);

        expect(successfulFinds).toBe(totalLogs);
    });
});
