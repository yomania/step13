import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';

interface HandDisplayProps {
    hand: TileType[];
    onDiscard?: (info: { tile: TileType, index: number }) => void;
    canDiscard?: boolean;
}

export function HandDisplay({ hand, onDiscard, canDiscard }: HandDisplayProps) {
    // Sort hand for display
    const sortedHand = [...hand].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank - b.rank;
    });

    return (
        <div className="flex flex-wrap gap-1 justify-center p-2 bg-slate-800 rounded">
            {sortedHand.map((tile, i) => (
                <Tile
                    key={`${tile.id}-${i}`}
                    tile={tile}
                    size="md"
                    onClick={() => canDiscard && onDiscard?.({ tile, index: i })}
                    disabled={!canDiscard}
                // Highlight or animate on hover if canDiscard
                />
            ))}
        </div>
    );
}
