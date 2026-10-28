import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// A missing .env is normal on Render (env vars come from the dashboard).
if (fs.existsSync(path.join(ROOT, '.env'))) dotenv.config({ path: path.join(ROOT, '.env') });

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalDatabase = /@(localhost|127\.0\.0\.1|\[::1\])/.test(databaseUrl);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const wantsAuthDisabled = bool(process.env.AUTH_DISABLED, false);

if (wantsAuthDisabled && isProduction) {
  console.error(
    'AUTH_DISABLED is ignored when NODE_ENV=production. Delete it from the environment: ' +
      'with it set, every request would look like a local developer and the admin panel would be open.'
  );
}

export const config = {
  root: ROOT,
  webDir: path.join(ROOT, 'web'),
  distDir: path.join(ROOT, 'web', 'dist'),
  seedFile: path.join(ROOT, 'data', 'bloggers.seed.json'),
  nodeEnv,
  isProduction,
  port: clampedNumber(process.env.PORT, 8080, 1, 65535),
  databaseUrl,
  // Render's internal network terminates TLS with its own CA; external
  // connection strings usually need sslmode, which the URL itself carries.
  databaseSsl: bool(process.env.DATABASE_SSL, !isLocalDatabase && databaseUrl !== ''),
  botToken: process.env.BOT_TOKEN || '',
  miniAppOrigin: (process.env.MINI_APP_ORIGIN || '').replace(/\/$/, ''),
  adminUserIds: list(process.env.ADMIN_USER_IDS).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0),
  notifyChatId: process.env.NOTIFY_CHAT_ID || '',
  autoMigrate: bool(process.env.AUTO_MIGRATE, true),
  autoSeed: bool(process.env.AUTO_SEED, true),
  // Dev bypass is a local convenience and never survives into production, where it
  // is dropped regardless of what the environment says.
  authDisabled: wantsAuthDisabled && !isProduction,
  initDataMaxAgeSeconds: clampedNumber(process.env.INIT_DATA_MAX_AGE_SECONDS, 86400, 300, 604800),
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  maxUploadBytes: clampedNumber(process.env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024, 1024, 20 * 1024 * 1024),
  // Only set this when a reverse proxy really is in front of the app: trusting an
  // attacker-supplied X-Forwarded-For would hand them the rate-limit identity.
  trustProxy: bool(process.env.TRUST_PROXY, false),
  cspOverride: process.env.CONTENT_SECURITY_POLICY || '',
};

export const publicConfigShape = {
  telegram: null,
  email: null,
  leadsReady: false,
  privacyUrl: null,
  operator: null,
};
