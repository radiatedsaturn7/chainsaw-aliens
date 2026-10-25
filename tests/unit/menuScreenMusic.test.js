import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuScreenMusic} from '../../src/menus/MenuScreenMusic.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
const track=ref=>({musicMode:'track',musicRef:ref,musicFadeOut:.8,musicFadeIn:.6,musicStart:0,musicVolume:.4,musicLoop:true});
test('splash, silent selection, world map, garage and loading music lifecycle',async()=>{
 const calls=[],music=new MenuScreenMusic({setActiveMusicTrack:(...args)=>calls.push(args)},async()=>({data:{}}));
 await music.enter(track('splash'));await music.enter({musicMode:'silent'});
 await music.enter(track('map'));await music.enter({musicMode:'continue'});await music.enter({musicMode:'continue'});
 await music.enter(track('map'));
 assert.deepEqual(calls.map(c=>c[0]),['splash',null,'map']);
 music.stop();assert.equal(calls.at(-1)[0],null);assert.equal(calls.at(-1)[1].fadeOut,.8);
});
test('pending music survives continue but cannot play after silence or cleanup',async()=>{
 const calls=[],pending=[],music=new MenuScreenMusic({setActiveMusicTrack:(...args)=>calls.push(args)},()=>new Promise(resolve=>pending.push(resolve)));
 const first=music.enter(track('map'));await music.enter({musicMode:'continue'});
 pending.shift()({data:{}});await first;assert.equal(calls.at(-1)[0],'map');
 const second=music.enter(track('other'));music.stop();pending.shift()({data:{}});await second;
 assert.deepEqual(calls.map(c=>c[0]),['map',null]);
});
test('screen music modes persist and old menus retain their playback behavior',()=>{
 const d=normalizeMenuDocument({screens:[{id:'a',musicRef:'song'},{id:'b'},{id:'c',musicMode:'continue'}]});
 assert.deepEqual(d.screens.map(s=>s.musicMode),['track','silent','continue']);
 assert.deepEqual(normalizeMenuDocument(JSON.parse(JSON.stringify(d))),d);
});
