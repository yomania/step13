import { useState } from 'react';
import { Tile as TileType } from '@step13/proto';
import { Tile } from './Tile';
import { isTenpai } from '@step13/scoring';

interface HandBuilderProps {
    dealtTiles: TileType[];
    onSubmit: (hand: TileType[], pool: TileType[]) => void;
}

export function HandBuilder({ dealtTiles, onSubmit }: HandBuilderProps) {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    // Sort tiles by suit and rank for display
    // We map original indices to sorted tiles to keep track of selection
    const sortedTilesWithIndices = dealtTiles.map((tile, index) => ({ tile, index }))
        .sort((a, b) => {
            if (a.tile.suit !== b.tile.suit) return a.tile.suit.localeCompare(b.tile.suit);
            return a.tile.rank - b.tile.rank;
        });

    const toggleTile = (originalIndex: number) => {
        if (selectedIndices.includes(originalIndex)) {
            setSelectedIndices(selectedIndices.filter(i => i !== originalIndex));
        } else {
            if (selectedIndices.length < 13) {
                setSelectedIndices([...selectedIndices, originalIndex]);
            }
        }
    };

    const selectedTiles = selectedIndices.map(i => dealtTiles[i]);
    const isValid = selectedTiles.length === 13 && isTenpai(selectedTiles);

    const handleSubmit = () => {
        if (!isValid) return;
        const hand = selectedTiles;
        const pool = dealtTiles.filter((_, i) => !selectedIndices.includes(i));
        onSubmit(hand, pool);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <span className="font-bold">
                    선택됨: {selectedTiles.length} / 13
                </span>
                <span className={`text-sm ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                    {isValid ? '제출 준비 완료 (텐파이)' : '유효하지 않은 패 (13개 & 텐파이 필수)'}
                </span>
            </div>

            {/* Dealt Tiles Grid */}
            <div className="grid grid-cols-8 gap-2 p-4 bg-slate-700 rounded-lg">
                {sortedTilesWithIndices.map(({ tile, index }) => (
                    <Tile
                        key={`${tile.id}-${index}`}
                        tile={tile}
                        selected={selectedIndices.includes(index)}
                        onClick={() => toggleTile(index)}
                        disabled={selectedIndices.length >= 13 && !selectedIndices.includes(index)}
                    />
                ))}
            </div>

            <button
                onClick={handleSubmit}
                disabled={!isValid}
                className={`
                    w-full py-3 rounded font-bold text-lg transition-colors
                    ${isValid
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
                `}
            >
                패 확정
            </button>
        </div>
    );
}
