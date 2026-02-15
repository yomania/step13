import { ReactNode } from 'react';
import { PlayerId } from '@step13/proto';
import { GameContext } from '@step13/core';
import { DiscardPile } from './DiscardPile';

interface GameBoardProps {
    context: GameContext;
    myPlayerId: PlayerId;
    children?: ReactNode;
}

export function GameBoard({ context, myPlayerId, children }: GameBoardProps) {
    const players = context.players;
    const otherPlayerId = players.find((p: PlayerId) => p !== myPlayerId);
    const myTimeBankMs = context.timeBankRemainingMs?.[myPlayerId] ?? 0;
    const otherTimeBankMs = otherPlayerId ? (context.timeBankRemainingMs?.[otherPlayerId] ?? 0) : 0;

    const formatBank = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`;

    return (
        <div className="relative flex flex-col min-h-screen text-white px-3 py-4 sm:px-5 overflow-x-hidden">
            <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl" />
            <header className="z-10 p-3 sm:p-4 glass-panel rounded-2xl flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
                <h1 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">17보 마작 실전</h1>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="surface-panel px-3 py-1 rounded-lg">
                        Round: <span className="text-yellow-400">{context.round}</span>
                    </div>
                    <div className="surface-panel px-3 py-1 rounded-lg">
                        Turn: <span className="text-cyan-300">5s</span>
                    </div>
                    <div className="surface-panel px-3 py-1 rounded-lg">
                        My Bank: <span className="text-green-300 font-mono">{formatBank(myTimeBankMs)}</span>
                    </div>
                    {otherPlayerId && (
                        <div className="surface-panel px-3 py-1 rounded-lg">
                            Opp Bank: <span className="text-red-300 font-mono">{formatBank(otherTimeBankMs)}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Battle Area */}
            <div className="z-10 flex-1 flex flex-col items-center justify-center relative w-full max-w-6xl mx-auto glass-panel rounded-3xl p-3 sm:p-5">

                {/* Opponent Area (Top) */}
                {otherPlayerId && (
                    <div className="w-full flex flex-col items-center mb-8 opacity-90 transition-opacity p-4 border border-slate-700/80 rounded-2xl bg-slate-900/45">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-rose-800/90 rounded-full flex items-center justify-center font-bold border-2 border-rose-500 shadow-md">
                                {otherPlayerId.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="text-lg font-bold text-red-200">{otherPlayerId} (Opponent)</span>
                            <span className="font-mono text-yellow-400 bg-black/30 px-2 py-0.5 rounded-lg">
                                {context.scores[otherPlayerId] || 0} pts
                            </span>
                            {/* Dealer Indicator */}
                            {context.dealer === otherPlayerId && (
                                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-lg">DEALER</span>
                            )}
                        </div>

                        {/* Opponent Hand (Generic Backs or count) */}
                        <div className="flex gap-1 mb-2">
                            {/* Usually we don't show opponent hand in 17-steps except 'ready' status? */}
                            {/* Just show simple indicator */}
                            <div className="text-sm text-gray-400">
                                {context.hands[otherPlayerId] ? "Hand Ready (13 tiles)" : "Building Hand..."}
                            </div>
                        </div>

                        {/* Opponent Pool/Discards */}
                        <div className="relative">
                            <h3 className="text-xs text-center text-gray-500 mb-1">DISCARDS (Pool)</h3>
                            <DiscardPile
                                discards={context.discards[otherPlayerId] || []}
                                isOpponent={true} // Rotate 180 degrees visually is standard in real mahjong, but here just top view
                            />
                        </div>
                    </div>
                )}

                {/* Center / Game Info / Turn Indicator */}
                <div className="my-4 text-center z-10">
                    <div className="text-2xl font-bold mb-2 transition-all duration-300 transform scale-100">
                        {context.currentTurn === myPlayerId ? (
                            <span className="text-blue-400 animate-pulse drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">YOUR TURN</span>
                        ) : (
                            <span className="text-red-400">OPPONENT'S TURN</span>
                        )}
                    </div>
                    <div className="text-sm text-gray-500">
                        Remains: {17 - (context.discards[myPlayerId]?.length || 0)} / 17
                    </div>
                </div>

                {/* My Area (Bottom) */}
                <div className="w-full flex flex-col items-center mt-auto p-4 sm:p-6 bg-gradient-to-t from-slate-900/70 to-transparent rounded-t-3xl">
                    {/* My Discards */}
                    <div className="mb-6 relative group">
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-slate-900 px-3 py-1 rounded-lg text-xs text-gray-400 border border-slate-700 shadow-sm">
                            MY DISCARDS
                        </div>
                        <div className="p-4 bg-slate-900/70 rounded-2xl shadow-inner border border-slate-700/50 backdrop-blur-sm">
                            <DiscardPile discards={context.discards[myPlayerId] || []} />
                        </div>
                    </div>

                    {/* My Hand / Controls / Info */}
                    <div className="flex items-center gap-6 w-full justify-between max-w-3xl">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-cyan-600 rounded-full flex items-center justify-center font-bold text-xl border-4 border-cyan-400 shadow-lg relative overflow-hidden">
                                {myPlayerId.slice(0, 1).toUpperCase()}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-cyan-100 flex items-center gap-2">
                                    {myPlayerId} (YOU)
                                    {context.dealer === myPlayerId && (
                                        <span className="px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded uppercase tracking-wider">Dealer</span>
                                    )}
                                </span>
                                <span className="font-mono text-2xl text-yellow-400 font-bold drop-shadow-md">
                                    {context.scores[myPlayerId] || 0} pts
                                </span>
                            </div>
                        </div>

                        {/* Children (HandBuilder, Action Buttons) */}
                        <div className="flex-1 flex justify-end">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
