import { useState, useEffect, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { gameMachine } from '@step13/core';
import { useGameSocket } from './hooks/useGameSocket';
import { HandBuilder } from './components/HandBuilder';
import { HandDisplay } from './components/HandDisplay';
import { DiscardPile } from './components/DiscardPile';
import { PlayerId, Tile } from '@step13/proto';

export default function App() {
    const [localState, send, actor] = useMachine(gameMachine);
    const [serverState, setServerState] = useState<any>(null);

    // Pass the actor and a callback to update serverState
    const handleServerStateUpdate = useCallback((newState: any) => {
        setServerState(newState);
    }, []);

    const { sendEvent } = useGameSocket(actor, handleServerStateUpdate);

    const [playerId] = useState(`player-${Math.floor(Math.random() * 1000)}`);
    const [isConnected, setIsConnected] = useState(false);

    // Initial connection check effect (mock)
    useEffect(() => {
        setIsConnected(true);
    }, []);

    // Helper to abstract state source (Server > Local)
    const context = serverState ? serverState.context : localState.context;

    // Helper to check state value
    const matches = (value: string) => {
        if (serverState) {
            return serverState.value === value || (typeof serverState.value === 'object' && serverState.value[value]);
        }
        return localState.matches(value as any);
    };

    const phase = serverState ? JSON.stringify(serverState.value) : localState.value.toString();

    const handleJoin = () => {
        send({ type: 'JOIN', playerId });
        sendEvent({ type: 'JOIN', playerId });
    };

    const handleStartMatch = () => {
        sendEvent({ type: 'START_MATCH' });
    };

    const onSubmitHand = (hand: Tile[], pool: Tile[]) => {
        sendEvent({ type: 'SUBMIT_HAND', playerId, hand, pool });
    };

    const onDiscard = (tile: Tile) => {
        if (!tile.id) return;
        send({ type: 'DISCARD', playerId, tileId: tile.id });
        sendEvent({ type: 'DISCARD', playerId, tileId: tile.id });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold mb-2">17보 마작</h1>
                <div className="flex flex-col items-center text-xs text-gray-400 gap-1">
                    <p>단계: {phase}</p>
                    <p>플레이어 ID: {playerId}</p>
                    <p className={isConnected ? "text-green-500" : "text-red-500"}>
                        네트워크: {isConnected ? "연결됨 (동기화됨)" : "연결 중..."}
                    </p>
                    {serverState && <span className="text-blue-400">[서버 권한 모드]</span>}
                </div>
            </header>

            <main className="w-full max-w-4xl bg-slate-800 rounded-lg p-6 shadow-xl">
                {matches('idle') && (
                    <div className="text-center space-y-4">
                        <h2 className="text-2xl font-semibold">로비</h2>
                        <div className="flex justify-center gap-4">
                            {!context.players.includes(playerId) ? (
                                <button
                                    onClick={handleJoin}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold"
                                >
                                    게임 참가
                                </button>
                            ) : (
                                <div className="text-green-400 mb-4">참가 완료! 대기 중...</div>
                            )}

                            {context.players.includes(playerId) && context.players.length === 1 && (
                                <button
                                    onClick={() => sendEvent({ type: 'ADD_BOT' })}
                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold"
                                >
                                    AI 추가 (+bot)
                                </button>
                            )}

                            {context.players.length === 2 && (
                                <button
                                    onClick={handleStartMatch}
                                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded font-bold"
                                >
                                    매치 시작
                                </button>
                            )}
                        </div>
                        <div className="mt-4">
                            <h3 className="text-lg">플레이어 ({context.players.length}/2):</h3>
                            <ul className="list-disc list-inside">
                                {context.players.map((p: PlayerId) => <li key={p}>{p}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                {matches('matchStart') && (
                    <div className="text-center animate-pulse">
                        <h2 className="text-3xl font-bold text-yellow-400">매치 시작 중...</h2>
                        <div className="mt-4">패 초기화 중...</div>
                    </div>
                )}

                {matches('handBuild') && (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">패 완성 단계</h2>
                        <p className="mb-4">텐파이 패를 만들기 위해 13개의 패를 선택하세요.</p>
                        <div className="p-4 bg-slate-700 rounded mb-4">
                            <HandBuilder
                                dealtTiles={context.dealtTiles[playerId] || []}
                                onSubmit={onSubmitHand}
                            />
                        </div>
                    </div>
                )}

                {matches('gameLoop') && (
                    <div className="text-center w-full">
                        <h2 className="text-2xl font-bold mb-4">게임 진행</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-700 rounded">
                                <h3 className="mb-2 font-bold">내 손패</h3>
                                <HandDisplay
                                    hand={context.hands[playerId] || []}
                                    canDiscard={context.currentTurn === playerId}
                                    onDiscard={({ tile }) => onDiscard(tile)}
                                />
                                <div className="mt-2 text-sm">
                                    {context.currentTurn === playerId ?
                                        <span className="text-green-400">내 차례 (패를 버리세요)</span> :
                                        <span className="text-yellow-400">상대방 차례...</span>
                                    }
                                </div>
                            </div>
                            <div className="p-4 bg-slate-700 rounded">
                                <h3 className="mb-2 font-bold">버림패</h3>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-xs text-gray-400">나</span>
                                        <DiscardPile discards={context.discards[playerId] || []} />
                                    </div>
                                    <hr className="border-slate-600" />
                                    {context.players.filter((p: PlayerId) => p !== playerId).map((p: PlayerId) => (
                                        <div key={p}>
                                            <span className="text-xs text-gray-400">상대방 ({p})</span>
                                            <DiscardPile discards={context.discards[p] || []} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="mt-8 text-xs text-gray-600 px-4 text-center">
                <p>디버그: {serverState ? '서버 상태 활성' : '로컬 상태 활성'}</p>
            </footer>
        </div>
    );
}
