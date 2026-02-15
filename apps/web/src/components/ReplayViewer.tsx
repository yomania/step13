
import { useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { replayMachine, GameEvents } from '@step13/core';
import { GameBoard } from './GameBoard';
import { PlayerId, Tile } from '@step13/proto';
import { calculateScore } from '@step13/scoring';

const SCORE_OPTIONS = {
    requireManganMinimum: true,
    includeOmoteDoraInMinimum: true,
    kiriageMangan: true,
    autoRiichiFallback: true
} as const;

interface ReplayViewerProps {
    events: GameEvents[];
    myPlayerId: PlayerId;
    onClose: () => void;
}

export function ReplayViewer({ events, myPlayerId, onClose }: ReplayViewerProps) {
    const [state, send] = useMachine(replayMachine, {});
    const { snapshots, currentIndex, isPlaying } = state.context;

    useEffect(() => {
        if (events.length > 0) {
            send({ type: 'LOAD_LOG', events });
        }
    }, [events, send]);

    const currentSnapshot = snapshots[currentIndex];
    const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : null;

    const replayGuide = useMemo(() => {
        if (!currentSnapshot) return null;

        const opponentId = currentSnapshot.players.find((p) => p !== myPlayerId);
        if (!opponentId) return null;

        const myPool = currentSnapshot.pools[myPlayerId] ?? [];
        const opponentHand = currentSnapshot.hands[opponentId] ?? [];

        const tileLabel = (tile: Tile) => `${tile.rank}${tile.suit}`;

        const risks = myPool.map((tile) => {
            const score = calculateScore(opponentHand, tile, false, [], SCORE_OPTIONS);
            return { tile, points: score.points };
        });

        const immediateLossTiles = risks
            .filter((r) => r.points >= 8000)
            .map((r) => ({ label: tileLabel(r.tile), points: r.points }));

        const alternatives = risks
            .sort((a, b) => a.points - b.points)
            .slice(0, 3)
            .map((r) => ({ label: tileLabel(r.tile), risk: r.points }));

        const isBlunder =
            Boolean(previousSnapshot?.lastDiscard) &&
            currentSnapshot.phase === 'ROUND_END' &&
            currentSnapshot.winner === opponentId &&
            previousSnapshot?.lastDiscard?.playerId === myPlayerId;

        return {
            immediateLossTiles,
            alternatives,
            isBlunder
        };
    }, [currentSnapshot, previousSnapshot, myPlayerId]);

    // If no snapshot (loading or empty), show standard loading
    if (!currentSnapshot) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading Replay...</div>;
    }

    return (
        <div className="relative w-full h-full">
            {/* Determine perspective: Toggle? For now use 'myPlayerId' from props which was the user's ID */}
            <GameBoard
                context={currentSnapshot}
                myPlayerId={myPlayerId}
            >
                {/* Replay Controls Overlay */}
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white p-4 rounded-xl flex items-center gap-4 z-50 border border-gray-600 shadow-2xl">
                    <button onClick={() => send({ type: 'PREV' })} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">
                        Prev
                    </button>
                    <button onClick={() => send({ type: isPlaying ? 'PAUSE' : 'PLAY' })} className="px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded font-bold w-20">
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={() => send({ type: 'NEXT' })} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">
                        Next
                    </button>
                    <div className="text-sm font-mono ml-2">
                        Step: {currentIndex + 1} / {snapshots.length}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-50">
                    <button onClick={onClose} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded shadow-lg font-bold">
                        Exit Replay
                    </button>
                </div>

                {replayGuide && (
                    <div className="absolute top-20 right-4 z-50 w-[340px] bg-slate-900/95 border border-slate-600 rounded-xl shadow-2xl p-4 text-sm">
                        <h3 className="font-bold text-cyan-300 mb-3">Replay Guide</h3>
                        <div className="mb-3">
                            <div className="text-slate-400 mb-1">즉시 방총패</div>
                            {replayGuide.immediateLossTiles.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {replayGuide.immediateLossTiles.map((item) => (
                                        <span key={`${item.label}-${item.points}`} className="px-2 py-1 rounded bg-red-900/60 border border-red-700 text-red-200">
                                            {item.label} ({item.points})
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-green-300">없음</div>
                            )}
                        </div>
                        <div className="mb-3">
                            <div className="text-slate-400 mb-1">추천 대안 Top 3</div>
                            <div className="space-y-1">
                                {replayGuide.alternatives.map((item) => (
                                    <div key={`${item.label}-${item.risk}`} className="flex justify-between bg-slate-800/80 rounded px-2 py-1">
                                        <span>{item.label}</span>
                                        <span className="text-slate-300">위험도 {item.risk}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {replayGuide.isBlunder && (
                            <div className="mt-2 px-3 py-2 rounded bg-amber-900/70 border border-amber-700 text-amber-200 font-semibold">
                                Blunder: 직전 버림이 치명타였습니다.
                            </div>
                        )}
                    </div>
                )}
            </GameBoard>
        </div>
    );
}
