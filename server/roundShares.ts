import { randomBytes } from 'node:crypto';
import type pg from 'pg';

export interface ShareStatus {
    token: string | null;
    memberCount: number;
}

// randomBytes(24) を base64url にすると 32 文字
const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function isShareToken(value: unknown): value is string {
    return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** 自分のラウンドでなければ null */
export async function getShareStatus(pool: pg.Pool, ownerId: string, roundId: string): Promise<ShareStatus | null> {
    const { rows } = await pool.query<{ token: string | null; member_count: number }>(
        `select s.token,
                (select count(*)::int from round_share_members m where m.round_id = r.id) as member_count
           from rounds r
           left join round_shares s on s.round_id = r.id
          where r.id = $1 and r.user_id = $2`,
        [roundId, ownerId],
    );
    if (rows.length === 0) return null;
    return { token: rows[0].token, memberCount: rows[0].member_count };
}

/** 既存のリンクがあれば同じトークンを返す。自分のラウンドでなければ null */
export async function createShareLink(pool: pg.Pool, ownerId: string, roundId: string): Promise<ShareStatus | null> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await pool.query(
        `insert into round_shares (round_id, token)
         select id, $3 from rounds where id = $1 and user_id = $2
         on conflict (round_id) do nothing`,
        [roundId, ownerId, token],
    );
    return getShareStatus(pool, ownerId, roundId);
}

/** リンクと全メンバーを削除する。自分のラウンドでなければ false */
export async function stopSharing(pool: pg.Pool, ownerId: string, roundId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `with owned as (select id from rounds where id = $1 and user_id = $2),
              members as (delete from round_share_members where round_id in (select id from owned)),
              links as (delete from round_shares where round_id in (select id from owned))
         select id from owned`,
        [roundId, ownerId],
    );
    return (rowCount ?? 0) > 0;
}
