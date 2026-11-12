import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPublicBlogger } from '../server/routes/public.js';
import { csvCell } from '../server/lib/csv.js';
import { selectionInquiry } from '../web/src/lib/selection-inquiry.js';
import { processNotification, retryDelaySeconds, startNotificationWorker } from '../server/lib/notificationOutbox.js';

test('public API projection excludes prices, terms and any unexpected future private fields', () => {
  const result = mapPublicBlogger({ id: '1', name: 'A', price: 400, ad_terms: ['private terms'], private_future: 'secret', topics:['лайф'], ad_restrictions:['Без казино', 'Цена 500 руб.'] });
  assert.equal(result.name, 'A');
  for (const field of ['price','ad_terms','private_future','published','description']) assert.equal(Object.hasOwn(result, field), false);
  assert.deepEqual(result.topics,['лайфстайл']);
  assert.deepEqual(result.ad_restrictions,['Без казино']);
});
test('CSV escapes quotes and neutralizes dangerous formula prefixes', () => {
  for (const s of ['=1+1','+2','-2','@foo','  =1+1','\tvalue','\rvalue','\nvalue','＝SUM(1,1)']) {
    assert.equal(csvCell(s), `"'${s}"`);
  }
  assert.equal(csvCell('Имя "Анна"'), '"Имя ""Анна"""');
  assert.equal(csvCell(['обычный','текст']), '"обычный; текст"');
  assert.equal(csvCell(null), '');
});
test('selection inquiry follows current configured contact and preserves other parameters', () => {
  const url = new URL(selectionInquiry([{name:'А & Б'}], 'https://t.me/newmanager?foo=1&text=old'));
  assert.equal(url.pathname, '/newmanager');
  assert.equal(url.searchParams.get('foo'),'1');
  assert.match(url.searchParams.get('text'), /А & Б/);
  assert.equal(new URL(selectionInquiry([], 'javascript:alert(1)')).hostname, 't.me');
});
test('notifications are acknowledged only after confirmed send', async () => {
  for (const outcome of ['success','failure','exception']) {
    const job={id:1,attempts:1,lease_token:'token'}; const calls=[];
    await processNotification({claim: async()=>job, send:async()=>{ if(outcome==='exception') throw Error('temporary'); return outcome==='success'; }, finish:async j=>calls.push(['finish',j.id]), retry:async j=>calls.push(['retry',j.id])});
    assert.deepEqual(calls, [[outcome==='success' ? 'finish' : 'retry',1]]);
  }
  assert.equal(await processNotification({claim:async()=>null}),false);
  assert.deepEqual([1,2,3,20].map(retryDelaySeconds),[15,30,60,3600]);
});
test('notification worker stops and does not schedule new work', async () => {
  let count=0;
  const worker=startNotificationWorker({process:async()=>{count++;return false}, intervalMs:10,log:console});
  await worker.stop(); await new Promise(r=>setTimeout(r,35)); assert.equal(count,1);
});
