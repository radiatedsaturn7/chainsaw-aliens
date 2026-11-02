import assert from 'node:assert/strict';
import test from 'node:test';
import {copyTireStateRecord} from '../../src/racing/simulation/TireStatePublication.js';

test('tire publication matches assignment through changing contact fields and thermal overrides', () => {
 const actual = {wear: .2}, expected = {...actual};
 let seed = 71;
 const random = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed / 4294967296;};
 for(let step=0;step<500;step++) {
  const patch = Object.create({inherited: 'excluded'});
  for(let i=0;i<120;i++) if(random()>.3) patch[`field${i}`] = random();
  patch.normal = {x: random(), y: random(), z: random()};
  patch.contactFeatureId = step%3 ? 'road' : null;
  patch.optional = undefined;
  Object.defineProperty(patch,'privateField',{value: step,enumerable:false});
  const thermal = {temperatureC: random()*100, field0: step};
  Object.assign(expected,patch,thermal);
  copyTireStateRecord(actual,patch); copyTireStateRecord(actual,thermal);
  assert.deepEqual(actual,expected);
  assert.strictEqual(actual.normal,patch.normal);
 }
 assert.strictEqual(copyTireStateRecord(actual,actual),actual);
 assert.deepEqual(actual,expected);
});


test('missing optional tire-transition records leave existing state untouched', () => {
 const target = {load: 123};
 assert.strictEqual(copyTireStateRecord(target, undefined), target);
 assert.strictEqual(copyTireStateRecord(target, null), target);
 assert.deepEqual(target, {load: 123});
});
