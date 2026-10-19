import { getSessionUserId } from './auth.js';
import { ValidationError } from './rounds.js';

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** ログイン必須の API 共通処理。label は console.error の接頭辞（例: 'api/rounds'） */
export async function withUser(
    request: Request,
    run: (userId: string) => Promise<Response>,
    label: string,
): Promise<Response> {
    try {
        const userId = await getSessionUserId(request);
        if (!userId) return json({ error: 'unauthorized' }, 401);
        return await run(userId);
    } catch (error: unknown) {
        if (error instanceof ValidationError) return json({ error: error.message }, 400);
        if (error instanceof SyntaxError) return json({ error: 'invalid json' }, 400);
        console.error(`[${label}]`, error);
        return json({ error: 'internal error' }, 500);
    }
}
