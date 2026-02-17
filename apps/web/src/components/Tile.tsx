import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tile as TileType } from '@step13/proto';
import { getTileAssetRoot } from '../lib/tileAssets';

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

// Helper to detect hidden tiles (Fog of War)
function isHiddenTile(tile: TileType): boolean {
    if (!tile.id) return false;
    return tile.id === 'HIDDEN' || tile.id.startsWith('wall-') || tile.id.startsWith('hidden-');
}



export function Tile({ tile, onClick, selected, disabled, size = 'md' }: TileProps) {
    const skin = useContext(TileSkinContext);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [assetExt, setAssetExt] = useState<'svg' | 'png'>('svg');
    const [errorCount, setErrorCount] = useState(0);

    const hidden = isHiddenTile(tile);

    const getAssetUrl = (ext: 'svg' | 'png', root = getTileAssetRoot()) => {
        const folder = ext === 'svg' ? 'regular' : 'regular-png';

        let fileName = '';
        if (hidden) {
            fileName = `Back.${ext}`;
        } else if (tile.suit === 'z') {
            const honors = ['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'];
            fileName = `${honors[tile.rank - 1]}.${ext}`;
        } else {
            const suitPrefix: Record<Exclude<TileType['suit'], 'z'>, string> = {
                man: 'Man',
                pin: 'Pin',
                sou: 'Sou'
            };
            const base = `${suitPrefix[tile.suit as Exclude<TileType['suit'], 'z'>]}${tile.rank}`;
            const doraSuffix = tile.isRed && tile.rank === 5 ? '-Dora' : '';
            fileName = `${base}${doraSuffix}.${ext}`;
        }

        return `${root}tiles/${folder}/${fileName}`;
    };

    const currentSrc = useMemo(() => getAssetUrl(assetExt), [tile, hidden, assetExt]);


    useEffect(() => {
        setImageLoaded(false);
        setAssetExt('svg');
        setErrorCount(0);
    }, [tile.suit, tile.rank, tile.isRed, hidden]);

    const sizeClasses = {
        sm: 'w-8 h-12 text-xs',
        md: 'w-10 h-14 text-sm',
        lg: 'w-12 h-16 text-base'
    };

    const suitColors = {
        man: 'text-red-600',
        pin: 'text-blue-600',
        sou: 'text-green-600',
        z: 'text-purple-600'
    };

    const getDisplayRank = () => {
        if (hidden) return '?';
        if (tile.suit === 'z') {
            return ['동', '남', '서', '북', '백', '발', '중'][tile.rank - 1];
        }
        return tile.rank;
    };

    const getDisplaySuit = () => {
        if (hidden) return 'BACK';
        switch (tile.suit) {
            case 'man': return '만';
            case 'pin': return '통';
            case 'sou': return '삭';
            case 'z': return '자';
            default: return tile.suit;
        }
    };

    const handleError = () => {
        if (assetExt === 'svg') {
            // Priority 1: Try PNG with same root
            setAssetExt('png');
        } else if (errorCount === 0) {
            // Priority 2: Try local fallback root (Reset to SVG)
            setAssetExt('svg');
            setErrorCount(1);
        } else {
            // Fail
            setImageLoaded(false);
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
                ${skin === 'classic' ? (hidden ? 'bg-slate-300' : 'bg-slate-100 hover:bg-white') : 'bg-slate-200/90 hover:bg-slate-100'}
                ${skin === 'classic' ? (hidden ? 'text-slate-500' : suitColors[tile.suit]) : 'text-slate-900'}
                font-bold
                relative
                overflow-hidden
            `}
        >
            {skin === 'real' ? (
                <div className="relative w-full h-full">
                    <div className={`absolute inset-0 flex flex-col items-center justify-center leading-none transition-opacity duration-300 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
                        <span>{getDisplayRank()}</span>
                        <span className="text-[10px] uppercase">{getDisplaySuit()}</span>
                    </div>
                    <img
                        key={currentSrc}
                        src={currentSrc}
                        alt={hidden ? 'Hidden Tile' : `${tile.suit}-${tile.rank}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={handleError}
                        className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center leading-none">
                    {hidden ? (
                        <span className="text-xs">BACK</span>
                    ) : (
                        <>
                            <span>{getDisplayRank()}</span>
                            <span className="text-[10px] uppercase">{getDisplaySuit()}</span>
                        </>
                    )}
                </div>
            )}
        </button>
    );
}
