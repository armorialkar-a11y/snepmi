import test from 'node:test';
import assert from 'node:assert/strict';
import { dampedSpring } from '../web/src/lib/animation.js';
test('step starts gently, grows monotonically without overshooting, and settles',()=>{
 let s={value:0,velocity:0},last=0,maxStep=0;
 for(let i=0;i<120;i++){
  s=dampedSpring(s,1,1/60);
  if(i===0)assert(s.value<.02);
  assert(s.value>=last&&s.value<=1);maxStep=Math.max(maxStep,s.value-last);last=s.value;
 }
 assert(maxStep<.075);assert(s.value>.99999);
});
test('60 and 120 Hz produce the same motion at equal elapsed time',()=>{
 const run=hz=>{let s={value:0,velocity:0};for(let i=0;i<hz/2;i++)s=dampedSpring(s,1,1/hz);return s;};
 const a=run(60),b=run(120);assert(Math.abs(a.value-b.value)<1e-12);assert(Math.abs(a.velocity-b.velocity)<1e-12);
});
test('reversal retains velocity, decelerates, then reverses without snapping',()=>{
 let s={value:0,velocity:0};for(let i=0;i<8;i++)s=dampedSpring(s,1,1/60);
 const before=s;s=dampedSpring(s,0,1/60);
 assert(s.value>before.value);assert(s.velocity<before.velocity);
 for(let i=0;i<120;i++)s=dampedSpring(s,0,1/60);
 assert(s.value<.00001);
});
test('paused frames are bounded and zero-duration geometry changes do not jump',()=>{
 const s={value:1.2,velocity:.1};const a=dampedSpring(s,1.3,10),b=dampedSpring(s,1.3,.032);
 assert.deepEqual(a,b);assert(Math.abs(a.value-s.value)<.01);
 const same=dampedSpring(s,1.1,0);assert(Math.abs(same.value-s.value)<1e-12);assert(Math.abs(same.velocity-s.velocity)<1e-12);
});
