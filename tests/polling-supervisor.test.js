import test from 'node:test';
import assert from 'node:assert/strict';
import { createPollingSupervisor } from '../server/lib/pollingSupervisor.js';
const next=()=>new Promise(resolve=>setImmediate(resolve));
const logger=()=>({warns:[],errors:[],warn(s){this.warns.push(s);},error(s){this.errors.push(s);}});

test('409 rejection is caught; bot retries instead of crashing Node',async()=>{
 let attempts=0;const delays=[],log=logger();
 const bot={async start(){if(++attempts<3)throw {error_code:409};},isRunning:()=>false};
 const s=createPollingSupervisor(bot,{log,wait:async ms=>delays.push(ms)});
 assert.equal(await s.done,true);assert.equal(attempts,3);assert.deepEqual(delays,[5000,10000]);assert.equal(log.warns.length,2);await s.stop();
});
test('persistent duplicate uses capped backoff, not a hot retry loop',async()=>{
 let s,calls=0;const delays=[];
 const bot={async start(){calls++;throw {error_code:409};},isRunning:()=>false};
 s=createPollingSupervisor(bot,{log:logger(),wait:async ms=>{delays.push(ms);if(delays.length===6)queueMicrotask(()=>s.stop());}});
 await s.done;assert.deepEqual(delays,[5000,10000,20000,30000,30000,30000]);assert.equal(calls,6);
});
test('unauthorized bot error is caught without retrying or exposing tokens',async()=>{
 const log=logger();let attempts=0;
 const s=createPollingSupervisor({async start(){attempts++;throw {error_code:401,message:'secret-token'};},isRunning:()=>false},{log});
 assert.equal(await s.done,false);assert.equal(attempts,1);assert.equal(log.errors.length,1);assert(!log.errors[0].includes('secret-token'));
});
test('shutdown interrupts a conflict backoff immediately',async()=>{
 const s=createPollingSupervisor({async start(){throw {error_code:409};},isRunning:()=>false},{log:logger()});
 await next();const before=Date.now();await s.stop();assert(Date.now()-before<500);
});
test('shutdown stops a running poller and tolerates final offset conflict',async()=>{
 let finish,stops=0;
 const bot={start:()=>new Promise(r=>finish=r),isRunning:()=>true,async stop(){stops++;finish();throw {error_code:409};}};
 const s=createPollingSupervisor(bot,{log:logger()});await s.stop();assert.equal(stops,1);
});

test('HTTP remains available while polling recovers from a simulated deploy conflict',async()=>{
 const {createServer}=await import('node:http');
 const server=createServer((_req,res)=>res.end('ok'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let finish,attempts=0,running=false;
 const bot={
  async start(){if(++attempts===1)throw {error_code:409};running=true;await new Promise(r=>finish=r);running=false;},
  isRunning:()=>running,
  async stop(){finish?.();},
 };
 const s=createPollingSupervisor(bot,{log:logger(),wait:async()=>{await next();}});
 try {
  await next();await next();
  const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status,200);assert.equal(await response.text(),'ok');assert.equal(attempts,2);
 } finally {await s.stop();await new Promise(r=>server.close(r));}
});
