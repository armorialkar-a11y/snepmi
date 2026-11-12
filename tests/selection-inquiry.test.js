import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionInquiry } from '../web/src/lib/selection-inquiry.js';
test('opens only advmiu with an editable draft containing selected names',()=>{
 const url=new URL(selectionInquiry([{name:'МУВИ'},{name:'natylishkaa'},{name:'МУВИ'}]));
 assert.equal(url.origin+url.pathname,'https://t.me/advmiu');
 const text=url.searchParams.get('text');
 assert(text.includes('— МУВИ\n— natylishkaa'));
 assert.equal(text.match(/— МУВИ/g).length,1);
 assert(!text.includes('₽'));
});
test('names with special characters are safely encoded',()=>{
 const url=new URL(selectionInquiry([{name:'Рокси & Юля #1'}]));
 assert(url.searchParams.get('text').includes('— Рокси & Юля #1'));
 assert.equal(url.hash,'');
});
test('encodes spaces as %20 for Telegram while preserving literal plus signs',()=>{
 const href=selectionInquiry([{name:'A+B'}], 'https://t.me/example?source=hello+there');
 const url=new URL(href);
 assert(!url.search.includes('+'));
 assert(url.search.includes('%20'));
 assert(url.search.includes('A%2BB'));
 assert.equal(url.searchParams.get('source'), 'hello there');
 assert(url.searchParams.get('text').includes('— A+B'));
});
