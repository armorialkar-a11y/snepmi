import crypto from 'node:crypto';
import { config } from '../config.js';
import { getSettings } from './settings.js';

/**
 * Verification of Telegram Mini App launch data, following
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app-from-the-user
 * The client sends the raw `initData` string in `Authorization: tma <initData>`.
 *
 * `initData` is a bearer credential: whoever holds a signed copy can act as that
 * user until `auth_date` ages out. It is never logged, never stored and never
 * echoed back.
 */

const MAX_RAW_LENGTH = 12000;
const FUTURE_SKEW_SECONDS = 90;
const HEX = /^[0-9a-f]+$/i;

function fail(reason) {
  return { ok: false, reason };
}

export function verifyInitData(raw, token = config.botToken, maxAgeSeconds = config.initDataMaxAgeSeconds) {
  if (typeof raw !== 'string' || !raw) return fail('missing');
  if (raw.length > MAX_RAW_LENGTH) return fail('too_large');
  if (!token) return fail('no_bot_token');

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  // A non-hex `hash` can never match, and comparing it would only waste a
  // timingSafeEqual call on attacker-chosen bytes.
  if (!hash || !HEX.test(hash) || hash.length !== 64) return fail('no_hash');

  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(calculated, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return fail('bad_signature');
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return fail('no_auth_date');
  const age = Date.now() / 1000 - authDate;
  // A clock in the future means the payload was forged, not launched by Telegram.
  if (age < -FUTURE_SKEW_SECONDS) return fail('future_auth_date');
  if (age > maxAgeSeconds) return fail('stale');

  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return fail('bad_user');
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return fail('bad_user');

  return { ok: true, user, rawData: Object.fromEntries(params.entries()) };
}

/**
 * The address the TCP connection actually came from. `req.ip` is not usable here:
 * `X-Forwarded-For` is attacker-controlled whenever trust proxy is on, and the dev
 * bypass must be impossible to claim over the network.
 */
export function isLoopbackRequest(req) {
  const address = req?.socket?.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function devUser(req) {
  if (!config.authDisabled || !isLoopbackRequest(req)) return null;
  return {
    id: Number(process.env.DEV_USER_ID || 1),
    username: process.env.DEV_USERNAME || 'dev_local',
    firstName: 'Dev',
    dev: true,
  };
}

export async function readTelegramUser(req) {
  const dev = devUser(req);
  if (dev) return dev;

  const header = req.get('authorization') || '';
  const match = /^tma\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  const result = verifyInitData(match[1]);
  if (!result.ok) return null;
  return { id: result.user.id, username: result.user.username || null, firstName: result.user.first_name };
}

// ---------------------------------------------------------------- rate limit

const LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LIMIT_MAX_FAILURES = 25;
const failures = new Map();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimited(req) {
  const now = Date.now();
  const key = clientKey(req);
  const record = failures.get(key);
  if (!record || now - record.started > LIMIT_WINDOW_MS) return false;
  return record.count >= LIMIT_MAX_FAILURES;
}

function noteFailure(req) {
  const now = Date.now();
  const key = clientKey(req);
  const record = failures.get(key);
  if (!record || now - record.started > LIMIT_WINDOW_MS) failures.set(key, { started: now, count: 1 });
  else record.count += 1;
  if (failures.size > 20000) {
    for (const [ip, entry] of failures) {
      if (now - entry.started > LIMIT_WINDOW_MS) failures.delete(ip);
    }
  }
}

function noteSuccess(req) {
  failures.delete(clientKey(req));
}

// ---------------------------------------------------------------- middleware

export function requireTelegram(handler) {
  return async (req, res, next) => {
    try {
      if (rateLimited(req)) {
        res.status(429).json({ error: 'Слишком много неудачных попыток авторизации. Подождите 15 минут.' });
        return;
      }
      const user = await readTelegramUser(req);
      if (!user) {
        if (!config.authDisabled) noteFailure(req);
        res.status(401).json({ error: 'Не удалось проверить Telegram-авторизацию. Откройте приложение через бота.' });
        return;
      }
      noteSuccess(req);
      req.tgUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Admin access = a signature Telegram produced for this bot token, an id that is
 * in the trusted list, and a connection that is not being guessed at.
 * Every branch below fails closed.
 */
export function requireAdmin() {
  return async (req, res, next) => {
    try {
      if (rateLimited(req)) {
        res.status(429).json({ error: 'Слишком много неудачных попыток доступа. Подождите 15 минут.' });
        return;
      }

      const dev = devUser(req);
      if (!dev && !config.botToken) {
        // Without a bot token there is no key to verify signatures with, so no
        // request can be trusted — refuse instead of waving it through.
        res.status(503).json({ error: 'Сервер не настроен: не задан BOT_TOKEN, проверка доступа невозможна.' });
        return;
      }

      const user = await readTelegramUser(req);
      if (!user) {
        if (!config.authDisabled) noteFailure(req);
        res.status(401).json({ error: 'Нужно открыть приложение через Telegram-бота.' });
        return;
      }

      const settings = await getSettings();
      const admins = new Set(settings.adminUserIds.map(Number));
      // Environment ids are always trusted and cannot be revoked from the panel.
      for (const id of config.adminUserIds) admins.add(Number(id));
      if (!admins.has(Number(user.id))) {
        if (!config.authDisabled) noteFailure(req);
        console.warn(`admin access denied for telegram id ${user.id}${user.dev ? ' (dev)' : ''} at ${req.method} ${req.originalUrl}`);
        res.status(403).json({ error: 'У этого пользователя нет доступа к админ-панели.' });
        return;
      }

      noteSuccess(req);
      req.tgUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Audit trail for every admin write: who changed what, and whether it stuck. */
export function adminAudit(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next();
    return;
  }
  res.on('finish', () => {
    console.log(
      `admin ${req.method} ${req.originalUrl} -> ${res.statusCode} by telegram id ${req.tgUser?.id ?? '?'}${req.tgUser?.dev ? ' (dev)' : ''}`
    );
  });
  next();
}
