import { type TenpaiDeclarationCandidate, type TenpaiDeclarationRejectReason } from '@step13/core';
import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

type TenStageAConfig = {
    enabled: boolean;
    selectedTileId: string | null;
    selectedCandidate: TenpaiDeclarationCandidate | null;
    candidateByTileId: Record<string, TenpaiDeclarationCandidate>;
    drawnTileId: string | null;
    showRiichi: boolean;
    onSelectTile: (tileId: string) => void;
    onDiscardSelected: () => void;
    onDeclareTenpai: (withRiichi: boolean) => void;
};

interface HandDisplayProps {
    hand: TileType[];
    pool: TileType[];
    waits?: TileType[];
    onDiscard?: (info: { tile: TileType, index: number }) => void;
    canDiscard?: boolean;
    furitenWaitKeys?: Set<string>;
    isFuriten?: boolean;
    tenStageA?: TenStageAConfig;
}

function tileWaitKey(tile: TileType): string {
    return `${tile.suit}-${tile.rank}`;
}

function tileSortValue(tile: TileType): [number, number, number] {
    const suitOrder: Record<TileType['suit'], number> = {
        man: 0,
        pin: 1,
        sou: 2,
        z: 3
    };
    return [suitOrder[tile.suit], tile.rank, tile.isRed ? 0 : 1];
}

