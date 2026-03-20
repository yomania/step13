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

function formatTileKey(tileKey: string | null): string {
    if (!tileKey) return '-';
    const [suit, rank] = tileKey.split('-');
    const suitLabel = suit === 'man' ? '만' : suit === 'pin' ? '통' : suit === 'sou' ? '삭' : '자';
    return `${rank}${suitLabel}`;
}

function findCatalogEntry(tileKey: string | null) {
    if (!tileKey) return null;
    return TILE_CATALOG.find((entry) => entry.key === tileKey) ?? null;
}

export function AttackDefensePanels({ context, playerId, onDeclareTenpai, onPass, onGuess, onKan, onKanPass }: Props) {
    if (context.ruleset === 'classic') return null;

    const stage = context.attackDefense.stage;
    const isEasy = context.ruleset === 'ten_attack_defense_easy';
    const isMyTurn = context.currentTurn === playerId;
    const isDefender = context.attackDefense.defender === playerId;
    const isAttacker = context.attackDefense.attacker === playerId;
    const stageLabel = stage === 'A' ? 'A단계' : stage === 'B_GUESS' ? 'B단계 · 수비 추측' : 'B단계 · 공격';
    const modeLabel = isEasy ? '텐 공방전 Easy' : '텐 공방전';
    const ownTurnCount = context.attackDefense.ownTurns[playerId] ?? 0;
    const turnsLeft = Math.max(0, 18 - ownTurnCount);

    const remainingCounts = new Map<string, number>();
    TILE_CATALOG.forEach((entry) => remainingCounts.set(entry.key, 0));
    context.wall.forEach((tile) => {
        const key = `${tile.suit}-${tile.rank}`;
        remainingCounts.set(key, (remainingCounts.get(key) ?? 0) + 1);
    });

    const waitPreview = computeWaitPreview(context.hands[playerId] ?? []);
    const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
    const selectedGuessEntry = findCatalogEntry(selectedGuess);
    const lastGuessEntry = findCatalogEntry(context.attackDefense.lastGuessTileKey);
    const showGuessFeedback = stage === 'B_GUESS'
        && context.attackDefense.lastGuessResult !== 'idle'
        && context.attackDefense.lastGuessResult !== 'pending';

    useEffect(() => {
        if (stage !== 'B_GUESS') {
            setSelectedGuess(null);
        }
    }, [stage, context.attackDefense.guessesRemaining]);

    return (
        <>
            <div className="absolute left-3 top-20 z-30 w-72 rounded-2xl border border-slate-600/80 bg-slate-950/92 p-4 text-xs shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="font-black text-cyan-300 tracking-[0.18em]">{modeLabel}</div>
                        <div className="text-slate-300 mt-1">{stageLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-center">
                        <div className="text-[10px] text-slate-400">남은 턴</div>
                        <div className="text-2xl font-black text-yellow-300 leading-none">{turnsLeft}</div>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2">
                        <div className="text-[10px] text-slate-400">추측 기회</div>
                        <div className="text-lg font-black text-cyan-200">{context.attackDefense.guessesRemaining}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2">
                        <div className="text-[10px] text-slate-400">공격 기회</div>
                        <div className="text-lg font-black text-amber-200">{context.attackDefense.assaultRemaining}</div>
                    </div>
                </div>
                {context.attackDefense.declarationType && (
                    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-slate-300">
                        선언: <span className="font-bold text-white">{context.attackDefense.declarationType === 'RIICHI' ? '리치' : '텐파이'}</span>
                        {context.attackDefense.declaredBy && (
                            <span className="text-slate-400"> · {context.attackDefense.declaredBy}</span>
                        )}
                    </div>
                )}
                {isAttacker && context.attackDefense.lastGuessTileKey && (
                    <div className="mt-2 text-amber-300">최근 추측: {formatTileKey(context.attackDefense.lastGuessTileKey)}</div>
                )}
            </div>

            {stage === 'A' && isMyTurn && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(960px,calc(100%-1.5rem))] rounded-3xl border border-cyan-500/30 bg-slate-950/92 p-4 shadow-2xl">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-xs font-bold tracking-[0.2em] text-cyan-200">STAGE A</div>
                            <div className="mt-1 text-sm text-slate-300">대기패를 확인하고 선언 여부를 정합니다.</div>
                            <div className="mt-2 text-xs text-cyan-200">대기패: {waitPreview.map((wait) => formatTileKey(wait)).join(', ') || '-'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button onClick={() => onDeclareTenpai(false)} className="px-4 py-2 rounded-2xl bg-cyan-600 font-semibold shadow-lg">
                                텐파이 선언
                            </button>
                            {!isEasy && (
                                <button onClick={() => onDeclareTenpai(true)} className="px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-lg">
                                    리치
                                </button>
                            )}
                            <button onClick={onPass} className="px-4 py-2 rounded-2xl bg-slate-700 font-semibold">
                                패스
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGuessFeedback && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
                    <div className={`w-full max-w-3xl rounded-[2rem] border px-6 py-5 shadow-2xl backdrop-blur-md ${context.attackDefense.lastGuessResult === 'succeeded'
                        ? 'border-emerald-300/70 bg-emerald-500/15'
                        : 'border-cyan-300/70 bg-cyan-500/15'
                        }`}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="rounded-2xl border border-slate-200/30 bg-white/10 px-5 py-4">
                                <div className="text-xs font-bold tracking-[0.2em] text-cyan-100">수비</div>
                                <div className="mt-2 text-3xl font-black text-white">{context.attackDefense.defender ?? '-'}</div>
                                {lastGuessEntry && (
                                    <div className="mt-3 inline-flex rounded-xl bg-white p-2">
                                        <TileView tile={lastGuessEntry.tile} disabled={true} />
                                    </div>
                                )}
                            </div>
                            <div className="text-center">
                                <div className={`text-4xl font-black drop-shadow-lg ${context.attackDefense.lastGuessResult === 'succeeded' ? 'text-amber-200' : 'text-cyan-100'}`}>
                                    {context.attackDefense.lastGuessResult === 'succeeded' ? '예측 성공!' : '예측 실패!'}
                                </div>
                                <div className="mt-2 text-sm text-slate-100">
                                    {context.attackDefense.lastGuessResult === 'succeeded' ? '수비자가 대기패를 맞혔습니다.' : '수비자가 계속 패를 예측합니다.'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200/30 bg-white/10 px-5 py-4 text-right">
                                <div className="text-xs font-bold tracking-[0.2em] text-rose-100">공격</div>
                                <div className="mt-2 text-3xl font-black text-white">{context.attackDefense.attacker ?? '-'}</div>
                                <div className="mt-3 text-sm text-slate-100">
                                    최근 추측: {formatTileKey(context.attackDefense.lastGuessTileKey)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stage === 'B_GUESS' && isDefender && (
                <div className="absolute bottom-0 left-0 right-0 z-40 border-t border-cyan-400/30 bg-slate-950/95 px-3 py-4 shadow-2xl">
                    <div className="mx-auto w-full max-w-6xl">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <div className="text-sm font-black text-cyan-100">공격자의 대기패는 무엇인가요?</div>
                                <div className="text-xs text-slate-400 mt-1">남은 추측 {context.attackDefense.guessesRemaining}회</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] tracking-[0.2em] text-slate-500">SELECTED</div>
                                <div className="mt-1 flex items-center justify-end gap-2">
                                    <div className="min-w-[4rem] text-sm font-semibold text-slate-100">{formatTileKey(selectedGuess)}</div>
                                    {selectedGuessEntry && (
                                        <div className="rounded-xl bg-white p-1.5">
                                            <TileView tile={selectedGuessEntry.tile} disabled={true} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-8 gap-2 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-3 max-h-64 overflow-y-auto md:grid-cols-12 lg:grid-cols-[repeat(17,minmax(0,1fr))]">
                            {TILE_CATALOG.map(({ tile, key }) => {
                                const count = remainingCounts.get(key) ?? 0;
                                const unavailable = count <= 0;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedGuess(key)}
                                        disabled={unavailable}
                                        className={`relative rounded-2xl border p-1.5 transition ${selectedGuess === key ? 'ring-2 ring-amber-300 border-amber-300 bg-amber-500/10' : ''} ${unavailable ? 'border-slate-700 opacity-40 bg-slate-900/80' : 'border-cyan-500/50 bg-slate-900/90 hover:bg-slate-800'}`}
                                    >
                                        <TileView tile={tile} disabled={true} />
                                        <div className={`text-[10px] mt-1 font-bold ${unavailable ? 'text-rose-300' : 'text-cyan-100'}`}>{unavailable ? 'X' : count}</div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-300">남은 패 수를 참고해 추측을 확정하세요.</div>
                            <button
                                onClick={() => selectedGuess && onGuess(selectedGuess)}
                                disabled={!selectedGuess}
                                className="px-5 py-2.5 rounded-2xl bg-yellow-400 text-slate-950 disabled:opacity-50 text-sm font-black shadow-lg"
                            >
                                확정
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stage === 'B_ASSAULT' && isAttacker && context.attackDefense.kanOption.pending && (
                <div className="absolute bottom-4 right-4 z-40 rounded-3xl border border-amber-500/50 bg-slate-950/95 p-4 flex items-center gap-3 shadow-2xl">
                    <div className="text-xs text-amber-200 mr-2">깡 선택 가능: {formatTileKey(context.attackDefense.kanOption.tileKey)}</div>
                    <button onClick={onKan} className="px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black">깡</button>
                    <button onClick={onKanPass} className="px-4 py-2 rounded-2xl bg-slate-700 font-semibold">패스</button>
                </div>
            )}
        </>
    );
}
