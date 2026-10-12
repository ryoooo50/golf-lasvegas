import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { defaultAc, userAc } from 'better-auth/plugins/admin/access';
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

export const ADMIN_ROLE = 'admin';
export const USER_ROLE = 'user';

// 管理者ができること: ユーザー一覧・停止・削除・パスワード再設定・権限変更。
// なりすまし（impersonate）は持たせない。
const adminRoleAc = defaultAc.newRole({
    user: ['list', 'get', 'ban', 'delete', 'set-password', 'set-role'],
    session: ['list', 'revoke'],
});

/**
 * 環境変数 ADMIN_EMAILS（カンマ区切り）に載っているメールか。追加を次回ログインで反映するため毎回読む。
 * 昇格のみで降格はしない（一覧から外しても管理者のまま。降格は管理画面で行う）。
 * メール確認を行っていないため、一覧に載せるのは登録済みのアカウントだけにすること。
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const admins = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    return admins.includes(email.trim().toLowerCase());
}

/** ADMIN_EMAILS に載っている既存ユーザーを、ログイン時に管理者へ引き上げる */
async function promoteListedAdmin(userId: string): Promise<void> {
    const { rows } = await getPool().query<{ email: string; role: string | null }>(
        'select email, role from "user" where id = $1',
        [userId],
    );
    const user = rows[0];
    if (!user || user.role === ADMIN_ROLE || !isAdminEmail(user.email)) return;
    await getPool().query('update "user" set role = $1 where id = $2', [ADMIN_ROLE, userId]);
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
        plugins: [
            expo(),
            admin({
                defaultRole: USER_ROLE,
                adminRoles: [ADMIN_ROLE],
                roles: { [ADMIN_ROLE]: adminRoleAc, [USER_ROLE]: userAc },
            }),
        ],
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => ({
                        data: { ...user, role: isAdminEmail(user.email) ? ADMIN_ROLE : USER_ROLE },
                    }),
                },
            },
            session: {
                create: {
                    // セッション作成前に引き上げておけば、ログイン直後の応答から管理者として扱われる
                    before: async (session) => {
                        // 昇格は付随処理。失敗してもログイン自体は止めない
                        try {
                            await promoteListedAdmin(session.userId);
                        } catch (error: unknown) {
                            console.error('[auth] admin promotion failed', error);
                        }
                    },
                },
            },
        },
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