function sortTiles(tiles: TileType[]): TileType[] {
    return [...tiles].sort((a, b) => {
        const [aSuit, aRank, aRed] = tileSortValue(a);
        const [bSuit, bRank, bRed] = tileSortValue(b);
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

function tileFromWaitKey(tileKey: string): TileType {
    const [suit, rank] = tileKey.split('-');
    return {
        suit: suit as TileType['suit'],
        rank: Number(rank) as TileType['rank'],
        isRed: false
    };
}

export function HandDisplay({
    hand,
    pool,
    waits = [],
    onDiscard,
    canDiscard,
    furitenWaitKeys = new Set<string>(),
    isFuriten = false,
    tenStageA
}: HandDisplayProps) {
    const stageAEnabled = Boolean(tenStageA?.enabled);
    const selectedTileId = tenStageA?.selectedTileId ?? null;
    const selectedCandidate = tenStageA?.selectedCandidate ?? null;
    const sortedHand = sortTiles(hand);
    const sortedPool = stageAEnabled
        ? (() => {
            const drawnTileId = tenStageA?.drawnTileId;
            const drawTile = drawnTileId ? pool.find((tile) => tile.id === drawnTileId) ?? null : null;
            const baseTiles = sortTiles(pool.filter((tile) => tile.id !== drawnTileId));
            return drawTile ? [...baseTiles, drawTile] : baseTiles;
        })()
        : sortTiles(pool);
    const sortedWaits = stageAEnabled
        ? sortTiles((selectedCandidate?.waits ?? []).map(tileFromWaitKey))
        : sortTiles(waits);

    return (
        <div className="w-full max-w-none mx-auto flex flex-col gap-1 sm:gap-3 min-w-0">
            {!stageAEnabled && (
                <>
                    <div className="px-1 sm:px-2 text-[10px] sm:text-xs text-slate-400">내 손패 (고정 13장)</div>
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center xl:justify-start p-1 sm:p-2 bg-slate-800 rounded min-w-0">
                        {sortedHand.map((tile, i) => (
                            <Tile
                                key={`${tile.id}-${i}`}
                                tile={tile}
                                size="md"
                                disabled={true}
                            />
                        ))}
                    </div>
                </>
            )}

            {stageAEnabled && (
                <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-3 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[10px] sm:text-xs font-black tracking-[0.2em] text-cyan-300">
                                        STAGE A
                                    </span>
                                    <span className="text-[11px] sm:text-xs text-slate-400">패를 먼저 고른 뒤 행동합니다.</span>
                                </div>
                                {selectedCandidate ? (
                                    <div className="flex flex-col gap-2 text-sm text-slate-200">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-slate-400">대기패</span>
                                            <span className="rounded-md border border-cyan-800/50 bg-cyan-950/40 px-2 py-1 text-cyan-200 font-semibold">
                                                {selectedCandidate.waits.length > 0
                                                    ? selectedCandidate.waits.map((wait) => formatTileKey(wait)).join(', ')
                                                    : '없음'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                            {selectedCandidate.declareable ? (
                                                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/40 px-2 py-1 font-bold text-emerald-300">
                                                    선언 가능
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-rose-700/50 bg-rose-950/40 px-2 py-1 font-bold text-rose-300">
                                                    {formatRejectReason(selectedCandidate.rejectReason ?? null)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400">버릴 패를 선택하세요.</div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                <button
                                    onClick={() => tenStageA?.onDiscardSelected()}
                                    disabled={!selectedTileId}
                                    className="min-w-[7rem] rounded-2xl border border-slate-600/60 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    선택 패 버리기
                                </button>
                                <button
                                    onClick={() => tenStageA?.onDeclareTenpai(false)}
                                    disabled={!selectedCandidate?.declareable}
                                    className="min-w-[6.5rem] rounded-2xl border border-cyan-500/50 bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    텐파이
                                </button>
                                {tenStageA?.showRiichi && (
                                    <button
                                        onClick={() => tenStageA?.onDeclareTenpai(true)}
                                        disabled={!selectedCandidate?.declareable}
                                        className="min-w-[6.5rem] rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:from-amber-300 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        리치
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-1 sm:px-2 text-[10px] sm:text-xs text-slate-400 flex items-center justify-between">
                <span>{stageAEnabled ? '선택할 패' : '버릴 패 (Pool)'}</span>
                {!stageAEnabled && isFuriten && <span className="text-red-300 font-bold">후리텐 상태</span>}
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-center xl:justify-start p-2 sm:p-3 bg-slate-800 rounded-xl min-h-[56px] sm:min-h-[88px] min-w-0">
                {sortedPool.length === 0 && (
                    <span className="text-slate-400 py-2 sm:py-4 text-[10px] sm:text-sm">버릴패 없음</span>
                )}
                {sortedPool.map((tile, i) => {
                    const isFuritenCandidate = !stageAEnabled && furitenWaitKeys.has(tileWaitKey(tile));
                    const isSelected = selectedTileId === tile.id;
                    const candidate = tile.id ? tenStageA?.candidateByTileId[tile.id] ?? null : null;
                    const isDrawnTile = Boolean(stageAEnabled && tenStageA?.drawnTileId && tile.id === tenStageA.drawnTileId);
                    return (
                        <div
                            key={`${tile.id}-${i}`}
                            className={`relative rounded ${isFuritenCandidate ? 'ring-2 ring-red-500' : ''}`}
                            title={isFuritenCandidate ? '이 패를 버리면 후리텐 대기패가 됩니다.' : undefined}
                        >
                            {isDrawnTile && (
                                <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-500 px-1.5 py-px text-[9px] font-black text-slate-950 whitespace-nowrap">
                                    쓰모패
                                </span>
                            )}
                            {isFuritenCandidate && (
                                <span className="absolute -top-2 -right-2 z-10 px-1 rounded bg-red-600 text-[10px] font-bold text-white">
                                    후
                                </span>
                            )}
                            {stageAEnabled && candidate?.declareable && !isSelected && (
                                <span className="absolute -bottom-1 left-1/2 z-10 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                            )}
                            <Tile
                                tile={tile}
                                size="board"
                                selected={isSelected}
                                onClick={() => {
                                    if (stageAEnabled) {
                                        if (tile.id) {
                                            tenStageA?.onSelectTile(tile.id);
                                        }
                                        return;
                                    }
                                    if (canDiscard) {
                                        onDiscard?.({ tile, index: i });
                                    }
                                }}
                                disabled={stageAEnabled ? !tile.id : !canDiscard}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="px-1 sm:px-2 text-[10px] sm:text-xs text-slate-400">{stageAEnabled ? '선택 패 기준 대기패' : '내 대기패'}</div>
            <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center xl:justify-start p-1 sm:p-2 bg-slate-800 rounded min-h-[44px] sm:min-h-[56px] min-w-0">
                {sortedWaits.length === 0 && (
                    <span className="text-slate-400 py-1 sm:py-2 text-[10px] sm:text-sm">
                        {stageAEnabled ? '선택한 패 기준 대기패 없음' : '대기패 없음'}
                    </span>
                )}
                {sortedWaits.map((tile, i) => (
                    <Tile key={`${tile.suit}-${tile.rank}-${i}`} tile={tile} size="sm" disabled={true} />
                ))}
            </div>
        </div>
    );
}
