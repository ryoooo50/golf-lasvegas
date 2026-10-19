import { getApiBaseUrl } from '../lib/apiBase';
import { apiRequest, SavedRound } from './cloudSave';

export type ShareStatus = { token: string | null; memberCount: number };

const sharesPath = (roundId: string) => `/api/round-shares?roundId=${encodeURIComponent(roundId)}`;

/** 共有リンクの URL（トークンはクエリで渡す） */
export function buildShareUrl(token: string): string {
    return `${getApiBaseUrl()}/share?token=${encodeURIComponent(token)}`;
}

export function fetchShareStatus(roundId: string): Promise<ShareStatus> {
    return apiRequest<ShareStatus>(sharesPath(roundId));
}

export function createShareLink(roundId: string): Promise<ShareStatus> {
    return apiRequest<ShareStatus>(sharesPath(roundId), { method: 'POST' });
}

export async function stopSharing(roundId: string): Promise<void> {
    await apiRequest(sharesPath(roundId), { method: 'DELETE' });
}

/** 共有リンクを受け取る。無効なリンクは CloudSaveError（status 404） */
export function acceptSharedRound(token: string): Promise<{ roundId: string; isOwner: boolean }> {
    return apiRequest<{ roundId: string; isOwner: boolean }>('/api/shared-rounds', {
        method: 'POST',
        body: JSON.stringify({ token }),
    });
}

export async function fetchSharedRounds(): Promise<SavedRound[]> {
    const { rounds } = await apiRequest<{ rounds: SavedRound[] }>('/api/shared-rounds');
    return rounds;
}

/** 共有された一覧から外す（ラウンド本体は消えない） */
export async function leaveSharedRound(roundId: string): Promise<void> {
    await apiRequest(`/api/shared-rounds?id=${encodeURIComponent(roundId)}`, { method: 'DELETE' });
}
