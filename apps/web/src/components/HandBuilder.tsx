import { useEffect, useMemo, useRef, useState } from 'react';
import { Tile as TileType, Wind } from '@step13/proto';
import { Tile } from './Tile';
import { calculateScore } from '@step13/scoring';
import { CandidateEvaluation, SCORE_OPTIONS, buildBestCandidates, evaluatePotentialScore, getWinningTiles } from '../lib/handAnalysis';

interface HandBuilderProps {
    dealtTiles: TileType[];
    onSubmit: (hand: TileType[], pool: TileType[]) => void;
    submitted?: boolean;
    opponentSubmitted?: boolean;
    buildTimeRemainingMs?: number | null;
    doraIndicators?: TileType[];
    debugMode?: boolean;
    singleMode?: boolean;
    loading?: boolean;
    submitActionLabel?: string;
    loadingLabel?: string;
    seatWind?: Wind;
}

function toKoreanLimit(limit: string): string {
    const map: Record<string, string> = {
        Mangan: '만관',
        Haneman: '하네만',
        Baiman: '배만',
        Sanbaiman: '삼배만',
        Yakuman: '역만'
    };
    return map[limit] ?? limit;
}

function toKoreanYaku(yaku: string): string {
    if (yaku.startsWith('Dora ')) {
        const count = yaku.replace('Dora ', '');
        return `도라 ${count}`;
    }
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
        if (yaku.startsWith('Yakuhai(Seat):')) {
            return `자풍패(${honorMap[honor] ?? honor})`;
        }
        if (yaku.startsWith('Yakuhai(Round):')) {
            return `장풍패(${honorMap[honor] ?? honor})`;
        }
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

function formatBuildTime(ms: number | null | undefined): string {
    if (ms == null) return '--:--';
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function windToTile(wind: Wind): TileType {
    const rankMap: Record<Wind, TileType['rank']> = {
        EAST: 1,
        SOUTH: 2,
        WEST: 3,
        NORTH: 4
    };
    return {
        suit: 'z',
        rank: rankMap[wind],
        isRed: false
    };
}

function windToKorean(wind: Wind): string {
    const map: Record<Wind, string> = {
        EAST: '동',
        SOUTH: '남',
        WEST: '서',
        NORTH: '북'
    };
    return map[wind];
}

function tileToKoreanLabel(tile: TileType): string {
    if (tile.suit === 'z') {
        const honors = ['동', '남', '서', '북', '백', '발', '중'];
        return honors[tile.rank - 1] ?? `${tile.rank}자`;
    }
    const suitMap: Record<'man' | 'pin' | 'sou', string> = {
        man: '만',
        pin: '통',
        sou: '삭'
    };
    return `${tile.rank}${suitMap[tile.suit]}`;
}

export function HandBuilder({
    dealtTiles,
    onSubmit,
    submitted = false,
    opponentSubmitted = false,
    buildTimeRemainingMs = null,
    doraIndicators = [],
    debugMode = false,
    singleMode = false,
    loading = false,
    submitActionLabel,
    loadingLabel = '로딩 중...',
    seatWind
}: HandBuilderProps) {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [showDebugLayer, setShowDebugLayer] = useState(false);
    const [debugCandidates, setDebugCandidates] = useState<CandidateEvaluation[]>([]);
    const [debugCandidatesLoading, setDebugCandidatesLoading] = useState(false);
    const debugWorkerRef = useRef<Worker | null>(null);
    const debugRequestIdRef = useRef(0);

    useEffect(() => {
        setSelectedIndices([]);
        setShowDebugLayer(false);
        setDebugCandidates([]);
        setDebugCandidatesLoading(false);
    }, [dealtTiles]);

    useEffect(() => {
        return () => {
            debugWorkerRef.current?.terminate();
            debugWorkerRef.current = null;
        };
    }, []);

    const sortedTilesWithIndices = useMemo(() => {
        return dealtTiles
            .map((tile, index) => ({ tile, index }))
            .sort((a, b) => {
                if (a.tile.suit !== b.tile.suit) return a.tile.suit.localeCompare(b.tile.suit);
                return a.tile.rank - b.tile.rank;
            });
    }, [dealtTiles]);

    const selectedTiles = useMemo(() => selectedIndices.map((index) => dealtTiles[index]), [selectedIndices, dealtTiles]);

    const winningTiles = useMemo(() => getWinningTiles(selectedTiles), [selectedTiles]);
    const waitEvaluations = useMemo(() => {
        return winningTiles.map((wait) => {
            const score = calculateScore(selectedTiles, wait, false, doraIndicators, {
                ...SCORE_OPTIONS,
                seatWind,
                roundWind: 'EAST'
            });
            return { wait, score };
        });
    }, [winningTiles, selectedTiles, doraIndicators, seatWind]);
    const insufficientWaits = useMemo(
        () => waitEvaluations.filter((item) => item.score.points === 0),
        [waitEvaluations]
    );
    const validWaits = useMemo(
        () => waitEvaluations.filter((item) => item.score.points > 0),
        [waitEvaluations]
    );
    const potentialScoreWithWind = useMemo(
        () => evaluatePotentialScore(selectedTiles, winningTiles, doraIndicators, { seatWind, roundWind: 'EAST' }),
        [selectedTiles, winningTiles, doraIndicators, seatWind]
    );

    useEffect(() => {
        if (!debugMode || submitted || !showDebugLayer) return;
        setDebugCandidatesLoading(true);

        const currentRequestId = ++debugRequestIdRef.current;
        const worker = new Worker(new URL('../workers/aiCandidateWorker.ts', import.meta.url), { type: 'module' });
        debugWorkerRef.current?.terminate();
        debugWorkerRef.current = worker;

        worker.onmessage = (
            event: MessageEvent<{ type: 'PREFETCH_RESULT'; requestId: number; candidate: CandidateEvaluation | null; candidates?: CandidateEvaluation[] }>
        ) => {
            const payload = event.data;
            if (payload.type !== 'PREFETCH_RESULT') return;
            if (payload.requestId !== currentRequestId) return;
            setDebugCandidates(payload.candidates ?? (payload.candidate ? [payload.candidate] : []));
            setDebugCandidatesLoading(false);
            worker.terminate();
            if (debugWorkerRef.current === worker) {
                debugWorkerRef.current = null;
            }
        };

        worker.onerror = () => {
            // Worker fallback: keep functionality by using local calculation.
            const next = buildBestCandidates(dealtTiles, doraIndicators, 8, { seatWind, roundWind: 'EAST' });
            setDebugCandidates(next);
            setDebugCandidatesLoading(false);
            worker.terminate();
            if (debugWorkerRef.current === worker) {
                debugWorkerRef.current = null;
            }
        };

        worker.postMessage({
            type: 'PREFETCH',
            requestId: currentRequestId,
            dealtTiles,
            doraIndicators,
            maxCount: 8,
            seatWind: seatWind ?? 'EAST',
            roundWind: 'EAST'
        });

        return () => {
            worker.terminate();
            if (debugWorkerRef.current === worker) {
                debugWorkerRef.current = null;
            }
        };
    }, [debugMode, submitted, showDebugLayer, dealtTiles, doraIndicators, seatWind]);

    const tenpai = winningTiles.length > 0;
    const isMangan = potentialScoreWithWind ? potentialScoreWithWind.points >= 8000 : false;
    const canSubmit = tenpai && !submitted && !loading;

    const toggleTile = (originalIndex: number) => {
        if (submitted || loading) return;

        if (selectedIndices.includes(originalIndex)) {
            setSelectedIndices(selectedIndices.filter((index) => index !== originalIndex));
            return;
        }

        if (selectedIndices.length < 13) {
            setSelectedIndices([...selectedIndices, originalIndex]);
        }
    };

    const applyCandidate = (candidate: CandidateEvaluation) => {
        if (submitted || loading) return;
        setSelectedIndices(candidate.indices);
        setShowDebugLayer(false);
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        const hand = selectedTiles;
        const pool = dealtTiles.filter((_, index) => !selectedIndices.includes(index));
        onSubmit(hand, pool);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="surface-panel flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center p-3 rounded-2xl">
                <div>
                    <span className="font-bold mr-4">선택됨: {selectedTiles.length} / 13</span>
                    <span className={`text-sm font-bold ${tenpai ? 'text-green-400' : 'text-red-400'}`}>
                        {tenpai ? '텐파이 (청패)' : '텐파이 아님'}
                    </span>
                    <div className="mt-2 w-full sm:w-56 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(selectedTiles.length / 13) * 100}%` }} />
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-cyan-300 font-mono font-bold">남은 시간: {formatBuildTime(buildTimeRemainingMs)}</div>
                    <div className="text-xs text-slate-300 mt-1">
                        도라: {doraIndicators.length > 0 ? `${doraIndicators.length}장 공개` : '오모테도라 미공개'}
                    </div>
                    <div className="flex justify-end gap-1 mt-1">
                        {doraIndicators.map((tile, idx) => (
                            <div key={`${tile.id ?? `${tile.suit}-${tile.rank}`}-${idx}`} className="transform scale-75 origin-right-top">
                                <Tile tile={tile} disabled={true} size="sm" />
                            </div>
                        ))}
                    </div>
                    {seatWind && (
                        <div className="mt-1 flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-300">자풍패: {windToKorean(seatWind)}</span>
                            <Tile tile={windToTile(seatWind)} disabled={true} size="sm" />
                        </div>
                    )}
                    {tenpai && potentialScoreWithWind && (
                        <div className="text-emerald-300 text-sm font-bold mt-1">현재 판수: {potentialScoreWithWind.han}판</div>
                    )}
                    {tenpai && potentialScoreWithWind && (
                        <>
                            <div className="text-yellow-400 font-bold">
                                예상: ({potentialScoreWithWind.han}/5판) {potentialScoreWithWind.points}점
                                {potentialScoreWithWind.limit && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded animate-pulse">{toKoreanLimit(potentialScoreWithWind.limit)}</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-400">(현재판수/최소화료판수, 최대 타점 기준)</div>
                            {potentialScoreWithWind.yaku.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-[360px] ml-auto">
                                    {potentialScoreWithWind.yaku.map((yaku) => (
                                        <span key={yaku} className="px-2 py-0.5 text-[10px] rounded bg-blue-900/60 border border-blue-700 text-blue-200">
                                            {toKoreanYaku(yaku)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {submitted && !opponentSubmitted && !singleMode && (
                        <div className="text-xs text-amber-300 font-semibold mt-1">준비 완료. 상대 선택 완료 대기 중...</div>
                    )}
                    {submitted && opponentSubmitted && !singleMode && (
                        <div className="text-xs text-green-300 font-semibold mt-1">모두 준비 완료. 곧 진행됩니다.</div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1 p-2 surface-panel rounded-2xl overflow-y-auto max-h-[400px] thin-scrollbar">
                {sortedTilesWithIndices.map(({ tile, index }) => (
                    <div key={index} className="transform scale-90">
                        <Tile
                            tile={tile}
                            selected={selectedIndices.includes(index)}
                            onClick={submitted ? undefined : () => toggleTile(index)}
                            disabled={submitted || loading || (selectedIndices.length >= 13 && !selectedIndices.includes(index))}
                        />
                    </div>
                ))}
            </div>

            {tenpai && (
                <div className="surface-panel rounded-2xl p-3">
                    <div className="text-sm font-bold text-emerald-300 mb-2">대기패 ({winningTiles.length})</div>
                    <div className="flex flex-wrap gap-1">
                        {waitEvaluations.map(({ wait, score }, idx) => (
                            <div key={`${wait.suit}-${wait.rank}-${idx}`} className="transform scale-90 origin-left-top relative">
                                <Tile tile={wait} disabled={true} size="sm" />
                                {score.points === 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] px-1 rounded">불가</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-300">
                        유효 대기 {validWaits.length}개 / 판수 부족 {insufficientWaits.length}개
                    </div>
                    {insufficientWaits.length > 0 && (
                        <div className="mt-1 text-xs text-rose-300">
                            판수 부족(17보 화료불가): {insufficientWaits.map((item) => tileToKoreanLabel(item.wait)).join(', ')}
                        </div>
                    )}
                </div>
            )}

            {debugMode && !submitted && !loading && (
                <div className="flex items-center justify-between rounded-2xl surface-panel p-3">
                    <div className="text-xs text-slate-300">
                        디버그 모드: 추천 조패를 우선순위별로 확인하고 자동 적용할 수 있습니다.
                    </div>
                    <button
                        onClick={() => setShowDebugLayer(true)}
                        className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
                    >
                        디버그 추천 보기
                    </button>
                </div>
            )}

            {showDebugLayer && (
                <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto thin-scrollbar glass-panel rounded-2xl p-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">디버그 조패 추천 (상위 {debugCandidates.length}개)</h3>
                            <button
                                onClick={() => setShowDebugLayer(false)}
                                className="px-3 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm"
                            >
                                닫기
                            </button>
                        </div>

                        <div className="space-y-3">
                            {debugCandidates.length === 0 && (
                                <div className="text-sm text-slate-400">
                                    {debugCandidatesLoading ? '추천 조패 계산 중...' : '추천 조패를 찾지 못했습니다.'}
                                </div>
                            )}

                            {debugCandidates.map((candidate, idx) => (
                                <div key={candidate.indices.join('-')} className="bg-slate-800/70 border border-slate-700 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-bold text-yellow-300">
                                            #{idx + 1} ({candidate.score.han}/5판) {candidate.score.points}점
                                            {candidate.score.limit && (
                                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-600 text-white">{toKoreanLimit(candidate.score.limit)}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => applyCandidate(candidate)}
                                            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold"
                                        >
                                            자동 적용
                                        </button>
                                    </div>

                                    <div className="text-xs text-slate-300 mb-2">
                                        역: {candidate.score.yaku.length > 0 ? candidate.score.yaku.map(toKoreanYaku).join(', ') : '없음'}
                                    </div>

                                    <div className="text-xs text-emerald-300 mb-1">대기패 ({candidate.waits.length})</div>
                                    <div className="flex flex-wrap gap-1">
                                        {candidate.waits.map((tile, waitIdx) => (
                                            <div key={`${tile.suit}-${tile.rank}-${waitIdx}`} className="transform scale-90 origin-left-top">
                                                <Tile tile={tile} disabled={true} size="sm" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className={`
                    w-full py-4 rounded-2xl font-bold text-xl transition-all shadow-lg
                    ${canSubmit && !loading
                        ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white transform hover:scale-[1.02]'
                        : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'}
                `}
            >
                {loading
                    ? loadingLabel
                    : submitted
                    ? (singleMode ? '제출 완료' : (opponentSubmitted ? '모두 준비 완료, 시작 중...' : '준비 완료 - 상대 대기 중'))
                    : (canSubmit
                        ? (submitActionLabel ?? (isMangan ? '만관 확정! 준비 완료' : '준비 완료 (만관 미만 주의)'))
                        : '패를 완성해주세요')}
            </button>
        </div>
    );
}
