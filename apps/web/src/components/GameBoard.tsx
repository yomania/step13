import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerId } from '@step13/proto';
import { GameContext, RULES } from '@step13/core';
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
    const currentTurn = context.currentTurn;
    const currentTurnBankMs = currentTurn ? (context.timeBankRemainingMs?.[currentTurn] ?? 0) : 0;
    const previousTurnRef = useRef<PlayerId | null>(null);
    const previousTurnBankRef = useRef<number>(0);
    const [clockStartMs, setClockStartMs] = useState<number | null>(null);
    const [clockDurationMs, setClockDurationMs] = useState<number>(RULES.timers.turnTimeMs);
    const [isBonusClock, setIsBonusClock] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const formatBank = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`;

    useEffect(() => {
        if (!currentTurn) {
            previousTurnRef.current = null;
            previousTurnBankRef.current = 0;
            setClockStartMs(null);
            setClockDurationMs(RULES.timers.turnTimeMs);
            setIsBonusClock(false);
            return;
        }

        const previousTurn = previousTurnRef.current;
        const previousBank = previousTurnBankRef.current;

        if (previousTurn !== currentTurn) {
            setClockStartMs(Date.now());
            setClockDurationMs(RULES.timers.turnTimeMs);
            setIsBonusClock(false);
        } else if (previousBank > currentTurnBankMs) {
            const consumedBankMs = previousBank - currentTurnBankMs;
            setClockStartMs(Date.now());
            setClockDurationMs(consumedBankMs);
            setIsBonusClock(true);
        }

        previousTurnRef.current = currentTurn;
        previousTurnBankRef.current = currentTurnBankMs;
    }, [currentTurn, currentTurnBankMs, context.eventLog.length]);

    useEffect(() => {
        if (!clockStartMs) return;
        const timer = setInterval(() => setNowMs(Date.now()), 100);
        return () => clearInterval(timer);
    }, [clockStartMs]);

    const turnTimeRemainingMs = useMemo(() => {
        if (!clockStartMs) {
            return RULES.timers.turnTimeMs;
        }
        return Math.max(0, clockDurationMs - (nowMs - clockStartMs));
    }, [clockStartMs, clockDurationMs, nowMs]);

    const turnTimeRemainingSec = Math.max(0, Math.ceil(turnTimeRemainingMs / 1000));
    const isLowTurnTime = turnTimeRemainingSec <= 3;
    const myRole = context.attackDefense?.attacker === myPlayerId
        ? 'ATTACKER'
        : context.attackDefense?.defender === myPlayerId
            ? 'DEFENDER'
            : null;
    const otherRole = otherPlayerId
        ? context.attackDefense?.attacker === otherPlayerId
            ? 'ATTACKER'
            : context.attackDefense?.defender === otherPlayerId
                ? 'DEFENDER'
                : null
        : null;

    return (
        <div className="game-shell relative flex flex-col min-h-[100dvh] text-white sm:px-5 overflow-x-hidden sm:overflow-hidden">
            <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-slate-800/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-slate-800/20 blur-[100px]" />
            <header className="header-bar z-10 p-2 sm:p-4 surface-panel sm:glass-panel rounded-none sm:rounded-2xl flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-4 border-b sm:border border-slate-700/50 shadow-md">
                <h1 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 drop-shadow-sm tracking-tight text-stroke-sm">17보 마작 실전</h1>
                <div className="flex flex-wrap gap-1 sm:gap-2 items-center text-xs sm:text-base">
                    <div className="surface-panel px-2 sm:px-3 py-1 rounded-lg border border-slate-700/50 shadow-inner">
                        Round: <span className="text-yellow-500 font-bold">{context.round}/{RULES.match.handsPerMatch}</span>
                    </div>
                    <div className="surface-panel px-2 sm:px-3 py-1 rounded-lg border border-slate-700/50 shadow-inner">
                        My Bank: <span className="text-emerald-400 font-mono font-bold">{formatBank(myTimeBankMs)}</span>
                    </div>
                    {otherPlayerId && (
                        <div className="surface-panel px-2 sm:px-3 py-1 rounded-lg">
                            Opp Bank: <span className="text-red-300 font-mono">{formatBank(otherTimeBankMs)}</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Battle Area */}
            <div className="board-shell z-10 flex-1 min-h-0 flex flex-col items-center justify-center relative w-full h-full sm:max-w-6xl mx-auto glass-panel rounded-none sm:rounded-3xl p-1 sm:p-5 mb-2 sm:mb-8 overflow-visible sm:overflow-hidden">
                <div className="board-scroll w-full h-full flex flex-col items-center thin-scrollbar">

                    {/* Opponent Area (Top) */}
                    {otherPlayerId && (
                        <div className="opponent-panel w-full flex flex-col items-center opacity-90 transition-opacity border border-slate-700/80 rounded-2xl bg-slate-900/45">
                            <div className="flex items-center gap-2 sm:gap-4 mb-1 sm:mb-2">
                                <div className="w-10 h-10 bg-rose-800/90 rounded-full flex items-center justify-center font-bold border-2 border-rose-500 shadow-md">
                                    {otherPlayerId.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="text-lg font-bold text-red-200">{otherPlayerId} (Opponent)</span>
                                {otherRole && (
                                    <span className="px-2 py-0.5 rounded bg-rose-700 text-[10px] font-bold">{otherRole}</span>
                                )}
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
                        <div className="text-2xl font-black mb-2 transition-all duration-300 transform scale-100 tracking-wider">
                            {context.currentTurn === myPlayerId ? (
                                <span className="text-yellow-500 animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">YOUR TURN</span>
                            ) : (
                                <span className="text-rose-600 drop-shadow-md">OPPONENT'S TURN</span>
                            )}
                        </div>
                        <div className="text-sm font-bold text-slate-400">
                            Remains: <span className="text-slate-200">{17 - (context.discards[myPlayerId]?.length || 0)} / 17</span>
                        </div>
                    </div>

                    {/* My Area (Bottom) */}
                    <div className="player-panel w-full flex flex-col items-center mt-auto p-2 sm:p-6 bg-gradient-to-t from-slate-900/90 to-transparent rounded-t-3xl border-t border-slate-700/30">
                        {/* My Discards */}
                        <div className="mb-2 sm:mb-6 relative group w-full max-w-2xl">
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-800 px-3 py-0.5 sm:px-4 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-slate-300 border border-slate-600 shadow-md z-10">
                                내 버림패
                            </div>
                            <div className="p-2 pt-4 sm:p-4 sm:pt-6 bg-slate-900/80 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-md">
                                <DiscardPile discards={context.discards[myPlayerId] || []} />
                            </div>
                        </div>

                        {/* My Hand / Controls / Info */}
                        <div className="flex flex-col gap-1 sm:gap-3 w-full max-w-3xl">
                            <div className="flex flex-row items-end justify-between gap-1 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-4 bg-slate-900/60 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-700/50 shadow-md">
                                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center font-bold text-xl sm:text-2xl border-2 border-slate-500 text-slate-200 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),_0_4px_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                                        {myPlayerId.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col items-start hidden sm:flex">
                                        <span className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                            {myPlayerId}
                                            {myRole && (
                                                <span className="px-2 py-0.5 rounded bg-cyan-700 text-[10px] font-bold">{myRole}</span>
                                            )}
                                            {context.dealer === myPlayerId && (
                                                <span className="px-2 py-0.5 bg-gradient-to-b from-yellow-400 to-amber-600 text-black text-[10px] font-black rounded uppercase tracking-wider shadow-sm border border-yellow-300/50">Deal</span>
                                            )}
                                        </span>
                                        <span className="font-mono text-xl text-yellow-500 font-extrabold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
                                            {context.scores[myPlayerId] || 0} pts
                                        </span>
                                    </div>
                                </div>

                                <div className="action-stack w-full sm:w-auto flex flex-col items-stretch sm:items-end">
                                    <div className={`self-start sm:self-end px-4 py-2 rounded-xl sm:rounded-2xl border backdrop-blur-sm shadow-lg ${isLowTurnTime
                                        ? 'border-rose-500 bg-rose-950/80 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                                        : isBonusClock
                                            ? 'border-yellow-500/80 bg-yellow-950/60 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                                            : 'border-slate-600 bg-slate-900/80'
                                        }`}>
                                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-400">제한시간</div>
                                        <div className={`font-mono text-2xl sm:text-3xl font-black leading-none drop-shadow-md ${isLowTurnTime
                                            ? 'text-rose-400 animate-pulse'
                                            : isBonusClock
                                                ? 'text-yellow-400'
                                                : 'text-slate-200'
                                            }`}>
                                            {isBonusClock ? `+${turnTimeRemainingSec}s` : `${turnTimeRemainingSec}s`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full flex justify-center">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
