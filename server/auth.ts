import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { getPool } from './db.js';

export const APP_SCHEME = 'golflasvegas://';
export const MIN_PASSWORD_LENGTH = 8;

function deploymentOrigins(): string[] {
    const hosts = [
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
    ].filter((host): host is string => Boolean(host));
    const extra = (process.env.TRUSTED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
    return [...hosts.map(host => `https://${host}`), ...extra];
}

function createAuth() {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return betterAuth({
        database: getPool(),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL ?? (productionHost ? `https://${productionHost}` : undefined),
        basePath: '/api/auth',
        emailAndPassword: {
            enabled: true,
            minPasswordLength: MIN_PASSWORD_LENGTH,
        },
        plugins: [expo()],
        trustedOrigins: [APP_SCHEME, ...deploymentOrigins()],
    });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
    auth ??= createAuth();
    return auth;
}

export async function getSessionUserId(request: Request): Promise<string | null> {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return session?.user.id ?? null;
}

// vercel.json で /api/auth/<path> を /api/auth?__path=<path> に書き換えて受ける。
// Better Auth はリクエストのパスでエンドポイントを判定するため、元の URL に戻してから渡す。
export function restoreAuthUrl(request: Request): Request {
    const url = new URL(request.url);
    const path = url.searchParams.get('__path');
    if (path === null) return request;
    url.searchParams.delete('__path');
    url.pathname = `/api/auth/${path.replace(/^\/+/, '')}`;
    return new Request(url, request);
}
