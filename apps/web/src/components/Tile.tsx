import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tile as TileType } from '@step13/proto';

interface TileProps {
    tile: TileType;
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export type TileSkin = 'classic' | 'real';

const TileSkinContext = createContext<TileSkin>('classic');

interface TileSkinProviderProps {
    skin: TileSkin;
    children: ReactNode;
}

export function TileSkinProvider({ skin, children }: TileSkinProviderProps) {
    return <TileSkinContext.Provider value={skin}>{children}</TileSkinContext.Provider>;
}

function getRealTileAsset(tile: TileType): string {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    if (tile.suit === 'z') {
        const honors = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];
        return `${root}tiles/regular-png/${honors[tile.rank - 1]}.png`;
    }

    const suitPrefix: Record<Exclude<TileType['suit'], 'z'>, string> = {
        man: 'Man',
        pin: 'Pin',
        sou: 'Sou'
    };
    const base = `${suitPrefix[tile.suit as Exclude<TileType['suit'], 'z'>]}${tile.rank}`;
    const doraSuffix = tile.isRed && tile.rank === 5 ? '-Dora' : '';
    return `${root}tiles/regular-png/${base}${doraSuffix}.png`;
}

export function Tile({ tile, onClick, selected, disabled, size = 'md' }: TileProps) {
    const skin = useContext(TileSkinContext);
    const [imageLoaded, setImageLoaded] = useState(false);
    const realAssetSrc = useMemo(() => getRealTileAsset(tile), [tile]);

    useEffect(() => {
        setImageLoaded(false);
    }, [realAssetSrc]);

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
                border-2 rounded
                shadow-md transition-all
                ${selected ? 'border-yellow-400 -translate-y-2' : 'border-slate-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${skin === 'classic' ? 'bg-slate-100 hover:bg-white' : 'bg-slate-200/90 hover:bg-slate-100'}
                ${skin === 'classic' ? suitColors[tile.suit] : 'text-slate-900'}
                font-bold
            `}
        >
            {skin === 'real' ? (
                <div className="relative w-full h-full">
                    <div className={`absolute inset-0 flex flex-col items-center justify-center leading-none transition-opacity ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
                        <span>{getDisplayRank()}</span>
                        <span className="text-[10px] uppercase">{getDisplaySuit()}</span>
                    </div>
                    <img
                        src={realAssetSrc}
                        alt={`${tile.suit}-${tile.rank}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(false)}
                        className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center leading-none">
                    <span>{getDisplayRank()}</span>
                    <span className="text-[10px] uppercase">{getDisplaySuit()}</span>
                </div>
            )}
        </button>
    );
}
