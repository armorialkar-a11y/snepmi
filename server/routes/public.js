import { Router } from 'express';
import { query } from '../db/pool.js';
import { getSettings } from '../lib/settings.js';
import { fieldErrors, leadSchema } from '../lib/schemas.js';
import { requireTelegram } from '../lib/telegramAuth.js';
import { notifyNewLead } from '../bot.js';

export const publicRouter = Router();

const recentSubmissions = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function throttled(userId) {
  const now = Date.now();
  const hits = (recentSubmissions.get(userId) || []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return true;
  hits.push(now);
  recentSubmissions.set(userId, hits);
  if (recentSubmissions.size > 5000) recentSubmissions.clear();
  return false;
}

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

publicRouter.get('/config', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      telegram: settings.telegram,
      email: settings.email,
      leadsReady: settings.leadsReady,
      privacyUrl: settings.privacyUrl,
      operator: settings.operator,
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/bloggers', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM bloggers WHERE published = true');
    res.json({ bloggers: rows.map(mapBlogger), error: false });
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/leads', requireTelegram(), async (req, res, next) => {
  try {
    const parsed = leadSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(422).json({ errors: fieldErrors(parsed.error) });
      return;
    }
    const settings = await getSettings();
    if (!settings.leadsReady) {
      res.status(409).json({ error: 'Приём заявок временно закрыт. Напишите в Telegram.' });
      return;
    }
    if (parsed.data.website) {
      res.status(400).json({ error: 'Не удалось отправить форму.' });
      return;
    }
    const userId = req.tgUser.id;
    if (throttled(userId)) {
      res.status(429).json({ error: 'Слишком много заявок с одного аккаунта. Попробуйте позже.' });
      return;
    }

    const ids = parsed.data.blogger_ids;
    let names = [];
    if (ids.length) {
      const { rows } = await query(
        `SELECT id, name FROM bloggers WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      const byId = new Map(rows.map((row) => [String(row.id), row.name]));
      names = ids.map((id) => byId.get(String(id))).filter(Boolean);
    }

    const { rows } = await query(
      `INSERT INTO leads (name, company, contact, social_url, task, blogger_ids, blogger_names,
                          budget, launch_date, consent, source, tg_user_id, tg_username)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13)
       RETURNING id, created_at`,
      [
        parsed.data.name,
        parsed.data.company,
        parsed.data.contact,
        parsed.data.social_url || null,
        parsed.data.task,
        JSON.stringify(ids),
        JSON.stringify(names),
        parsed.data.budget || null,
        parsed.data.launch_date || null,
        true,
        'mini_app',
        userId,
        req.tgUser.username || null,
      ]
    );

    const lead = { ...parsed.data, id: rows[0].id, names };
    notifyNewLead(lead).catch((error) => console.error('lead notification failed:', error.message));

    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/media/:id', sendMedia);

/** Uploaded images are also reachable as `/media/<uuid>` so admin URLs stay site-style. */
const SERVED_IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

export async function sendMedia(req, res, next) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
      res.status(404).end();
      return;
    }
    const { rows } = await query(
      'SELECT content_type, byte_size, data, filename FROM media WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) {
      res.status(404).end();
      return;
    }
    // Re-checked on the way out: a row written by hand or by an older build must
    // not turn this endpoint into a carrier for HTML or SVG.
    if (!SERVED_IMAGE_TYPES.has(rows[0].content_type)) {
      res.status(415).end();
      return;
    }
    res.setHeader('Content-Type', rows[0].content_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(rows[0].byte_size));
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.end(rows[0].data);
  } catch (error) {
    next(error);
  }
}

const JSONB_COLUMNS = ['social_links', 'topics', 'formats', 'ad_terms', 'ad_restrictions'];

export function mapBlogger(row) {
  const out = { ...row };
  for (const column of JSONB_COLUMNS) out[column] = Array.isArray(row[column]) ? row[column] : [];
  out.price = row.price === null ? null : Number(row.price);
  out.id = String(row.id);
  return out;
}
