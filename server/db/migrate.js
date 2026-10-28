import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { getPool } from './pool.js';

const SQL_DIR = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'sql');

export async function migrate({ log = console.log } = {}) {
  const pool = getPool();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );

  const applied = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
  const runner = {
    async query(text, params) {
      return pool.query(text, params);
    },
  };

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      count += 1;
      log(`applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${error.message}`);
    } finally {
      client.release();
    }
  }
  if (count === 0) log('schema is up to date');
  return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  migrate()
    .then(async () => {
      await getPool().end();
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
