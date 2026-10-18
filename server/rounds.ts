import type pg from 'pg';

// クライアントが書き込めるのはこの列だけ。id / user_id / 日時はサーバーが決める。
const COLUMN_TYPES = {
    match_name: 'string',
    rate: 'number',
    player_count: 'number',
    player_names: 'json',
    push_limit: 'number',
    push_recovery_on_birdie: 'number',
    push_recovery_on_eagle: 'number',
    near_pin_rate: 'number',
    holes: 'json',
    total_points: 'json',
    status: 'string',
    current_hole: 'number',
    start_hole: 'number',
    round_length: 'number',
    draft_hole: 'json',
    player_ranking: 'json',
    course_name: 'string',
    played_at: 'string',
    memo: 'string',
} as const;

type Column = keyof typeof COLUMN_TYPES;
export type RoundInput = Partial<Record<Column, unknown>>;

const COLUMNS = Object.keys(COLUMN_TYPES) as Column[];
const REQUIRED_ON_CREATE: Column[] = ['match_name', 'player_count', 'player_names', 'holes', 'total_points', 'status'];

export class ValidationError extends Error {}

/** 未知の列を除き、型を検証した値だけを返す。json 列は文字列化して返す */
export function sanitizeRoundInput(body: unknown, { partial }: { partial: boolean }): Map<Column, unknown> {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('body must be an object');
    }
    const input = body as Record<string, unknown>;
    const values = new Map<Column, unknown>();

    for (const column of COLUMNS) {
        if (!(column in input) || input[column] === undefined) continue;
        const value = input[column];
        const type = COLUMN_TYPES[column];
        if (type === 'json') {
            values.set(column, JSON.stringify(value));
            continue;
        }
        if (typeof value !== type || (type === 'number' && !Number.isFinite(value))) {
            throw new ValidationError(`${column} must be a ${type}`);
        }
        values.set(column, value);
    }

    if (values.has('status') && !['paused', 'completed'].includes(values.get('status') as string)) {
        throw new ValidationError('status must be paused or completed');
    }
    if (!partial) {
        const missing = REQUIRED_ON_CREATE.filter(column => !values.has(column));
        if (missing.length > 0) throw new ValidationError(`missing: ${missing.join(', ')}`);
    }
    if (values.size === 0) throw new ValidationError('no updatable fields');
    return values;
}

export async function listRounds(pool: pg.Pool, userId: string): Promise<unknown[]> {
    const { rows } = await pool.query(
        'select * from rounds where user_id = $1 order by created_at desc limit 500',
        [userId],
    );
    return rows;
}

export async function createRound(pool: pg.Pool, userId: string, body: unknown): Promise<string> {
    const values = sanitizeRoundInput(body, { partial: false });
    const columns = ['user_id', ...values.keys()];
    const params = [userId, ...values.values()];
    const placeholders = params.map((_, index) => `$${index + 1}`);
    const { rows } = await pool.query<{ id: string }>(
        `insert into rounds (${columns.join(', ')}) values (${placeholders.join(', ')}) returning id`,
        params,
    );
    return rows[0].id;
}

/** 自分のラウンドが見つからなければ false */
export async function updateRound(pool: pg.Pool, userId: string, roundId: string, body: unknown): Promise<boolean> {
    const values = sanitizeRoundInput(body, { partial: true });
    const assignments = [...values.keys()].map((column, index) => `${column} = $${index + 3}`);
    const { rowCount } = await pool.query(
        `update rounds set ${assignments.join(', ')} where id = $1 and user_id = $2`,
        [roundId, userId, ...values.values()],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteRound(pool: pg.Pool, userId: string, roundId: string): Promise<boolean> {
    const { rowCount } = await pool.query('delete from rounds where id = $1 and user_id = $2', [roundId, userId]);
    return (rowCount ?? 0) > 0;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRoundId(value: string | null): value is string {
    return value !== null && UUID_PATTERN.test(value);
}
