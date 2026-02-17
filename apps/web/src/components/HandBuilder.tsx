import { useEffect, useMemo, useState } from 'react';
import { Tile as TileType, Wind } from '@step13/proto';
import { Tile } from './Tile';

interface HandBuilderProps {
    dealtTiles: TileType[];
    initialSelectedIndices?: number[];
    doraIndicators: TileType[];
    onSubmit: (hand: TileType[], pool: TileType[]) => void;
    onQueryAnalysis?: (query: any) => void;
    analysisResult?: any;
    loading?: boolean;
    submitted?: boolean;
    opponentSubmitted?: boolean;
    buildTimeRemainingMs?: number | null;
    debugMode?: boolean;
    singleMode?: boolean;
    submitActionLabel?: string;
    loadingLabel?: string;
    seatWind?: Wind;
    scoreDiff?: number;
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



export const HandBuilder: React.FC<HandBuilderProps> = ({
    dealtTiles,
    initialSelectedIndices = [],
    doraIndicators = [],
    onSubmit,
    onQueryAnalysis,
    analysisResult,
    loading = false,
    submitted = false,
    opponentSubmitted = false,
    buildTimeRemainingMs = null,
    debugMode = false,
    singleMode = false,
    submitActionLabel,
    loadingLabel = '로딩 중...',
    seatWind,
    scoreDiff
}) => {
    const [selectedIndices, setSelectedIndices] = useState<number[]>(initialSelectedIndices);
    const [showDebugLayer, setShowDebugLayer] = useState(false);

    // Analysis State from server
    const [serverPotentialScore, setServerPotentialScore] = useState<any>(null);
    const [serverCandidates, setServerCandidates] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showAnalyzingIndicator, setShowAnalyzingIndicator] = useState(false);

    useEffect(() => {
        setSelectedIndices([]);
        setShowDebugLayer(false);
        setServerPotentialScore(null);
        setServerCandidates([]);
    }, [dealtTiles]);

    const selectedTiles = useMemo(() => selectedIndices.map((index) => dealtTiles[index]), [selectedIndices, dealtTiles]);

    // Handle incoming analysis results
    useEffect(() => {
        if (!analysisResult) return;

        if (analysisResult.scoreResult) {
            setServerPotentialScore(analysisResult.scoreResult);
        }
        if (analysisResult.candidates) {
            setServerCandidates(analysisResult.candidates);
            if (!analysisResult.scoreResult) {
                setServerPotentialScore(analysisResult.candidates[0]?.score ?? null);
            }
            setIsAnalyzing(false);
        }
    }, [analysisResult]);

    useEffect(() => {
        if (!isAnalyzing) {
            setShowAnalyzingIndicator(false);
            return;
        }

        const timer = setTimeout(() => {
            setShowAnalyzingIndicator(true);
        }, 250);

        return () => clearTimeout(timer);
    }, [isAnalyzing]);

    // Request analysis when selection changes (Debounced)
    useEffect(() => {
        if (!onQueryAnalysis || submitted) return;
        if (selectedTiles.length !== 13) {
            setIsAnalyzing(false);
            setServerPotentialScore(null);
            setServerCandidates([]);
            return;
        }

        const timer = setTimeout(() => {
            // In 17-step, we always want to know if it's Tenpai (shanten -1) and what's the best score
            // We'll bundle these into a single custom server query or multiple
            onQueryAnalysis({
                queryType: 'AI_HINT', // Heavy lifting
                hand: selectedTiles,
                doraIndicators,
                difficulty: 'HARD',
                scoreDiff
            });
            setIsAnalyzing(true);
        }, 500);

        return () => clearTimeout(timer);
    }, [selectedTiles, onQueryAnalysis, submitted, doraIndicators, scoreDiff]);

    const sortedTilesWithIndices = useMemo(() => {
        return dealtTiles
            .map((tile, index) => ({ tile, index }))
            .sort((a, b) => {
                if (a.tile.suit !== b.tile.suit) return a.tile.suit.localeCompare(b.tile.suit);
                return a.tile.rank - b.tile.rank;
            });
    }, [dealtTiles]);

    const tenpai = serverPotentialScore && serverPotentialScore.points > 0;
    const hasAnalysisScore = Boolean(serverPotentialScore);
    const isMangan = serverPotentialScore ? serverPotentialScore.points >= 8000 : false;
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

