import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface HandDisplayProps {
    hand: TileType[];
    pool: TileType[];
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

    return (
        <div className="w-full flex flex-col gap-3">
            <div className="px-2 text-xs text-slate-400">내 손패 (고정 13장)</div>
            <div className="flex flex-wrap gap-1 justify-center p-2 bg-slate-800 rounded">
                {sortedHand.map((tile, i) => (
                    <Tile
                        key={`${tile.id}-${i}`}
                        tile={tile}
                        size="md"
                        disabled={true}
                    />
                ))}
            </div>

            <div className="px-2 text-xs text-slate-400 flex items-center justify-between">
                <span>버릴 패 (Pool)</span>
                {isFuriten && <span className="text-red-300 font-bold">후리텐 상태</span>}
            </div>
            <div className="flex flex-wrap gap-1 justify-center p-2 bg-slate-800 rounded min-h-[72px]">
                {sortedPool.length === 0 && (
                    <span className="text-slate-400 py-4">버릴패 없음</span>
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
                                size="md"
                                onClick={() => canDiscard && onDiscard?.({ tile, index: i })}
                                disabled={!canDiscard}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
