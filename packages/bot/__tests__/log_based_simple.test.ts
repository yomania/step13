import { describe, it, expect } from 'vitest';
import { Tile } from '@step13/proto';
import { evaluateHandQuality, Difficulty } from '@step13/scoring';
import { BotLogic } from '../src/logic';
import * as fs from 'fs';
import * as path from 'path';

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

function parseTile(id: string): Tile {
    const match = id.match(/([a-z]+)(\d+)/);
    if (!match) throw new Error(`Invalid tile id: ${id}`);
    const suit = match[1] as any;
    const rank = parseInt(match[2], 10) as any;
    return { suit, rank, isRed: false };
}

function loadGameLogs(): GameLog[] {
    const logsDir = path.join(__dirname, 'logs');

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
            const log = JSON.parse(content) as GameLog;
            logs.push(log);
        } catch (error) {
            console.error(`로그 파일 파싱 실패: ${file}`, error);
        }
    }

    return logs;
}

describe('로그 기반 AI vs User 조패 테스트 (간소화)', () => {
    const difficulty: Difficulty = 'HARD';
    const botLogic = new BotLogic('test-bot', difficulty);

    const gameLogs = loadGameLogs();

    if (gameLogs.length === 0) {
        it.skip('로그 파일이 없습니다', () => { });
        return;
    }

    console.log(`\n📋 총 ${gameLogs.length}개의 게임 로그 발견\n`);

    gameLogs.forEach((log, index) => {
        describe(`게임 로그 ${index + 1}: ${log.description}`, () => {
            const playerHand = log.playerHandIds.map(parseTile);
            const dealtTiles = log.dealtTileIds.map(parseTile);
            const doraIndicators = log.doraIndicatorIds.map(parseTile);

            it('AI가 최적 조패를 찾고 User와 비교', () => {
                console.log(`\n🎮 [${log.description}]`);

                // AI 최적 조패 찾기
                const candidates = botLogic.buildBestCandidates(
                    dealtTiles,
                    doraIndicators,
                    3, // 상위 3개만
                    { seatWind: 'EAST', roundWind: 'EAST' },
                    difficulty,
                    0
                );

                expect(candidates.length).toBeGreaterThan(0);

                const aiBest = candidates[0];

                console.log(`\n🤖 AI 최적 조패:`);
                console.log(`   - ${aiBest.score.han}한, ${aiBest.score.points}점`);
                console.log(`   - 역: ${aiBest.score.yaku.join(', ')}`);
                console.log(`   - 대기: ${aiBest.waits.length}개`);

                // Player 조패 평가
                const playerWaits = botLogic.getWinningTiles(playerHand);
                const playerQuality = evaluateHandQuality(playerHand, difficulty, doraIndicators);

                console.log(`\n👤 Player 조패:`);
                console.log(`   - 품질 점수: ${playerQuality}`);
                console.log(`   - 대기: ${playerWaits.length}개`);
                console.log(`   - 기대 역: ${log.expectedResult.expectedYaku?.join(', ') || 'N/A'}`);

                // 검증
                if (log.expectedResult.playerShouldWin) {
                    console.log(`\n✅ 기대: Player가 우수한 조패`);
                    // Player의 기대 한 수 검증
                    if (log.expectedResult.minPlayerHan) {
                        expect(log.expectedResult.minPlayerHan).toBeGreaterThanOrEqual(aiBest.score.han);
                    }
                } else {
                    console.log(`\n✅ 기대: AI가 우수한 조패`);
                    expect(aiBest.score.points).toBeGreaterThan(0);
                }

                // 고득점 패턴 검증
                if (log.expectedResult.expectedYaku) {
                    const hasExpectedYaku = log.expectedResult.expectedYaku.some(yaku =>
                        aiBest.score.yaku.includes(yaku)
                    );
                    console.log(`\n🎯 기대 역 포함 여부: ${hasExpectedYaku ? '✓' : '✗'}`);
                    expect(hasExpectedYaku).toBe(true);
                }
            });
        });
    });

    it('통합: 모든 로그에서 AI가 유효한 조패를 찾는지 검증', () => {
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

        console.log(`\n📊 [통합 테스트 결과]`);
        console.log(`   총 로그 수: ${totalLogs}`);
        console.log(`   성공적인 조패 발견: ${successfulFinds}`);
        console.log(`   성공률: ${totalLogs > 0 ? ((successfulFinds / totalLogs) * 100).toFixed(1) : 0}%`);

        expect(successfulFinds).toBe(totalLogs);
    });
});
