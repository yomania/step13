import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface DiscardPileProps {
    discards: TileType[];
    isOpponent?: boolean;
}

export function DiscardPile({ discards, isOpponent }: DiscardPileProps) {
    // Usually discards are 6 per row in Riichi, but for 17-steps maybe similar.
    // We'll just wrap them.
    return (
        <div className={`flex flex-wrap gap-0.5 sm:gap-1 justify-start p-1 sm:p-2 min-h-[40px] sm:min-h-[100px] bg-slate-800 rounded ${isOpponent ? 'rotate-180' : ''}`}>
            {discards.length === 0 && <span className="text-slate-500 text-[10px] sm:text-sm pt-0 sm:pt-2">버림패 없음</span>}
            {discards.map((tile, i) => (
                <Tile
                    key={`${tile.id}-${i}`}
                    tile={tile}
                    size="sm"
                    disabled // Discards are not clickable usually
                />
            ))}
        </div>
    );
}
