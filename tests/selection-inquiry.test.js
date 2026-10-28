import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionInquiry } from '../web/src/lib/selection-inquiry.js';
test('opens only nesssvt with an editable draft containing selected names',()=>{
 const url=new URL(selectionInquiry([{name:'МУВИ'},{name:'natylishkaa'},{name:'МУВИ'}]));
 assert.equal(url.origin+url.pathname,'https://t.me/nesssvt');
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
