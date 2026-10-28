import { query } from '../db/pool.js';

const TTL_MS = 10_000;
const cache = { value: null, at: 0 };

function normalize(row) {
  return {
    telegram: row?.telegram || null,
    email: row?.email || null,
    leadsReady: Boolean(row?.leads_ready),
    privacyUrl: row?.privacy_url || null,
    operator: row?.operator || null,
    adminUserIds: Array.isArray(row?.admin_user_ids) ? row.admin_user_ids.map(Number) : [],
  };
}

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  const { rows } = await query('SELECT * FROM settings WHERE id = 1');
  cache.value = normalize(rows[0]);
  cache.at = Date.now();
  return cache.value;
}

export function invalidateSettings() {
  cache.value = null;
  cache.at = 0;
}

export async function updateSettings(patch) {
  const next = { ...(await getSettings({ fresh: true })), ...patch };
  await query(
    `UPDATE settings
       SET telegram = $1, email = $2, leads_ready = $3, privacy_url = $4,
           operator = $5, admin_user_ids = $6::jsonb, updated_at = now()
     WHERE id = 1`,
    [next.telegram, next.email, next.leadsReady, next.privacyUrl, next.operator, JSON.stringify(next.adminUserIds)]
  );
  invalidateSettings();
  return next;
}
