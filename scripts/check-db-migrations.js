// Read-only pre-deployment inspection. It never runs migrations or prints secrets.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { getPool } from '../server/db/pool.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL не задан. Используйте защищённое окружение с доступом к копии базы или рабочей базе.');
  process.exit(1);
}
const pool = getPool();
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  const reg = await client.query("SELECT to_regclass('public.schema_migrations') AS name, to_regclass('public.bloggers') AS bloggers");
  const applied = reg.rows[0].name
    ? new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    : new Set();
  const files = fs.readdirSync(path.join(config.root, 'server/db/sql')).filter((f) => f.endsWith('.sql')).sort();
  const pending = files.filter((f) => !applied.has(f));
  console.log('Применённые миграции:', [...applied].sort().join(', ') || 'нет');
  console.log('Ожидающие миграции:', pending.join(', ') || 'нет');
  if (reg.rows[0].bloggers) {
    const count = await client.query('SELECT count(*)::int AS total FROM bloggers');
    console.log('Записей в каталоге:', count.rows[0].total);
  }
  if (pending.includes('002_leads_open_by_default.sql')) console.warn('ВНИМАНИЕ: 002 включает приём заявок в существующих настройках.');
  if (pending.includes('003_primary_contact_advmiu.sql')) console.warn('ВНИМАНИЕ: 003 меняет основной контакт и некоторые контакты блогеров.');
  if (pending.includes('004_add_irina_tikhomirova.sql')) console.warn('Миграция 004 может добавить карточку Ирины в непустой каталог.');
  if (pending.includes('005_lead_notification_outbox.sql')) console.log('Миграция 005 создаёт очередь новых уведомлений; старые заявки не отправляются повторно.');
  await client.query('ROLLBACK');
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {});
  console.error('Проверка не выполнена:', error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
