import { getPool } from '../server/db.js';
import { json, withUser } from '../server/http.js';
import { isRoundId } from '../server/rounds.js';
import { acceptShare, isShareToken, leaveSharedRound, listSharedRounds } from '../server/roundShares.js';

const LABEL = 'api/shared-rounds';

const notFound = () => json({ error: 'not found' }, 404);

export function GET(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        return json({ rounds: await listSharedRounds(getPool(), userId) });
    }, LABEL);
}

export function POST(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        // 壊れた body やトークンは「無効なリンク」と同じ扱い
        const body: unknown = await request.json().catch(() => null);
        const token = typeof body === 'object' && body !== null ? (body as { token?: unknown }).token : undefined;
        if (!isShareToken(token)) return notFound();
        const accepted = await acceptShare(getPool(), userId, token);
        return accepted ? json(accepted) : notFound();
    }, LABEL);
}

export function DELETE(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const id = new URL(request.url).searchParams.get('id');
        if (!isRoundId(id)) return notFound();
        const left = await leaveSharedRound(getPool(), userId, id);
        return left ? new Response(null, { status: 204 }) : notFound();
    }, LABEL);
}
