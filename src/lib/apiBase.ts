import { Platform } from 'react-native';

// 静的書き出し（ビルド時のプリレンダリング）では window が無いため仮の値を返す
const STATIC_RENDER_FALLBACK = 'http://localhost';

/**
 * API（Vercel Functions）のベース URL。
 * - Web: 同じドメインで配信されるため、そのページのオリジン（Cookie も同一オリジンで扱える）
 * - ネイティブ / ローカル開発: EXPO_PUBLIC_API_URL（例: https://golf-lasvegas.vercel.app）
 */
export function getApiBaseUrl(): string {
    const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
    if (configured) return configured;
    if (Platform.OS === 'web') {
        return typeof window === 'undefined' ? STATIC_RENDER_FALLBACK : window.location.origin;
    }
    throw new Error('EXPO_PUBLIC_API_URL is not set');
}
