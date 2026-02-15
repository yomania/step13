let preloadPromise: Promise<void> | null = null;

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

    const baseUrl = import.meta.env.BASE_URL || '/';
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const assetNames = buildTileAssetNames();

    preloadPromise = Promise.all(
        assetNames.map((name) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = `${root}tiles/regular-png/${name}`;
            });
        })
    ).then(() => undefined);

    return preloadPromise;
}
