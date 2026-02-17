import { Tile } from '@step13/proto';

type CandidateEvaluation = {
    hand: Tile[];
    waits: Tile[];
    score: {
        points: number;
        han: number;
        yaku: string[];
        bestWait: Tile | null;
    };
};

function buildBestCandidates(
    _dealtTiles: Tile[],
    _doraIndicators: Tile[],
    _maxCount: number,
    _extraScoreOptions: Record<string, unknown>,
    _difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    _scoreDiff?: number
): CandidateEvaluation[] {
    // Worker path is currently unused in app runtime.
    // Keep a safe no-op implementation so typecheck/build can proceed.
    return [];
}

type WorkerRequest = {
    type: 'PREFETCH';
    requestId: number;
    dealtTiles: Tile[];
    doraIndicators: Tile[];
    maxCount?: number;
    scoreDiff?: number;
    seatWind: 'EAST' | 'SOUTH' | 'WEST' | 'NORTH';
    roundWind: 'EAST' | 'SOUTH' | 'WEST' | 'NORTH';
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
};

type WorkerResponse = {
    type: 'PREFETCH_RESULT';
    requestId: number;
    candidate: CandidateEvaluation | null;
    candidates?: CandidateEvaluation[];
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const payload = event.data;
    if (payload.type !== 'PREFETCH') return;

    const maxCount = payload.maxCount ?? 1;
    const candidates = buildBestCandidates(
        payload.dealtTiles,
        payload.doraIndicators,
        maxCount,
        {}, // extraScoreOptions (unused for now)
        payload.difficulty ?? 'MEDIUM',
        payload.scoreDiff
    );
    const candidate = candidates[0] ?? null;

    const response: WorkerResponse = {
        type: 'PREFETCH_RESULT',
        requestId: payload.requestId,
        candidate,
        candidates
    };
    self.postMessage(response);
};

export { };
