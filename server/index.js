import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { getPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { publicRouter, sendMedia } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { startBot, stopBot, webhookHandler } from './bot.js';

const app = express();

if (config.trustProxy) app.set('trust proxy', 1);

app.disable('x-powered-by');

const CSP =
  config.cspOverride ||
  [
    "default-src 'self'",
    // telegram-web-app.js is the only third-party script the Mini App needs.
    "script-src 'self' https://telegram.org",
    // React sets a handful of transform/opacity styles inline; nothing else.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://telegram.org",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Mini Apps open inside Telegram's own web client, so framing is allowed
    // for Telegram only — any other site embedding us gets refused.
    "frame-ancestors 'self' https://telegram.org https://*.telegram.org https://web.telegram.org https://*.web.telegram.org",
  ].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (config.isProduction && (req.secure || req.get('x-forwarded-proto') === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

// The credential is the `Authorization` header, so a cross-site form or fetch
// cannot reach the API — but a same-origin page injected through some other hole
// could, and DNS rebinding changes the host under the app. State-changing calls
// therefore have to come from this origin.
const CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.use('/api', (req, res, next) => {
  if (!CHANGING.has(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      host = '';
    }
    if (host && host !== req.hostname) {
      res.status(403).json({ error: 'Запрос отправлен с другого источника.' });
      return;
    }
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);
app.get('/media/:id', sendMedia);

if (config.webhookUrl) {
  if (!config.webhookSecret) {
    // An unauthenticated webhook lets anyone post forged updates and make the bot
    // reply into arbitrary chats, so the endpoint is not exposed at all.
    console.error('WEBHOOK_URL is set without WEBHOOK_SECRET — /telegram/webhook is disabled.');
  } else {
    const handler = webhookHandler();
    if (handler) app.post('/telegram/webhook', handler);
  }
}

const assets = [
  [path.join(config.distDir, 'assets'), '/assets'],
  [path.join(config.webDir, 'public'), ''],
];
for (const [directory, mount] of assets) {
  if (fs.existsSync(directory)) app.use(mount, express.static(directory, { maxAge: '7d', immutable: false }));
}
if (fs.existsSync(config.distDir)) app.use(express.static(config.distDir, { index: false }));

app.get(/^\/(?!api\/).*/, (req, res, next) => {
  const index = path.join(config.distDir, 'index.html');
  if (req.method !== 'GET' || !fs.existsSync(index)) return next();
  res.sendFile(index);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Не найдено' });
    return;
  }
  res
    .status(404)
    .type('text/plain')
    .send('web/dist/index.html is missing — run `npm run build` before `npm start`.');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || (error.code === '23505' ? 409 : 500);
  // Postgres codes (23505, 42P01, …) carry table and column names; multer and
  // Node codes are longer, so this only catches database internals.
  const isDatabaseError = typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code);
  if (isDatabaseError && error.code === '23505') {
    res.status(409).json({ error: 'Такая запись уже существует.' });
    return;
  }
  if (status === 500 || isDatabaseError) {
    res.status(status === 500 ? 500 : 409).json({ error: 'Внутренняя ошибка сервера' });
    return;
  }
  res.status(status).json({ error: error.message });
});

async function boot() {
  if (config.databaseUrl) {
    if (config.autoMigrate) await migrate();
    if (config.autoSeed) await seed();
  } else {
    console.warn('DATABASE_URL is empty — API calls will fail until it is configured.');
  }

  if (config.isProduction) {
    if (!config.botToken) console.error('BOT_TOKEN is empty — Telegram signatures cannot be verified, so the admin panel is closed to everyone.');
    if (!config.miniAppOrigin) console.warn('MINI_APP_ORIGIN is empty — bot buttons and deep links will not work.');
    if (!config.adminUserIds.length) console.warn('ADMIN_USER_IDS is empty — only the ids saved in Settings can reach the admin panel.');
  }

  const server = app.listen(config.port, () => {
    console.log(
      `listening on :${config.port} (${config.nodeEnv}, auth ${config.authDisabled ? 'dev bypass ON, loopback only' : 'enforced'})`
    );
  });

  startBot().catch((error) => console.error('bot start failed:', error.message));

  const shutdown = async () => {
    console.log('shutting down');
    await stopBot().catch(() => {});
    server.close();
    if (config.databaseUrl) await getPool().end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

boot().catch((error) => {
  console.error('startup failed:', error.message);
  process.exit(1);
});
