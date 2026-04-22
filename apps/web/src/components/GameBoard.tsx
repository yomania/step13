import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerId } from '@step13/proto';
import { GameContext, RULES } from '@step13/core';
import { DiscardPile } from './DiscardPile';

const TEN_TURN_TIMER_MS = 30000;
const CLASSIC_PHASES: Array<{ step: GameContext['step']; label: string; shortLabel: string }> = [
    { step: 'classic_match_start', label: '라운드 시작', shortLabel: 'START' },
    { step: 'classic_dora_select', label: '도라 선택', shortLabel: 'DORA' },
    { step: 'classic_hand_build', label: '조패', shortLabel: 'BUILD' },
    { step: 'classic_turn', label: '공방', shortLabel: 'BATTLE' },
    { step: 'classic_round_end', label: '결과 확인', shortLabel: 'RESULT' }
];
const TEN_PHASES: Array<{ step: GameContext['step']; label: string; shortLabel: string }> = [
    { step: 'ten_match_start', label: '라운드 시작', shortLabel: 'START' },
    { step: 'ten_a_turn', label: 'A단계 선언', shortLabel: 'STAGE A' },
    { step: 'ten_b_guess', label: 'B단계 추측', shortLabel: 'GUESS' },
    { step: 'ten_b_assault', label: 'B단계 공격', shortLabel: 'ASSAULT' },
    { step: 'ten_round_end', label: '결과 확인', shortLabel: 'RESULT' }
];

function getRulesetLabel(ruleset: GameContext['ruleset']): string {
    if (ruleset === 'classic') return 'Classic 17-Step Track';
    return ruleset === 'ten_attack_defense_easy' ? 'ten easy Track' : 'ten Track';
}

function getStepHeadline(context: GameContext): string {
    switch (context.step) {
        case 'classic_match_start':
            return 'Classic 17-step 라운드를 준비 중입니다.';
        case 'classic_dora_select':
            return '도라를 선택해 라운드 기준점을 고정합니다.';
        case 'classic_hand_build':
            return '34장에서 13장을 골라 classic 텐파이를 완성합니다.';
        case 'classic_turn':
            return context.currentTurn ? `${context.currentTurn}의 선택 차례입니다.` : '현재 턴 정보를 기다리는 중입니다.';
        case 'classic_round_end':
            return '결과를 확인한 뒤 리플레이 또는 다음 국으로 이동합니다.';
        case 'ten_match_start':
            return '공격자와 수비자를 배정하고 라운드를 엽니다.';
        case 'ten_a_turn':
            return '공격자가 선언과 버림을 설계하는 단계입니다.';
        case 'ten_b_guess':
            return '수비자가 대기패를 추측하는 단계입니다.';
        case 'ten_b_assault':
            return '공격자가 남은 기회 안에 관통을 노립니다.';
        case 'ten_round_end':
            return '공방전 결과를 확정하고 다음 라운드를 준비합니다.';
        case 'match_end':
            return '매치가 종료되었습니다.';
        default:
            return '대국을 준비 중입니다.';
    }
}

