import { Tile } from '@step13/proto';
import { CandidateEvaluation, buildBestCandidates } from '../lib/handAnalysis';

type WorkerRequest = {
    type: 'PREFETCH';
    requestId: number;
    dealtTiles: Tile[];
    doraIndicators: Tile[];
    maxCount?: number;
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
        { seatWind: payload.seatWind, roundWind: payload.roundWind },
        payload.difficulty ?? 'MEDIUM'
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
