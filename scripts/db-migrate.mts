import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const sql = await readFile(join(dirname(fileURLToPath(import.meta.url)), '../neon/schema.sql'), 'utf8');
const client = new pg.Client({ connectionString });
await client.connect();
try {
    await client.query(sql);
    console.log('schema applied');
} finally {
    await client.end();
}
