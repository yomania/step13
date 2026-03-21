import { useEffect, useState } from 'react';
import { Tile } from '@step13/proto';
import {
    GameContext,
    listTenpaiDeclarationCandidates,
    type TenpaiDeclarationCandidate,
    type TenpaiDeclarationRejectReason
} from '@step13/core';
import { Tile as TileView } from './Tile';

type Props = {
    context: GameContext;
    playerId: string;
    onDeclareTenpai: (withRiichi: boolean, tileId: string) => void;
    onDiscardSelectedTile: (tileId: string) => void;
    onGuess: (tileKey: string) => void;
    onKan: () => void;
    onKanPass: () => void;
};

const SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

function buildTileCatalog() {
    const result: Array<{ tile: Tile; key: string }> = [];
    SUITS.forEach((suit) => {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            result.push({ tile, key: `${suit}-${rank}` });
        }
    });
    return result;
}

const TILE_CATALOG = buildTileCatalog();

function tileSortKey(tile: Tile): [number, number, number] {
    const suitOrder: Record<Tile['suit'], number> = {
        man: 0,
        pin: 1,
        sou: 2,
        z: 3
    };
    return [suitOrder[tile.suit], tile.rank, tile.isRed ? 0 : 1];
}

function sortTiles(tiles: Tile[]): Tile[] {
    return [...tiles].sort((a, b) => {
        const [aSuit, aRank, aRed] = tileSortKey(a);
        const [bSuit, bRank, bRed] = tileSortKey(b);
        if (aSuit !== bSuit) return aSuit - bSuit;
        if (aRank !== bRank) return aRank - bRank;
        return aRed - bRed;
    });
}

function formatTileKey(tileKey: string | null): string {
    if (!tileKey) return '-';
    const [suit, rank] = tileKey.split('-');
    const suitLabel = suit === 'man' ? '만' : suit === 'pin' ? '통' : suit === 'sou' ? '삭' : '자';
    return `${rank}${suitLabel}`;
}

function findCatalogEntry(tileKey: string | null) {
    if (!tileKey) return null;
    return TILE_CATALOG.find((entry) => entry.key === tileKey) ?? null;
}

function formatRejectReason(reason: TenpaiDeclarationRejectReason | null): string {
    switch (reason) {
        case 'furiten':
            return '후리텐으로 선언할 수 없습니다.';
        case 'no_yaku_wait':
            return '유효한 역이 있는 대기만 선언할 수 있습니다.';
        case 'not_tenpai':
            return '선택한 패를 버리면 텐파이가 아닙니다.';
        case 'invalid_hand':
            return '선언에 필요한 13장 구성이 아닙니다.';
        case 'missing_tile':
            return '선택한 패를 찾지 못했습니다.';
        default:
            return '선언 가능한 패를 선택하세요.';
    }
}

