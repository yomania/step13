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
import {
    AuthSessionDTO,
    PlayerId,
    StatsSummaryDTO,
    Tile
} from '@step13/proto';
import { calculateScore, calculateShanten, type ScoreResult } from '@step13/scoring';
import { preloadRealTileAssets } from './lib/tileAssets';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ApiError,
    getStatsSummaryApi,
    loginApi,
    logoutApi,
    refreshApi,
    registerApi,
    updateProfileApi
} from './lib/authApi';

type BotPersonaOption = {
    id: string;
    name: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
};

type EntryMode = 'home' | 'single' | 'online';
type SingleMode = 'menu' | 'mini' | 'ai';
type AuthMode = 'login' | 'register';

const REFRESH_TOKEN_STORAGE_KEY = 'step13-refresh-token';

function getWinningWaits(hand: Tile[]): Tile[] {
    if (hand.length !== RULES.tiles.handSize) {
        return [];
    }

    const waits: Tile[] = [];
    const suits: Tile['suit'][] = ['man', 'pin', 'sou', 'z'];
    for (const suit of suits) {
        const maxRank = suit === 'z' ? 7 : 9;
        for (let rank = 1; rank <= maxRank; rank++) {
            const wait: Tile = { suit, rank: rank as Tile['rank'], isRed: false };
            if (calculateShanten([...hand, wait]) === -1) {
                waits.push(wait);
            }
        }
    }
    return waits;
}

function pickBestWaitScore(hand: Tile[], waits: Tile[], doraIndicators: Tile[], seatWind: 'EAST' | 'WEST' | undefined): ScoreResult {
    const empty: ScoreResult = {
        han: 0,
        fu: 0,
        points: 0,
        yaku: [],
        isMangan: false,
        doraCount: 0,
        pointsDelta: 0
    };
    if (waits.length === 0) {
        return empty;
    }

    return waits.reduce((best, wait) => {
        const score = calculateScore(hand, wait, false, doraIndicators, {
            seatWind,
            roundWind: 'EAST'
        });
        if (score.points !== best.points) {
            return score.points > best.points ? score : best;
        }
        if (score.han !== best.han) {
            return score.han > best.han ? score : best;
        }
        return score.yaku.length > best.yaku.length ? score : best;
    }, empty);
}

function toKoreanLimit(limit: string): string {
    const map: Record<string, string> = {
        Mangan: '만관',
        Haneman: '하네만',
        Baiman: '배만',
        Sanbaiman: '삼배만',
        Yakuman: '역만'
    };
    return map[limit] ?? limit;
}

function toKoreanYaku(yaku: string): string {
    if (yaku.startsWith('Dora ')) {
        const count = yaku.replace('Dora ', '');
        return `도라 ${count}`;
    }
    if (yaku.startsWith('Yakuhai')) {
        const honor = yaku.split(': ')[1] ?? '';
        const honorMap: Record<string, string> = {
            z1: '동',
            z2: '남',
            z3: '서',
            z4: '북',
            z5: '백',
            z6: '발',
            z7: '중'
        };
        if (yaku.startsWith('Yakuhai(Seat):')) {
            return `자풍패(${honorMap[honor] ?? honor})`;
        }
        if (yaku.startsWith('Yakuhai(Round):')) {
            return `장풍패(${honorMap[honor] ?? honor})`;
        }
        return `역패(${honorMap[honor] ?? honor})`;
    }

    const map: Record<string, string> = {
        Chiitoitsu: '치또이츠',
        KokushiMusou: '국사무쌍',
        Pinfu: '핑후',
        SanshokuDoukou: '삼색동각',
        SanshokuDoujun: '삼색동순',
        Toitoi: '또이또이',
        Sanankou: '삼암각',
        Chanta: '찬타',
        Junchan: '준찬',
        Honroutou: '혼노두',
        Shousangen: '소삼원',
        Shousushi: '소사희',
        Daisushi: '대사희',
        Daisangen: '대삼원',
        Tanyao: '탕야오',
        Chinitsu: '청일색',
        Honitsu: '혼일색',
        Ittsuu: '일기통관',
        Iipeikou: '이페코',
        'Riichi (Auto)': '리치(자동)'
    };
    return map[yaku] ?? yaku;
}

function loadStoredRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

