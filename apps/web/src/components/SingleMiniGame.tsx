import { useEffect, useRef, useState } from 'react';
import { Tile } from '@step13/proto';
import { HandBuilder } from './HandBuilder';
import { Tile as TileView } from './Tile';
import { CandidateEvaluation, buildBestCandidates, evaluatePotentialScore, getWinningTiles, scoreCandidateForRate } from '../lib/handAnalysis';

type MiniRound = {
    dealtTiles: Tile[];
    doraIndicators: Tile[];
};

type MiniResult = {
    player: {
        hand: Tile[];
        waits: Tile[];
        han: number;
        points: number;
        yaku: string[];
        bestWait: Tile | null;
    };
    ai: {
        hand: Tile[];
        waits: Tile[];
        han: number;
        points: number;
        yaku: string[];
        bestWait: Tile | null;
    };
    rate: number;
    description: string;
    gaveUp?: boolean;
};

type MiniHistoryEntry = {
    id: string;
    round: number;
    createdAt: number;
    roundData: MiniRound;
    result: MiniResult;
};

const SINGLE_MINI_GAME_HISTORY_KEY = 'single-mini-game-history-v1';

function createTileDeck(): Tile[] {
    const tiles: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            for (let copy = 0; copy < 4; copy++) {
                tiles.push({
                    suit,
                    rank: rank as Tile['rank'],
                    isRed: false,
                    id: `${suit}${rank}-${copy}`
                });
            }
        }
    }
    return tiles;
}

function shuffle<T>(arr: T[]): T[] {
    const copied = [...arr];
    for (let i = copied.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
}

function createMiniRound(): MiniRound {
    const shuffled = shuffle(createTileDeck());
    return {
        dealtTiles: shuffled.slice(0, 34),
        doraIndicators: [shuffled[34]]
    };
}

function buildDescription(
    player: { han: number; waits: number; points: number },
    ai: { han: number; waits: number; points: number },
    rate: number
): string {
    const hanDiff = player.han - ai.han;
    const waitDiff = player.waits - ai.waits;
    if (rate >= 100) {
        return `AI 기준을 넘겼습니다. 판수 ${hanDiff >= 0 ? '+' : ''}${hanDiff}, 대기수 ${waitDiff >= 0 ? '+' : ''}${waitDiff}로 우세했습니다.`;
    }
    return `AI 기준 대비 ${100 - rate}% 부족합니다. 판수 ${hanDiff >= 0 ? '+' : ''}${hanDiff}, 대기수 ${waitDiff >= 0 ? '+' : ''}${waitDiff}, 점수 ${player.points - ai.points >= 0 ? '+' : ''}${player.points - ai.points} 차이입니다.`;
}

function sortTiles(tiles: Tile[]): Tile[] {
    return [...tiles].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });
}

function tileLabel(tile: Tile): string {
    const suitMap: Record<Tile['suit'], string> = {
        man: '만',
        pin: '통',
        sou: '삭',
        z: '자'
    };
    if (tile.suit === 'z') {
        const honors = ['동', '남', '서', '북', '백', '발', '중'];
        return honors[tile.rank - 1];
    }
    return `${tile.rank}${suitMap[tile.suit]}`;
}

function tileKey(tile: Tile): string {
    return `${tile.suit}${tile.rank}`;
}

function parseTileKey(key: string): Tile {
    const suit = key.slice(0, key.length - 1) as Tile['suit'];
    const rank = Number(key.slice(-1)) as Tile['rank'];
    return { suit, rank, isRed: false };
}