function getNextActionLabel(context: GameContext, myPlayerId: PlayerId): string {
    const isMyTurn = context.currentTurn === myPlayerId;

    switch (context.step) {
        case 'classic_match_start':
            return context.dealer === myPlayerId ? '딜러가 시작 버튼과 도라 흐름을 열 준비를 합니다.' : '상대 시작 이후 첫 공개 정보를 기다립니다.';
        case 'classic_dora_select':
            return context.dealer === myPlayerId ? '도라를 고른 뒤 조패 단계로 넘기세요.' : '딜러의 도라 선택 결과를 확인하세요.';
        case 'classic_hand_build':
            return '손패를 제출할 때까지 조패, 대기패, 시간 관리를 한 흐름으로 유지하세요.';
        case 'classic_turn':
            return isMyTurn ? '지금 할 일: 버림 또는 론 판단을 즉시 확정하세요.' : '상대 버림과 론 기회를 동시에 확인하세요.';
        case 'classic_round_end':
            return '결과 요약을 본 뒤 리플레이 복기 또는 확인 버튼으로 다음 국을 준비하세요.';
        case 'ten_match_start':
            return '역할과 첫 단계 안내를 확인한 뒤 Stage A로 진입합니다.';
        case 'ten_a_turn':
            return context.attackDefense.attacker === myPlayerId
                ? '지금 할 일: 선언, 치/펑, 버림 우선순위를 빠르게 정하세요.'
                : '공격자의 선언과 버림 흐름을 읽고 Stage B를 준비하세요.';
        case 'ten_b_guess':
            return context.attackDefense.defender === myPlayerId
                ? '지금 할 일: 후보를 고른 뒤 실패 기록을 확인하고 확정하세요.'
                : '수비자의 추측 결과를 읽고 다음 Stage B 결과를 기다리세요.';
        case 'ten_b_assault':
            return context.attackDefense.attacker === myPlayerId
                ? '지금 할 일: pending draw 확인 후 버림 또는 깡 판단을 이어가세요.'
                : '공격자의 남은 기회와 결과 피드백을 읽고 생존 판단을 유지하세요.';
        case 'ten_round_end':
            return '결과를 확인하고 리플레이로 복기한 뒤 양쪽 확인을 맞추세요.';
        case 'match_end':
            return '최종 결과를 확인하고 리플레이 또는 로비 복귀를 선택하세요.';
        default:
            return '현재 단계가 준비되는 동안 핵심 정보를 정리합니다.';
    }
}

function getClassicPressure(context: GameContext, myPlayerId: PlayerId, otherPlayerId?: PlayerId) {
    const myDiscards = context.discards[myPlayerId]?.length ?? 0;
    const opponentDiscards = otherPlayerId ? (context.discards[otherPlayerId]?.length ?? 0) : 0;
    const myRemaining = Math.max(0, RULES.draw.afterDiscardsEach - myDiscards);
    const opponentRemaining = Math.max(0, RULES.draw.afterDiscardsEach - opponentDiscards);
    const lowOnTempo = myRemaining <= 5 || opponentRemaining <= 5;

    return {
        label: lowOnTempo ? '마무리 국면' : '중반 운영',
        detail: `내 ${myRemaining} / 상대 ${opponentRemaining} 버림 남음`,
        tone: lowOnTempo
            ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
            : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
    };
}

function getTenPressure(context: GameContext, myPlayerId: PlayerId) {
    const isAttacker = context.attackDefense.attacker === myPlayerId;
    const isDefender = context.attackDefense.defender === myPlayerId;
    const turnsUsed = context.attackDefense.ownTurns[myPlayerId] ?? 0;
    const turnsLeft = Math.max(0, RULES.ten.maxOwnTurns - turnsUsed);
    const urgent = context.attackDefense.stage === 'B_GUESS'
        ? context.attackDefense.guessesRemaining <= 1
        : context.attackDefense.stage === 'B_ASSAULT'
            ? context.attackDefense.assaultRemaining <= 2
            : turnsLeft <= 4;

    let label = '정보 수집';
    let detail = `내 턴 ${turnsLeft}회 남음`;
    if (context.attackDefense.stage === 'B_GUESS') {
        label = isDefender ? '추측 압박' : '방어 대기';
        detail = `추측 ${context.attackDefense.guessesRemaining}회 · 실패 ${context.attackDefense.failedGuesses}회`;
    } else if (context.attackDefense.stage === 'B_ASSAULT') {
        label = isAttacker ? '관통 압박' : '생존 압박';
        detail = `공격 ${context.attackDefense.assaultRemaining}회 · ${context.attackDefense.pendingDrawTile ? '패 확인됨' : '다음 draw 대기'}`;
    } else if (isAttacker) {
        label = '선언 설계';
    } else if (isDefender) {
        label = '수비 분석';
    }

    return {
        label,
        detail,
        tone: urgent
            ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
            : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
    };
}

interface GameBoardProps {
    context: GameContext;
    myPlayerId: PlayerId;
    onLeave?: () => void;
    children?: ReactNode;
}

