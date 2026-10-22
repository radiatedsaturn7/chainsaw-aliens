import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackWakeLock} from '../../src/ui/shared/PlaybackWakeLock.js';
function fixture(request){
 const document=new EventTarget();document.visibilityState='visible';
 const locks=[];
 const navigator={wakeLock:{request:request|| (async type=>{
   assert.equal(type,'screen');const lock=new EventTarget();lock.released=false;
   lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'));};locks.push(lock);return lock;
 })}};
 return {wake:new PlaybackWakeLock({navigator,document}),locks,document,navigator};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('active playback holds one lock, stops release it, and visible return reacquires',async()=>{
 const {wake,locks,document}=fixture();
 await wake.setActive(true);await wake.setActive(true);assert.equal(locks.length,1);assert.equal(wake.status,'active');
 document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(locks[0].released,true);
 document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(locks.length,2);
 await wake.setActive(false);assert.equal(locks[1].released,true);
 document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(locks.length,2);
});
test('pending acquisition cannot keep the screen awake after playback stops',async()=>{
 const f=fixture(),request=f.navigator.wakeLock.request;let resolve;
 f.navigator.wakeLock.request=()=>new Promise(r=>{resolve=r;});
 const pending=f.wake.setActive(true);await flush();await f.wake.setActive(false);
 resolve(await request('screen'));await pending;assert.equal(f.locks[0].released,true);assert.equal(f.wake.lock,null);
});
test('pause/resume during acquisition discards stale lock and acquires current lock',async()=>{
 const f=fixture(),request=f.navigator.wakeLock.request;let resolve;
 f.navigator.wakeLock.request=()=>new Promise(r=>{resolve=r;});
 const pending=f.wake.setActive(true);await flush();await f.wake.setActive(false);f.wake.setActive(true);
 f.navigator.wakeLock.request=request;resolve(await request('screen'));await pending;await flush();
 assert.equal(f.locks[0].released,true);assert.equal(f.locks.length,2);assert.equal(f.wake.status,'active');await f.wake.setActive(false);
});
test('unsupported and rejected locks do not fail playback or loop requests',async()=>{
 const unavailable=new PlaybackWakeLock({navigator:{}});await unavailable.setActive(true);assert.equal(unavailable.status,'unavailable');
 for(const request of [()=>{throw Error('denied');},async()=>{throw Error('low battery');}]){
  const {wake,document}=fixture(request);await wake.setActive(true);assert.equal(wake.status,'unavailable');assert.equal(wake.pending,null);
  await wake.setActive(true);assert.equal(wake.pending,null);await wake.setActive(false);
 }
});
test('OS release is reflected without repeatedly fighting a power-saving decision',async()=>{
 const {wake,locks}=fixture();await wake.setActive(true);await locks[0].release();await flush();assert.equal(wake.status,'released');assert.equal(locks.length,1);await wake.setActive(false);
});
