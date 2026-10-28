import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeTopics, withoutPrices, publicBlogger } from '../shared/public-blogger.js';
const original = JSON.parse(fs.readFileSync(new URL('../data/bloggers.seed.json', import.meta.url), 'utf8'));

test('life aliases merge with no duplicates; unrelated topics retain order', () => {
  assert.deepEqual(normalizeTopics(['лайф', 'юмор', 'Лайфстайл', 'лайф']), ['лайфстайл', 'юмор']);
});
test('prices are omitted, including future entries from existing database', () => {
  assert.deepEqual(withoutPrices(['Цена по запросу', 'От 2 000 руб.', 'Стоимость договорная', '500 USD', 'Без казино.', 'От 70 тыс. просмотров.']), ['Без казино.', 'От 70 тыс. просмотров.']);
});
test('all 38 bloggers retain identity, links, photos, order and restrictions', () => {
  const updated = original.map(publicBlogger);
  assert.equal(updated.length, 38);
  for (let i = 0; i < updated.length; i++) {
    for (const key of Object.keys(original[i]).filter(k => !['topics','ad_terms','ad_restrictions','price'].includes(k))) {
      assert.deepEqual(updated[i][key], original[i][key], key);
    }
    assert.deepEqual(updated[i].ad_restrictions, (original[i].ad_restrictions || []));
    assert(!updated[i].topics.includes('лайф'));
    assert(!/[₽$€]|стоимость|цена/iu.test(updated[i].ad_terms.join(' ')));
  }
});
test('all advertising terms and guarantees are removed from old database records', () => {
  for (const name of ['Регина','РИАНКА','Полина — polalaa']) {
    const value = { name, ad_terms: ['TikTok: видео, гарантия 20 000 просмотров.', 'Instagram: от 50 тыс. просмотров.'], ad_restrictions: ['Не принимает ставки и казино.'] };
    const result = publicBlogger(value);
    assert.deepEqual(result.ad_terms, []);
    assert.deepEqual(result.ad_restrictions, value.ad_restrictions);
  }
});
test('does not mutate database-shaped input', () => {
  const value = { topics: ['лайф'], ad_terms: ['500 ₽'], price: 500 };
  publicBlogger(value);
  assert.deepEqual(value, { topics: ['лайф'], ad_terms: ['500 ₽'], price: 500 });
});
