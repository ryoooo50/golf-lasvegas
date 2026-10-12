// iOS / Android 用。セッションは SecureStore に保存し、API には Cookie ヘッダーで渡す。
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/client';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './apiBase';

export const authClient = createAuthClient({
    baseURL: getApiBaseUrl(),
    basePath: '/api/auth',
    plugins: [
        expoClient({
            scheme: 'golflasvegas',
            storagePrefix: 'golflasvegas',
            storage: SecureStore,
        }),
    ],
});

export async function getAuthHeaders(): Promise<Record<string, string>> {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
}

export const API_CREDENTIALS: RequestCredentials = 'omit';
