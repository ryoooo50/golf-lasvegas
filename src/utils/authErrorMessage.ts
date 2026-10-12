// 認証エラーを、ユーザー向け文言の i18n キーに変換する。
// - better-auth クライアントは { code, status, message } 形式のエラーを返す
// - 通信そのものの失敗は fetch の TypeError になり、文言がブラウザごとに違う
//   （Safari: "Load failed" など）ため、そのまま表示すると原因が伝わらない

export interface AuthErrorKey {
    key: string;
    detail?: string;
}

const NETWORK_MESSAGES = [
    'load failed',
    'failed to fetch',
    'network request failed',
    'networkerror when attempting to fetch resource',
];

const CODE_TO_KEY: Record<string, string> = {
    USER_ALREADY_EXISTS: 'auth.errorAlreadyRegistered',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'auth.errorAlreadyRegistered',
    INVALID_EMAIL_OR_PASSWORD: 'auth.errorInvalidCredentials',
    EMAIL_NOT_VERIFIED: 'auth.errorEmailNotConfirmed',
    PASSWORD_TOO_SHORT: 'auth.errorWeakPassword',
    INVALID_EMAIL: 'auth.errorInvalidEmail',
    BANNED_USER: 'auth.errorBanned',
};

interface ErrorLike {
    code?: unknown;
    status?: unknown;
    message?: unknown;
}

function isNetworkMessage(message: string): boolean {
    return NETWORK_MESSAGES.includes(message.trim().toLowerCase().replace(/\.$/, ''));
}

export function toAuthErrorKey(error: unknown): AuthErrorKey {
    if (error === null || typeof error !== 'object') {
        return { key: 'auth.errorUnknown', detail: String(error) };
    }

    const { code, status, message } = error as ErrorLike;
    const text = typeof message === 'string' ? message : '';

    if (status === 0 || isNetworkMessage(text)) return { key: 'auth.errorNetwork' };
    if (typeof code === 'string' && CODE_TO_KEY[code]) return { key: CODE_TO_KEY[code] };
    if (status === 429) return { key: 'auth.errorRateLimit' };
    if (typeof status === 'number' && status >= 500) return { key: 'auth.errorServer' };

    return { key: 'auth.errorUnknown', detail: text || String(status ?? '') };
}