    const applyCandidate = (candidate: any) => {
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
                        {tenpai ? '텐파이' : '텐파이 아님'}
                    </span>
                    {selectedTiles.length === 13 && showAnalyzingIndicator && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-cyan-400/50 bg-cyan-900/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                            분석 중...
                        </span>
                    )}
                    <div className="mt-2 w-full sm:w-56 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(selectedTiles.length / 13) * 100}%` }} />
                    </div>
                    {singleMode && !submitted && !loading && selectedTiles.length === 13 && debugMode && (
                        <div className="flex items-center justify-between rounded-2xl surface-panel p-3 gap-3">
                            <div className="text-xs text-slate-300">
                                디버그 모드: 추천 조패를 우선순위별로 확인하고 자동 적용할 수 있습니다.
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const log = {
                                            selectedHand: selectedTiles.map(t => `${t.suit}${t.rank}`),
                                            dealtTiles: dealtTiles.map(t => `${t.suit}${t.rank}`),
                                            doraIndicators: doraIndicators.map(t => `${t.suit}${t.rank}`),
                                            selectedIndices: selectedIndices,
                                            serverScore: serverPotentialScore
                                        };
                                        navigator.clipboard.writeText(JSON.stringify(log, null, 2))
                                            .then(() => alert('현재 선택 패가 클립보드에 복사되었습니다.'))
                                            .catch(() => alert('복사에 실패했습니다.'));
                                    }}
                                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold whitespace-nowrap"
                                >
                                    로그 복사
                                </button>
                                <button
                                    onClick={() => setShowDebugLayer(true)}
                                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold whitespace-nowrap"
                                >
                                    디버그 추천 보기
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    {!submitted && !loading && selectedTiles.length > 0 && (
                        <button
                            onClick={() => {
                                if (window.confirm('선택한 패를 초기화하시겠습니까?')) {
                                    setSelectedIndices([]);
                                    setServerPotentialScore(null);
                                    setServerCandidates([]);
                                }
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg border border-rose-400/50 transition-all active:scale-95"
                        >
                            선택 초기화
                        </button>
                    )}
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
                    {tenpai && serverPotentialScore && (
                        <div className="text-emerald-300 text-sm font-bold mt-1">현재 판수: {serverPotentialScore.han}판</div>
                    )}
                    {hasAnalysisScore && serverPotentialScore && (
                        <>
                            <div className="text-yellow-400 font-bold">
                                예상: ({serverPotentialScore.han}/5판) {serverPotentialScore.points}점
                                {serverPotentialScore.limit && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded animate-pulse">{toKoreanLimit(serverPotentialScore.limit)}</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-400">(현재판수/최소화료판수, 최대 타점 기준)</div>
                            {!tenpai && (
                                <div className="text-xs text-amber-300">현재 조합은 만관 조건 미달입니다.</div>
                            )}
                            {serverPotentialScore.yaku.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-[360px] ml-auto">
                                    {serverPotentialScore.yaku.map((yaku: string) => (
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
                    <div className="text-sm font-bold text-emerald-300 mb-2">대기패</div>
                    <div className="flex flex-wrap gap-1">
                        {serverPotentialScore?.bestWait && (
                            <div className="transform scale-90 origin-left-top relative">
                                <Tile tile={serverPotentialScore.bestWait} disabled={true} size="sm" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showDebugLayer && (
                <div
                    className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setShowDebugLayer(false)}
                >
                    <div
                        className="w-full max-w-4xl max-h-[80vh] overflow-y-auto thin-scrollbar glass-panel rounded-2xl p-6 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowDebugLayer(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-white mb-2">추천 조패 리스트</h2>

                            {(serverCandidates.length === 0) && (
                                <div className="text-center py-8">
                                    <div className="text-lg text-slate-300 font-medium mb-1">
                                        {isAnalyzing ? '추천 조패 계산 중...' : '추천 조패를 찾지 못했습니다.'}
                                    </div>
                                    {!isAnalyzing && (
                                        <div className="text-sm text-slate-500">
                                            현재 선택된 패의 조합으로는 유효한 텐파이 경로를 찾을 수 없습니다.
                                        </div>
                                    )}
                                </div>
                            )}

                            {serverCandidates.map((candidate: any, idx: number) => (
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
                                        {candidate.waits.map((tile: any, waitIdx: number) => (
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
