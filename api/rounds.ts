import { getPool } from '../server/db.js';
import { json, withUser } from '../server/http.js';
import { createRound, deleteRound, isRoundId, listRounds, updateRound } from '../server/rounds.js';

function roundIdFrom(request: Request): string | null {
    return new URL(request.url).searchParams.get('id');
}

export function GET(request: Request): Promise<Response> {
    return withUser(request, async userId => json({ rounds: await listRounds(getPool(), userId) }), 'api/rounds');
}

export function POST(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = await createRound(getPool(), userId, await request.json());
        return json({ id }, 201);
    }, 'api/rounds');
}

export function PATCH(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = roundIdFrom(request);
        if (!isRoundId(id)) return json({ error: 'not found' }, 404);
        const found = await updateRound(getPool(), userId, id, await request.json());
        return found ? json({ id }) : json({ error: 'not found' }, 404);
    }, 'api/rounds');
}

export function DELETE(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = roundIdFrom(request);
        if (!isRoundId(id)) return json({ error: 'not found' }, 404);
        const found = await deleteRound(getPool(), userId, id);
        return found ? new Response(null, { status: 204 }) : json({ error: 'not found' }, 404);
    }, 'api/rounds');
}
