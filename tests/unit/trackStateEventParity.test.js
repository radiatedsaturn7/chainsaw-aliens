import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrackStateEvent} from '../../src/racing/trackState/TrackStateEvents.js';
import {normalizeTrackStateEvent as reference} from './fixtures/trackStateEventsReference.js';

test('event payload normalization preserves canonical values and serialized key order',()=>{
 let seed=912;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<10000;i++){
  const payload={z:random(),load:random()*10000,slip:random()*2,nested:{b:[random(),{q:NaN,a:Infinity}],a:-0},'4':4,'1':1};
  const event={stepIndex:i%20,vehicleId:`ai-${i%30}`,wheelId:'fl',x:random()*1000,z:-random()*1000,payload};
  const actual=normalizeTrackStateEvent(event,i),expected=reference(event,i);
  assert.deepEqual(actual,expected);
  assert.equal(JSON.stringify(actual),JSON.stringify(expected));
 }
});

test('event canonicalization preserves special keys, array holes and getter access order',()=>{
 const log=[];
 const payload={};
 Object.defineProperty(payload,'z',{enumerable:true,get(){log.push('z');return 3;}});
 Object.defineProperty(payload,'a',{enumerable:true,get(){log.push('a');return [,,2];}});
 Object.defineProperty(payload,'__proto__',{value:{polluted:true},enumerable:true});
 payload.constructor='constructor';
 const actual=normalizeTrackStateEvent({payload});const actualLog=log.splice(0);
 const expected=reference({payload});
 assert.deepEqual(actual,expected);
 assert.deepEqual(actualLog,log);
 assert.equal(Object.getPrototypeOf(actual.payload),Object.prototype);
 assert.equal(Object.hasOwn(actual.payload,'__proto__'),true);
 assert.equal(actual.payload.polluted,undefined);
 assert.equal(0 in actual.payload.a,false);
});