export function AttackDefensePanels({ context, playerId, onDeclareTenpai, onDiscardSelectedTile, onGuess, onKan, onKanPass }: Props) {
    if (context.ruleset === 'classic') return null;

    const stage = context.attackDefense.stage;
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isMyTurn = context.currentTurn === playerId;
    const isDefender = context.attackDefense.defender === playerId;
    const isAttacker = context.attackDefense.attacker === playerId;
    const stageLabel = stage === 'A' ? 'A단계' : stage === 'B_GUESS' ? 'B단계 · 수비 추측' : 'B단계 · 공격';
    const modeLabel = isEasy ? '텐 공방전 Easy' : '텐 공방전';
    const ownTurnCount = context.attackDefense.ownTurns[playerId] ?? 0;
    const turnsLeft = Math.max(0, 18 - ownTurnCount);

    const remainingCounts = new Map<string, number>();
    TILE_CATALOG.forEach((entry) => remainingCounts.set(entry.key, 0));
    context.wall.forEach((tile) => {
        const key = `${tile.suit}-${tile.rank}`;
        remainingCounts.set(key, (remainingCounts.get(key) ?? 0) + 1);
    });

    const drawnTile = context.attackDefense.pendingDrawTile;
    const handTiles = context.hands[playerId] ?? [];
    const turnTiles = [
        ...handTiles,
        ...(drawnTile ? [drawnTile] : [])
    ];
    const orderedTurnTiles = drawnTile
        ? [...sortTiles(handTiles), drawnTile]
        : sortTiles(handTiles);
    const declarationCandidates: TenpaiDeclarationCandidate[] = listTenpaiDeclarationCandidates({
        turnTiles,
        discardedTiles: context.discards[playerId] ?? [],
        doraIndicators: context.doraIndicators ?? [],
        ruleset: context.ruleset,
        seatWind: context.seatMap[playerId] ?? 'WEST'
    });
    const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
    const [selectedStageATileId, setSelectedStageATileId] = useState<string | null>(null);
    const selectedGuessEntry = findCatalogEntry(selectedGuess);
    const selectedDeclaration = declarationCandidates.find((entry: TenpaiDeclarationCandidate) => entry.tile.id === selectedStageATileId) ?? null;
    const lastGuessEntry = findCatalogEntry(context.attackDefense.lastGuessTileKey);
    const showGuessFeedback = stage === 'B_GUESS'
        && context.attackDefense.lastGuessResult !== 'idle'
        && context.attackDefense.lastGuessResult !== 'pending';

    useEffect(() => {
        if (stage !== 'B_GUESS') {
            setSelectedGuess(null);
        }
    }, [stage, context.attackDefense.guessesRemaining]);

    useEffect(() => {
        if (stage !== 'A') {
            setSelectedStageATileId(null);
            return;
        }
        if (!declarationCandidates.some((entry: TenpaiDeclarationCandidate) => entry.tile.id === selectedStageATileId)) {
            const firstDeclareable = declarationCandidates.find((entry: TenpaiDeclarationCandidate) => entry.declareable);
            setSelectedStageATileId((firstDeclareable ?? declarationCandidates[0])?.tile.id ?? null);
        }
    }, [stage, declarationCandidates, selectedStageATileId]);

    return (
        <>
            {/* HUD / Status Info (Top Left Corner) */}
            <div className="absolute left-0 top-0 z-40 p-2 sm:p-4 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
                <div className="pointer-events-auto rounded-3xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md p-3 shadow-xl flex items-center justify-between">
                    <div>
                        <div className="font-black text-cyan-300 tracking-[0.18em] text-xs sm:text-sm">{modeLabel}</div>
                        <div className="text-slate-300 mt-0.5 text-[10px] sm:text-xs">{stageLabel}</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="rounded-2xl bg-slate-900/80 px-3 py-1.5 flex flex-col items-center justify-center border border-slate-700/50">
                            <span className="text-[9px] text-slate-400 font-bold mb-0.5">남은 턴</span>
                            <span className="text-xl font-black text-yellow-300 leading-none">{turnsLeft}</span>
                        </div>
                    </div>
                </div>
                
                <div className="pointer-events-auto grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md px-3 py-2 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">추측 기회</span>
                        <span className="text-base font-black text-cyan-200 leading-none">{context.attackDefense.guessesRemaining}</span>
                    </div>
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/70 backdrop-blur-md px-3 py-2 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">공격 기회</span>
                        <span className="text-base font-black text-amber-200 leading-none">{context.attackDefense.assaultRemaining}</span>
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
                {isAttacker && context.attackDefense.lastGuessTileKey && (
                    <div className="pointer-events-auto rounded-2xl border border-amber-900/50 bg-slate-950/80 backdrop-blur-md px-3 py-2 text-xs text-amber-300 shadow-lg font-medium">
                        수비자 최근 추측: <span className="font-bold text-amber-200">{formatTileKey(context.attackDefense.lastGuessTileKey)}</span>
                    </div>
                )}
            </div>

            {/* STAGE A: Discard & Declare (Floating Bottom Panel) */}
            {stage === 'A' && isMyTurn && (
                <div className="absolute bottom-[calc(max(10dvh,80px))] left-0 right-0 z-50 px-2 sm:px-6 pointer-events-none flex justify-center">
                    <div className="pointer-events-auto flex flex-col w-full max-w-4xl rounded-[2.5rem] border border-cyan-500/30 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] ring-1 ring-white/5">
                        
                        {/* Top Action Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1">
                                    <span className="text-xs font-black tracking-widest text-cyan-300">STAGE A</span>
                                </div>
                                <div className="text-sm font-medium text-slate-300">
                                    {selectedDeclaration ? (
                                        <div className="flex items-center gap-2">
                                            대기패: 
                                            <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-800/50">
                                                {selectedDeclaration.waits.length > 0 ? selectedDeclaration.waits.map((wait: string) => formatTileKey(wait)).join(', ') : '없음'}
                                            </span>
                                            {selectedDeclaration.declareable ? (
                                                <span className="ml-2 text-emerald-400 text-xs font-bold rounded-full bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5">✓ 선언 가능</span>
                                            ) : (
                                                <span className="ml-2 text-rose-400 text-xs font-bold rounded-full bg-rose-950/50 border border-rose-800/50 px-2 py-0.5">
                                                    ✗ {formatRejectReason(selectedDeclaration.rejectReason ?? null)}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="opacity-70">버릴 패를 선택하세요</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 sm:justify-end">
                                <button
                                    onClick={() => selectedStageATileId && onDiscardSelectedTile(selectedStageATileId)}
                                    disabled={!selectedStageATileId}
                                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl border border-slate-600/50 bg-slate-800/80 text-sm font-bold shadow-lg hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    선택 패 버리기
                                </button>
                                <button
                                    onClick={() => selectedStageATileId && onDeclareTenpai(false, selectedStageATileId)}
                                    disabled={!selectedDeclaration?.declareable}
                                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl border border-cyan-500/50 bg-cyan-600/90 text-slate-50 text-sm font-bold shadow-[0_0_15px_rgba(8,145,178,0.4)] hover:bg-cyan-500 transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    텐파이
                                </button>
                                {!isEasy && (
                                    <button
                                        onClick={() => selectedStageATileId && onDeclareTenpai(true, selectedStageATileId)}
                                        disabled={!selectedDeclaration?.declareable}
                                        className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 text-sm font-black shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:from-amber-300 hover:to-amber-500 transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
                                    >
                                        리치
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tiles Row */}
                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-3 rounded-2xl bg-slate-900/60 border border-slate-700/50 overflow-x-auto thin-scrollbar">
                            {orderedTurnTiles.map((tile) => {
                                const selected = selectedStageATileId === tile.id;
                                const candidate = declarationCandidates.find((entry: TenpaiDeclarationCandidate) => entry.tile.id === tile.id) ?? null;
                                const declareable = Boolean(candidate?.declareable);
                                const isDrawnTile = Boolean(drawnTile?.id && tile.id === drawnTile.id);
                                return (
                                    <button
                                        key={tile.id}
                                        onClick={() => setSelectedStageATileId(tile.id ?? null)}
                                        className={`relative rounded-xl border-2 transition-all flex flex-col items-center flex-shrink-0 ${
                                            selected 
                                                ? 'border-cyan-400 bg-cyan-500/20 translate-y-[-6px] shadow-[0_10px_20px_-10px_rgba(34,211,238,0.5)]' 
                                                : declareable
                                                    ? 'border-slate-600/50 bg-slate-800 hover:-translate-y-1 hover:border-slate-500' 
                                                    : 'border-transparent bg-slate-900/80 opacity-50 hover:opacity-80'
                                        } p-1`}
                                    >
                                        {isDrawnTile && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 border border-emerald-300 px-1.5 py-px text-[9px] font-black text-slate-950 shadow-sm whitespace-nowrap z-10">
                                                쓰모패
                                            </div>
                                        )}
                                        <TileView tile={tile} disabled={true} />
                                        {declareable && !selected && (
                                            <div className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,1)]"></div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Cinematic Feedback overlay */}
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

            {/* STAGE B: Guess (Defender's floating dock) */}
            {stage === 'B_GUESS' && isDefender && (
                <div className="absolute bottom-[calc(max(5dvh,40px))] left-0 right-0 z-50 px-2 sm:px-6 pointer-events-none flex justify-center">
                    <div className="pointer-events-auto flex flex-col w-full max-w-5xl rounded-[2.5rem] border border-cyan-500/30 bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] ring-1 ring-white/5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1">
                                    <span className="text-xs font-black tracking-widest text-cyan-300">STAGE B</span>
                                </div>
                                <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    대기패 추측 중... <span className="text-xs text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-full">남은 횟수: {context.attackDefense.guessesRemaining}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="flex-1 sm:flex-none flex justify-end items-center px-4 py-2 rounded-2xl bg-slate-900 border border-slate-700/50">
                                    <span className="text-xs text-slate-400 mr-3">선택됨:</span>
                                    {selectedGuessEntry ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-cyan-300">{formatTileKey(selectedGuess)}</span>
                                            <div className="scale-75 origin-right">
                                                <TileView tile={selectedGuessEntry.tile} disabled={true} />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-600 font-medium">없음</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => selectedGuess && onGuess(selectedGuess)}
                                    disabled={!selectedGuess}
                                    className="px-6 py-2.5 rounded-2xl bg-cyan-600 text-white font-bold shadow-[0_0_15px_rgba(8,145,178,0.4)] hover:bg-cyan-500 transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    확정
                                </button>
                            </div>
                        </div>

                        <div className="relative rounded-2xl border border-slate-700/50 bg-slate-900/60 p-3 max-h-[40vh] overflow-y-auto thin-scrollbar grid grid-cols-7 sm:grid-cols-10 md:grid-cols-17 gap-1.5 md:gap-2 justify-items-center">
                            {TILE_CATALOG.map(({ tile, key }) => {
                                const count = remainingCounts.get(key) ?? 0;
                                const unavailable = count <= 0;
                                const isSelected = selectedGuess === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedGuess(key)}
                                        disabled={unavailable}
                                        className={`relative group rounded-xl p-1 transition-all flex flex-col items-center
                                            ${isSelected ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_5px_15px_rgba(34,211,238,0.3)] scale-110' : 'bg-slate-800 border-2 border-transparent'}
                                            ${unavailable ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:border-slate-500 hover:-translate-y-1 cursor-pointer'} 
                                        `}
                                    >
                                        <TileView tile={tile} disabled={true} />
                                        <div className={`mt-1 text-[9px] font-black ${unavailable ? 'text-rose-400' : isSelected ? 'text-cyan-300' : 'text-slate-400'}`}>
                                            {unavailable ? 'X' : count}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* STAGE B: Assault actions (Kan) */}
            {stage === 'B_ASSAULT' && isAttacker && context.attackDefense.kanOption.pending && (
                <div className="absolute bottom-[calc(max(15dvh,120px))] right-4 sm:right-8 z-50 rounded-[2rem] border border-amber-500/40 bg-slate-950/90 backdrop-blur-xl p-3 flex items-center gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.3)] ring-1 ring-white/5">
                    <div className="flex flex-col items-end pr-2 pl-2">
                        <span className="text-[10px] text-amber-500/70 font-black tracking-widest mb-0.5">KAN OPTION</span>
                        <div className="text-sm text-amber-200 font-bold">{formatTileKey(context.attackDefense.kanOption.tileKey)}</div>
                    </div>
                    <div className="flex items-center gap-2 border-l border-slate-700/50 pl-3">
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
