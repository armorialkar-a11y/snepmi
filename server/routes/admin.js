import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { getSettings, invalidateSettings, updateSettings } from '../lib/settings.js';
import {
  bloggerPatchSchema,
  bloggerSchema,
  fieldErrors,
  leadStatusSchema,
  settingsSchema,
} from '../lib/schemas.js';
import { adminAudit, requireAdmin } from '../lib/telegramAuth.js';
import { mapBlogger } from './public.js';

export const adminRouter = Router();

// Whole router is admin-only: the guard runs before any handler, and every write
// is logged with the Telegram id that made it.
adminRouter.use(requireAdmin(), adminAudit);

const UPLOAD_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const UPLOAD_MIME = new Set(['image/webp', 'image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = `.${(file.originalname.split('.').pop() || '').toLowerCase()}`;
    if (UPLOAD_MIME.has(file.mimetype) && UPLOAD_EXTENSIONS.has(extension)) cb(null, true);
    else cb(Object.assign(new Error('Разрешены только изображения webp, jpg или png'), { status: 400 }));
  },
});

/** Multer reports its own failures as plain 500s; the Mini App needs the reason. */
function parseUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `Файл больше ${Math.round(config.maxUploadBytes / 1024 / 1024)} МБ` });
      return;
    }
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Не удалось загрузить файл' });
  });
}

