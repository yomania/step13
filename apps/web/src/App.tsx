import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { gameMachine, RULES } from '@step13/core';
import { useGameSocket } from './hooks/useGameSocket';
import { HandBuilder } from './components/HandBuilder';
import { HandDisplay } from './components/HandDisplay';
import { Tile as TileView, TileSkinProvider, type TileSkin } from './components/Tile';
import { GameBoard } from './components/GameBoard';
import { ReplayViewer } from './components/ReplayViewer';
import { SingleMiniGame } from './components/SingleMiniGame';
import { YakuInfoLayer } from './components/YakuInfoLayer';
import { PlayerId, Tile } from '@step13/proto';
import { preloadRealTileAssets } from './lib/tileAssets';
import { AnimatePresence, motion } from 'framer-motion';

type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';



export default function App() {
    const [localState, , actor] = useMachine(gameMachine);
    const [serverState, setServerState] = useState<any>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    // Pass the actor and a callback to update serverState
    const handleServerStateUpdate = useCallback((newState: any) => {
        setServerState(newState);
    }, []);

    const handleAnalysisResult = useCallback((result: any) => {
        setAnalysisResult(result);
    }, []);

    const { sendEvent, queryAnalysis } = useGameSocket(actor, handleServerStateUpdate, handleAnalysisResult);

    const [playerId] = useState(`player-${Math.floor(Math.random() * 1000)}`);
    const queryAnalysisWithPlayer = useCallback((query: any) => {
        queryAnalysis({ ...query, playerId });
    }, [queryAnalysis, playerId]);
    const [isConnected, setIsConnected] = useState(false);
    const [debugMode, setDebugMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('step13-debug-mode') === '1';
    });
    const [tileSkin, setTileSkin] = useState<TileSkin>(() => {
        if (typeof window === 'undefined') return 'classic';
        const saved = window.localStorage.getItem('step13-tile-skin');
        return saved === 'real' ? 'real' : 'classic';
    });
    const [showOptions, setShowOptions] = useState(false);
    const [mainMode, setMainMode] = useState<'match' | 'mini'>('match');
    const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');

    // Initial connection check effect (mock)
    useEffect(() => {
        setIsConnected(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('step13-debug-mode', debugMode ? '1' : '0');
    }, [debugMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('step13-tile-skin', tileSkin);
    }, [tileSkin]);

    useEffect(() => {
        // Warm image cache early so switching to real skin feels instant.
        preloadRealTileAssets().catch(() => undefined);
    }, []);

    // Helper to abstract state source (Server > Local)
    const context = serverState ? serverState.context : localState.context;
    const otherPlayerId = context.players.find((p: PlayerId) => p !== playerId);
    const myHandSubmitted = Boolean(context.hands[playerId]);
    const opponentHandSubmitted = otherPlayerId ? Boolean(context.hands[otherPlayerId]) : false;
    const doraIndicators = (context as { doraIndicators?: Tile[] }).doraIndicators ?? [];
    const selectedDoraId = doraIndicators[0]?.id ?? null;
    const isAiMatch = context.players.some((p: PlayerId) => p.startsWith('bot-'));
    const myHand = context.hands[playerId] || [];
    const myPool = context.pools[playerId] || [];
    const myDiscards = context.discards[playerId] || [];
    const mySeatWind = context.seatMap?.[playerId] === 'EAST'
        ? 'EAST'
        : context.seatMap?.[playerId] === 'WEST'
            ? 'WEST'
            : undefined;

    // Use analysis results from server
    const myWaitKeys = useMemo(() => {
        if (!analysisResult?.candidates?.[0]) return new Set<string>();
        return new Set<string>((analysisResult.candidates[0].waits || []).map((t: Tile) => `${t.suit}-${t.rank}`));
    }, [analysisResult]);

    const myWaitTiles = useMemo(() => {
        if (!analysisResult?.candidates?.[0]) return [];
        return analysisResult.candidates[0].waits || [];
    }, [analysisResult]);

    const isFuriten = useMemo(() => {
        return myDiscards.some((tile: Tile) => myWaitKeys.has(`${tile.suit}-${tile.rank}`));
    }, [myDiscards, myWaitKeys]);
    const myRoundEndConfirmed = Boolean(context.roundEndConfirmedBy?.[playerId]);
    const roundEndSummaries = useMemo(() => {
        // Simplified: In roundEnd, server usually sends full state or we can query
        // For now, just show names and confirmations. Full details should be sent in sanitizedState after round end.
        return (context.players as PlayerId[]).map((pid) => {
            return {
                playerId: pid,
                waits: [] as Tile[],
                best: { points: 0, han: 0, yaku: [] as string[] },
                confirmed: Boolean(context.roundEndConfirmedBy?.[pid]),
                isBot: pid.startsWith('bot-')
            };
        });
    }, [context.players, context.roundEndConfirmedBy]);

    // Helper to check state value
    const matches = (value: string) => {
        if (serverState) {
            return serverState.value === value || (typeof serverState.value === 'object' && serverState.value[value]);
        }
        return localState.matches(value as any);
    };
    const isIdle = matches('idle');
    const isHandBuild = matches('handBuild');
    const isDoraSelect = matches('doraSelect');

    const scoreDiff = useMemo(() => {
        const opponentId = context.players.find((p: PlayerId) => p !== playerId);
        if (!opponentId) return 0;
        return (context.scores[playerId] || 0) - (context.scores[opponentId] || 0);
    }, [context.players, context.scores, playerId]);

    const [handBuildRoundMeta, setHandBuildRoundMeta] = useState<{ round: number; startedAt: number } | null>(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [showDoraReveal, setShowDoraReveal] = useState(false);
    const [doraRevealDeadlineMs, setDoraRevealDeadlineMs] = useState<number | null>(null);
    const [doraNowMs, setDoraNowMs] = useState(() => Date.now());
    const lastDoraIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isHandBuild) {
            setHandBuildRoundMeta(null);
            return;
        }

        setHandBuildRoundMeta((prev) => {
            if (!prev || prev.round !== context.round) {
                return { round: context.round, startedAt: Date.now() };
            }
            return prev;
        });
    }, [isHandBuild, context.round]);

    useEffect(() => {
        if (!isHandBuild) return;
        const timer = setInterval(() => setNowMs(Date.now()), 250);
        return () => clearInterval(timer);
    }, [isHandBuild]);

    const handBuildRemainingMs = useMemo(() => {
        if (!isHandBuild || !handBuildRoundMeta) return null;
        const deadline = handBuildRoundMeta.startedAt + RULES.timers.buildTimeMs;
        return Math.max(0, deadline - nowMs);
    }, [isHandBuild, handBuildRoundMeta, nowMs]);

    useEffect(() => {
        if (!isDoraSelect) {
            lastDoraIdRef.current = null;
            setShowDoraReveal(false);
            setDoraRevealDeadlineMs(null);
            return;
        }

        const currentDoraId = doraIndicators[0]?.id ?? null;
        if (!currentDoraId || currentDoraId === lastDoraIdRef.current) {
            return;
        }

        lastDoraIdRef.current = currentDoraId;
        setShowDoraReveal(true);
        setDoraRevealDeadlineMs(Date.now() + RULES.timers.doraRevealTimeMs);
        const timer = setTimeout(() => setShowDoraReveal(false), 900);
        return () => clearTimeout(timer);
    }, [isDoraSelect, doraIndicators]);

    useEffect(() => {
        if (!isDoraSelect || !selectedDoraId || doraRevealDeadlineMs === null) return;
        const timer = setInterval(() => setDoraNowMs(Date.now()), 100);
        return () => clearInterval(timer);
    }, [isDoraSelect, selectedDoraId, doraRevealDeadlineMs]);

    const doraRevealRemainingSec = useMemo(() => {
        if (!isDoraSelect || !selectedDoraId || doraRevealDeadlineMs === null) return null;
        return Math.max(0, Math.ceil((doraRevealDeadlineMs - doraNowMs) / 1000));
    }, [isDoraSelect, selectedDoraId, doraRevealDeadlineMs, doraNowMs]);

    const handleJoin = () => {
        sendEvent({ type: 'JOIN', playerId });
    };

    const handleStartMatch = () => {
        sendEvent({ type: 'START_MATCH' });
    };

    const handleAddBot = () => {
        sendEvent({ type: 'ADD_BOT', difficulty: botDifficulty });
    };

    const onSubmitHand = (hand: Tile[], pool: Tile[]) => {
        if (myHandSubmitted) return;
        sendEvent({ type: 'SUBMIT_HAND', playerId, hand, pool });
    };

    const onSelectDora = (tile: Tile) => {
        if (playerId !== context.dealer || !tile.id || (context.doraIndicators?.length ?? 0) > 0) return;
        sendEvent({ type: 'SELECT_DORA', playerId, tileId: tile.id });
    };

    const onDiscard = (tile: Tile) => {
        if (!tile.id) return;
        sendEvent({ type: 'DISCARD', playerId, tileId: tile.id });
    };

    const onDeclareWin = () => {
        sendEvent({ type: 'DECLARE_WIN', playerId });
    };
    const onConfirmRoundEnd = () => {
        if (myRoundEndConfirmed) return;
        sendEvent({ type: 'CONFIRM_ROUND_END', playerId });
    };

    const onRestart = () => {
        // Send restart if implemented, or just refresh
        window.location.reload();
    };

    // Ron Opportunity (Query server when lastDiscard changes)
    const [ronOpportunity, setRonOpportunity] = useState<any>(null);

    useEffect(() => {
        if (!matches('gameLoop')) {
            setRonOpportunity(null);
            return;
        }
        const { lastDiscard, hands } = context;
        if (!lastDiscard || lastDiscard.playerId === playerId) {
            setRonOpportunity(null);
            return;
        }

        const myHand = hands[playerId];
        if (!myHand) return;

        // Query server for ron check
        queryAnalysisWithPlayer({
            queryType: 'SCORE',
            hand: myHand,
            wait: lastDiscard.tile,
            doraIndicators
        });
    }, [context.lastDiscard, playerId, matches, doraIndicators, context.hands, queryAnalysisWithPlayer]);

    // Update ronOpportunity when analysisResult comes back for SCORE
    useEffect(() => {
        if (analysisResult?.type === 'ANALYSIS_RESULT' && analysisResult.scoreResult) {
            if (analysisResult.scoreResult.points > 0) {
                setRonOpportunity(analysisResult.scoreResult);
            } else {
                setRonOpportunity(null);
            }
        }
    }, [analysisResult]);

    const [showReplay, setShowReplay] = useState(false);
    const [showYakuInfo, setShowYakuInfo] = useState(false);
    const [showAiExitMenu, setShowAiExitMenu] = useState(false);
    const [aiRematchStep, setAiRematchStep] = useState<'none' | 'join' | 'waitSelf' | 'addBot' | 'waitBot' | 'start'>('none');

    useEffect(() => {
        if (showReplay) {
            sendEvent({ type: 'GUIDE_VIEW', playerId, step: 'replay_open' });
        }
    }, [showReplay, playerId, sendEvent]);

    useEffect(() => {
        if (!isAiMatch) {
            setShowAiExitMenu(false);
        }
    }, [isAiMatch]);

    useEffect(() => {
        if (aiRematchStep === 'none' || !isIdle) return;

        const hasSelf = context.players.includes(playerId);
        const hasBot = context.players.some((p: PlayerId) => p.startsWith('bot-'));
        const playerCount = context.players.length;

        if (aiRematchStep === 'join') {
            if (!hasSelf) {
                sendEvent({ type: 'JOIN', playerId });
                setAiRematchStep('waitSelf');
                return;
            }
            setAiRematchStep('addBot');
            return;
        }

        if (aiRematchStep === 'waitSelf') {
            if (hasSelf) {
                setAiRematchStep('addBot');
            }
            return;
        }

        if (aiRematchStep === 'addBot') {
            if (!hasBot) {
                sendEvent({ type: 'ADD_BOT', difficulty: botDifficulty });
                setAiRematchStep('waitBot');
                return;
            }
            setAiRematchStep('start');
            return;
        }

        if (aiRematchStep === 'waitBot') {
            if (hasBot) {
                setAiRematchStep('start');
            }
            return;
        }

        if (aiRematchStep === 'start' && playerCount === 2) {
            sendEvent({ type: 'START_MATCH' });
            setAiRematchStep('none');
        }
    }, [aiRematchStep, botDifficulty, isIdle, context.players, playerId, sendEvent]);

    const onAiExitToLobby = () => {
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        sendEvent({ type: 'RESTART' });
    };

    const onAiExitToHandBuild = () => {
        setShowAiExitMenu(false);
        setAiRematchStep('join');
        sendEvent({ type: 'RESTART' });
    };

    if (showReplay) {
        return (
            <TileSkinProvider skin={tileSkin}>
                <ReplayViewer
                    events={context.eventLog || []}
                    myPlayerId={playerId}
                    onClose={() => setShowReplay(false)}
                />
            </TileSkinProvider>
        );
    }

    if (mainMode === 'mini') {
        return (
            <TileSkinProvider skin={tileSkin}>
                <div className="app-noise flex flex-col items-center justify-center min-h-screen text-white font-sans relative overflow-x-hidden px-3 py-4 sm:px-5">
                    <div className="pointer-events-none absolute -top-24 -left-28 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
                    <div className="absolute top-4 left-4 z-[70]">
                        <button
                            onClick={() => setShowYakuInfo(true)}
                            className="px-4 py-2 rounded-xl bg-cyan-700/90 hover:bg-cyan-600 text-white font-bold shadow-lg border border-cyan-300/70"
                        >
                            17보 역정보
                        </button>
                    </div>
                    <SingleMiniGame
                        onExit={() => setMainMode('match')}
                        queryAnalysis={queryAnalysisWithPlayer}
                        analysisResult={analysisResult}
                        debugMode={debugMode}
                    />
                    <YakuInfoLayer open={showYakuInfo} onClose={() => setShowYakuInfo(false)} />
                </div>
            </TileSkinProvider>
        );
    }

    return (
        <TileSkinProvider skin={tileSkin}>
            <div className="app-noise flex flex-col items-center justify-center min-h-screen text-white font-sans relative overflow-x-hidden px-3 py-4 sm:px-5">
                <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
                {(isIdle || isHandBuild) && (
                    <div className="absolute top-4 left-4 z-[70]">
                        <button
                            onClick={() => setShowYakuInfo(true)}
                            className="px-4 py-2 rounded-xl bg-cyan-700/90 hover:bg-cyan-600 text-white font-bold shadow-lg border border-cyan-300/70"
                        >
                            17보 역정보
                        </button>
                    </div>
                )}
                {isAiMatch && !isIdle && (
                    <div className="absolute top-4 right-4 z-[60]">
                        <button
                            onClick={() => setShowAiExitMenu(true)}
                            className="px-4 py-2 rounded-xl bg-rose-700/90 hover:bg-rose-600 text-white font-bold shadow-lg border border-rose-300/70"
                        >
                            AI 대전 종료
                        </button>
                    </div>
                )}
                {showAiExitMenu && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-sm rounded-2xl glass-panel p-5 shadow-2xl">
                            <h3 className="text-lg font-bold text-white">AI 대전 종료</h3>
                            <p className="mt-2 text-sm text-slate-300">
                                진행 중인 AI 대전을 종료하고 이동할 위치를 선택하세요.
                            </p>
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={onAiExitToLobby}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
                                >
                                    최초 화면(로비)로 이동
                                </button>
                                <button
                                    onClick={onAiExitToHandBuild}
                                    className="w-full px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-sm font-semibold"
                                >
                                    조패 단계부터 다시 시작
                                </button>
                                <button
                                    onClick={() => setShowAiExitMenu(false)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <YakuInfoLayer open={showYakuInfo} onClose={() => setShowYakuInfo(false)} />
                {/* Lobby / Match Start / Hand Build Phases - Keep as overlays or separate views */}
                {/* If gameLoop or matchEnd, we can use GameBoard as base? 
                 Actually, matchEnd is an overlay ON TOP of GameBoard usually.
                 gameLoop IS the GameBoard.
                 handBuild is separate? 
                 App.tsx utilized a single main container. 
              */}

                {(matches('idle') || matches('matchStart') || matches('doraSelect') || matches('handBuild')) ? (
                    <div className="w-full max-w-5xl glass-panel rounded-3xl p-4 sm:p-6 min-h-[600px] flex flex-col relative m-2 sm:m-4 z-10">
                        <header className="mb-4 text-center w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end border-b border-slate-700/80 pb-4">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300">17보 마작</h1>
                                <div className="text-xs text-gray-400 mt-1 space-x-2">
                                    <span>ID: <span className="text-white font-mono">{playerId}</span></span>
                                    <span>•</span>
                                    <span className={isConnected ? "text-green-500" : "text-red-500"}>
                                        {isConnected ? "ONLINE" : "OFFLINE"}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right relative">
                                <button
                                    onClick={() => setShowOptions((prev) => !prev)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-500/80 bg-slate-800/80 hover:bg-slate-700 text-sm font-semibold"
                                >
                                    옵션
                                </button>
                                {showOptions && (
                                    <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel p-3 shadow-2xl z-[70] text-left">
                                        <div className="text-xs text-slate-400 mb-2">실행 옵션</div>
                                        <div className="mb-3">
                                            <div className="text-xs text-slate-300 mb-1">실행모드</div>
                                            <div className="grid grid-cols-2 gap-1">
                                                <button
                                                    onClick={() => setDebugMode(false)}
                                                    className={`px-2 py-1 rounded text-xs border ${!debugMode ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                                                >
                                                    NORMAL
                                                </button>
                                                <button
                                                    onClick={() => setDebugMode(true)}
                                                    className={`px-2 py-1 rounded text-xs border ${debugMode ? 'bg-amber-700 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                                                >
                                                    DEBUG
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-300 mb-1">UI 선택</div>
                                            <div className="grid grid-cols-2 gap-1">
                                                <button
                                                    onClick={() => setTileSkin('classic')}
                                                    className={`px-2 py-1 rounded text-xs border ${tileSkin === 'classic' ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                                                >
                                                    클래식
                                                </button>
                                                <button
                                                    onClick={() => setTileSkin('real')}
                                                    className={`px-2 py-1 rounded text-xs border ${tileSkin === 'real' ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                                                >
                                                    리얼 패
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {context.players.length === 2 && (
                                <div className="text-right text-xs">
                                    <div className="text-slate-300 mb-1">선결정 주사위</div>
                                    <div className="text-yellow-300">
                                        {context.players.map((p: PlayerId) => (
                                            <span key={p} className="ml-2">{p === playerId ? 'YOU' : 'OPP'}: {context.dealerDice?.[p] ?? '-'}</span>
                                        ))}
                                    </div>
                                    <div className="text-amber-300 mt-1">선: {context.dealer === playerId ? 'YOU' : context.dealer || '-'}</div>
                                </div>
                            )}
                        </header>

                        {matches('idle') && (
                            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                                {/* ... Lobby UI ... */}
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-bold text-white">대기실</h2>
                                    <p className="text-gray-400">상대를 기다리거나 봇을 추가하세요.</p>
                                </div>

                                <div className="flex flex-col gap-4 w-full max-w-md">
                                    <button
                                        onClick={() => setMainMode('mini')}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-lg shadow-lg"
                                    >
                                        싱글 미니게임: 조패하기
                                    </button>
                                    {!context.players.includes(playerId) ? (
                                        <button onClick={handleJoin} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-bold text-lg shadow-lg">
                                            게임 참가
                                        </button>
                                    ) : (
                                        <div className="text-green-300 bg-green-900/30 py-2 px-4 rounded-xl text-center border border-green-500/50">
                                            참가 완료! ({context.players.indexOf(playerId) + 1}P)
                                        </div>
                                    )}

                                    {context.players.length > 0 && (
                                        <div className="surface-panel p-4 rounded-2xl">
                                            <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Players</h3>
                                            <ul className="space-y-2">
                                                {context.players.map((p: PlayerId) => (
                                                    <li key={p} className="flex items-center gap-2 p-2 bg-slate-800/80 rounded-xl">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        <span className={p === playerId ? "text-yellow-300 font-bold" : "text-gray-300"}>
                                                            {p} {p === playerId && "(YOU)"}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {context.players.includes(playerId) && context.players.length === 1 && (
                                        <>
                                            <div className="surface-panel p-4 rounded-2xl">
                                                <label className="text-sm font-bold text-slate-300 block mb-2">AI 난이도</label>
                                                <select
                                                    value={botDifficulty}
                                                    onChange={(event) => setBotDifficulty(event.target.value as BotDifficulty)}
                                                    className="w-full rounded-xl bg-slate-900/90 border border-slate-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                >
                                                    <option value="EASY">쉬움</option>
                                                    <option value="MEDIUM">보통</option>
                                                    <option value="HARD">어려움</option>
                                                </select>
                                            </div>
                                            <button onClick={handleAddBot} className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-2xl font-bold shadow-lg">
                                                AI 추가 (Add Bot)
                                            </button>
                                        </>
                                    )}
                                    {context.players.length === 2 && (
                                        <button onClick={handleStartMatch} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-xl shadow-xl animate-pulse">
                                            매치 시작 (Start)
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {matches('matchStart') && (
                            <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                <h2 className="text-4xl font-bold text-yellow-400 mb-4">MATCH START</h2>
                                <div className="text-xl text-gray-300">패를 섞는 중...</div>
                            </div>
                        )}

                        {isDoraSelect && (
                            <div className="flex-1">
                                <AnimatePresence>
                                    {showDoraReveal && doraIndicators[0] && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -70, scale: 0.8 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 40, scale: 0.95 }}
                                            transition={{ duration: 0.45, ease: 'easeOut' }}
                                            className="pointer-events-none fixed inset-0 z-[85] flex flex-col items-center justify-center gap-3"
                                        >
                                            <div className="text-lg font-bold text-yellow-300 drop-shadow">도라를 뽑았습니다!</div>
                                            <div className="transform scale-125">
                                                <TileView tile={doraIndicators[0]} disabled={true} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <AnimatePresence mode="popLayout">
                                    {selectedDoraId && doraRevealRemainingSec !== null && doraRevealRemainingSec > 0 && (
                                        <motion.div
                                            key={doraRevealRemainingSec}
                                            initial={{ opacity: 0, scale: 0.7, y: -12 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 1.25, y: 8 }}
                                            transition={{ duration: 0.25, ease: 'easeOut' }}
                                            className="pointer-events-none fixed top-24 left-1/2 -translate-x-1/2 z-[86]"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-black/55 border border-yellow-400/80 text-yellow-300 text-3xl font-black flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.35)]">
                                                {doraRevealRemainingSec}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-white">도라 선택 단계</h2>
                                    <p className="text-gray-400 text-sm">
                                        선({context.dealer === playerId ? 'YOU' : context.dealer})이 패산에서 도라 표시패를 선택합니다.
                                    </p>
                                </div>

                                <div>
                                    <div className="text-sm text-slate-300 mb-3">
                                        {(context.doraIndicators?.length ?? 0) > 0
                                            ? `선이 선택한 도라를 공개 중입니다. ${doraRevealRemainingSec ?? 0}초 후 조패 단계로 이동합니다.`
                                            : context.dealer === playerId
                                                ? '패산에서 1장을 선택하세요.'
                                                : '선의 도라 선택을 기다리는 중...'}
                                    </div>
                                    <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1 p-2 bg-slate-700 rounded-lg max-h-[360px] overflow-y-auto">
                                        {(context.wall || []).map((tile: Tile, idx: number) => {
                                            const isSelectedDora = selectedDoraId !== null && tile.id === selectedDoraId;
                                            return (
                                                <button
                                                    key={tile.id ?? `${tile.suit}-${tile.rank}-${idx}`}
                                                    onClick={() => onSelectDora(tile)}
                                                    disabled={context.dealer !== playerId || (context.doraIndicators?.length ?? 0) > 0}
                                                    className={`w-10 h-14 rounded border-2 text-xs font-bold flex items-center justify-center overflow-hidden ${isSelectedDora
                                                        ? 'border-emerald-400 bg-slate-100'
                                                        : context.dealer === playerId && (context.doraIndicators?.length ?? 0) === 0
                                                            ? 'border-yellow-400 bg-slate-100 text-slate-900 hover:bg-white'
                                                            : 'border-slate-500 bg-slate-600 text-slate-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {isSelectedDora ? <TileView tile={tile} disabled={true} /> : '?'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {matches('handBuild') && (
                            <div className="flex-1">
                                <div className="mb-6 flex justify-between items-end">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">조패 단계 (Hand Building)</h2>
                                        <p className="text-gray-400 text-sm">34개의 패 중 13개를 선택하여 텐파이를 만드세요.</p>
                                    </div>
                                </div>
                                {(context.dealtTiles[playerId] || []).length === 0 ? (
                                    <div className="h-64 rounded-xl border border-slate-700 bg-slate-800/70 flex items-center justify-center">
                                        <div className="text-center w-full max-w-md px-4">
                                            <div className="text-lg font-semibold text-cyan-300">패를 섞는 중입니다...</div>
                                            <div className="text-sm text-slate-400 mt-1">조패 화면을 준비하고 있습니다.</div>
                                            <div className="mt-6 flex items-center justify-center gap-3">
                                                {[0, 1, 2, 3, 4].map((i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ y: 0, opacity: 0.6 }}
                                                        animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }}
                                                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
                                                        className="w-10 h-14 rounded border border-cyan-300/70 bg-slate-100/90 shadow"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <HandBuilder
                                        dealtTiles={context.dealtTiles[playerId] || []}
                                        onSubmit={onSubmitHand}
                                        onQueryAnalysis={queryAnalysisWithPlayer}
                                        analysisResult={analysisResult}
                                        submitted={myHandSubmitted}
                                        opponentSubmitted={opponentHandSubmitted}
                                        buildTimeRemainingMs={handBuildRemainingMs}
                                        doraIndicators={doraIndicators}
                                        debugMode={debugMode}
                                        seatWind={mySeatWind}
                                        scoreDiff={scoreDiff}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // Game Loop & Match End using GameBoard
                    <GameBoard context={context} myPlayerId={playerId}>
                        {/* Interactive Elements passed as children */}
                        <div className="w-full">
                            <HandDisplay
                                hand={myHand}
                                pool={myPool}
                                waits={myWaitTiles}
                                canDiscard={context.currentTurn === playerId}
                                furitenWaitKeys={myWaitKeys}
                                isFuriten={isFuriten}
                                onDiscard={({ tile }) => onDiscard(tile)}
                            />
                        </div>

                        {/* Overlays */}
                        {ronOpportunity && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                                <button
                                    onClick={onDeclareWin}
                                    className="bg-red-600 border-4 border-yellow-400 text-white text-6xl font-black py-8 px-16 rounded-full shadow-2xl animate-bounce hover:scale-110 transition-transform"
                                >
                                    RON! ({ronOpportunity.points})
                                </button>
                            </div>
                        )}

                        {matches('roundEnd') && (
                            <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
                                <div className="glass-panel p-6 rounded-3xl shadow-2xl max-w-3xl w-full">
                                    <h2 className="text-3xl font-black text-white text-center mb-1">
                                        {context.winner ? (context.winner === playerId ? '라운드 승리' : '라운드 패배') : '유국 (DRAW)'}
                                    </h2>
                                    <p className="text-center text-slate-300 mb-4">
                                        다음 라운드로 진행하려면 양쪽 확인이 필요합니다.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {roundEndSummaries.map((summary) => (
                                            <div key={summary.playerId} className="rounded-lg border border-slate-600 bg-slate-900/60 p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-bold text-slate-100">{summary.playerId}{summary.playerId === playerId ? ' (YOU)' : ''}</div>
                                                    <div className={`text-xs font-bold ${summary.confirmed ? 'text-emerald-300' : 'text-amber-300'}`}>
                                                        {summary.confirmed ? '확인 완료' : summary.isBot ? '자동 확인 대기' : '확인 대기'}
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-sm text-slate-300">
                                                    예상 역수: <span className="text-yellow-300 font-bold">{summary.best.han}판</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400">
                                                    대기패 {summary.waits.length}개
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {summary.waits.length === 0 && <span className="text-xs text-slate-500">대기패 없음</span>}
                                                    {summary.waits.map((tile, idx) => (
                                                        <TileView key={`${summary.playerId}-${tile.suit}-${tile.rank}-${idx}`} tile={tile} size="sm" disabled={true} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-5 flex justify-center gap-3">
                                        <button
                                            onClick={onConfirmRoundEnd}
                                            disabled={myRoundEndConfirmed}
                                            className={`px-6 py-2 rounded font-bold ${myRoundEndConfirmed ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                        >
                                            {myRoundEndConfirmed ? '확인 완료' : '결과 확인'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {matches('matchEnd') && (
                            <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                                <div className="glass-panel p-8 rounded-3xl shadow-2xl max-w-2xl w-full text-center animate-in zoom-in-50 duration-300">
                                    <h2 className="text-5xl font-black text-white mb-2">
                                        {context.winner ? (context.winner === playerId ? "WINNER!" : "LOSE...") : "DRAW (유국)"}
                                    </h2>
                                    <p className="text-2xl text-gray-400 mb-8">
                                        {context.winner ? (context.winner === playerId ? "축하합니다! 승리하셨습니다." : "아쉽네요. 패배했습니다.") : "승부가 나지 않았습니다."}
                                    </p>

                                    {context.winResult && (
                                        <div className="bg-black/30 p-6 rounded-xl mb-8 text-left space-y-2">
                                            <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                                                <span className="text-gray-400">Winning Hand Score</span>
                                                <span className="text-3xl font-bold text-yellow-400">{context.winResult.points.toLocaleString()} pts</span>
                                            </div>
                                            <div className="flex gap-4 text-lg">
                                                <span className="font-bold text-white">{context.winResult.han}판</span>
                                                <span className="font-bold text-white">{context.winResult.fu}부</span>
                                                {context.winResult.limit && <span className="bg-red-600 px-2 rounded text-xs leading-6 h-6">{String(context.winResult.limit)}</span>}
                                            </div>
                                            <div className="pt-2">
                                                <h4 className="text-sm text-gray-500 mb-1">Yaku (역)</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {context.winResult.yaku.length > 0 ? context.winResult.yaku.map((y: string) => (
                                                        <span key={y} className="px-3 py-1 bg-blue-900/50 text-blue-200 rounded-full text-sm border border-blue-800">
                                                            {y}
                                                        </span>
                                                    )) : <span className="text-gray-600">No Yaku?</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4 justify-center">
                                        <button
                                            onClick={onRestart}
                                            className="px-8 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-gray-200 transition-colors"
                                        >
                                            로비로 돌아가기
                                        </button>
                                        <button
                                            onClick={() => setShowReplay(true)}
                                            className="px-8 py-3 bg-cyan-600 text-white font-bold rounded-full hover:bg-cyan-500 border border-cyan-300 shadow-lg"
                                        >
                                            리플레이 보기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </GameBoard>
                )}
            </div>
        </TileSkinProvider>
    );
};
