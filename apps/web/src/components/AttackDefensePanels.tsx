import { useEffect, useState } from 'react';
import { GameContext } from '@step13/core';
import { Tile as TileView } from './Tile';
import {
    TenCallCandidate,
    TenGuessCandidate,
    buildTenGuessTileCatalog,
    getGuessCandidateStates,
    getTenAttackDefenseStageSummary,
    listTenCallCandidates
} from '../lib/ten-attack-defense';

type Props = {
    context: GameContext;
    playerId: string;
    onCall: (type: 'CHI' | 'PON', discardTileId: string, useTileIds: [string, string]) => void;
    onGuess: (tileKey: string) => void;
    onKan: () => void;
    onKanPass: () => void;
};

const TILE_CATALOG = buildTenGuessTileCatalog();

function formatTileKey(tileKey: string | null): string {
    if (!tileKey) return '-';
    const [suit, rank] = tileKey.split('-');
    const suitLabel = suit === 'man' ? '만' : suit === 'pin' ? '통' : suit === 'sou' ? '삭' : '자';
    return `${rank}${suitLabel}`;
}

function findCatalogEntry(tileKey: string | null) {
    if (!tileKey) return null;
    return TILE_CATALOG.find((entry: TenGuessCandidate) => entry.tileKey === tileKey) ?? null;
}

function formatCallLabel(candidate: TenCallCandidate): string {
    return candidate.type === 'CHI' ? '치' : '펑';
}

