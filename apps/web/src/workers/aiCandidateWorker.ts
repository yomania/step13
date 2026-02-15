import { Tile } from '@step13/proto';
import { CandidateEvaluation, buildBestCandidates } from '../lib/handAnalysis';

type WorkerRequest = {
    type: 'PREFETCH';
    requestId: number;
    dealtTiles: Tile[];
    doraIndicators: Tile[];
    seatWind: 'EAST' | 'SOUTH' | 'WEST' | 'NORTH';
    roundWind: 'EAST' | 'SOUTH' | 'WEST' | 'NORTH';
};

type WorkerResponse = {
    type: 'PREFETCH_RESULT';
    requestId: number;
    candidate: CandidateEvaluation | null;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const payload = event.data;
    if (payload.type !== 'PREFETCH') return;

    const candidate = buildBestCandidates(
        payload.dealtTiles,
        payload.doraIndicators,
        1,
        { seatWind: payload.seatWind, roundWind: payload.roundWind }
    )[0] ?? null;

    const response: WorkerResponse = {
        type: 'PREFETCH_RESULT',
        requestId: payload.requestId,
        candidate
    };
    self.postMessage(response);
};

export {};
