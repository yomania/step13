import { useEffect, useState } from 'react';
import { Tile } from '@step13/proto';
import { GameContext } from '@step13/core';
import { calculateShanten } from '@step13/scoring';
import { Tile as TileView } from './Tile';

type Props = {
    context: GameContext;
    playerId: string;
    onDeclareTenpai: (withRiichi: boolean) => void;
    onPass: () => void;
    onGuess: (tileKey: string) => void;
    onKan: () => void;
    onKanPass: () => void;
};

const SUITS: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];

function buildTileCatalog() {
    const result: Array<{ tile: Tile; key: string }> = [];
    SUITS.forEach((suit) => {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const tile: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            result.push({ tile, key: `${suit}-${rank}` });
        }
    });
    return result;
}

const TILE_CATALOG = buildTileCatalog();

function computeWaitPreview(hand: Tile[]): string[] {
    if (hand.length !== 13) return [];
    const waits: string[] = [];
    TILE_CATALOG.forEach(({ tile, key }) => {
        if (calculateShanten([...hand, tile]) === -1) {
            waits.push(key);
        }
    });
    return waits;
}

export function AttackDefensePanels({ context, playerId, onDeclareTenpai, onPass, onGuess, onKan, onKanPass }: Props) {
    if (context.ruleset === 'classic') return null;
    const stage = context.attackDefense.stage;
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isMyTurn = context.currentTurn === playerId;
    const isDefender = context.attackDefense.defender === playerId;
    const stageLabel = stage === 'A' ? 'Stage A' : stage === 'B_GUESS' ? 'Stage B: Defense Guess' : 'Stage B: Attack Assault';
    const modeLabel = context.ruleset === 'ten_attack_defense_easy' ? 'Ten Attack Defense (Easy)' : 'Ten Attack Defense';

    const remainingCounts = new Map<string, number>();
    TILE_CATALOG.forEach((entry) => remainingCounts.set(entry.key, 0));
    context.wall.forEach((tile) => {
        const key = `${tile.suit}-${tile.rank}`;
        remainingCounts.set(key, (remainingCounts.get(key) ?? 0) + 1);
    });
    const waitPreview = computeWaitPreview(context.hands[playerId] ?? []);
    const [selectedGuess, setSelectedGuess] = useState<string | null>(null);

    useEffect(() => {
        if (stage !== 'B_GUESS') {
            setSelectedGuess(null);
        }
    }, [stage, context.attackDefense.guessesRemaining]);

    return (
        <>
            <div className="absolute left-3 top-20 z-30 w-64 rounded-xl border border-slate-600 bg-slate-900/90 p-3 text-xs">
                <div className="font-bold text-cyan-300">{modeLabel}</div>
                <div className="text-slate-300 mt-1">{stageLabel}</div>
                <div className="text-slate-400 mt-2">Guess Left: {context.attackDefense.guessesRemaining}</div>
                <div className="text-slate-400">Assault Left: {context.attackDefense.assaultRemaining}</div>
                {context.attackDefense.declarationType && (
                    <div className="text-slate-400">Declaration: {context.attackDefense.declarationType}</div>
                )}
                {context.attackDefense.attacker === playerId && context.attackDefense.lastGuessTileKey && (
                    <div className="text-amber-300">Defender guessed: {context.attackDefense.lastGuessTileKey}</div>
                )}
            </div>

            {stage === 'A' && isMyTurn && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-4 flex items-center gap-2">
                    <div className="text-xs text-cyan-200 mr-2">Waits: {waitPreview.join(', ') || '-'}</div>
                    <button onClick={() => onDeclareTenpai(false)} className="px-3 py-2 rounded bg-cyan-600 font-semibold">Declare Tenpai</button>
                    {!isEasy && (
                        <button onClick={() => onDeclareTenpai(true)} className="px-3 py-2 rounded bg-amber-600 font-semibold">Riichi</button>
                    )}
                    <button onClick={onPass} className="px-3 py-2 rounded bg-slate-700 font-semibold">Pass</button>
                </div>
            )}

            {stage === 'B_GUESS' && isDefender && (
                <div className="absolute bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-700 p-3">
                    <div className="text-sm mb-2 font-semibold text-rose-200">Select defender guess ({context.attackDefense.guessesRemaining} left)</div>
                    <div className="grid grid-cols-10 gap-2 max-h-52 overflow-y-auto">
                        {TILE_CATALOG.map(({ tile, key }) => {
                            const count = remainingCounts.get(key) ?? 0;
                            const unavailable = count <= 0;
                            return (
                                <button key={key} onClick={() => setSelectedGuess(key)} disabled={unavailable} className={`relative rounded border p-1 ${selectedGuess === key ? 'ring-2 ring-amber-300' : ''} ${unavailable ? 'border-slate-700 opacity-50' : 'border-cyan-500'}`}>
                                    <TileView tile={tile} disabled={true} />
                                    <div className="text-[10px] mt-1">{unavailable ? 'X' : count}</div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            onClick={() => selectedGuess && onGuess(selectedGuess)}
                            disabled={!selectedGuess}
                            className="px-3 py-2 rounded bg-cyan-700 disabled:opacity-50 text-sm font-semibold"
                        >
                            Confirm
                        </button>
                        <div className="text-xs text-slate-300">{selectedGuess ?? 'No tile selected'}</div>
                    </div>
                </div>
            )}
            {stage === 'B_ASSAULT' && context.attackDefense.attacker === playerId && context.attackDefense.kanOption.pending && (
                <div className="absolute bottom-4 right-4 z-40 rounded-2xl border border-amber-500/50 bg-slate-900/95 p-3 flex items-center gap-2">
                    <div className="text-xs text-amber-200 mr-2">KAN available: {context.attackDefense.kanOption.tileKey}</div>
                    <button onClick={onKan} className="px-3 py-2 rounded bg-amber-600 font-semibold">KAN</button>
                    <button onClick={onKanPass} className="px-3 py-2 rounded bg-slate-700 font-semibold">PASS</button>
                </div>
            )}
        </>
    );
}
