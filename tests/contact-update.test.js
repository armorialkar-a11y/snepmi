import test from 'node:test';
import assert from 'node:assert/strict';
import { adLink, telegramHandle } from '../web/src/lib/blogger.js';
import { SITE } from '../web/src/lib/content.js';

test('agency fallback links to the new Telegram contact', () => {
  const url = new URL(adLink({}, null));
  assert.equal(url.origin + url.pathname, 'https://t.me/advmiu');
  assert.equal(url.searchParams.get('text'), SITE.adPrefill);
  assert.equal(telegramHandle(url.origin + url.pathname), '@advmiu');
});
test('individual blogger contacts remain usable', () => {
  const url = new URL(adLink({ad_contact:'https://t.me/another_author'}, {telegram:'https://t.me/advmiu'}));
  assert.equal(url.pathname, '/another_author');
});
