import { authClient } from '../lib/authClient';

// 管理者向けのユーザー操作（Better Auth admin プラグイン）。
// 権限チェックはサーバー側で行われ、管理者以外が呼ぶと 403 になる。

export interface AdminUser {
    id: string;
    email: string;
    role: 'admin' | 'user';
    banned: boolean;
    createdAt: string;
}

export const ADMIN_USER_PAGE_SIZE = 100;

interface RawUser {
    id: string;
    email: string;
    role?: string | null;
    banned?: boolean | null;
    createdAt: Date | string;
}

function toAdminUser(user: RawUser): AdminUser {
    return {
        id: user.id,
        email: user.email,
        role: user.role === 'admin' ? 'admin' : 'user',
        banned: user.banned === true,
        createdAt: new Date(user.createdAt).toISOString(),
    };
}

/** better-auth の { data, error } を、失敗時に例外を投げる形にそろえる */
async function unwrap<T>(promise: Promise<{ data: T | null; error: unknown }>): Promise<T> {
    const { data, error } = await promise;
    if (error) throw error;
    if (data === null) throw new Error('empty response');
    return data;
}

export async function listUsers(search: string): Promise<{ users: AdminUser[]; total: number }> {
    const trimmed = search.trim();
    const data = await unwrap(authClient.admin.listUsers({
        query: {
            limit: ADMIN_USER_PAGE_SIZE,
            sortBy: 'createdAt',
            sortDirection: 'desc',
            ...(trimmed ? { searchField: 'email' as const, searchOperator: 'contains' as const, searchValue: trimmed } : {}),
        },
    }));
    return { users: (data.users as RawUser[]).map(toAdminUser), total: data.total };
}

export async function setUserBanned(userId: string, banned: boolean): Promise<void> {
    await unwrap(banned ? authClient.admin.banUser({ userId }) : authClient.admin.unbanUser({ userId }));
}

export async function setUserRole(userId: string, role: AdminUser['role']): Promise<void> {
    await unwrap(authClient.admin.setRole({ userId, role }));
}

export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
    await unwrap(authClient.admin.setUserPassword({ userId, newPassword }));
}

export async function removeUser(userId: string): Promise<void> {
    await unwrap(authClient.admin.removeUser({ userId }));
}