export function AttackDefensePanels({ context, playerId, onCall, onGuess, onKan, onKanPass }: Props) {
    if (context.ruleset === 'classic') return null;

    const attackDefense = context.attackDefense as typeof context.attackDefense & {
        mustDiscardAfterClaim?: boolean;
        pendingClaim?: { type: 'CHI' | 'PON' } | null;
    };
    const stage = context.attackDefense.stage;
    const stageSummary = getTenAttackDefenseStageSummary(context, playerId);
    const isDefender = stageSummary.isDefenderView;
    const isAttacker = stageSummary.isAttackerView;

    const guessCandidates = getGuessCandidateStates(context, playerId);
    const availableCalls = listTenCallCandidates(context, playerId);

    const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
    const [selectedCallKey, setSelectedCallKey] = useState<string | null>(null);
    const selectedGuessEntry = findCatalogEntry(selectedGuess);
    const lastGuessEntry = findCatalogEntry(context.attackDefense.lastGuessTileKey);
    const showGuessFeedback = stage === 'B_GUESS'
        && context.attackDefense.lastGuessResult !== 'idle'
        && context.attackDefense.lastGuessResult !== 'pending';
    const selectedCall = availableCalls.find((candidate) =>
        `${candidate.type}:${candidate.discardTileId}:${candidate.useTileIds.join(',')}` === selectedCallKey
    ) ?? availableCalls[0] ?? null;

    useEffect(() => {
        if (stage !== 'B_GUESS') {
            setSelectedGuess(null);
        }
    }, [stage, context.attackDefense.guessesRemaining]);

    useEffect(() => {
        if (stage !== 'A' || availableCalls.length === 0) {
            setSelectedCallKey(null);
            return;
        }
        const nextKey = `${availableCalls[0].type}:${availableCalls[0].discardTileId}:${availableCalls[0].useTileIds.join(',')}`;
        setSelectedCallKey((current) => (
            current && availableCalls.some((candidate) => `${candidate.type}:${candidate.discardTileId}:${candidate.useTileIds.join(',')}` === current)
                ? current
                : nextKey
        ));
    }, [stage, availableCalls]);

    return (
        <>
            <div className="absolute left-0 top-0 z-40 p-2 sm:p-4 flex flex-col gap-2 w-full sm:max-w-sm pointer-events-none">
                <div className="pointer-events-auto rounded-3xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md p-3 shadow-xl flex items-center justify-between">
                    <div>
                        <div className="font-black text-cyan-300 tracking-[0.18em] text-xs sm:text-sm">{stageSummary.modeLabel}</div>
                        <div className="text-slate-300 mt-0.5 text-[10px] sm:text-xs">{stageSummary.stageLabel}</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="rounded-2xl bg-slate-900/80 px-3 py-1.5 flex flex-col items-center justify-center border border-slate-700/50">
                            <span className="text-[9px] text-slate-400 font-bold mb-0.5">남은 턴</span>
                            <span className="text-xl font-black text-yellow-300 leading-none">{stageSummary.turnsLeft}</span>
                        </div>
                    </div>
                </div>

                <div className="pointer-events-auto grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md px-3 py-2 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">추측 기회</span>
                        <span className="text-base font-black text-cyan-200 leading-none">{stageSummary.guessesRemaining}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md px-3 py-2 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">공격 기회</span>
                        <span className="text-base font-black text-amber-200 leading-none">{stageSummary.assaultRemaining}</span>
                    </div>
                </div>

                {context.attackDefense.declarationType && (
                    <div className="pointer-events-auto rounded-2xl border border-rose-900/50 bg-slate-950/80 backdrop-blur-md px-3 py-2 text-xs text-slate-300 shadow-lg flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-rose-600/20 text-rose-300 font-bold border border-rose-500/30">
                            {context.attackDefense.declarationType === 'RIICHI' ? '리치' : '텐파이'} 선언됨
                        </span>
                        {context.attackDefense.declaredBy && (
                            <span className="font-semibold text-slate-200">{context.attackDefense.declaredBy}</span>
                        )}
                    </div>
                )}
                {stage === 'A' && isAttacker && (availableCalls.length > 0 || attackDefense.mustDiscardAfterClaim) && (
                    <div className="pointer-events-auto rounded-3xl border border-emerald-500/30 bg-slate-950/85 backdrop-blur-md p-3 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-black tracking-[0.22em] text-emerald-300">CALL FLOW</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                    {attackDefense.mustDiscardAfterClaim
                                        ? `${attackDefense.pendingClaim?.type === 'CHI' ? '치' : '펑'} 후 버릴 패를 선택하세요.`
                                        : '직전 버림패에 반응해 치/펑을 선택할 수 있습니다.'}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-400">
                                    {context.lastDiscard
                                        ? `대상 버림패 ${formatTileKey(`${context.lastDiscard.tile.suit}-${context.lastDiscard.tile.rank}`)}`
                                        : '대상 버림패 없음'}
                                </div>
                            </div>
                            {!attackDefense.mustDiscardAfterClaim && selectedCall && (
                                <button
                                    onClick={() => onCall(selectedCall.type, selectedCall.discardTileId, selectedCall.useTileIds)}
                                    className="rounded-2xl border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-500"
                                >
                                    {formatCallLabel(selectedCall)} 실행
                                </button>
                            )}
                        </div>
                        {!attackDefense.mustDiscardAfterClaim && availableCalls.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {availableCalls.map((candidate) => {
                                    const callKey = `${candidate.type}:${candidate.discardTileId}:${candidate.useTileIds.join(',')}`;
                                    const isSelected = selectedCallKey === callKey;
                                    return (
                                        <button
                                            key={callKey}
                                            onClick={() => setSelectedCallKey(callKey)}
                                            className={`rounded-2xl border px-3 py-2 text-left transition ${
                                                isSelected
                                                    ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_8px_20px_rgba(16,185,129,0.2)]'
                                                    : 'border-slate-700/60 bg-slate-900/80 hover:border-slate-500'
                                            }`}
                                        >
                                            <div className="text-[10px] font-black tracking-[0.18em] text-emerald-300">{formatCallLabel(candidate)}</div>
                                            <div className="mt-1 flex items-center gap-1">
                                                {candidate.meldTiles.map((tile: TenCallCandidate['meldTiles'][number], index: number) => (
                                                    <TileView key={`${callKey}-${tile.id ?? index}`} tile={tile} size="xs" disabled={true} />
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {isAttacker && context.attackDefense.lastGuessTileKey && (
                    <div className="pointer-events-auto rounded-2xl border border-amber-900/50 bg-slate-950/80 backdrop-blur-md px-3 py-2 text-xs text-amber-300 shadow-lg font-medium">
                        수비자 최근 추측: <span className="font-bold text-amber-200">{formatTileKey(context.attackDefense.lastGuessTileKey)}</span>
                    </div>
                )}
                {stage === 'B_ASSAULT' && isAttacker && (
                    <div className="pointer-events-auto rounded-3xl border border-amber-500/40 bg-slate-950/85 backdrop-blur-md p-3 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[10px] font-black tracking-[0.24em] text-amber-300">ASSAULT FLOW</div>
                                <div className="mt-1 text-sm font-semibold text-slate-100">
                                    {stageSummary.hasPendingDraw ? '패를 확인하고 쯔모기리 하세요.' : '다음 공격 draw를 준비 중입니다.'}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-400">
                                    진행 {stageSummary.assaultProgressLabel} · 남은 공격 {stageSummary.assaultRemaining}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center min-w-[5rem]">
                                <div className="text-[9px] font-black tracking-[0.18em] text-amber-200/70">DRAW</div>
                                <div className="mt-1 text-base font-black text-amber-100">
                                    {stageSummary.pendingDrawTileKey ? formatTileKey(stageSummary.pendingDrawTileKey) : '-'}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-900/80 overflow-hidden border border-slate-700/60">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-rose-400 transition-all"
                                style={{ width: `${stageSummary.assaultProgressValue * 20}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {showGuessFeedback && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" />
                    <div className={`relative w-full py-8 flex items-center justify-center shadow-2xl backdrop-blur-md overflow-hidden ${
                        context.attackDefense.lastGuessResult === 'succeeded'
                            ? 'bg-gradient-to-r from-transparent via-emerald-600/40 to-transparent border-y border-emerald-500/50'
                            : 'bg-gradient-to-r from-transparent via-rose-600/40 to-transparent border-y border-rose-500/50'
                    }`}>
                        <div className={`absolute top-0 w-full h-px ${context.attackDefense.lastGuessResult === 'succeeded' ? 'bg-gradient-to-r from-transparent via-emerald-300 to-transparent' : 'bg-gradient-to-r from-transparent via-rose-300 to-transparent'}`} />
                        <div className={`absolute bottom-0 w-full h-px ${context.attackDefense.lastGuessResult === 'succeeded' ? 'bg-gradient-to-r from-transparent via-emerald-300 to-transparent' : 'bg-gradient-to-r from-transparent via-rose-300 to-transparent'}`} />

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 w-full max-w-5xl px-4 z-10">
                            <div className="flex flex-col items-center">
                                <div className="text-[10px] font-black tracking-[0.3em] text-cyan-200/70 mb-1">DEFENDER</div>
                                <div className="text-xl sm:text-2xl font-black text-white">{context.attackDefense.defender ?? '-'}</div>
                            </div>

                            <div className="flex flex-col items-center justify-center text-center animate-bounce-subtle">
                                <div className={`text-4xl sm:text-6xl font-black drop-shadow-[0_0_25px_rgba(0,0,0,0.8)] tracking-tight ${
                                    context.attackDefense.lastGuessResult === 'succeeded' ? 'text-emerald-300' : 'text-rose-400'
                                }`} style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                                    {context.attackDefense.lastGuessResult === 'succeeded' ? '예측 성공!' : '예측 실패..'}
                                </div>
                                {lastGuessEntry && (
                                    <div className="mt-4 flex items-center gap-3 bg-slate-950/50 px-4 py-2 rounded-2xl border border-white/10">
                                        <span className="text-sm font-medium text-slate-300">추측한 패:</span>
                                        <div className="bg-slate-800 rounded-lg p-1 shadow-inner">
                                            <TileView tile={lastGuessEntry.tile} disabled={true} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center">
                                <div className="text-[10px] font-black tracking-[0.3em] text-rose-300/70 mb-1">ATTACKER</div>
                                <div className="text-xl sm:text-2xl font-black text-white">{context.attackDefense.attacker ?? '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stage === 'B_GUESS' && isDefender && (
                <div className="absolute bottom-[calc(max(4dvh,28px))] left-0 right-0 z-50 px-2 sm:px-4 lg:px-6 pointer-events-none flex justify-center">
                    <div className="pointer-events-auto flex flex-col w-full max-w-[min(96vw,1440px)] rounded-[2rem] sm:rounded-[2.5rem] border border-cyan-500/30 bg-slate-950/85 backdrop-blur-2xl p-3 sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] ring-1 ring-white/5">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 mb-3">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1">
                                    <span className="text-xs font-black tracking-widest text-cyan-300">STAGE B</span>
                                </div>
                                <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    대기패 추측 중... <span className="text-xs text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-full">남은 횟수: {context.attackDefense.guessesRemaining}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                                <div className="flex-1 min-w-[12rem] sm:flex-none flex justify-end items-center px-4 py-2 rounded-2xl bg-slate-900 border border-slate-700/50">
                                    <span className="text-xs text-slate-400 mr-3">선택됨:</span>
                                    {selectedGuessEntry ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-cyan-300">{formatTileKey(selectedGuess)}</span>
                                            <div className="scale-75 origin-right">
                                                <TileView tile={selectedGuessEntry.tile} size="xs" disabled={true} />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-600 font-medium">없음</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => selectedGuess && onGuess(selectedGuess)}
                                    disabled={!selectedGuess}
                                    className="flex-1 min-w-[7rem] xl:flex-none px-6 py-2.5 rounded-2xl bg-cyan-600 text-white font-bold shadow-[0_0_15px_rgba(8,145,178,0.4)] hover:bg-cyan-500 transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    확정
                                </button>
                            </div>
                        </div>

                        <div className="relative rounded-2xl border border-slate-700/50 bg-slate-900/60 p-2 sm:p-3 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-11 xl:grid-cols-[repeat(17,minmax(0,1fr))] gap-1 sm:gap-1.5 justify-items-center">
                            {guessCandidates.map(({ tile, tileKey, remainingCount, state, blockedReason }: TenGuessCandidate) => {
                                const unavailable = state !== 'selectable';
                                const isSelected = selectedGuess === tileKey;
                                const wasLastFailed = context.attackDefense.lastGuessResult === 'failed'
                                    && context.attackDefense.lastGuessTileKey === tileKey;
                                const statusLabel = blockedReason === 'opponent_discard'
                                    ? '상대 버림패'
                                    : blockedReason === 'exhausted'
                                        ? '패산 소진'
                                        : remainingCount;
                                return (
                                    <button
                                        key={tileKey}
                                        onClick={() => setSelectedGuess(tileKey)}
                                        disabled={unavailable}
                                        className={`relative group rounded-xl p-1 transition-all flex flex-col items-center w-full max-w-[3rem]
                                            ${isSelected ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_5px_15px_rgba(34,211,238,0.3)] -translate-y-0.5 sm:scale-105' : wasLastFailed ? 'bg-rose-500/10 border-2 border-rose-400/70' : 'bg-slate-800 border-2 border-transparent'}
                                            ${unavailable ? 'cursor-not-allowed' : 'hover:border-slate-500 hover:-translate-y-1 cursor-pointer'} 
                                        `}
                                        title={typeof statusLabel === 'string' ? statusLabel : undefined}
                                    >
                                        <div className={`relative ${unavailable ? 'opacity-45 grayscale' : ''}`}>
                                            <TileView tile={tile} size="sm" disabled={true} />
                                            {unavailable && (
                                                <div className={`absolute inset-0 flex items-center justify-center text-xl font-black ${blockedReason === 'opponent_discard' ? 'text-rose-400' : 'text-slate-400'}`}>
                                                    X
                                                </div>
                                            )}
                                        </div>
                                        <div className={`mt-1 text-[9px] font-black ${unavailable ? 'text-rose-400' : isSelected ? 'text-cyan-300' : wasLastFailed ? 'text-rose-300' : 'text-slate-400'}`}>
                                            {statusLabel}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {stage === 'B_ASSAULT' && isAttacker && context.attackDefense.kanOption.pending && (
                <div className="absolute bottom-[calc(max(10dvh,88px))] left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-8 z-50 rounded-[2rem] border border-amber-500/40 bg-slate-950/90 backdrop-blur-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.3)] ring-1 ring-white/5">
                    <div className="flex flex-col items-center sm:items-end pr-2 pl-2">
                        <span className="text-[10px] text-amber-500/70 font-black tracking-widest mb-0.5">KAN OPTION</span>
                        <div className="text-sm text-amber-200 font-bold">{formatTileKey(context.attackDefense.kanOption.tileKey)}</div>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:border-l border-slate-700/50 sm:pl-3">
                        <button onClick={onKan} className="px-6 py-2.5 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:from-amber-300 hover:to-amber-500 transition">
                            깡
                        </button>
                        <button onClick={onKanPass} className="px-5 py-2.5 rounded-2xl bg-slate-800 text-slate-300 font-semibold border border-slate-600/50 hover:bg-slate-700 transition">
                            패스
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
