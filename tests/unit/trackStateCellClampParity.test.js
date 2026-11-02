import test from 'node:test';
import assert from 'node:assert/strict';
import {clampTrackStateCell as current} from '../../src/racing/trackState/TrackStateCell.js';
import {clampTrackStateCell as reference} from './fixtures/trackStateCellClampReference.js';
test('cell clamping matches original across wear, weather, invalid values, and repeated normalization',()=>{
 let seed=871;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const fields=Object.keys(reference({}));
 for(let i=0;i<5000;i++){
  const cell={};
  for(const field of fields)cell[field]=random()<.2?[undefined,null,NaN,Infinity,-Infinity,-0,'.2','invalid',false,true][Math.floor(random()*10)]:(random()-.15)*200;
  const a={...cell},b={...cell};
  assert.strictEqual(current(a),a);reference(b);assert.deepEqual(a,b);
  current(a);reference(b);assert.deepEqual(a,b);
 }
});
