import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface DiscardPileProps {
    discards: TileType[];
    isOpponent?: boolean;
}

export function DiscardPile({ discards, isOpponent }: DiscardPileProps) {
    return (
        <div className={`flex flex-wrap gap-1 sm:gap-1.5 justify-center lg:justify-start p-2 sm:p-3 min-h-[56px] sm:min-h-[112px] bg-slate-800 rounded-xl ${isOpponent ? 'rotate-180' : ''}`}>
            {discards.length === 0 && <span className="text-slate-500 text-[10px] sm:text-sm pt-0 sm:pt-2">버림패 없음</span>}
            {discards.map((tile, i) => (
                <Tile
                    key={`${tile.id}-${i}`}
                    tile={tile}
                    size="board"
                    disabled // Discards are not clickable usually
                />
            ))}
        </div>
    );
}
