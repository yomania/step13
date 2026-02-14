import { Tile as TileType } from '@step13/proto';

interface TileProps {
    tile: TileType;
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function Tile({ tile, onClick, selected, disabled, size = 'md' }: TileProps) {
    const sizeClasses = {
        sm: 'w-8 h-12 text-xs',
        md: 'w-10 h-14 text-sm',
        lg: 'w-12 h-16 text-base'
    };

    // Simple text representation for now. 
    // In real app, replace with SVG or Image assets.
    const suitColors = {
        man: 'text-red-600',
        pin: 'text-blue-600',
        sou: 'text-green-600',
        z: 'text-purple-600'
    };

    const getDisplayRank = () => {
        if (tile.suit === 'z') {
            return ['동', '남', '서', '북', '백', '발', '중'][tile.rank - 1];
        }
        return tile.rank;
    };

    const getDisplaySuit = () => {
        switch (tile.suit) {
            case 'man': return '만';
            case 'pin': return '통';
            case 'sou': return '삭';
            case 'z': return '자';
            default: return tile.suit;
        }
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                ${sizeClasses[size]}
                flex items-center justify-center
                bg-slate-100 border-2 rounded
                shadow-md transition-all
                ${selected ? 'border-yellow-400 -translate-y-2' : 'border-slate-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}
                ${suitColors[tile.suit]}
                font-bold
            `}
        >
            <div className="flex flex-col items-center leading-none">
                <span>{getDisplayRank()}</span>
                <span className="text-[10px] uppercase">{getDisplaySuit()}</span>
            </div>
        </button>
    );
}