function saveStoredRefreshToken(refreshToken: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

function clearStoredRefreshToken(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}



export default function App() {
    const [localState, , actor] = useMachine(gameMachine);
    const [serverState, setServerState] = useState<any>(null);
    const [playerProfiles, setPlayerProfiles] = useState<Record<string, { nickname: string; avatarKey: string }>>({});
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [botPersonas, setBotPersonas] = useState<BotPersonaOption[]>([]);
    const [authSession, setAuthSession] = useState<AuthSessionDTO | null>(null);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [authEmailInput, setAuthEmailInput] = useState('');
    const [authPasswordInput, setAuthPasswordInput] = useState('');
    const [authNicknameInput, setAuthNicknameInput] = useState('');
    const [authLoading, setAuthLoading] = useState(true);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showProfilePanel, setShowProfilePanel] = useState(false);
    const [profileNicknameInput, setProfileNicknameInput] = useState('');
    const [profileBioInput, setProfileBioInput] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [statsSummary, setStatsSummary] = useState<StatsSummaryDTO | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:3001', []);
    const playerId = authSession?.profile.playerId ?? '__unauth__';

    // Pass the actor and a callback to update serverState
    const handleServerStateUpdate = useCallback((newState: any, incomingProfiles?: Record<string, { nickname: string; avatarKey: string }>) => {
        setServerState(newState);
        if (incomingProfiles) {
            setPlayerProfiles(incomingProfiles);
        }
    }, []);

    const handleAnalysisResult = useCallback((result: any) => {
        setAnalysisResult(result);
    }, []);

    const handlePersonaListResult = useCallback((result: any) => {
        if (!Array.isArray(result?.personas)) return;
        const personas = result.personas.filter((persona: any) =>
            persona &&
            typeof persona.id === 'string' &&
            typeof persona.name === 'string' &&
            (persona.difficulty === 'EASY' || persona.difficulty === 'MEDIUM' || persona.difficulty === 'HARD')
        ) as BotPersonaOption[];
        setBotPersonas(personas);
    }, []);

    const handleSocketAuthExpired = useCallback(() => {
        void (async () => {
            const refreshToken = loadStoredRefreshToken();
            if (!refreshToken) {
                setAuthSession(null);
                return;
            }

            try {
                const session = await refreshApi(refreshToken, apiBaseUrl);
                saveStoredRefreshToken(session.tokens.refreshToken);
                setAuthSession(session);
                setAuthError(null);
            } catch {
                clearStoredRefreshToken();
                setAuthSession(null);
            }
        })();
    }, [apiBaseUrl]);

    const socketOptions = useMemo(() => ({
        accessToken: authSession?.tokens.accessToken ?? null,
        apiBaseUrl,
        onAuthExpired: handleSocketAuthExpired
    }), [authSession?.tokens.accessToken, apiBaseUrl, handleSocketAuthExpired]);

    const { sendEvent, queryAnalysis, queryPersonas } = useGameSocket(
        actor,
        handleServerStateUpdate,
        handleAnalysisResult,
        handlePersonaListResult,
        socketOptions
    );

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
    const [entryMode, setEntryMode] = useState<EntryMode>('home');
    const [singleMode, setSingleMode] = useState<SingleMode>('menu');
    const [botPersonaId, setBotPersonaId] = useState<string>('');

    useEffect(() => {
        setIsConnected(Boolean(authSession));
    }, [authSession]);

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

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            const storedRefreshToken = loadStoredRefreshToken();
            if (!storedRefreshToken) {
                if (!cancelled) {
                    setAuthSession(null);
                    setAuthLoading(false);
                }
                return;
            }

            try {
                const session = await refreshApi(storedRefreshToken, apiBaseUrl);
                if (cancelled) return;
                saveStoredRefreshToken(session.tokens.refreshToken);
                setAuthSession(session);
                setAuthError(null);
            } catch {
                if (cancelled) return;
                clearStoredRefreshToken();
                setAuthSession(null);
            } finally {
                if (!cancelled) {
                    setAuthLoading(false);
                }
            }
        };

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl]);

    useEffect(() => {
        if (!authSession) {
            setProfileNicknameInput('');
            setProfileBioInput('');
            return;
        }
        setProfileNicknameInput(authSession.profile.nickname);
        setProfileBioInput(authSession.profile.bio ?? '');
    }, [authSession]);

    const withAccessTokenRetry = useCallback(async <T,>(run: (accessToken: string) => Promise<T>): Promise<T> => {
        const currentSession = authSession;
        if (!currentSession) {
            throw new ApiError('로그인이 필요합니다.', 401, 'AUTH_REQUIRED');
        }

        try {
            return await run(currentSession.tokens.accessToken);
        } catch (error) {
            if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) {
                throw error;
            }

            const refreshToken = loadStoredRefreshToken();
            if (!refreshToken) {
                clearStoredRefreshToken();
                setAuthSession(null);
                throw error;
            }

            try {
                const refreshed = await refreshApi(refreshToken, apiBaseUrl);
                saveStoredRefreshToken(refreshed.tokens.refreshToken);
                setAuthSession(refreshed);
                return run(refreshed.tokens.accessToken);
            } catch {
                clearStoredRefreshToken();
                setAuthSession(null);
                throw error;
            }
        }
    }, [authSession, apiBaseUrl]);

    const refreshStats = useCallback(async () => {
        const summary = await withAccessTokenRetry((accessToken) => getStatsSummaryApi(accessToken, apiBaseUrl));
        setStatsSummary(summary);
    }, [apiBaseUrl, withAccessTokenRetry]);

    useEffect(() => {
        if (!showProfilePanel || !authSession) {
            return;
        }

        let cancelled = false;
        setStatsLoading(true);
        setProfileError(null);

        void refreshStats()
            .catch((error) => {
                if (cancelled) return;
                if (error instanceof Error) {
                    setProfileError(error.message);
                } else {
                    setProfileError('전적 정보를 불러오지 못했습니다.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setStatsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [showProfilePanel, authSession, refreshStats]);

    const submitAuthForm = useCallback(async () => {
        if (!authEmailInput || !authPasswordInput || (authMode === 'register' && !authNicknameInput)) {
            setAuthError('이메일, 비밀번호, 닉네임을 확인해주세요.');
            return;
        }

        setAuthSubmitting(true);
        setAuthError(null);
        try {
            const session = authMode === 'login'
                ? await loginApi({ email: authEmailInput, password: authPasswordInput }, apiBaseUrl)
                : await registerApi({ email: authEmailInput, password: authPasswordInput, nickname: authNicknameInput }, apiBaseUrl);

            saveStoredRefreshToken(session.tokens.refreshToken);
            setAuthSession(session);
            setAuthNicknameInput('');
            setAuthPasswordInput('');
            setAuthLoading(false);
        } catch (error) {
            if (error instanceof ApiError) {
                setAuthError(error.message);
            } else {
                setAuthError('로그인 처리 중 오류가 발생했습니다.');
            }
        } finally {
            setAuthSubmitting(false);
        }
    }, [apiBaseUrl, authEmailInput, authMode, authNicknameInput, authPasswordInput]);

    const submitProfileUpdate = useCallback(async () => {
        if (!authSession) return;

        setProfileSaving(true);
        setProfileError(null);
        try {
            const response = await withAccessTokenRetry((accessToken) => updateProfileApi(accessToken, {
                nickname: profileNicknameInput,
                bio: profileBioInput || null
            }, apiBaseUrl));
            setAuthSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    profile: response.profile
                };
            });
            await refreshStats();
        } catch (error) {
            if (error instanceof ApiError) {
                setProfileError(error.message);
            } else {
                setProfileError('프로필 저장 중 오류가 발생했습니다.');
            }
        } finally {
            setProfileSaving(false);
        }
    }, [apiBaseUrl, authSession, profileBioInput, profileNicknameInput, refreshStats, withAccessTokenRetry]);

    const handleLogout = useCallback(async () => {
        const refreshToken = loadStoredRefreshToken();
        try {
            await logoutApi(refreshToken, apiBaseUrl);
        } catch {
            // No-op: logout should clear local session regardless of server response.
        }

        clearStoredRefreshToken();
        setAuthSession(null);
        setServerState(null);
        setPlayerProfiles({});
        setShowProfilePanel(false);
        setStatsSummary(null);
        setAuthError(null);
    }, [apiBaseUrl]);

    const getPlayerName = useCallback((pid: PlayerId) => {
        if (pid === playerId) {
            return authSession?.profile.nickname ?? playerProfiles[pid]?.nickname ?? pid;
        }
        return playerProfiles[pid]?.nickname ?? pid;
    }, [authSession?.profile.nickname, playerId, playerProfiles]);

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

    const myWaitTiles = useMemo(() => {
        return getWinningWaits(myHand);
    }, [myHand]);

    const myWaitKeys = useMemo(() => {
        return new Set<string>(myWaitTiles.map((t: Tile) => `${t.suit}-${t.rank}`));
    }, [myWaitTiles]);

    const isFuriten = useMemo(() => {
        return myDiscards.some((tile: Tile) => myWaitKeys.has(`${tile.suit}-${tile.rank}`));
    }, [myDiscards, myWaitKeys]);
    const myRoundEndConfirmed = Boolean(context.roundEndConfirmedBy?.[playerId]);
    const roundEndSummaries = useMemo(() => {
        return (context.players as PlayerId[]).map((pid) => {
            const hand = (context.hands?.[pid] || []) as Tile[];
            const waits = getWinningWaits(hand);
            const seatWind = context.seatMap?.[pid] === 'EAST'
                ? 'EAST'
                : context.seatMap?.[pid] === 'WEST'
                    ? 'WEST'
                    : undefined;
            const best = pickBestWaitScore(hand, waits, doraIndicators, seatWind);
            return {
                playerId: pid,
                waits,
                best,
                confirmed: Boolean(context.roundEndConfirmedBy?.[pid]),
                isBot: pid.startsWith('bot-')
            };
        });
    }, [context.players, context.hands, context.seatMap, context.roundEndConfirmedBy, doraIndicators]);

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
    const isGameLoop = matches('gameLoop');
    const isRoundEnd = matches('roundEnd');
    const isPlayerInLobby = context.players.includes(playerId);
    const isHomeMode = entryMode === 'home';
    const isSingleMiniMode = entryMode === 'single' && singleMode === 'mini';
    const isSingleAiMode = entryMode === 'single' && singleMode === 'ai';
    const isOnlineMode = entryMode === 'online';

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

    const handleLeaveLobby = () => {
        if (!isPlayerInLobby) return;
        sendEvent({ type: 'LEAVE', playerId });
    };

    const handleStartMatch = () => {
        sendEvent({ type: 'START_MATCH' });
    };

    const handleGoHome = () => {
        if (isIdle && isPlayerInLobby) {
            sendEvent({ type: 'LEAVE', playerId });
        }
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        setEntryMode('home');
        setSingleMode('menu');
    };

    const handleOpenSingleMenu = () => {
        if (isIdle && isPlayerInLobby) {
            sendEvent({ type: 'LEAVE', playerId });
        }
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        setEntryMode('single');
        setSingleMode('menu');
    };

    const handleOpenOnlineMode = () => {
        if (isIdle && isPlayerInLobby) {
            sendEvent({ type: 'LEAVE', playerId });
        }
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        setEntryMode('online');
        setSingleMode('menu');
    };

    const handleOpenMiniGame = () => {
        if (isIdle && isPlayerInLobby) {
            sendEvent({ type: 'LEAVE', playerId });
        }
        setEntryMode('single');
        setSingleMode('mini');
    };

    const handleExitMiniGame = () => {
        if (isIdle && isPlayerInLobby) {
            sendEvent({ type: 'LEAVE', playerId });
        }
        setSingleMode('menu');
    };

    const handleStartSingleAi = () => {
        setEntryMode('single');
        setSingleMode('ai');
        setShowAiExitMenu(false);
        queryPersonas({ playerId });
        sendEvent({ type: 'RESTART' });
        setAiRematchStep('none');
    };

    const handleExitSingleAiSetup = () => {
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        if (isIdle && context.players.length > 0) {
            sendEvent({ type: 'RESTART' });
        }
        setEntryMode('single');
        setSingleMode('menu');
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
        sendEvent({ type: 'RESTART' });
        if (isSingleAiMode) {
            setSingleMode('menu');
        }
    };

    // Ron Opportunity (Query server when lastDiscard changes)
    const [ronOpportunity, setRonOpportunity] = useState<any>(null);
    const ronQueryIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isGameLoop) {
            ronQueryIdRef.current = null;
            setRonOpportunity(null);
            return;
        }
        const { lastDiscard, hands } = context;
        if (!lastDiscard || lastDiscard.playerId === playerId) {
            ronQueryIdRef.current = null;
            setRonOpportunity(null);
            return;
        }

        const myHand = hands[playerId];
        if (!myHand) return;

        const queryId = `ron-${context.round}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        ronQueryIdRef.current = queryId;

        // Query server for ron check
        queryAnalysisWithPlayer({
            queryId,
            queryType: 'SCORE',
            hand: myHand,
            wait: lastDiscard.tile,
            doraIndicators
        });
    }, [context.lastDiscard, playerId, isGameLoop, doraIndicators, context.hands, queryAnalysisWithPlayer]);

    // Update ronOpportunity when analysisResult comes back for SCORE
    useEffect(() => {
        if (analysisResult?.type !== 'ANALYSIS_RESULT') return;
        if (!analysisResult.scoreResult) return;

        const pendingRonQueryId = ronQueryIdRef.current;
        const incomingQueryId = typeof analysisResult.queryId === 'string' ? analysisResult.queryId : null;
        if (!pendingRonQueryId || incomingQueryId !== pendingRonQueryId) {
            return;
        }

        if (analysisResult.scoreResult.points > 0) {
            setRonOpportunity(analysisResult.scoreResult);
        } else {
            setRonOpportunity(null);
        }
    }, [analysisResult]);

    const [showReplay, setShowReplay] = useState(false);
    const [showYakuInfo, setShowYakuInfo] = useState(false);
    const [showAiExitMenu, setShowAiExitMenu] = useState(false);
    const [aiRematchStep, setAiRematchStep] = useState<'none' | 'join' | 'waitSelf' | 'addBot' | 'waitBot' | 'start'>('none');
    const [showRoundEndOverlay, setShowRoundEndOverlay] = useState(true);
    const aiRematchStatusText = useMemo(() => {
        switch (aiRematchStep) {
            case 'join':
                return '플레이어를 싱글 대전에 등록 중입니다.';
            case 'waitSelf':
                return '대기실 등록 반영을 기다리는 중입니다.';
            case 'addBot':
                return 'AI 상대를 추가하고 있습니다.';
            case 'waitBot':
                return 'AI 참가 완료를 기다리는 중입니다.';
            case 'start':
                return '매치를 시작하는 중입니다.';
            default:
                return '준비 완료. 버튼을 눌러 AI 대전을 시작하세요.';
        }
    }, [aiRematchStep]);

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
        if (isRoundEnd) {
            setShowRoundEndOverlay(true);
        }
    }, [isRoundEnd]);

    useEffect(() => {
        if (!isSingleAiMode) return;
        queryPersonas({ playerId });
    }, [isSingleAiMode, queryPersonas, playerId]);

    useEffect(() => {
        if (aiRematchStep === 'none' || !isIdle || !isSingleAiMode) return;

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
                sendEvent({
                    type: 'ADD_BOT',
                    personaId: botPersonaId || undefined
                });
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
    }, [aiRematchStep, botPersonaId, isIdle, isSingleAiMode, context.players, playerId, sendEvent]);

    useEffect(() => {
        if (botPersonas.length === 0) return;

        const selected = botPersonas.find((persona) => persona.id === botPersonaId);
        if (!selected) {
            const medium = botPersonas.find((persona) => persona.difficulty === 'MEDIUM');
            const fallback = medium ?? botPersonas[0];
            setBotPersonaId(fallback.id);
            return;
        }
    }, [botPersonas, botPersonaId]);

    const onAiExitToLobby = () => {
        setShowAiExitMenu(false);
        setAiRematchStep('none');
        setEntryMode('single');
        setSingleMode('menu');
        sendEvent({ type: 'RESTART' });
    };

    const onAiExitToHandBuild = () => {
        setShowAiExitMenu(false);
        setEntryMode('single');
        setSingleMode('ai');
        setAiRematchStep('join');
        sendEvent({ type: 'RESTART' });
    };

    if (authLoading || !authSession) {
        return (
            <TileSkinProvider skin={tileSkin}>
                <div className="app-noise min-h-screen flex items-center justify-center px-4 py-8 text-white">
                    <div className="w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl">
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300">
                            17보 마작
                        </h1>
                        <p className="mt-2 text-sm text-slate-300">
                            온라인 플레이를 위해 로그인하세요.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setAuthMode('login')}
                                className={`px-3 py-2 rounded-xl font-semibold border ${authMode === 'login'
                                    ? 'bg-cyan-700 border-cyan-400 text-white'
                                    : 'bg-slate-800 border-slate-600 text-slate-300'
                                    }`}
                            >
                                로그인
                            </button>
                            <button
                                onClick={() => setAuthMode('register')}
                                className={`px-3 py-2 rounded-xl font-semibold border ${authMode === 'register'
                                    ? 'bg-emerald-700 border-emerald-400 text-white'
                                    : 'bg-slate-800 border-slate-600 text-slate-300'
                                    }`}
                            >
                                회원가입
                            </button>
                        </div>
                        <form
                            className="mt-5 flex flex-col gap-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void submitAuthForm();
                            }}
                        >
                            <input
                                type="email"
                                value={authEmailInput}
                                onChange={(event) => setAuthEmailInput(event.target.value)}
                                placeholder="이메일"
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <input
                                type="password"
                                value={authPasswordInput}
                                onChange={(event) => setAuthPasswordInput(event.target.value)}
                                placeholder="비밀번호 (8자 이상)"
                                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            {authMode === 'register' && (
                                <input
                                    type="text"
                                    value={authNicknameInput}
                                    onChange={(event) => setAuthNicknameInput(event.target.value)}
                                    placeholder="닉네임 (2~20자)"
                                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            )}
                            {authError && (
                                <div className="text-sm text-rose-300 bg-rose-900/25 border border-rose-500/40 rounded-lg px-3 py-2">
                                    {authError}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={authSubmitting || authLoading}
                                className={`w-full py-3 rounded-2xl font-bold ${authSubmitting || authLoading
                                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                                    : authMode === 'login'
                                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                            >
                                {authSubmitting ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
                            </button>
                        </form>
                    </div>
                </div>
            </TileSkinProvider>
        );
    }

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

    if (isSingleMiniMode) {
        return (
            <TileSkinProvider skin={tileSkin}>
                <div className="app-noise flex flex-col items-center justify-center min-h-screen text-white font-sans relative overflow-x-hidden px-3 py-4 sm:px-5">
                    <div className="pointer-events-none absolute -top-24 -left-28 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
                    <div className="absolute top-4 left-4 z-[70]">
                        <button
                            onClick={() => setShowYakuInfo(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-yellow-500 font-bold shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-yellow-500/30 transition-all hover:scale-105"
                        >
                            17보 역정보
                        </button>
                    </div>
                    <SingleMiniGame
                        onExit={handleExitMiniGame}
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
                {((isIdle && !isHomeMode) || isHandBuild) && (
                    <div className="absolute top-4 left-4 z-[70]">
                        <button
                            onClick={() => setShowYakuInfo(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-yellow-500 font-bold shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-yellow-500/30 transition-all hover:scale-105"
                        >
                            17보 역정보
                        </button>
                    </div>
                )}
                {isAiMatch && isSingleAiMode && !isIdle && (
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
                                    싱글 메뉴로 이동
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
                {showProfilePanel && (
                    <div className="fixed inset-0 z-[82] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-xl rounded-2xl glass-panel p-5 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">내 프로필</h3>
                                <button
                                    onClick={() => setShowProfilePanel(false)}
                                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
                                >
                                    닫기
                                </button>
                            </div>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">닉네임</div>
                                        <input
                                            value={profileNicknameInput}
                                            onChange={(event) => setProfileNicknameInput(event.target.value)}
                                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 mb-1">소개</div>
                                        <textarea
                                            value={profileBioInput}
                                            onChange={(event) => setProfileBioInput(event.target.value)}
                                            rows={4}
                                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                    {profileError && (
                                        <div className="text-xs text-rose-300 bg-rose-900/30 border border-rose-500/40 rounded-lg px-2 py-1.5">
                                            {profileError}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => void submitProfileUpdate()}
                                        disabled={profileSaving}
                                        className={`w-full py-2 rounded-xl font-semibold ${profileSaving
                                            ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                                            : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                                            }`}
                                    >
                                        {profileSaving ? '저장 중...' : '프로필 저장'}
                                    </button>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-3">
                                    <div className="text-sm font-semibold text-slate-200 mb-2">전적 요약</div>
                                    {statsLoading && <div className="text-sm text-slate-400">불러오는 중...</div>}
                                    {!statsLoading && statsSummary && (
                                        <div className="space-y-2 text-sm text-slate-300">
                                            <div>총 매치: <span className="text-white font-bold">{statsSummary.totalMatches}</span></div>
                                            <div>승/패: <span className="text-emerald-300 font-bold">{statsSummary.wins}</span> / <span className="text-rose-300 font-bold">{statsSummary.losses}</span></div>
                                            <div>승률: <span className="text-white font-bold">{(statsSummary.winRate * 100).toFixed(1)}%</span></div>
                                            <div>총 점수 증감: <span className={`font-bold ${statsSummary.totalScoreDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{statsSummary.totalScoreDelta >= 0 ? '+' : ''}{statsSummary.totalScoreDelta}</span></div>
                                            <div className="mt-3">
                                                <div className="text-xs text-slate-400 mb-1">최근 매치</div>
                                                <div className="max-h-48 overflow-y-auto space-y-1">
                                                    {statsSummary.recentMatches.length === 0 && (
                                                        <div className="text-xs text-slate-500">아직 전적이 없습니다.</div>
                                                    )}
                                                    {statsSummary.recentMatches.map((match) => (
                                                        <div key={match.matchId} className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <span>{match.mode.toUpperCase()}</span>
                                                                <span className={match.isWinner ? 'text-emerald-300' : 'text-rose-300'}>
                                                                    {match.isWinner ? 'WIN' : 'LOSE'}
                                                                </span>
                                                            </div>
                                                            <div className="text-slate-400">
                                                                점수 {match.finalScore.toLocaleString()} ({match.scoreDelta >= 0 ? '+' : ''}{match.scoreDelta.toLocaleString()})
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                    <div className="w-full h-full max-h-screen sm:aspect-video sm:h-auto sm:max-w-5xl glass-panel rounded-none sm:rounded-3xl p-4 sm:p-6 flex flex-col relative m-0 sm:m-4 z-10 overflow-hidden">
                        <header className="mb-4 text-center w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end border-b border-slate-700/80 pb-4">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-600 drop-shadow-sm tracking-tight text-stroke-sm">17보 마작</h1>
                                <div className="text-xs text-gray-400 mt-1 space-x-2">
                                    <span>닉네임: <span className="text-white font-semibold">{authSession.profile.nickname}</span></span>
                                    <span>•</span>
                                    <span>ID: <span className="text-white font-mono">{playerId}</span></span>
                                    <span>•</span>
                                    <span className={isConnected ? "text-green-500" : "text-red-500"}>
                                        {isConnected ? "ONLINE" : "OFFLINE"}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right relative">
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => setShowProfilePanel((prev) => !prev)}
                                        className="px-3 py-1.5 rounded-xl border border-yellow-500/50 bg-slate-800/80 hover:bg-slate-700 text-yellow-400 text-sm font-bold shadow-sm"
                                    >
                                        프로필
                                    </button>
                                    <button
                                        onClick={() => setShowOptions((prev) => !prev)}
                                        className="px-3 py-1.5 rounded-xl border border-slate-500/80 bg-slate-800/80 hover:bg-slate-700 text-sm font-semibold"
                                    >
                                        옵션
                                    </button>
                                    <button
                                        onClick={() => void handleLogout()}
                                        className="px-3 py-1.5 rounded-xl border border-rose-500/80 bg-rose-900/50 hover:bg-rose-800 text-sm font-semibold"
                                    >
                                        로그아웃
                                    </button>
                                </div>
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
                                            <span key={p} className="ml-2">{getPlayerName(p)}: {context.dealerDice?.[p] ?? '-'}</span>
                                        ))}
                                    </div>
                                    <div className="text-amber-300 mt-1">선: {context.dealer ? getPlayerName(context.dealer) : '-'}</div>
                                </div>
                            )}
                        </header>

                        {matches('idle') && (
                            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                                {isHomeMode && (
                                    <>
                                        <div className="text-center space-y-2">
                                            <h2 className="text-3xl font-bold text-white">모드 선택</h2>
                                            <p className="text-gray-400">싱글 플레이 또는 온라인 대전을 선택하세요.</p>
                                        </div>
                                        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                                            <button
                                                onClick={handleOpenSingleMenu}
                                                className="rounded-3xl border border-emerald-400/40 bg-emerald-700/20 p-6 text-left shadow-lg hover:bg-emerald-600/30"
                                            >
                                                <div className="text-2xl font-black text-emerald-200">싱글 모드</div>
                                                <div className="mt-2 text-sm text-emerald-100/90">조패게임과 AI 대전을 혼자 플레이합니다.</div>
                                            </button>
                                            <button
                                                onClick={handleOpenOnlineMode}
                                                className="rounded-3xl border border-cyan-400/40 bg-cyan-700/20 p-6 text-left shadow-lg hover:bg-cyan-600/30"
                                            >
                                                <div className="text-2xl font-black text-cyan-100">온라인 모드</div>
                                                <div className="mt-2 text-sm text-cyan-100/90">대기실에 입장해 다른 플레이어와 매치를 시작합니다.</div>
                                            </button>
                                        </div>
                                    </>
                                )}

                                {entryMode === 'single' && singleMode === 'menu' && (
                                    <>
                                        <div className="text-center space-y-2">
                                            <h2 className="text-3xl font-bold text-white">싱글 모드</h2>
                                            <p className="text-gray-400">조패게임 또는 AI 대전을 선택하세요.</p>
                                        </div>
                                        <div className="flex flex-col gap-4 w-full max-w-md">
                                            <button
                                                onClick={handleOpenMiniGame}
                                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-lg shadow-lg"
                                            >
                                                조패게임
                                            </button>
                                            <button
                                                onClick={handleStartSingleAi}
                                                className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-2xl font-bold text-lg shadow-lg"
                                            >
                                                AI 대전
                                            </button>
                                            <button
                                                onClick={handleGoHome}
                                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl font-semibold shadow"
                                            >
                                                모드 선택으로 돌아가기
                                            </button>
                                        </div>
                                    </>
                                )}

                                {isSingleAiMode && (
                                    <>
                                        <div className="text-center space-y-2">
                                            <h2 className="text-3xl font-bold text-white">싱글 AI 대전</h2>
                                            <p className="text-gray-400">플레이어 + AI 1명으로 매치를 자동 준비합니다.</p>
                                        </div>
                                        <div className="flex flex-col gap-4 w-full max-w-md">
                                            <div className="surface-panel p-4 rounded-2xl">
                                                <label className="text-sm font-bold text-slate-300 block mb-2">AI 페르소나</label>
                                                <select
                                                    value={botPersonaId}
                                                    onChange={(event) => setBotPersonaId(event.target.value)}
                                                    className="w-full rounded-xl bg-slate-900/90 border border-slate-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                                    disabled={botPersonas.length === 0 || aiRematchStep !== 'none'}
                                                >
                                                    {botPersonas.length === 0 && (
                                                        <option value="">페르소나 목록 불러오는 중...</option>
                                                    )}
                                                    {botPersonas.map((persona) => (
                                                        <option key={persona.id} value={persona.id}>
                                                            {persona.name} ({persona.difficulty})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="surface-panel p-4 rounded-2xl text-sm text-slate-300">
                                                {aiRematchStatusText}
                                            </div>
                                            <button
                                                onClick={() => setAiRematchStep('join')}
                                                disabled={aiRematchStep !== 'none'}
                                                className={`w-full py-3 rounded-2xl font-bold text-lg shadow-lg ${aiRematchStep !== 'none'
                                                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                                                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                                                    }`}
                                            >
                                                AI 대전 시작
                                            </button>
                                            <button
                                                onClick={handleExitSingleAiSetup}
                                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl font-semibold shadow"
                                            >
                                                싱글 메뉴로
                                            </button>
                                        </div>
                                    </>
                                )}

                                {isOnlineMode && (
                                    <>
                                        <div className="text-center space-y-2">
                                            <h2 className="text-3xl font-bold text-white">온라인 대기실</h2>
                                            <p className="text-gray-400">대기실 입장 후 상대를 기다리거나 매치를 시작하세요.</p>
                                        </div>
                                        <div className="flex flex-col gap-4 w-full max-w-md">
                                            {!isPlayerInLobby ? (
                                                <button onClick={handleJoin} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-bold text-lg shadow-lg">
                                                    대기실 입장
                                                </button>
                                            ) : (
                                                <div className="text-green-300 bg-green-900/30 py-2 px-4 rounded-xl text-center border border-green-500/50">
                                                    입장 완료! ({context.players.indexOf(playerId) + 1}P)
                                                </div>
                                            )}
                                            {isPlayerInLobby && (
                                                <button onClick={handleLeaveLobby} className="w-full py-3 bg-rose-700 hover:bg-rose-600 rounded-2xl font-bold shadow-lg">
                                                    대기실 나가기
                                                </button>
                                            )}
                                            {context.players.length > 0 && (
                                                <div className="surface-panel p-4 rounded-2xl">
                                                    <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Players</h3>
                                                    <ul className="space-y-2">
                                                        {context.players.map((p: PlayerId) => (
                                                            <li key={p} className="flex items-center gap-2 p-2 bg-slate-800/80 rounded-xl">
                                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                <span className={p === playerId ? "text-yellow-300 font-bold" : "text-gray-300"}>
                                                                    {getPlayerName(p)} {p === playerId && "(YOU)"}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {isPlayerInLobby && context.players.length === 2 && (
                                                <button onClick={handleStartMatch} className="w-full py-4 bg-gradient-to-b from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-black border border-yellow-400 rounded-2xl font-black text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4),_0_4px_15px_rgba(0,0,0,0.5)] animate-pulse">
                                                    온라인 매치 시작
                                                </button>
                                            )}
                                            <button
                                                onClick={handleGoHome}
                                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl font-semibold shadow"
                                            >
                                                모드 선택으로 돌아가기
                                            </button>
                                        </div>
                                    </>
                                )}
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
                                        선({context.dealer ? getPlayerName(context.dealer) : '-'})이 패산에서 도라 표시패를 선택합니다.
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

                        {isRoundEnd && !showRoundEndOverlay && (
                            <>
                                <button
                                    onClick={() => setShowRoundEndOverlay(true)}
                                    className="absolute inset-0 z-40 cursor-pointer"
                                    aria-label="결과 레이어 다시 보기"
                                />
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
                                    <div className="px-4 py-2 rounded-xl bg-slate-900/85 border border-cyan-400/50 text-cyan-200 text-sm font-semibold shadow-lg">
                                        게임판 클릭 시 결과 화면이 다시 열립니다.
                                    </div>
                                </div>
                            </>
                        )}

                        {isRoundEnd && showRoundEndOverlay && (() => {
                            // 론패 정보: 론으로 끝난 경우 lastDiscard에 버린 패 정보가 있음
                            const ronTile = context.winner && context.lastDiscard ? context.lastDiscard.tile : null;
                            const ronLoserId = context.winner && context.lastDiscard ? context.lastDiscard.playerId : null;
                            // 점수 변동 계산
                            const winResult = context.winResult as { han: number; fu: number; points: number; yaku: string[]; limit?: string } | null;
                            const getScoreDelta = (pid: string): number => {
                                if (!winResult) return 0;
                                if (context.winner === pid) return winResult.points;
                                if (context.winner && context.winner !== pid) return -winResult.points;
                                return 0;
                            };

                            return (
                                <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
                                    <div className="glass-panel p-6 rounded-3xl shadow-2xl max-w-3xl w-full">
                                        <h2 className="text-3xl font-black text-white text-center mb-1">
                                            {context.winner ? (context.winner === playerId ? '라운드 승리' : '라운드 패배') : '유국 (DRAW)'}
                                        </h2>
                                        <p className="text-center text-slate-300 mb-2">
                                            다음 라운드로 진행하려면 양쪽 확인이 필요합니다.
                                        </p>

                                        {/* 화료 점수 요약 배너 */}
                                        {winResult && context.winner && (
                                            <div className="mb-4 rounded-xl border border-yellow-500/50 bg-yellow-900/20 px-4 py-3 text-center">
                                                <div className="text-xs text-yellow-400 mb-1 font-semibold tracking-wide">화료 점수</div>
                                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                                    <span className="text-2xl font-black text-yellow-300">{winResult.points.toLocaleString()}점</span>
                                                    <span className="text-sm text-slate-300">{winResult.han}판 {winResult.fu}부</span>
                                                    {winResult.limit && (
                                                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold">{toKoreanLimit(winResult.limit)}</span>
                                                    )}
                                                </div>
                                                {winResult.yaku.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1 justify-center">
                                                        {winResult.yaku.map((y: string) => (
                                                            <span key={y} className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-[11px] border border-slate-600">{toKoreanYaku(y)}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {roundEndSummaries.map((summary) => {
                                                // 이 플레이어가 론 승자인지 여부
                                                const isRonWinner = context.winner === summary.playerId && ronTile !== null;
                                                // 이 플레이어가 론패를 버린 패자인지 여부
                                                const isRonLoser = ronLoserId === summary.playerId && ronTile !== null;

                                                return (
                                                    <div
                                                        key={summary.playerId}
                                                        className={`rounded-lg border p-3 ${isRonWinner
                                                            ? 'border-yellow-400/70 bg-yellow-900/20'
                                                            : isRonLoser
                                                                ? 'border-rose-500/60 bg-rose-900/15'
                                                                : 'border-slate-600 bg-slate-900/60'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-bold text-slate-100">{getPlayerName(summary.playerId)}{summary.playerId === playerId ? ' (YOU)' : ''}</div>
                                                            <div className={`text-xs font-bold ${summary.confirmed ? 'text-emerald-300' : 'text-amber-300'}`}>
                                                                {summary.confirmed ? '확인 완료' : summary.isBot ? '자동 확인 대기' : '확인 대기'}
                                                            </div>
                                                        </div>
                                                        {/* 점수 표시 영역 */}
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <div className="text-sm text-slate-300">
                                                                예상 역수: <span className="text-yellow-300 font-bold">{summary.best.han}판</span>
                                                            </div>
                                                            {(() => {
                                                                const currentScore = (context.scores as Record<string, number>)[summary.playerId] ?? 0;
                                                                const delta = getScoreDelta(summary.playerId);
                                                                return (
                                                                    <div className="text-right">
                                                                        <div className="text-base font-black text-white">{currentScore.toLocaleString()}점</div>
                                                                        {delta !== 0 && (
                                                                            <div className={`text-xs font-bold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                                {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-400">
                                                            대기패 {summary.waits.length}개
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {summary.waits.length === 0 && <span className="text-xs text-slate-500">대기패 없음</span>}
                                                            {summary.waits.map((tile, idx) => {
                                                                // 론패와 일치하는 대기패 하이라이트
                                                                const isRonWaitTile = isRonWinner && ronTile &&
                                                                    tile.suit === ronTile.suit && tile.rank === ronTile.rank;
                                                                return (
                                                                    <div
                                                                        key={`${summary.playerId}-${tile.suit}-${tile.rank}-${idx}`}
                                                                        className={`relative ${isRonWaitTile
                                                                            ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900 rounded'
                                                                            : ''
                                                                            }`}
                                                                    >
                                                                        <TileView tile={tile} size="sm" disabled={true} />
                                                                        {isRonWaitTile && (
                                                                            <span className="absolute -top-1.5 -right-1.5 px-1 py-[1px] rounded bg-yellow-500 text-black text-[8px] font-black leading-none shadow">
                                                                                론
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* 론패 표시: 승자에게는 론패, 패자에게는 버린 패 */}
                                                        {isRonWinner && ronTile && (
                                                            <div className="mt-3 pt-2 border-t border-yellow-500/30">
                                                                <div className="text-xs text-yellow-300 mb-1 font-semibold">론패 (화료패)</div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="relative">
                                                                        <TileView tile={ronTile} size="sm" disabled={true} />
                                                                        <span className="absolute -top-1.5 -right-1.5 px-1 py-[1px] rounded bg-yellow-500 text-black text-[8px] font-black leading-none shadow">
                                                                            론
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs text-yellow-200">
                                                                        상대가 버린 패로 화료!
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {isRonLoser && ronTile && (
                                                            <div className="mt-3 pt-2 border-t border-rose-500/30">
                                                                <div className="text-xs text-rose-300 mb-1 font-semibold">버린 패 (론당함)</div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="relative">
                                                                        <TileView tile={ronTile} size="sm" disabled={true} />
                                                                        <span className="absolute -top-1.5 -right-1.5 px-1 py-[1px] rounded bg-rose-600 text-white text-[8px] font-black leading-none shadow">
                                                                            방총
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-xs text-rose-200">
                                                                        이 패로 론당했습니다.
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-5 flex justify-center gap-3">
                                            <button
                                                onClick={() => setShowRoundEndOverlay(false)}
                                                disabled={myRoundEndConfirmed}
                                                className={`px-6 py-2 rounded font-bold ${myRoundEndConfirmed ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                                            >
                                                게임판 보기
                                            </button>
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
                            );
                        })()}

                        {matches('matchEnd') && (() => {
                            const ronTile = context.winner && context.lastDiscard ? context.lastDiscard.tile : null;
                            const ronLoserId = context.winner && context.lastDiscard ? context.lastDiscard.playerId : null;

                            return (
                                <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                                    <div className="glass-panel p-8 rounded-3xl shadow-2xl max-w-4xl w-full text-center animate-in zoom-in-50 duration-300">
                                        <h2 className="text-5xl font-black text-white mb-2">
                                            {context.winner ? (context.winner === playerId ? "WINNER!" : "LOSE...") : "DRAW (유국)"}
                                        </h2>
                                        <p className="text-2xl text-gray-400 mb-8">
                                            {context.winner ? (context.winner === playerId ? "축하합니다! 승리하셨습니다." : "아쉽네요. 패배했습니다.") : "승부가 나지 않았습니다."}
                                        </p>

                                        {context.winResult && (
                                            <div className="bg-black/30 p-6 rounded-xl mb-6 text-left space-y-2">
                                                <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                                                    <span className="text-gray-400">Winning Hand Score</span>
                                                    <span className="text-3xl font-bold text-yellow-400">{context.winResult.points.toLocaleString()} pts</span>
                                                </div>
                                                <div className="flex gap-4 text-lg">
                                                    <span className="font-bold text-white">{context.winResult.han}판</span>
                                                    <span className="font-bold text-white">{context.winResult.fu}부</span>
                                                    {context.winResult.limit && <span className="bg-red-600 px-2 rounded text-xs leading-6 h-6">{toKoreanLimit(String(context.winResult.limit))}</span>}
                                                </div>
                                                <div className="pt-2">
                                                    <h4 className="text-sm text-gray-500 mb-1">Yaku (역)</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {context.winResult.yaku.length > 0 ? context.winResult.yaku.map((y: string) => (
                                                            <span key={y} className="px-3 py-1 bg-blue-900/50 text-blue-200 rounded-full text-sm border border-blue-800">
                                                                {toKoreanYaku(y)}
                                                            </span>
                                                        )) : <span className="text-gray-600">No Yaku?</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-8 text-left">
                                            <h3 className="text-sm text-slate-400 mb-2">최종 손패</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(context.players as PlayerId[]).map((pid) => {
                                                    const hand = (context.hands?.[pid] || []) as Tile[];
                                                    const waits = getWinningWaits(hand);
                                                    const isRonWinner = context.winner === pid && ronTile !== null;
                                                    const isRonLoser = ronLoserId === pid && ronTile !== null;
                                                    const score = (context.scores?.[pid] ?? 0) as number;

                                                    return (
                                                        <div
                                                            key={`match-end-${pid}`}
                                                            className={`rounded-xl border p-3 ${isRonWinner
                                                                ? 'border-yellow-400/70 bg-yellow-900/20'
                                                                : isRonLoser
                                                                    ? 'border-rose-500/60 bg-rose-900/15'
                                                                    : 'border-slate-600 bg-slate-900/60'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-slate-100">
                                                                    {getPlayerName(pid)}{pid === playerId ? ' (YOU)' : ''}
                                                                </span>
                                                                <span className="text-sm font-semibold text-slate-300">
                                                                    {score.toLocaleString()}점
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 mb-2">대기패 {waits.length}개</div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {hand.length > 0 ? hand.map((tile, idx) => (
                                                                    <TileView
                                                                        key={`${pid}-${tile.id ?? `${tile.suit}-${tile.rank}-${idx}`}`}
                                                                        tile={tile}
                                                                        size="sm"
                                                                        disabled={true}
                                                                    />
                                                                )) : (
                                                                    <span className="text-xs text-slate-500">손패 정보 없음</span>
                                                                )}
                                                                {isRonWinner && ronTile && (
                                                                    <div className="relative ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900 rounded">
                                                                        <TileView tile={ronTile} size="sm" disabled={true} />
                                                                        <span className="absolute -top-1.5 -right-1.5 px-1 py-[1px] rounded bg-yellow-500 text-black text-[8px] font-black leading-none shadow">
                                                                            론
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex gap-4 justify-center">
                                            {isSingleAiMode && isAiMatch && (
                                                <button
                                                    onClick={onAiExitToHandBuild}
                                                    disabled={aiRematchStep !== 'none'}
                                                    className={`px-8 py-3 font-bold rounded-full transition-colors ${aiRematchStep !== 'none'
                                                        ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                                                        : 'bg-amber-600 text-white hover:bg-amber-500'
                                                        }`}
                                                >
                                                    AI 대전 다시 시작
                                                </button>
                                            )}
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
                            );
                        })()}
                    </GameBoard>
                )}
            </div>
        </TileSkinProvider>
    );
};
