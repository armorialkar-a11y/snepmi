import test from 'node:test';
import assert from 'node:assert/strict';
import { onBackClick, ready } from '../web/src/lib/telegram.js';

test('Telegram BackButton registers and removes the same handler',()=>{
 const previous=globalThis.window;const calls=[];const handler=()=>{};
 globalThis.window={Telegram:{WebApp:{isVersionAtLeast:()=>true,BackButton:{show:()=>calls.push('show'),hide:()=>calls.push('hide'),onClick:f=>calls.push(f),offClick:f=>calls.push(f)}}}};
 try {const remove=onBackClick(handler);remove();assert.deepEqual(calls,['show',handler,handler,'hide']);}
 finally {globalThis.window=previous;}
});
test('stable viewport changes apply, intermediate drag frames do not',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;const values={};let listener;
 const tg={viewportStableHeight:800,ready(){},expand(){},isVersionAtLeast:()=>true,onEvent:(name,fn)=>{assert.equal(name,'viewportChanged');listener=fn;}};
 globalThis.window={innerHeight:900,Telegram:{WebApp:tg}};
 globalThis.document={documentElement:{style:{setProperty:(key,value)=>values[key]=value}}};
 try {ready();assert.equal(values['--app-viewport-height'],'800px');tg.viewportStableHeight=600;listener({isStateStable:false});assert.equal(values['--app-viewport-height'],'800px');listener({isStateStable:true});assert.equal(values['--app-viewport-height'],'600px');}
 finally {globalThis.window=previousWindow;globalThis.document=previousDocument;}
});