function countTiles(tiles: Tile[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const tile of tiles) {
        const key = tileKey(tile);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

function nextDoraFromIndicator(tile: Tile): { suit: Tile['suit']; rank: number } {
    if (tile.suit === 'z') {
        if (tile.rank >= 1 && tile.rank <= 4) return { suit: 'z', rank: tile.rank === 4 ? 1 : tile.rank + 1 };
        if (tile.rank >= 5 && tile.rank <= 7) return { suit: 'z', rank: tile.rank === 7 ? 5 : tile.rank + 1 };
    }
    return { suit: tile.suit, rank: tile.rank === 9 ? 1 : tile.rank + 1 };
}

function toKoreanYakuName(yaku: string): string {
    if (yaku.startsWith('Dora ')) return yaku.replace('Dora', '도라');
    if (yaku.startsWith('Yakuhai')) {
        const honor = yaku.split(': ')[1] ?? '';
        const honorMap: Record<string, string> = {
            z1: '동',
            z2: '남',
            z3: '서',
            z4: '북',
            z5: '백',
            z6: '발',
            z7: '중'
        };
        if (yaku.startsWith('Yakuhai(Seat):')) return `자풍패(${honorMap[honor] ?? honor})`;
        if (yaku.startsWith('Yakuhai(Round):')) return `장풍패(${honorMap[honor] ?? honor})`;
        return `역패(${honorMap[honor] ?? honor})`;
    }
    const map: Record<string, string> = {
        Chiitoitsu: '치또이츠',
        Pinfu: '핑후',
        SanshokuDoukou: '삼색동각',
        SanshokuDoujun: '삼색동순',
        Toitoi: '또이또이',
        Sanankou: '삼암각',
        Chanta: '찬타',
        Junchan: '준찬',
        Honroutou: '혼노두',
        Shousangen: '소삼원',
        Tanyao: '탕야오',
        Chinitsu: '청일색',
        Honitsu: '혼일색',
        Ittsuu: '일기통관',
        Iipeikou: '이페코',
        'Riichi (Auto)': '리치(자동)'
    };
    return map[yaku] ?? yaku;
}

function yakuDetailText(yaku: string, hand: Tile[], waits: Tile[], doraIndicators: Tile[]): string {
    const all = [...hand, ...waits];

    if (yaku.startsWith('Dora ')) {
        const doraTiles = doraIndicators
            .map(nextDoraFromIndicator)
            .flatMap((dora) => all.filter((tile) => tile.suit === dora.suit && tile.rank === dora.rank))
            .map(tileLabel);
        return doraTiles.length > 0 ? doraTiles.join(', ') : '도라 패';
    }

    if (yaku.startsWith('Yakuhai')) {
        const target = yaku.split(': ')[1] ?? '';
        const honorMap: Record<string, string> = {
            z1: '동',
            z2: '남',
            z3: '서',
            z4: '북',
            z5: '백',
            z6: '발',
            z7: '중'
        };
        const matched = all.filter((tile) => `${tile.suit}${tile.rank}` === target).map(tileLabel);
        return matched.length > 0 ? matched.join(', ') : honorMap[target] ?? target;
    }

    if (yaku === 'Chiitoitsu') {
        const counts = new Map<string, number>();
        for (const tile of all) {
            const key = `${tile.suit}-${tile.rank}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const pairs = [...counts.entries()]
            .filter(([, count]) => count >= 2)
            .map(([key]) => {
                const [suit, rank] = key.split('-');
                return tileLabel({ suit: suit as Tile['suit'], rank: Number(rank) as Tile['rank'], isRed: false });
            });
        return pairs.length > 0 ? pairs.join(', ') : '또이츠 구성';
    }
    if (yaku === 'Pinfu') return '평화형(순자 4세트 + 비역패 머리)';
    if (yaku === 'SanshokuDoukou') return '만/통/삭 동일 숫자 각 3장';
    if (yaku === 'SanshokuDoujun') return '만/통/삭 동일 순자';
    if (yaku === 'Toitoi') return '모든 몸통이 각자/암각';
    if (yaku === 'Sanankou') return '암각 3개 이상';
    if (yaku === 'Chanta') return '모든 몸통/머리에 요구패 또는 자패 포함';
    if (yaku === 'Junchan') return '모든 몸통/머리에 요구패 포함(자패 없음)';
    if (yaku === 'Honroutou') return '요구패/자패로만 구성';
    if (yaku === 'Shousangen') return '삼원패 2각 + 삼원패 머리';

    if (yaku === 'Tanyao') return '2~8 수패 중심';
    if (yaku === 'Chinitsu') return '한 가지 수패로 구성';
    if (yaku === 'Honitsu') return '한 가지 수패 + 자패';
    if (yaku === 'Ittsuu') return '123456789 일통 형태';
    if (yaku === 'Iipeikou') return '동일 순자 2세트';
    if (yaku === 'Riichi (Auto)') return '자동 리치 적용';

    return '구성 패';
}

function refinedYakuDetailText(yaku: string, hand: Tile[], bestWait: Tile | null, doraIndicators: Tile[]): string {
    const completed = bestWait ? [...hand, bestWait] : [...hand];
    const counts = countTiles(completed);

    if (yaku.startsWith('Dora ')) {
        const doraTiles = doraIndicators
            .map(nextDoraFromIndicator)
            .flatMap((dora) => completed.filter((tile) => tile.suit === dora.suit && tile.rank === dora.rank))
            .map(tileLabel);
        return doraTiles.length > 0 ? doraTiles.join(', ') : '도라 패';
    }

    if (yaku.startsWith('Yakuhai')) {
        const target = yaku.split(': ')[1] ?? '';
        const matched = completed.filter((tile) => tileKey(tile) === target).map(tileLabel);
        return matched.length > 0 ? matched.join(', ') : '역패';
    }

    if (yaku === 'Chiitoitsu') {
        const pairs = Object.entries(counts)
            .filter(([, count]) => count >= 2)
            .map(([key]) => `${tileLabel(parseTileKey(key))}x2`);
        return pairs.length > 0 ? pairs.join(', ') : '또이츠 구성';
    }
    if (yaku === 'Pinfu') return '평화형(순자 4세트 + 비역패 머리)';
    if (yaku === 'SanshokuDoukou') return '만/통/삭 동일 숫자 각 3장';
    if (yaku === 'SanshokuDoujun') return '만/통/삭 동일 순자';
    if (yaku === 'Toitoi') return '모든 몸통이 각자/암각';
    if (yaku === 'Sanankou') return '암각 3개 이상';
    if (yaku === 'Chanta') return '모든 몸통/머리에 요구패 또는 자패 포함';
    if (yaku === 'Junchan') return '모든 몸통/머리에 요구패 포함(자패 없음)';
    if (yaku === 'Honroutou') return '요구패/자패로만 구성';
    if (yaku === 'Shousangen') return '삼원패 2각 + 삼원패 머리';

    if (yaku === 'Tanyao') {
        const middle = completed.filter((tile) => tile.suit !== 'z' && tile.rank >= 2 && tile.rank <= 8).map(tileLabel);
        return middle.length > 0 ? middle.join(', ') : '2~8 수패 중심';
    }

    if (yaku === 'Chinitsu' || yaku === 'Honitsu') {
        const suits = completed.filter((tile) => tile.suit !== 'z').map((tile) => tile.suit);
        const majorSuit = suits[0];
        const suitName: Record<Tile['suit'], string> = { man: '만', pin: '통', sou: '삭', z: '자' };
        return majorSuit ? `${suitName[majorSuit]}패 중심` : '한 가지 수패 중심';
    }

    if (yaku === 'Ittsuu') {
        for (const suit of ['man', 'pin', 'sou'] as const) {
            const hasAll = Array.from({ length: 9 }).every((_, i) => (counts[`${suit}${i + 1}`] ?? 0) >= 1);
            if (hasAll) {
                const suitName: Record<typeof suit, string> = { man: '만', pin: '통', sou: '삭' };
                return `1${suitName[suit]}~9${suitName[suit]}`;
            }
        }
        return '123456789 일통 형태';
    }

    if (yaku === 'Iipeikou') {
        for (const suit of ['man', 'pin', 'sou'] as const) {
            for (let start = 1; start <= 7; start++) {
                if (
                    (counts[`${suit}${start}`] ?? 0) >= 2 &&
                    (counts[`${suit}${start + 1}`] ?? 0) >= 2 &&
                    (counts[`${suit}${start + 2}`] ?? 0) >= 2
                ) {
                    const seq = [
                        tileLabel({ suit, rank: start as Tile['rank'], isRed: false }),
                        tileLabel({ suit, rank: (start + 1) as Tile['rank'], isRed: false }),
                        tileLabel({ suit, rank: (start + 2) as Tile['rank'], isRed: false })
                    ];
                    return `${seq.join(', ')} x2`;
                }
            }
        }
        return '동일 순자 2세트';
    }

    if (yaku === 'Riichi (Auto)') return '자동 리치 적용';

    return yakuDetailText(yaku, hand, bestWait ? [bestWait] : [], doraIndicators);
}

function shouldHideYakuDetail(yaku: string): boolean {
    return yaku === 'Tanyao' || yaku === 'Pinfu';
}

function readMiniHistory(): MiniHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.sessionStorage.getItem(SINGLE_MINI_GAME_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as MiniHistoryEntry[];
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch {
        return [];
    }
}

function writeMiniHistory(entries: MiniHistoryEntry[]) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SINGLE_MINI_GAME_HISTORY_KEY, JSON.stringify(entries));
}

interface SingleMiniGameProps {
    onExit: () => void;
}

export function SingleMiniGame({ onExit }: SingleMiniGameProps) {
    const [round, setRound] = useState(1);
    const [currentRound, setCurrentRound] = useState<MiniRound>(() => createMiniRound());
    const [result, setResult] = useState<MiniResult | null>(null);
    const [history, setHistory] = useState<MiniHistoryEntry[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [aiPrefetch, setAiPrefetch] = useState<CandidateEvaluation | null>(null);
    const [isPreloading, setIsPreloading] = useState(true);
    const workerRef = useRef<Worker | null>(null);
    const requestIdRef = useRef(0);
    const pendingResolversRef = useRef(new Map<number, (candidate: CandidateEvaluation | null) => void>());

    const selectedHistoryEntry = selectedHistoryId ? history.find((entry) => entry.id === selectedHistoryId) ?? null : null;
    const visibleRound = selectedHistoryEntry?.roundData ?? currentRound;
    const visibleResult = selectedHistoryEntry?.result ?? result;
    const sortedVisibleDealtTiles = sortTiles(visibleRound.dealtTiles);

    const prefetchAi = (targetRound: MiniRound) => {
        const worker = workerRef.current;
        if (!worker) return;
        setIsPreloading(true);
        setAiPrefetch(null);

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        worker.postMessage({
            type: 'PREFETCH',
            requestId,
            dealtTiles: targetRound.dealtTiles,
            doraIndicators: targetRound.doraIndicators,
            seatWind: 'EAST',
            roundWind: 'EAST'
        });
    };

    const requestAiCandidate = (targetRound: MiniRound): Promise<CandidateEvaluation | null> => {
        if (workerRef.current) {
            return new Promise<CandidateEvaluation | null>((resolve) => {
                const id = Math.random();
                const handler = (event: MessageEvent) => {
                    if (event.data.type === 'PREFETCH_RESULT' && event.data.requestId === id) {
                        workerRef.current?.removeEventListener('message', handler);
                        resolve(event.data.candidate);
                    }
                };
                workerRef.current?.addEventListener('message', handler);
                workerRef.current?.postMessage({
                    type: 'PREFETCH',
                    requestId: id,
                    dealtTiles: targetRound.dealtTiles,
                    doraIndicators: targetRound.doraIndicators,
                    maxCount: 1,
                    seatWind: 'EAST',
                    roundWind: 'EAST',
                    difficulty: 'HARD'
                });
            });
        }

        return Promise.resolve(buildBestCandidates(
            targetRound.dealtTiles,
            targetRound.doraIndicators,
            1,
            { seatWind: 'EAST', roundWind: 'EAST' },
            'HARD'
        )[0] ?? null);
    };

    useEffect(() => {
        const loaded = readMiniHistory();
        setHistory(loaded);
    }, []);

    useEffect(() => {
        const worker = new Worker(new URL('../workers/aiCandidateWorker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<{ type: 'PREFETCH_RESULT'; requestId: number; candidate: CandidateEvaluation | null }>) => {
            const payload = event.data;
            if (payload.type !== 'PREFETCH_RESULT') return;

            const resolver = pendingResolversRef.current.get(payload.requestId);
            if (resolver) {
                pendingResolversRef.current.delete(payload.requestId);
                resolver(payload.candidate);
                return;
            }

            if (payload.requestId === requestIdRef.current) {
                setAiPrefetch(payload.candidate);
                setIsPreloading(false);
            }
        };

        return () => {
            pendingResolversRef.current.forEach((resolve) => resolve(null));
            pendingResolversRef.current.clear();
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!workerRef.current) return;
        if (!isPreloading || aiPrefetch) return;
        prefetchAi(currentRound);
    }, [currentRound, aiPrefetch, isPreloading]);

    const handleSubmit = async (hand: Tile[]) => {
        if (isCalculating || result) return;
        setIsCalculating(true);

        const aiExpected = aiPrefetch ?? await requestAiCandidate(currentRound);
        const waits = getWinningTiles(hand);
        const score = evaluatePotentialScore(hand, waits, currentRound.doraIndicators, { seatWind: 'EAST', roundWind: 'EAST' });
        if (!score || !aiExpected) {
            setIsCalculating(false);
            return;
        }

        const playerMetric = scoreCandidateForRate({ waits, score });
        const aiMetric = scoreCandidateForRate({ waits: aiExpected.waits, score: aiExpected.score });
        const rawRate = aiMetric <= 0 ? 100 : Math.round((playerMetric / aiMetric) * 100);
        const clampedRate = Math.max(0, Math.min(150, rawRate));

        const nextResult: MiniResult = {
            player: {
                hand,
                waits,
                han: score.han,
                points: score.points,
                yaku: score.yaku,
                bestWait: score.bestWait
            },
            ai: {
                hand: aiExpected.hand,
                waits: aiExpected.waits,
                han: aiExpected.score.han,
                points: aiExpected.score.points,
                yaku: aiExpected.score.yaku,
                bestWait: aiExpected.score.bestWait
            },
            rate: clampedRate,
            description: buildDescription(
                { han: score.han, waits: waits.length, points: score.points },
                { han: aiExpected.score.han, waits: aiExpected.waits.length, points: aiExpected.score.points },
                clampedRate
            )
        };
        setResult(nextResult);
        const entry: MiniHistoryEntry = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            round,
            createdAt: Date.now(),
            roundData: currentRound,
            result: nextResult
        };
        setHistory((prev) => {
            const next = [entry, ...prev].slice(0, 30);
            writeMiniHistory(next);
            return next;
        });
        setSelectedHistoryId(null);
        setIsCalculating(false);
    };

    const handleNextRound = () => {
        const nextRound = createMiniRound();
        setCurrentRound(nextRound);
        setResult(null);
        setIsCalculating(false);
        setAiPrefetch(null);
        setIsPreloading(true);
        setRound((prev) => prev + 1);
    };

    const handleGiveUp = () => {
        if (isCalculating || result) return;
        setIsCalculating(true);

        const runGiveUp = async () => {
            const aiExpected = aiPrefetch ?? await requestAiCandidate(currentRound);

            const nextResult: MiniResult = {
                player: {
                    hand: [],
                    waits: [],
                    han: 0,
                    points: 0,
                    yaku: [],
                    bestWait: null
                },
                ai: {
                    hand: aiExpected?.hand ?? [],
                    waits: aiExpected?.waits ?? [],
                    han: aiExpected?.score.han ?? 0,
                    points: aiExpected?.score.points ?? 0,
                    yaku: aiExpected?.score.yaku ?? [],
                    bestWait: aiExpected?.score.bestWait ?? null
                },
                rate: 0,
                description: '이번 판은 포기했습니다. AI 기준 조패를 참고해서 다음 판에서 갱신해보세요.',
                gaveUp: true
            };
            setResult(nextResult);
            const entry: MiniHistoryEntry = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                round,
                createdAt: Date.now(),
                roundData: currentRound,
                result: nextResult
            };
            setHistory((prev) => {
                const next = [entry, ...prev].slice(0, 30);
                writeMiniHistory(next);
                return next;
            });
            setSelectedHistoryId(null);
            setIsCalculating(false);
        };

        setTimeout(() => {
            runGiveUp().catch(() => setIsCalculating(false));
        }, 100);
    };

    return (
        <div className="w-full max-w-5xl glass-panel rounded-3xl p-4 sm:p-6 shadow-2xl min-h-[600px] flex flex-col relative m-2 sm:m-4 z-10">
            <header className="mb-4 w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-slate-700/80 pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300">
                        조패하기 미니게임
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">목표: 최대 판수 + 다면 대기를 만드는 13패를 선택하세요.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-400">현재 판수</div>
                    <div className="text-2xl font-black text-yellow-300">{round}국</div>
                    <div className="text-[11px] text-cyan-300 mt-1">
                        {isPreloading ? 'AI 결과 프리로딩 중...' : 'AI 결과 프리로딩 완료'}
                    </div>
                    <div className="mt-2 flex gap-2 justify-end">
                        {history.length > 0 && (
                            <button
                                onClick={() => setSelectedHistoryId(null)}
                                className="px-3 py-1 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-sm"
                            >
                                현재 판 보기
                            </button>
                        )}
                        {!result && (
                            <button
                                onClick={handleGiveUp}
                                className="px-3 py-1 rounded-xl bg-rose-700 hover:bg-rose-600 text-sm"
                            >
                                포기
                            </button>
                        )}
                        <button onClick={onExit} className="px-3 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm">
                            로비로
                        </button>
                    </div>
                </div>
            </header>

            <div className="mb-4 rounded-2xl surface-panel p-3">
                <div className="text-sm text-slate-300 mb-2">도라 표시패</div>
                <div className="flex gap-2">
                    {visibleRound.doraIndicators.map((tile, idx) => (
                        <div key={`${tile.id ?? `${tile.suit}-${tile.rank}`}-${idx}`} className="transform scale-95 origin-left-top">
                            <TileView tile={tile} disabled={true} />
                        </div>
                    ))}
                </div>
            </div>

            <HandBuilder
                dealtTiles={currentRound.dealtTiles}
                onSubmit={(hand, _pool) => handleSubmit(hand)}
                submitted={Boolean(result) || isCalculating || Boolean(selectedHistoryEntry)}
                doraIndicators={currentRound.doraIndicators}
                debugMode={false}
                singleMode={true}
                loading={isCalculating}
                submitActionLabel="결과 확인"
                loadingLabel="결과 확인 중..."
                seatWind="EAST"
            />

            {isCalculating && (
                <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-900/20 p-4">
                    <div className="text-sm font-semibold text-amber-300">로딩 중...</div>
                    <div className="text-xs text-slate-300 mt-1">서버 전달 및 결과 계산을 진행하고 있습니다. 잠시만 기다려주세요.</div>
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-4 rounded-2xl surface-panel p-4">
                    <div className="text-sm font-semibold text-slate-200 mb-2">로컬 세션 히스토리</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {history.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => setSelectedHistoryId(entry.id)}
                                className={`text-left rounded-xl border px-3 py-2 ${selectedHistoryId === entry.id ? 'border-cyan-400 bg-cyan-900/30' : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700'}`}
                            >
                                <div className="text-xs text-slate-300">
                                    {entry.round}국 · RATE {entry.result.rate}% · {new Date(entry.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">{entry.result.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {visibleResult && (
                <div className="mt-4 rounded-2xl border border-cyan-600/40 bg-slate-900/75 p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-cyan-300">결과 분석</h3>
                        <div className="flex items-center gap-2">
                            {visibleResult.gaveUp && (
                                <span className="px-2 py-1 rounded bg-rose-700 text-white text-xs font-bold">포기</span>
                            )}
                            <button
                                onClick={() => {
                                    const log = {
                                        round: visibleRound,
                                        result: visibleResult,
                                        dealt: visibleRound.dealtTiles.map(t => tileKey(t)),
                                        doraCheck: visibleRound.doraIndicators.map(t => tileKey(t)),
                                        playerHand: visibleResult.player.hand.map(t => tileKey(t)),
                                        aiHand: visibleResult.ai.hand.map(t => tileKey(t))
                                    };
                                    navigator.clipboard.writeText(JSON.stringify(log, null, 2))
                                        .then(() => alert('로그가 클립보드에 복사되었습니다.'))
                                        .catch(() => alert('로그 복사에 실패했습니다.'));
                                }}
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-cyan-300 border border-slate-600 transition-colors"
                            >
                                로그 복사
                            </button>
                            <div className="text-2xl font-black text-yellow-300">RATE {visibleResult.rate}%</div>
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{visibleResult.description}</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-800/80 p-3 border border-slate-700">
                            <div className="text-xs text-slate-400">내 결과</div>
                            <div className="text-sm font-bold text-white">{visibleResult.player.han}판 / {visibleResult.player.points}점 / 대기 {visibleResult.player.waits.length}개</div>
                            <div className="text-xs text-emerald-300 mt-2 mb-1">내 조패 (정렬 13)</div>
                            <div className="flex flex-wrap gap-1">
                                {sortTiles(visibleResult.player.hand).map((tile, idx) => (
                                    <div key={`player-hand-${tile.suit}-${tile.rank}-${idx}`} className="transform scale-90 origin-left-top">
                                        <TileView tile={tile} disabled={true} size="sm" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-emerald-300 mt-2 mb-1">내 대기패</div>
                            <div className="flex flex-wrap gap-1">
                                {visibleResult.player.waits.map((tile, idx) => (
                                    <div key={`player-wait-${tile.suit}-${tile.rank}-${idx}`} className="transform scale-90 origin-left-top">
                                        <TileView tile={tile} disabled={true} size="sm" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-emerald-300 mt-2 mb-1">내 역</div>
                            {visibleResult.player.yaku.length > 0 ? (
                                <div className="space-y-1">
                                    {visibleResult.player.yaku.map((yaku) => (
                                        <div key={`player-yaku-${yaku}`} className="text-xs text-slate-200">
                                            {shouldHideYakuDetail(yaku)
                                                ? toKoreanYakuName(yaku)
                                                : `${toKoreanYakuName(yaku)}: ${refinedYakuDetailText(yaku, visibleResult.player.hand, visibleResult.player.bestWait, visibleRound.doraIndicators)}`}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">없음</div>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-800/80 p-3 border border-slate-700">
                            <div className="text-xs text-slate-400">AI 예상 최대 판수 다면팅</div>
                            <div className="text-sm font-bold text-white">{visibleResult.ai.han}판 / {visibleResult.ai.points}점 / 대기 {visibleResult.ai.waits.length}개</div>
                            <div className="text-xs text-cyan-300 mt-2 mb-1">AI 예상 조패 (13)</div>
                            <div className="flex flex-wrap gap-1">
                                {sortTiles(visibleResult.ai.hand).map((tile, idx) => (
                                    <div key={`ai-hand-${tile.suit}-${tile.rank}-${idx}`} className="transform scale-90 origin-left-top">
                                        <TileView tile={tile} disabled={true} size="sm" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-cyan-300 mt-2 mb-1">AI 대기패</div>
                            <div className="flex flex-wrap gap-1">
                                {visibleResult.ai.waits.map((tile, idx) => (
                                    <div key={`ai-wait-${tile.suit}-${tile.rank}-${idx}`} className="transform scale-90 origin-left-top">
                                        <TileView tile={tile} disabled={true} size="sm" />
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-cyan-300 mt-2 mb-1">AI 역</div>
                            {visibleResult.ai.yaku.length > 0 ? (
                                <div className="space-y-1">
                                    {visibleResult.ai.yaku.map((yaku) => (
                                        <div key={`ai-yaku-${yaku}`} className="text-xs text-slate-200">
                                            {shouldHideYakuDetail(yaku)
                                                ? toKoreanYakuName(yaku)
                                                : `${toKoreanYakuName(yaku)}: ${refinedYakuDetailText(yaku, visibleResult.ai.hand, visibleResult.ai.bestWait, visibleRound.doraIndicators)}`}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">없음</div>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-800/70 border border-slate-700 p-3">
                        <div className="text-xs text-slate-400 mb-2">이번 판 제시 패 (34)</div>
                        <div className="flex flex-wrap gap-1">
                            {sortedVisibleDealtTiles.map((tile, idx) => (
                                <div key={`dealt-${tile.id ?? `${tile.suit}-${tile.rank}`}-${idx}`} className="transform scale-75 origin-left-top">
                                    <TileView tile={tile} disabled={true} size="sm" />
                                </div>
                            ))}
                        </div>
                    </div>
                    {!selectedHistoryEntry && (
                        <button
                            onClick={handleNextRound}
                            className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 font-bold"
                        >
                            다음 판 시작
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
