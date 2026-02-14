import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface DiscardPileProps {
    discards: TileType[];
}

export function DiscardPile({ discards }: DiscardPileProps) {
    // Usually discards are 6 per row in Riichi, but for 17-steps maybe similar.
    // We'll just wrap them.
    return (
        <div className="flex flex-wrap gap-1 justify-start p-2 min-h-[100px] bg-slate-800 rounded">
            {discards.length === 0 && <span className="text-gray-500 text-sm">버림패 없음</span>}
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
