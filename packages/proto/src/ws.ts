import { PublicProfileDTO } from './auth';
import { PlayerId } from './types';

export type PlayerProfileMapDTO = Record<PlayerId, Pick<PublicProfileDTO, 'nickname' | 'avatarKey'>>;

export type UpdateEnvelopeDTO = {
    type: 'UPDATE';
    state: any;
    playerProfiles?: PlayerProfileMapDTO;
};

export type AnalysisResultEnvelopeDTO = {
    type: 'ANALYSIS_RESULT';
    queryId?: string;
    [key: string]: unknown;
};

export type PersonaListEnvelopeDTO = {
    type: 'PERSONA_LIST_RESULT';
    personas: unknown[];
};

export type RejectedEventEnvelopeDTO = {
    type: 'REJECTED_EVENT';
    reason: string;
};

export type ServerWsEnvelopeDTO =
    | UpdateEnvelopeDTO
    | AnalysisResultEnvelopeDTO
    | PersonaListEnvelopeDTO
    | RejectedEventEnvelopeDTO;
