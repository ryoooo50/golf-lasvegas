// API 結合テスト。実際の Postgres に対して実行する。
//   DATABASE_URL=postgres://... BETTER_AUTH_SECRET=... npm run test:api
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import * as authApi from '../api/auth.js';
import * as roundsApi from '../api/rounds.js';
import { getPool } from './db.js';

const ORIGIN = 'http://localhost:3000';
const RUN_ID = Date.now().toString(36);
const ADMIN_EMAIL = `admin-${RUN_ID}@example.com`;
process.env.ADMIN_EMAILS = ADMIN_EMAIL;

function authRequest(path: string, body: unknown, cookie?: string): Promise<Response> {
    // vercel.json の書き換え後と同じ形（/api/auth?__path=...）で呼ぶ
    return authApi.POST(new Request(`${ORIGIN}/api/auth?__path=${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body),
    }));
}

function authGet(path: string, cookie: string): Promise<Response> {
    return authApi.GET(new Request(`${ORIGIN}/api/auth?__path=${path}`, { headers: { Cookie: cookie } }));
}

function sessionCookie(response: Response): string {
    return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}

async function sessionUser(cookie: string): Promise<{ id: string; email: string; role?: string }> {
    return (await (await authGet('get-session', cookie)).json()).user;
}

async function signUp(email: string, password = 'password123'): Promise<string> {
    const response = await authRequest('sign-up/email', { email, password, name: email });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = sessionCookie(response);
    assert.ok(cookie.includes('session_token'), 'session cookie should be set');
    return cookie;
}

function roundsRequest(method: string, cookie: string | null, { id, body }: { id?: string; body?: unknown } = {}) {
    const url = `${ORIGIN}/api/rounds${id ? `?id=${id}` : ''}`;
    const request = new Request(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const handler = { GET: roundsApi.GET, POST: roundsApi.POST, PATCH: roundsApi.PATCH, DELETE: roundsApi.DELETE }[method];
    assert.ok(handler);
    return handler(request);
}

const ROUND = {
    match_name: 'Test', rate: 10, player_count: 4, player_names: { p1: 'A' }, push_limit: 2,
    push_recovery_on_birdie: 1, push_recovery_on_eagle: 2, holes: [], total_points: { p1: 0 },
    status: 'paused', current_hole: 1, start_hole: 1, round_length: 18, draft_hole: null,
    player_ranking: [], course_name: '', played_at: '', memo: '',
};

describe('api', { skip: !process.env.DATABASE_URL }, () => {
    let alice: string;
    let bob: string;

    before(async () => {
        alice = await signUp(`alice-${RUN_ID}@example.com`);
        bob = await signUp(`bob-${RUN_ID}@example.com`);
    });

    after(async () => {
        await getPool().query(`delete from "user" where email like $1`, [`%-${RUN_ID}@example.com`]);
        await getPool().end();
    });

    test('duplicate sign-up returns a USER_ALREADY_EXISTS code', async () => {
        const response = await authRequest('sign-up/email', {
            email: `alice-${RUN_ID}@example.com`, password: 'password123', name: 'x',
        });
        assert.equal(response.status, 422);
        assert.match((await response.json()).code, /^USER_ALREADY_EXISTS/);
    });

    test('short password is rejected', async () => {
        const response = await authRequest('sign-up/email', { email: `short-${RUN_ID}@example.com`, password: 'short', name: 'x' });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).code, 'PASSWORD_TOO_SHORT');
    });

    test('sign-in with a wrong password fails, correct password succeeds', async () => {
        const wrong = await authRequest('sign-in/email', { email: `alice-${RUN_ID}@example.com`, password: 'nope-nope' });
        assert.equal(wrong.status, 401);
        assert.equal((await wrong.json()).code, 'INVALID_EMAIL_OR_PASSWORD');
        const ok = await authRequest('sign-in/email', { email: `alice-${RUN_ID}@example.com`, password: 'password123' });
        assert.equal(ok.status, 200);
    });

    test('get-session works through the rewritten URL', async () => {
        const response = await authApi.GET(new Request(`${ORIGIN}/api/auth?__path=get-session`, { headers: { Cookie: alice } }));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).user.email, `alice-${RUN_ID}@example.com`);
    });

    test('rounds require a session', async () => {
        assert.equal((await roundsRequest('GET', null)).status, 401);
    });

    test('create, list, update and delete own rounds', async () => {
        const created = await roundsRequest('POST', alice, { body: { ...ROUND, user_id: 'attacker', id: 'x' } });
        assert.equal(created.status, 201);
        const { id } = await created.json();

        const list = await (await roundsRequest('GET', alice)).json();
        assert.equal(list.rounds.length, 1);
        assert.equal(list.rounds[0].id, id);
        assert.deepEqual(list.rounds[0].player_names, { p1: 'A' });
        assert.equal(list.rounds[0].rate, 10);

        assert.equal((await roundsRequest('PATCH', alice, { id, body: { status: 'completed', holes: [{ holeNumber: 1 }] } })).status, 200);
        const updated = (await (await roundsRequest('GET', alice)).json()).rounds[0];
        assert.equal(updated.status, 'completed');
        assert.deepEqual(updated.holes, [{ holeNumber: 1 }]);

        assert.equal((await roundsRequest('DELETE', alice, { id })).status, 204);
        assert.equal((await (await roundsRequest('GET', alice)).json()).rounds.length, 0);
    });

    test("cannot see, update or delete another user's round", async () => {
        const { id } = await (await roundsRequest('POST', alice, { body: ROUND })).json();
        assert.equal((await (await roundsRequest('GET', bob)).json()).rounds.length, 0);
        assert.equal((await roundsRequest('PATCH', bob, { id, body: { memo: 'hacked' } })).status, 404);
        assert.equal((await roundsRequest('DELETE', bob, { id })).status, 404);
        const mine = (await (await roundsRequest('GET', alice)).json()).rounds[0];
        assert.equal(mine.memo, '');
    });

    test('unknown round id and invalid input', async () => {
        assert.equal((await roundsRequest('PATCH', alice, { id: '00000000-0000-0000-0000-000000000000', body: { memo: 'x' } })).status, 404);
        assert.equal((await roundsRequest('PATCH', alice, { id: 'not-a-uuid', body: { memo: 'x' } })).status, 404);
        assert.equal((await roundsRequest('POST', alice, { body: { ...ROUND, status: 'bogus' } })).status, 400);
        assert.equal((await roundsRequest('POST', alice, { body: { memo: 'only' } })).status, 400);
        assert.equal((await roundsRequest('POST', alice, { body: { ...ROUND, rate: 'ten' } })).status, 400);
    });

    describe('admin', () => {
        let admin: string;

        before(async () => {
            admin = await signUp(ADMIN_EMAIL);
        });

        test('a user listed in ADMIN_EMAILS becomes admin, others are users', async () => {
            assert.equal((await sessionUser(admin)).role, 'admin');
            assert.equal((await sessionUser(bob)).role, 'user');
        });

        test('only admins can list users', async () => {
            const asAdmin = await authGet('admin/list-users&limit=100', admin);
            assert.equal(asAdmin.status, 200);
            const { users } = await asAdmin.json();
            assert.ok(users.some((u: { email: string }) => u.email === `bob-${RUN_ID}@example.com`));
            assert.equal((await authGet('admin/list-users', bob)).status, 403);
        });

        test('an existing user added to ADMIN_EMAILS is promoted on next sign-in', async () => {
            const email = `late-${RUN_ID}@example.com`;
            await signUp(email);
            process.env.ADMIN_EMAILS = `${ADMIN_EMAIL}, ${email.toUpperCase()}`;
            try {
                const response = await authRequest('sign-in/email', { email, password: 'password123' });
                assert.equal(response.status, 200);
                assert.equal((await sessionUser(sessionCookie(response))).role, 'admin');
            } finally {
                process.env.ADMIN_EMAILS = ADMIN_EMAIL;
            }
        });

        test('a banned user cannot sign in until unbanned', async () => {
            const email = `banned-${RUN_ID}@example.com`;
            const cookie = await signUp(email);
            const { id } = await sessionUser(cookie);
            assert.equal((await authRequest('admin/ban-user', { userId: id }, admin)).status, 200);
            const blocked = await authRequest('sign-in/email', { email, password: 'password123' });
            assert.equal(blocked.status, 403);
            assert.equal((await blocked.json()).code, 'BANNED_USER');
            assert.equal((await authRequest('admin/unban-user', { userId: id }, admin)).status, 200);
            assert.equal((await authRequest('sign-in/email', { email, password: 'password123' })).status, 200);
        });

        test('admin can reset a password', async () => {
            const email = `reset-${RUN_ID}@example.com`;
            const { id } = await sessionUser(await signUp(email));
            const response = await authRequest('admin/set-user-password', { userId: id, newPassword: 'newpassword1' }, admin);
            assert.equal(response.status, 200);
            assert.equal((await authRequest('sign-in/email', { email, password: 'newpassword1' })).status, 200);
        });

        test('admin cannot impersonate users', async () => {
            const { id } = await sessionUser(bob);
            assert.equal((await authRequest('admin/impersonate-user', { userId: id }, admin)).status, 403);
        });

        test('non-admins cannot use admin actions', async () => {
            const { id } = await sessionUser(alice);
            assert.equal((await authRequest('admin/ban-user', { userId: id }, bob)).status, 403);
            assert.equal((await authRequest('admin/set-role', { userId: (await sessionUser(bob)).id, role: 'admin' }, bob)).status, 403);
        });

        test('removing a user also removes their rounds', async () => {
            const email = `removed-${RUN_ID}@example.com`;
            const cookie = await signUp(email);
            const { id } = await sessionUser(cookie);
            assert.equal((await roundsRequest('POST', cookie, { body: ROUND })).status, 201);
            assert.equal((await authRequest('admin/remove-user', { userId: id }, admin)).status, 200);
            const { rows } = await getPool().query('select count(*)::int as n from rounds where user_id = $1', [id]);
            assert.equal(rows[0].n, 0);
        });
    });
});
