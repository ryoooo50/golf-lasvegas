// Web 用。ネイティブ（iOS/Android）は authClient.native.ts が使われる。
import { createAuthClient } from 'better-auth/client';
import { getApiBaseUrl } from './apiBase';

export const authClient = createAuthClient({
    baseURL: getApiBaseUrl(),
    basePath: '/api/auth',
});

/** API 呼び出しに付けるヘッダー。Web は同一オリジンの Cookie が自動で送られるので不要 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    return {};
}

export const API_CREDENTIALS: RequestCredentials = 'include';
