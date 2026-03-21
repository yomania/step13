import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface HandDisplayProps {
    hand: TileType[];
    pool: TileType[];
    waits?: TileType[];
    onDiscard?: (info: { tile: TileType, index: number }) => void;
    canDiscard?: boolean;
    furitenWaitKeys?: Set<string>;
    isFuriten?: boolean;
}

function tileWaitKey(tile: TileType): string {
    return `${tile.suit}-${tile.rank}`;
}

export function HandDisplay({
    hand,
    pool,
    waits = [],
    onDiscard,
    canDiscard,
    furitenWaitKeys = new Set<string>(),
    isFuriten = false
}: HandDisplayProps) {
    const sortedHand = [...hand].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });

    const sortedPool = [...pool].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });
    const sortedWaits = [...waits].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });

    return (
        <div className="w-full max-w-none mx-auto flex flex-col gap-1 sm:gap-3 min-w-0">
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

            <div className="px-1 sm:px-2 text-[10px] sm:text-xs text-slate-400 flex items-center justify-between">
                <span>버릴 패 (Pool)</span>
                {isFuriten && <span className="text-red-300 font-bold">후리텐 상태</span>}
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-center xl:justify-start p-2 sm:p-3 bg-slate-800 rounded-xl min-h-[56px] sm:min-h-[88px] min-w-0">
                {sortedPool.length === 0 && (
                    <span className="text-slate-400 py-2 sm:py-4 text-[10px] sm:text-sm">버릴패 없음</span>
                )}
                {sortedPool.map((tile, i) => {
                    const isFuritenCandidate = furitenWaitKeys.has(tileWaitKey(tile));
                    return (
                        <div
                            key={`${tile.id}-${i}`}
                            className={`relative rounded ${isFuritenCandidate ? 'ring-2 ring-red-500' : ''}`}
                            title={isFuritenCandidate ? '이 패를 버리면 후리텐 대기패가 됩니다.' : undefined}
                        >
                            {isFuritenCandidate && (
                                <span className="absolute -top-2 -right-2 z-10 px-1 rounded bg-red-600 text-[10px] font-bold text-white">
                                    후
                                </span>
                            )}
                            <Tile
                                tile={tile}
                                size="board"
                                onClick={() => canDiscard && onDiscard?.({ tile, index: i })}
                                disabled={!canDiscard}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="px-1 sm:px-2 text-[10px] sm:text-xs text-slate-400">내 대기패</div>
            <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center xl:justify-start p-1 sm:p-2 bg-slate-800 rounded min-h-[44px] sm:min-h-[56px] min-w-0">
                {sortedWaits.length === 0 && <span className="text-slate-400 py-1 sm:py-2 text-[10px] sm:text-sm">대기패 없음</span>}
                {sortedWaits.map((tile, i) => (
                    <Tile key={`${tile.suit}-${tile.rank}-${i}`} tile={tile} size="sm" disabled={true} />
                ))}
            </div>
        </div>
    );
}
