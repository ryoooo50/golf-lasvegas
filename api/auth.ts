import { getAuth, restoreAuthUrl } from '../server/auth.js';

async function handle(request: Request): Promise<Response> {
    return getAuth().handler(restoreAuthUrl(request));
}

export const GET = handle;
export const POST = handle;
