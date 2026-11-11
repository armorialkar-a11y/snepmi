import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicBlogger } from '../shared/public-blogger.js';

test('Irina has her photo, supplied links and no invented audience metrics', () => {
  const rows = JSON.parse(fs.readFileSync(new URL('../data/bloggers.seed.json', import.meta.url)));
  const matches = rows.filter(r => r.name === 'Ирина Тихомирова');
  assert.equal(matches.length, 1);
  const b = publicBlogger(matches[0]);
  assert.equal(b.social_links.find(x => x.platform === 'Telegram').url, 'https://t.me/tihomirno_obo_vsem');
  assert.equal(b.social_links.find(x => x.platform === 'Instagram').url, 'https://www.instagram.com/irina.tiho.mirova');
  assert.equal(b.audience, 'Женщины 25–40 (предположительно)');
  assert.equal(b.geography, 'Уточняется');
  assert.equal(b.followers, null);
  assert.equal(b.average_views, null);
  assert.equal(b.rkn_registered, null);
  assert.equal(b.category, 'unassigned');
  assert(b.topics.includes('материнство'));
  assert(fs.existsSync(new URL('../web/public' + b.image_url, import.meta.url)));
});