export function GameBoard({ context, myPlayerId, onLeave, children }: GameBoardProps) {
    const players = context.players;
    const otherPlayerId = players.find((p: PlayerId) => p !== myPlayerId);
    const turnTimerMs = context.ruleset === 'classic' ? RULES.timers.turnTimeMs : TEN_TURN_TIMER_MS;
    const myTimeBankMs = context.timeBankRemainingMs?.[myPlayerId] ?? 0;
    const otherTimeBankMs = otherPlayerId ? (context.timeBankRemainingMs?.[otherPlayerId] ?? 0) : 0;
    const currentTurn = context.currentTurn;
    const currentTurnBankMs = currentTurn ? (context.timeBankRemainingMs?.[currentTurn] ?? 0) : 0;
    const previousTurnRef = useRef<PlayerId | null>(null);
    const previousTurnBankRef = useRef<number>(0);
    const [clockStartMs, setClockStartMs] = useState<number | null>(null);
    const [clockDurationMs, setClockDurationMs] = useState<number>(turnTimerMs);
    const [isBonusClock, setIsBonusClock] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const formatBank = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`;

    useEffect(() => {
        if (!currentTurn) {
            previousTurnRef.current = null;
            previousTurnBankRef.current = 0;
            setClockStartMs(null);
            setClockDurationMs(turnTimerMs);
            setIsBonusClock(false);
            return;
        }

        const previousTurn = previousTurnRef.current;
        const previousBank = previousTurnBankRef.current;

        if (previousTurn !== currentTurn) {
            setClockStartMs(Date.now());
            setClockDurationMs(turnTimerMs);
            setIsBonusClock(false);
        } else if (previousBank > currentTurnBankMs) {
            const consumedBankMs = previousBank - currentTurnBankMs;
            setClockStartMs(Date.now());
            setClockDurationMs(consumedBankMs);
            setIsBonusClock(true);
        }

        previousTurnRef.current = currentTurn;
        previousTurnBankRef.current = currentTurnBankMs;
    }, [currentTurn, currentTurnBankMs, context.eventLog.length, turnTimerMs]);

    useEffect(() => {
        if (!clockStartMs) return;
        const timer = setInterval(() => setNowMs(Date.now()), 100);
        return () => clearInterval(timer);
    }, [clockStartMs]);

    const turnTimeRemainingMs = useMemo(() => {
        if (!clockStartMs) {
            return turnTimerMs;
        }
        return Math.max(0, clockDurationMs - (nowMs - clockStartMs));
    }, [clockStartMs, clockDurationMs, nowMs, turnTimerMs]);

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
    const isTenAttackDefense = context.ruleset !== 'classic';
    const title = isTenAttackDefense ? '2인 공방전' : '17보 마작 실전';
    const myDiscardCount = context.discards[myPlayerId]?.length || 0;
    const remainingLabel = isTenAttackDefense
        ? `Stage ${context.attackDefense.stage}`
        : `Remains: ${17 - myDiscardCount} / 17`;
    const activePhases = isTenAttackDefense ? TEN_PHASES : CLASSIC_PHASES;
    const activePhaseIndex = activePhases.findIndex((phase) => phase.step === context.step);
    const myRoleLabel = isTenAttackDefense
        ? myRole === 'ATTACKER'
            ? '공격'
            : myRole === 'DEFENDER'
                ? '수비'
                : '대기'
        : context.currentTurn === myPlayerId
            ? '공격 차례'
            : '대응 차례';
    const objectiveLabel = isTenAttackDefense
        ? context.attackDefense.stage === 'A'
            ? '선언 가치와 버림 흐름을 읽히게 유지'
            : context.attackDefense.stage === 'B_GUESS'
                ? '후보를 빠르게 줄이고 실패 히스토리를 피드백'
                : '남은 공격 기회를 손실 없이 전달'
        : context.step === 'classic_hand_build'
            ? '조패 완성 전 필요한 정보만 강조'
            : context.step === 'classic_turn'
                ? '론/버림 흐름과 남은 기회를 한 화면에 유지'
                : '라운드 흐름을 다음 단계까지 명확히 연결';
    const nextActionLabel = getNextActionLabel(context, myPlayerId);
    const pressure = isTenAttackDefense
        ? getTenPressure(context, myPlayerId)
        : getClassicPressure(context, myPlayerId, otherPlayerId);

    return (
        <div className="game-shell relative flex flex-col min-h-[100dvh] text-white px-1 sm:px-4 lg:px-6 overflow-hidden">
            <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-slate-800/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-slate-800/20 blur-[100px]" />
            <header className="header-bar z-10 p-2 sm:p-4 surface-panel sm:glass-panel rounded-none sm:rounded-2xl flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-4 border-b sm:border border-slate-700/50 shadow-md">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 drop-shadow-sm tracking-tight text-stroke-sm">
                        {title}
                    </h1>
                    {isTenAttackDefense && (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black tracking-[0.2em] border ${context.ruleset === 'ten_attack_defense_easy'
                            ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-200'
                            : 'border-amber-300/70 bg-amber-500/10 text-amber-200'
                            }`}>
                            {context.ruleset === 'ten_attack_defense_easy' ? 'EASY' : 'TEN'}
                        </span>
                    )}
                    {onLeave && (
                        <button
                            onClick={onLeave}
                            className="ml-2 px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-bold text-white shadow-md transition-colors"
                        >
                            포기/나가기
                        </button>
                    )}
                </div>
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
            <div className="board-shell z-10 flex-1 min-h-0 flex flex-col items-center justify-center relative w-full h-full max-w-none mx-auto glass-panel rounded-none sm:rounded-3xl p-1 sm:p-4 lg:p-5 mb-2 sm:mb-4 overflow-hidden">
                <div className="board-scroll w-full h-full flex flex-col items-stretch thin-scrollbar">
                    <div className="mb-3 sm:mb-4 rounded-[1.75rem] border border-slate-700/60 bg-slate-950/75 p-3 sm:p-4 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.95)] backdrop-blur-xl">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.24em] ${
                                        isTenAttackDefense
                                            ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                                            : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                    }`}>
                                        {getRulesetLabel(context.ruleset)}
                                    </span>
                                    <span className="rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1 text-[10px] font-black tracking-[0.24em] text-slate-300">
                                        ROUND {context.round}/{RULES.match.handsPerMatch}
                                    </span>
                                    {context.dealer === myPlayerId && (
                                        <span className="rounded-full border border-yellow-400/50 bg-yellow-500/10 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-yellow-200">
                                            DEALER
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
                                    {getStepHeadline(context)}
                                </div>
                                <div className="mt-1 text-sm text-slate-300">
                                    현재 역할은 <span className="font-black text-white">{myRoleLabel}</span>이며, 이번 국의 목표는 <span className="font-semibold text-slate-100">{objectiveLabel}</span>입니다.
                                </div>
                                <div className="mt-2 inline-flex max-w-3xl rounded-2xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                                    <span className="mr-2 font-black tracking-[0.18em] text-cyan-300">NEXT ACTION</span>
                                    <span>{nextActionLabel}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[34rem]">
                                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/85 px-3 py-3">
                                    <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">ROLE</div>
                                    <div className="mt-1 text-lg font-black text-white">{myRoleLabel}</div>
                                    <div className="mt-1 text-xs text-slate-400">{context.currentTurn ? `턴 주체 ${context.currentTurn}` : '턴 대기 중'}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/85 px-3 py-3">
                                    <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">STEP</div>
                                    <div className="mt-1 text-lg font-black text-white">{activePhases[Math.max(activePhaseIndex, 0)]?.shortLabel ?? 'IDLE'}</div>
                                    <div className="mt-1 text-xs text-slate-400">{activePhases[Math.max(activePhaseIndex, 0)]?.label ?? '준비 중'}</div>
                                </div>
                                <div className={`rounded-2xl border px-3 py-3 ${pressure.tone}`}>
                                    <div className="text-[10px] font-black tracking-[0.22em] opacity-70">PRESSURE</div>
                                    <div className="mt-1 text-lg font-black">{pressure.label}</div>
                                    <div className="mt-1 text-xs opacity-80">{pressure.detail}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/85 px-3 py-3">
                                    <div className="text-[10px] font-black tracking-[0.22em] text-slate-500">BANK</div>
                                    <div className="mt-1 text-lg font-black text-white">{formatBank(myTimeBankMs)}</div>
                                    <div className="mt-1 text-xs text-slate-400">{otherPlayerId ? `상대 ${formatBank(otherTimeBankMs)}` : '상대 없음'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-[10px] font-black tracking-[0.22em] text-slate-500">
                                <span>PHASE TIMELINE</span>
                                <span>{activePhaseIndex >= 0 ? `${activePhaseIndex + 1}/${activePhases.length}` : `0/${activePhases.length}`}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                                {activePhases.map((phase, index) => {
                                    const isActive = phase.step === context.step;
                                    const isCompleted = activePhaseIndex > index;
                                    return (
                                        <div
                                            key={phase.step}
                                            className={`rounded-2xl border px-3 py-3 transition-colors ${
                                                isActive
                                                    ? 'border-cyan-400/60 bg-cyan-500/12 shadow-[0_0_25px_rgba(34,211,238,0.15)]'
                                                    : isCompleted
                                                        ? 'border-emerald-400/30 bg-emerald-500/10'
                                                        : 'border-slate-700/70 bg-slate-900/70'
                                            }`}
                                        >
                                            <div className={`text-[10px] font-black tracking-[0.22em] ${
                                                isActive ? 'text-cyan-200' : isCompleted ? 'text-emerald-200' : 'text-slate-500'
                                            }`}>
                                                {phase.shortLabel}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-white">{phase.label}</div>
                                            <div className={`mt-2 text-[11px] ${
                                                isActive ? 'text-cyan-100' : isCompleted ? 'text-emerald-100' : 'text-slate-400'
                                            }`}>
                                                {isActive ? '현재 진행 중' : isCompleted ? '완료됨' : '대기 중'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Opponent Area (Top) */}
                    {otherPlayerId && (
                        <div className="opponent-panel w-full flex flex-col items-stretch opacity-90 transition-opacity border border-slate-700/80 rounded-2xl bg-slate-900/45 p-2 sm:p-4">
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-4 mb-1 sm:mb-2">
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
                            <div className="flex gap-1 mb-2 justify-center lg:justify-start">
                                {/* Usually we don't show opponent hand in 17-steps except 'ready' status? */}
                                {/* Just show simple indicator */}
                                <div className="text-sm text-gray-400">
                                    {context.hands[otherPlayerId] ? "Hand Ready (13 tiles)" : "Building Hand..."}
                                </div>
                            </div>

                            {/* Opponent Pool/Discards */}
                            <div className="relative w-full">
                                <h3 className="text-xs text-center text-gray-500 mb-1">DISCARDS (Pool)</h3>
                                <DiscardPile
                                    discards={context.discards[otherPlayerId] || []}
                                    isOpponent={true} // Rotate 180 degrees visually is standard in real mahjong, but here just top view
                                />
                            </div>
                        </div>
                    )}

                    {/* Center / Game Info / Turn Indicator */}
                    <div className="my-2 sm:my-3 text-center z-10">
                        <div className="text-2xl font-black mb-2 transition-all duration-300 transform scale-100 tracking-wider">
                            {context.currentTurn === myPlayerId ? (
                                <span className="text-yellow-500 animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">YOUR TURN</span>
                            ) : (
                                <span className="text-rose-600 drop-shadow-md">OPPONENT'S TURN</span>
                            )}
                        </div>
                        <div className="text-sm font-bold text-slate-400">
                            <span className="text-slate-200">{remainingLabel}</span>
                        </div>
                    </div>

                    {/* My Area (Bottom) */}
                    <div className="player-panel w-full flex flex-col items-stretch mt-auto p-2 sm:p-4 lg:p-5 bg-gradient-to-t from-slate-900/90 to-transparent rounded-t-3xl border-t border-slate-700/30">
                        {/* My Discards */}
                        <div className="mb-2 sm:mb-4 relative group w-full">
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-800 px-3 py-0.5 sm:px-4 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold text-slate-300 border border-slate-600 shadow-md z-10">
                                내 버림패
                            </div>
                            <div className="p-2 pt-4 sm:p-4 sm:pt-6 bg-slate-900/80 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-slate-700/50 backdrop-blur-md">
                                <DiscardPile discards={context.discards[myPlayerId] || []} />
                            </div>
                        </div>

                        {/* My Hand / Controls / Info */}
                        <div className="flex flex-col gap-2 sm:gap-3 w-full min-w-0">
                            <div className="flex flex-col xl:grid xl:grid-cols-[auto_minmax(0,1fr)] items-stretch xl:items-end gap-2 sm:gap-3 w-full">
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

                                <div className="action-stack w-full min-w-0 flex flex-col xl:items-end">
                                    <div className={`self-stretch xl:self-end px-4 py-2 rounded-xl sm:rounded-2xl border backdrop-blur-sm shadow-lg ${isLowTurnTime
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

                            <div className="w-full min-w-0 flex justify-center">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
