import { z } from 'zod';

/**
 * Schemas ported from the original site bundle (the `AU` lead schema and the
 * `Ime` blogger schema), including the Russian validation messages, so the
 * Mini App rejects the same input the website rejected.
 */

const httpsUrl = (message = 'Используйте http или https') =>
  z.string().url(message).refine((value) => /^https?:\/\//.test(value), message);

const optionalHttpsUrl = z.union([z.literal(''), httpsUrl()]).optional();

const nonNegative = (message) => z.number().int().min(0, message);

/** `YYYY-MM-DD` from a date input; the regex alone would accept 2026-13-99. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Введите корректную дату');

export const LEAD_PLATFORMS = ['TikTok', 'Instagram', 'Telegram', 'YouTube', 'VK', 'Likee'];
export const CATEGORIES = ['large', 'medium', 'small', 'unassigned'];

/** The site folded these two topic spellings into one filter value. */
export function normalizeTopic(topic) {
  const value = String(topic).trim().toLocaleLowerCase('ru');
  if (value === 'липсинг' || value === 'липсинги') return 'липсинги';
  return topic;
}

export function normalizeTopics(list) {
  return [...new Set(list.map(normalizeTopic))];
}

export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя, минимум 2 символа').max(100),
  company: z.string().trim().min(2, 'Укажите компанию или бренд').max(150),
  contact: z.string().trim().min(5, 'Укажите email, телефон или Telegram').max(200),
  social_url: optionalHttpsUrl,
  task: z.string().trim().min(15, 'Опишите задачу подробнее: минимум 15 символов').max(5000),
  blogger_ids: z.array(z.string().uuid()).max(50).default([]),
  budget: z.string().trim().max(100).optional(),
  launch_date: z.union([z.literal(''), isoDate]).optional(),
  // zod v3 ignores `message` on literals, so the Russian text needs an errorMap.
  consent: z.literal(true, { errorMap: () => ({ message: 'Необходимо согласие на обработку данных' }) }),
  // Honeypot: real users never fill it in.
  website: z.string().max(0, 'Не удалось отправить форму').optional(),
});

/**
 * Optional text profile fields accept `null` *or* an omitted key: `nullable()`
 * alone still demands the property, and a partial request then fails with
 * zod's English "Required" message instead of being stored as NULL.
 */
const optionalText = (schema) => schema.nullable().optional();

export const bloggerSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(100),
  nickname: optionalText(z.string().trim().max(100)),
  image_url: optionalText(
    z
      .string()
      .max(500)
      .refine(
        (value) => /^https:\/\/.+/.test(value) || /^\/(images|media|assets)\/[\w./-]+$/.test(value),
        'Нужен HTTPS URL или локальное изображение каталога'
      )
  ),
  social_url: optionalText(httpsUrl('Ссылка на профиль должна быть http или https')),
  platform: optionalText(z.string().trim().max(60)),
  social_links: z
    .array(z.object({ platform: z.enum(LEAD_PLATFORMS), url: httpsUrl() }))
    .max(6)
    .default([]),
  followers: optionalText(nonNegative('Не может быть отрицательным')),
  average_views: optionalText(nonNegative('Не может быть отрицательным')),
  topics: z.array(z.string().trim().max(100)).max(20).default([]).transform(normalizeTopics),
  formats: z.array(z.string().trim().max(100)).max(20).default([]),
  price: optionalText(z.number().min(0, 'Не может быть отрицательной')),
  description: optionalText(z.string().max(3000)),
  audience: optionalText(z.string().trim().max(200)),
  geography: optionalText(z.string().trim().max(200)),
  image_kind: z.enum(['photo', 'cutout'], { errorMap: () => ({ message: 'Только фото или вырезка' }) }).nullable().default('photo'),
  published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  category: optionalText(z.enum(CATEGORIES, { errorMap: () => ({ message: 'Неизвестная категория' }) })),
  featured_first: z.boolean().default(false),
  rkn_registered: z.boolean().nullable().optional(),
  ad_contact: optionalText(z.string().url('Нужна полная ссылка, например https://t.me/username')),
  ad_terms: z.array(z.string().max(1500)).max(30).default([]),
  ad_restrictions: z.array(z.string().max(1500)).max(30).default([]),
});

export const bloggerPatchSchema = bloggerSchema.partial();

export const settingsSchema = z.object({
  telegram: z
    .union([z.literal(''), z.string().url('Нужна ссылка вида https://t.me/username')])
    .nullable()
    .optional(),
  email: z.union([z.literal(''), z.string().email('Не похоже на email')]).nullable().optional(),
  leadsReady: z.boolean().optional(),
  privacyUrl: z
    .union([z.literal(''), z.string().url('Не похоже на ссылку')])
    .nullable()
    .optional(),
  operator: optionalText(z.string().trim().max(150)),
  adminUserIds: z
    .array(
      z
        .coerce.number({ invalid_type_error: 'user_id должен быть числом' })
        .int('user_id — целое число')
        .positive('user_id должен быть положительным')
    )
    .max(50)
    .optional(),
});

export const leadStatusSchema = z.enum(['new', 'in_work', 'contacted', 'done', 'rejected']);

export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
