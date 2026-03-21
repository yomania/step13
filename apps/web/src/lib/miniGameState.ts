export function isMiniGamePrefetchReady(analysisResult: unknown, hasResolvedResult: boolean): boolean {
    if (hasResolvedResult || !analysisResult || typeof analysisResult !== 'object') {
        return false;
    }

    const result = analysisResult as { type?: unknown; candidates?: unknown };
    return result.type === 'ANALYSIS_RESULT' && Array.isArray(result.candidates);
}

export function extractMatchedMiniGameResult<T>(
    analysisResult: unknown,
    pendingQueryId: string | null
): T | null {
    if (!pendingQueryId || !analysisResult || typeof analysisResult !== 'object') {
        return null;
    }

    const result = analysisResult as { type?: unknown; miniResult?: T; queryId?: unknown };
    if (result.type !== 'ANALYSIS_RESULT' || result.queryId !== pendingQueryId) {
        return null;
    }
    return result.miniResult ?? null;
}

export function appendBoundedHistory<T>(entries: T[], entry: T, limit: number): T[] {
    return [entry, ...entries].slice(0, limit);
}
