import pg from 'pg';

// Neon の接続文字列（Vercel の Neon 連携では DATABASE_URL が自動で入る）。
// Neon 専用ドライバではなく pg を使うのは、Vercel Functions（Fluid Compute）では
// 通常の TCP 接続プールがそのまま使え、ローカルの Postgres でも同じコードで検証できるため。
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
    if (pool) return pool;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
    return pool;
}
