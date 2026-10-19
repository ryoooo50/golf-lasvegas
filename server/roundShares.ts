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

/** 無効なトークンは null。オーナー本人はメンバー登録しない */
export async function acceptShare(
    pool: pg.Pool,
    userId: string,
    token: string,
): Promise<{ roundId: string; isOwner: boolean } | null> {
    const { rows } = await pool.query<{ round_id: string; user_id: string }>(
        `select s.round_id, r.user_id
           from round_shares s join rounds r on r.id = s.round_id
          where s.token = $1`,
        [token],
    );
    if (rows.length === 0) return null;
    const { round_id: roundId, user_id: ownerId } = rows[0];
    if (ownerId === userId) return { roundId, isOwner: true };
    await pool.query(
        `insert into round_share_members (round_id, user_id) values ($1, $2) on conflict do nothing`,
        [roundId, userId],
    );
    return { roundId, isOwner: false };
}

/** 自分がメンバーで、共有リンクが有効なラウンド */
export async function listSharedRounds(pool: pg.Pool, userId: string): Promise<unknown[]> {
    const { rows } = await pool.query(
        `select r.*
           from round_share_members m
           join rounds r on r.id = m.round_id
           join round_shares s on s.round_id = r.id
          where m.user_id = $1
          order by r.created_at desc
          limit 500`,
        [userId],
    );
    return rows;
}

/** 自分の一覧から外す。メンバーでなければ false */
export async function leaveSharedRound(pool: pg.Pool, userId: string, roundId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        'delete from round_share_members where round_id = $1 and user_id = $2',
        [roundId, userId],
    );
    return (rowCount ?? 0) > 0;
}
