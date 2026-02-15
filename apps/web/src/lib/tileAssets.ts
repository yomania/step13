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

    preloadPromise = Promise.all(
        assetNames.map((name) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = getRealTileAssetUrl(name, root);
            });
        })
    ).then(() => undefined);

    return preloadPromise;
}
