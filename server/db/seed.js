import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { config } from '../config.js';
import { getPool } from './pool.js';

const COLUMNS = [
  'id', 'name', 'nickname', 'image_url', 'social_url', 'platform', 'social_links',
  'followers', 'average_views', 'topics', 'formats', 'price', 'description',
  'audience', 'geography', 'image_kind', 'published', 'sort_order', 'category',
  'featured_first', 'rkn_registered', 'ad_contact', 'ad_terms', 'ad_restrictions',
];

function toRow(record) {
  const value = (key, fallback) => {
    const raw = record[key];
    return raw === undefined || raw === null ? fallback : raw;
  };
  return {
    id: record.id,
    name: record.name,
    nickname: value('nickname', null),
    image_url: value('image_url', null),
    social_url: value('social_url', null),
    platform: value('platform', null),
    social_links: JSON.stringify(value('social_links', [])),
    followers: value('followers', null),
    average_views: value('average_views', null),
    topics: JSON.stringify(value('topics', [])),
    formats: JSON.stringify(value('formats', [])),
    price: value('price', null),
    description: value('description', null),
    audience: value('audience', null),
    geography: value('geography', null),
    image_kind: value('image_kind', 'photo'),
    published: Boolean(value('published', true)),
    sort_order: Number(value('sort_order', 0)),
    category: value('category', null),
    featured_first: Boolean(value('featured_first', false)),
    rkn_registered: value('rkn_registered', null),
    ad_contact: value('ad_contact', null),
    ad_terms: JSON.stringify(value('ad_terms', [])),
    ad_restrictions: JSON.stringify(value('ad_restrictions', [])),
  };
}

export async function seed({ log = console.log, force = false } = {}) {
  const pool = getPool();

  const { rows } = await pool.query('SELECT count(*)::int AS total FROM bloggers');
  if (rows[0].total > 0 && !force) {
    log(`bloggers table already has ${rows[0].total} rows — seed skipped (use --force to add missing ones)`);
  } else {
    const records = JSON.parse(fs.readFileSync(config.seedFile, 'utf8'));
    const existing = new Set((await pool.query('SELECT id FROM bloggers')).rows.map((r) => String(r.id)));
    let inserted = 0;
    for (const record of records) {
      if (!force && existing.has(String(record.id))) continue;
      const row = toRow(record);
      const placeholders = COLUMNS.map((c, i) => `$${i + 1}`);
      await pool.query(
        `INSERT INTO bloggers (${COLUMNS.join(', ')}) VALUES (${placeholders.join(', ')})
         ON CONFLICT (id) DO UPDATE SET ${COLUMNS.filter((c) => c !== 'id').map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`,
        COLUMNS.map((c) => row[c])
      );
      inserted += 1;
    }
    log(`seeded ${inserted}/${records.length} bloggers`);
  }

  const seedTelegram = 'https://t.me/nesssvt';
  await pool.query(
    `UPDATE settings SET
       telegram = COALESCE(telegram, $1),
       admin_user_ids = CASE WHEN admin_user_ids = '[]'::jsonb THEN $2::jsonb ELSE admin_user_ids END
     WHERE id = 1`,
    [seedTelegram, JSON.stringify(config.adminUserIds)]
  );
  log(`settings ready (telegram contact, ${config.adminUserIds.length} admin ids from env)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  seed({ force: process.argv.includes('--force') })
    .then(async () => {
      await getPool().end();
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
