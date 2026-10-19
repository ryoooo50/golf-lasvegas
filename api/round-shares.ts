import { getPool } from '../server/db.js';
import { json, withUser } from '../server/http.js';
import { isRoundId } from '../server/rounds.js';
import { createShareLink, getShareStatus, stopSharing } from '../server/roundShares.js';

const LABEL = 'api/round-shares';

function roundIdFrom(request: Request): string | null {
    return new URL(request.url).searchParams.get('roundId');
}

const notFound = () => json({ error: 'not found' }, 404);

export function GET(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const roundId = roundIdFrom(request);
        if (!isRoundId(roundId)) return notFound();
        const status = await getShareStatus(getPool(), userId, roundId);
        return status ? json(status) : notFound();
    }, LABEL);
}

export function POST(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const roundId = roundIdFrom(request);
        if (!isRoundId(roundId)) return notFound();
        const status = await createShareLink(getPool(), userId, roundId);
        return status ? json(status) : notFound();
    }, LABEL);
}

export function DELETE(request: Request): Promise<Response> {
    return withUser(request, async userId => {
        const roundId = roundIdFrom(request);
        if (!isRoundId(roundId)) return notFound();
        const found = await stopSharing(getPool(), userId, roundId);
        return found ? new Response(null, { status: 204 }) : notFound();
    }, LABEL);
}