adminRouter.get('/me', async (req, res) => {
  const settings = await getSettings({ fresh: true });
  res.json({
    user: { id: req.tgUser.id, username: req.tgUser.username, firstName: req.tgUser.firstName },
    adminUserIds: settings.adminUserIds,
    telegram: settings.telegram,
    leadsReady: settings.leadsReady,
    authDisabled: config.authDisabled,
  });
});

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*)::int FROM bloggers) AS bloggers,
        (SELECT count(*)::int FROM bloggers WHERE published) AS bloggers_published,
        (SELECT count(*)::int FROM leads) AS leads,
        (SELECT count(*)::int FROM leads WHERE status = 'new') AS leads_new,
        (SELECT count(*)::int FROM leads WHERE created_at > now() - interval '7 days') AS leads_week
    `);
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- bloggers

adminRouter.get('/bloggers', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM bloggers ORDER BY sort_order, name');
    res.json({ bloggers: rows.map(mapBlogger) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/bloggers', async (req, res, next) => {
  try {
    const parsed = bloggerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(422).json({ errors: fieldErrors(parsed.error) });
      return;
    }
    const data = parsed.data;
    const { sql, values } = buildInsert({ id: randomUUID(), ...data });
    const { rows } = await query(sql, values);
    res.status(201).json({ blogger: mapBlogger(rows[0]) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/bloggers/:id', async (req, res, next) => {
  try {
    const parsed = bloggerPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(422).json({ errors: fieldErrors(parsed.error) });
      return;
    }
    const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
    if (!entries.length) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }
    const sets = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
    const values = entries.map(([key, value]) => toSqlValue(key, value));
    const { rows } = await query(
      `UPDATE bloggers SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'Блогер не найден' });
      return;
    }
    res.json({ blogger: mapBlogger(rows[0]) });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/bloggers/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM bloggers WHERE id = $1', [req.params.id]);
    if (!rowCount) {
      res.status(404).json({ error: 'Блогер не найден' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------- leads

/**
 * `lower()` and `ILIKE` only fold Cyrillic when the database cluster has a UTF-8
 * locale; on a `C`-locale cluster (common on Windows and minimal images) they
 * leave 'Тест' untouched and the search silently returns nothing. `translate()`
 * is locale-independent, so we fold the Russian alphabet ourselves and let
 * `lower()` handle ASCII.
 */
const CYRILLIC_UPPER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const CYRILLIC_LOWER = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const fold = (column) => `lower(translate(${column}, '${CYRILLIC_UPPER}', '${CYRILLIC_LOWER}'))`;

function leadFilters(request) {
  const status = request.query.status && leadStatusSchema.safeParse(request.query.status).success
    ? request.query.status
    : null;
  const search = String(request.query.q || '').trim().slice(0, 120);

  const where = [];
  const values = [];
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.toLocaleLowerCase('ru')}%`);
    where.push(
      `(${fold('name')} LIKE $${values.length} OR ${fold('company')} LIKE $${values.length} OR ${fold(
        'contact'
      )} LIKE $${values.length} OR ${fold('task')} LIKE $${values.length})`
    );
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

adminRouter.get('/leads', async (req, res, next) => {
  try {
    const { clause, values } = leadFilters(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows, total] = await Promise.all([
      query(`SELECT * FROM leads ${clause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, values),
      query(`SELECT count(*)::int AS total FROM leads ${clause}`, values),
    ]);

    res.json({
      leads: rows.rows.map((row) => ({
        ...row,
        id: Number(row.id),
        blogger_ids: Array.isArray(row.blogger_ids) ? row.blogger_ids : [],
        blogger_names: Array.isArray(row.blogger_names) ? row.blogger_names : [],
      })),
      total: total.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/leads/:id', async (req, res, next) => {
  try {
    const sets = [];
    const values = [];
    if (req.body?.status !== undefined) {
      const parsed = leadStatusSchema.safeParse(req.body.status);
      if (!parsed.success) {
        res.status(422).json({ error: 'Неизвестный статус' });
        return;
      }
      values.push(parsed.data);
      sets.push(`status = $${values.length}`);
    }
    if (req.body?.note !== undefined) {
      values.push(String(req.body.note).slice(0, 4000));
      sets.push(`note = $${values.length}`);
    }
    if (!sets.length) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }
    const { rows } = await query(
      `UPDATE leads SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
      [...values, Number(req.params.id)]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }
    res.json({ lead: { ...rows[0], id: Number(rows[0].id) } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/leads.csv', async (req, res, next) => {
  try {
    const { clause, values } = leadFilters(req);
    const { rows } = await query(`SELECT * FROM leads ${clause} ORDER BY created_at DESC`, values);

    const columns = [
      ['id', 'ID'], ['created_at', 'Дата'], ['status', 'Статус'], ['name', 'Имя'],
      ['company', 'Компания'], ['contact', 'Контакт'], ['social_url', 'Соцсети бренда'],
      ['task', 'Задача'], ['blogger_names', 'Блогеры'], ['budget', 'Бюджет'],
      ['launch_date', 'Запуск'], ['tg_username', 'Telegram автора'], ['note', 'Заметка'],
    ];
    const escape = (value) => {
      if (value === null || value === undefined) return '';
      const text = Array.isArray(value) ? value.join('; ') : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [columns.map(([, label]) => escape(label)).join(';')];
    for (const row of rows) {
      lines.push(columns.map(([key]) => escape(row[key] instanceof Date ? row[key].toISOString() : row[key])).join(';'));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="snepmi-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.end(`${String.fromCharCode(65279)}${lines.join('\r\n')}`); // BOM keeps Cyrillic readable in Excel
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- settings

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    res.json(await getSettings({ fresh: true }));
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/settings', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(422).json({ errors: fieldErrors(parsed.error) });
      return;
    }
    const data = parsed.data;
    // The panel must never end up with no administrator it can prove: an empty
    // list, or one that drops the caller, is refused. `ADMIN_USER_IDS` from the
    // environment stays trusted either way.
    if (data.adminUserIds !== undefined) {
      const ids = [...new Set(data.adminUserIds.map(Number))];
      if (!ids.length) {
        res.status(422).json({ errors: { adminUserIds: 'Список администраторов не может быть пустым.' } });
        return;
      }
      if (!req.tgUser.dev && !ids.includes(Number(req.tgUser.id))) {
        res.status(422).json({
          errors: {
            adminUserIds: 'Нельзя сохранить список без собственного id — доступ передаётся через ADMIN_USER_IDS в окружении.',
          },
        });
        return;
      }
      data.adminUserIds = ids;
    }
    // Every field is optional now, so a partial save must not blank the rest —
    // wiping adminUserIds would lock every administrator out of the panel.
    const current = await getSettings({ fresh: true });
    const keep = (key, value) => (value === undefined ? current[key] : value);
    // Empty strings and missing values both mean "no value" for the text fields.
    const text = (key, value) => {
      const next = keep(key, value);
      return next === '' ? null : next ?? null;
    };
    const updated = await updateSettings({
      telegram: text('telegram', data.telegram),
      email: text('email', data.email),
      leadsReady: keep('leadsReady', data.leadsReady),
      privacyUrl: text('privacyUrl', data.privacyUrl),
      operator: text('operator', data.operator),
      adminUserIds: [...new Set(keep('adminUserIds', data.adminUserIds) ?? [])],
    });
    invalidateSettings();
    res.json({ settings: updated });
  } catch (error) {
    next(error);
  }
});

// ------------------------------------------------------------------- media

adminRouter.post('/media', parseUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не получен' });
      return;
    }
    const id = randomUUID();
    await query(
      'INSERT INTO media (id, filename, content_type, byte_size, data, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, req.file.originalname.slice(0, 200), req.file.mimetype, req.file.size, req.file.buffer, req.tgUser.id]
    );
    res.status(201).json({ url: `/media/${id}` });
  } catch (error) {
    next(error);
  }
});

const JSONB_FIELDS = ['social_links', 'topics', 'formats', 'ad_terms', 'ad_restrictions'];

function toSqlValue(key, value) {
  return JSONB_FIELDS.includes(key) ? JSON.stringify(value) : value;
}

function buildInsert(data) {
  const columns = Object.keys(data);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  return {
    sql: `INSERT INTO bloggers (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values: columns.map((column) => toSqlValue(column, data[column])),
  };
}
