import crypto from 'node:crypto';
import { Bot } from 'grammy';
import { config } from './config.js';
import { getSettings } from './lib/settings.js';

let bot = null;
let polling = false;

/** Telegram posts the secret as `X-Telegram-Bot-Api-Secret-Token`. */
function webhookAuthorized(req) {
  if (!config.webhookSecret) return false;
  const provided = String(req.get('x-telegram-bot-api-secret-token') || '');
  const expected = config.webhookSecret;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const STATUS_LABELS = {
  new: 'новая',
  in_work: 'в работе',
  contacted: 'связались',
  done: 'закрыта',
  rejected: 'отклонена',
};

function miniAppUrl() {
  return config.miniAppOrigin || '';
}

/** Deep link into the Mini App: Telegram passes `startapp` as `initDataUnsafe.start_param`. */
function appUrl(param) {
  const origin = miniAppUrl();
  return origin ? `${origin}/?startapp=${param}` : '';
}

function startKeyboard(settings) {
  const catalog = appUrl('catalog');
  const rows = [];
  if (catalog) rows.push([webAppButton('📁 Открыть каталог блогеров', catalog)]);
  if (settings.telegram) rows.push([{ text: 'Написать менеджеру ↗', url: settings.telegram }]);
  // An empty `inline_keyboard: [[]]` makes sendMessage answer 400 — which is what
  // a fresh deploy without MINI_APP_ORIGIN would otherwise produce on every reply.
  return rows.length ? { inline_keyboard: rows } : undefined;
}

function webAppButton(text, url) {
  return { text, web_app: { url } };
}

export function getBot() {
  return bot;
}

export function createBot() {
  if (bot || !config.botToken) return bot;
  bot = new Bot(config.botToken, { canUseNewComponents: true });

  bot.command('start', async (ctx) => {
    const settings = await safeSettings();
    const username = ctx.from.username ? `@${ctx.from.username}` : String(ctx.from.id);
    await ctx.reply(
      [
        'SNEPMI AGENCY — подбор блогеров под вашу рекламную задачу.',
        '',
        'Откройте каталог: ищите авторов по площадке, тематике и аудитории, отмечайте нужных и оставляйте заявку.',
        '',
        `Ваш id: ${username} (нужен, чтобы получить доступ к админ-панели).`,
      ].join('\n'),
      { reply_markup: startKeyboard(settings) }
    );
  });

  bot.command('id', async (ctx) => {
    const settings = await safeSettings();
    const is = settings.adminUserIds.includes(Number(ctx.from.id));
    await ctx.reply(
      [
        `Telegram user_id: ${ctx.from.id}`,
        `Имя: ${ctx.from.first_name || '—'}${ctx.from.username ? ` (@${ctx.from.username})` : ''}`,
        `Доступ к админке: ${is ? 'есть' : 'нет'}`,
        is ? '' : 'Попросите владельца добавить этот id в Settings → Администраторы.',
      ]
        .filter(Boolean)
        .join('\n')
    );
  });

  bot.command('help', async (ctx) => {
    const settings = await safeSettings();
    await ctx.reply(
      [
        'Что умеет бот:',
        '/start — открыть Mini App с каталогом блогеров',
        '/id — показать ваш Telegram id (для доступа в админку)',
        '/settings — короткая сводка текущего режима',
        '/admin — админ-панель (только для ответственных)',
        '',
        'В каталоге можно фильтровать авторов, собирать подборку и отправлять заявку агентству.',
      ].join('\n'),
      { reply_markup: startKeyboard(settings) }
    );
  });

  bot.command('settings', async (ctx) => {
    const settings = await safeSettings();
    await ctx.reply(
      [
        `Контакт: ${settings.telegram || 'не задан'}`,
        `Заявки включены: ${settings.leadsReady ? 'да' : 'нет'}`,
        `Администраторов: ${settings.adminUserIds.length}`,
        `Mini App: ${miniAppUrl() || 'MINI_APP_ORIGIN не задан'}`,
      ].join('\n')
    );
  });

  bot.command('admin', async (ctx) => {
    const settings = await safeSettings();
    const isAdmin = settings.adminUserIds.includes(Number(ctx.from.id)) ||
      config.adminUserIds.includes(Number(ctx.from.id));
    const url = appUrl('admin');
    if (!isAdmin || !url) {
      await ctx.reply('Админ-панель доступна только пользователям из списка ADMIN_USER_IDS.');
      return;
    }
    await ctx.reply('Админ-панель SNEPMI AGENCY.', {
      reply_markup: { inline_keyboard: [[webAppButton('Открыть админку', url)]] },
    });
  });

  bot.on('message', async (ctx) => {
    if (ctx.message?.text?.startsWith('/')) return;
    const settings = await safeSettings();
    await ctx.reply('Открыть каталог можно кнопкой ниже.', { reply_markup: startKeyboard(settings) });
  });

  bot.catch((error) => console.error('bot error:', error.message));
  return bot;
}

async function safeSettings() {
  try {
    return await getSettings();
  } catch {
    return { telegram: null, leadsReady: false, adminUserIds: [] };
  }
}

export async function applyBotSetup() {
  const instance = createBot();
  if (!instance) return false;
  const target = miniAppUrl();
  try {
    await instance.api.setMyCommands([
      { command: 'start', description: 'Открыть каталог блогеров' },
      { command: 'id', description: 'Мой Telegram id' },
      { command: 'help', description: 'Как пользоваться' },
      { command: 'admin', description: 'Админ-панель (для ответственных)' },
    ]);
    if (target) {
      await instance.api.setChatMenuButton({
        menu_button: { type: 'web_app', text: 'Каталог', web_app: { url: target } },
      });
    }
    return true;
  } catch (error) {
    console.error('bot setup failed:', error.message);
    return false;
  }
}

/** Sends a freshly created lead to the agency's notification chat. */
export async function notifyNewLead(lead) {
  const instance = createBot();
  if (!instance || !config.notifyChatId) return false;
  const shortId = String(lead.id).slice(-6);
  const lines = [
    `Новая заявка #${shortId}`,
    `${lead.name} — ${lead.company}`,
    `Контакт: ${lead.contact}`,
    lead.budget ? `Бюджет: ${lead.budget}` : null,
    lead.launch_date ? `Запуск: ${lead.launch_date}` : null,
    lead.names?.length ? `Авторы: ${lead.names.join(', ')}` : 'Авторы: не выбраны',
    '',
    lead.task,
  ].filter((line) => line !== null);

  const adminUrl = appUrl('admin');
  const replyMarkup = adminUrl ? { inline_keyboard: [[webAppButton('Открыть в админке ↗', adminUrl)]] } : undefined;

  try {
    await instance.api.sendMessage(config.notifyChatId, lines.join('\n').slice(0, 3900), {
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
    return true;
  } catch (error) {
    console.error('notify failed:', error.description ?? error.message);
    return false;
  }
}

export function webhookHandler() {
  const instance = createBot();
  if (!instance) return null;
  return async (req, res) => {
    if (!webhookAuthorized(req)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    try {
      await instance.handleUpdate(req.body);
      res.status(200).end();
    } catch (error) {
      console.error('webhook handling failed:', error.message);
      res.status(500).end();
    }
  };
}

export async function startBot() {
  const instance = createBot();
  if (!instance) {
    console.warn('BOT_TOKEN is empty — Telegram bot is not running.');
    return false;
  }
  await applyBotSetup();
  if (config.webhookUrl) {
    await instance.api.setWebhook(config.webhookUrl, {
      secret_token: config.webhookSecret || undefined,
      drop_pending_updates: false,
    });
    console.log(`bot webhook set to ${config.webhookUrl}`);
    return true;
  }
  const me = await instance.api.getMe();
  console.log(`bot @${me.username} is polling`);
  polling = true;
  instance.start();
  return true;
}

export async function stopBot() {
  // grammy's stop() waits on a promise that never settles when polling never
  // started, which would hang the deploy's shutdown hook.
  if (polling && bot?.botInfo) await bot.stop();
  polling = false;
}
