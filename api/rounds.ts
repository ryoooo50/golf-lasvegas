import { getSessionUserId } from '../server/auth.js';
import { getPool } from '../server/db.js';
import { createRound, deleteRound, isRoundId, listRounds, updateRound, ValidationError } from '../server/rounds.js';

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function withUser(request: Request, run: (userId: string) => Promise<Response>): Promise<Response> {
    try {
        const userId = await getSessionUserId(request);
        if (!userId) return json({ error: 'unauthorized' }, 401);
        return await run(userId);
    } catch (error: unknown) {
        if (error instanceof ValidationError) return json({ error: error.message }, 400);
        if (error instanceof SyntaxError) return json({ error: 'invalid json' }, 400);
        console.error('[api/rounds]', error);
        return json({ error: 'internal error' }, 500);
    }
}

function roundIdFrom(request: Request): string | null {
    return new URL(request.url).searchParams.get('id');
}

export function GET(request: Request): Promise<Response> {
    return withUser(request, async userId => json({ rounds: await listRounds(getPool(), userId) }));
}

export function POST(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = await createRound(getPool(), userId, await request.json());
        return json({ id }, 201);
    });
}

export function PATCH(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = roundIdFrom(request);
        if (!isRoundId(id)) return json({ error: 'not found' }, 404);
        const found = await updateRound(getPool(), userId, id, await request.json());
        return found ? json({ id }) : json({ error: 'not found' }, 404);
    });
}

export function DELETE(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = roundIdFrom(request);
        if (!isRoundId(id)) return json({ error: 'not found' }, 404);
        const found = await deleteRound(getPool(), userId, id);
        return found ? new Response(null, { status: 204 }) : json({ error: 'not found' }, 404);
    });
}
