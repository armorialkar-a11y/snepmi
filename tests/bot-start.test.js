import test from 'node:test';
import assert from 'node:assert/strict';

// Test handlers with a simulated Telegram API; no real messages are sent.
test('start greeting omits admin ID but /id remains available', async () => {
  process.env.BOT_TOKEN = '123456:FAKE_TOKEN';
  process.env.MINI_APP_ORIGIN = 'https://example.com';
  delete process.env.DATABASE_URL;
  const { createBot } = await import('../server/bot.js');
  const bot = createBot();
  const sent = [];
  bot.api.config.use(async (_prev, method, payload) => {
    if (method === 'getMe') return {ok: true, result: {id: 123456, is_bot: true, first_name: 'Test', username: 'test_bot'}};
    if (method === 'sendMessage') {
      sent.push(payload);
      return {ok: true, result: {message_id: sent.length, date: 0, chat: {id: 42, type: 'private'}, text: payload.text}};
    }
    throw new Error(`Unexpected Telegram API call: ${method}`);
  });
  await bot.init();
  const update = (command, update_id) => ({update_id, message: {message_id: update_id, date: 0, chat: {id: 42, type: 'private'}, from: {id: 42, is_bot: false, first_name: 'Test', username: 'example'}, text: command, entities: [{type:'bot_command', offset:0, length:command.length}]}});
  await bot.handleUpdate(update('/start', 1));
  assert.match(sent[0].text, /SNEPMI AGENCY — подбор блогеров/);
  assert.doesNotMatch(sent[0].text, /Ваш id|админ-панели|@example/i);
  assert.equal(sent[0].reply_markup.inline_keyboard[0][0].text, 'Открыть SNEPMI AGENCY');
  await bot.handleUpdate(update('/id', 2));
  assert.match(sent[1].text, /Telegram user_id: 42/);
});
