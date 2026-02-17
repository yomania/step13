let preloadPromise: Promise<void> | null = null;

function normalizeRoot(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '/';
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function getLocalTileRoot(): string {
    const baseUrl = import.meta.env.BASE_URL || '/';
    return normalizeRoot(baseUrl);
}

export function getTileAssetRoot(): string {
    const cdnBase = (import.meta.env.VITE_TILE_CDN_BASE as string | undefined) ?? '';
    if (cdnBase.trim().length > 0) {
        return normalizeRoot(cdnBase);
    }
    return getLocalTileRoot();
}

export function getFallbackTileAssetRoot(): string {
    return getLocalTileRoot();
}

export function getRealTileAssetUrl(fileName: string, root = getTileAssetRoot()): string {
    return `${root}tiles/regular-png/${fileName}`;
}

function buildTileAssetNames(): string[] {
    const names: string[] = [];

    for (const suit of ['Man', 'Pin', 'Sou'] as const) {
        for (let rank = 1; rank <= 9; rank++) {
            names.push(`${suit}${rank}.png`);
        }
        names.push(`${suit}5-Dora.png`);
    }

    names.push('Ton.png', 'Nan.png', 'Shaa.png', 'Pei.png', 'Haku.png', 'Hatsu.png', 'Chun.png');
    names.push('Back.png', 'Front.png', 'Blank.png');
    return names;
}

export function preloadRealTileAssets(): Promise<void> {
    if (preloadPromise) return preloadPromise;

    const root = getTileAssetRoot();
    const assetNames = buildTileAssetNames();

    // PNG 외에 SVG도 우선적으로 캐싱 시도 (환경에 따라 SVG가 더 안정적일 수 있음)
    const svgNames = assetNames.map(n => n.replace('.png', '.svg'));
    const allToLoad = [...assetNames, ...svgNames];

    preloadPromise = Promise.all(
        allToLoad.map((name) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();

                let url;
                if (name.endsWith('.svg')) {
                    url = `${root}tiles/regular/${name}`;
                } else {
                    url = getRealTileAssetUrl(name, root);
                }
                img.src = url;
            });
        })
    ).then(() => {
        console.log('Tile assets preloaded.');
    });

    return preloadPromise;
}
