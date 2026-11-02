import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneTrackStateCheckpointCell as copy} from '../../src/racing/trackState/TrackStateCheckpointCell.js';
import {createTrackStateCell} from '../../src/racing/trackState/TrackStateCell.js';
const reference=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
test('checkpoint cell copies match JSON round trips and own all mutable data',()=>{
 let seed=177;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<3000;i++){
  const cell=createTrackStateCell({x:i,z:-i,stepIndex:i,base:{baseSurfaceId:['asphalt','dirt','snow'][i%3],elevationM:random()*1000,
   normal:{x:random(),y:random(),z:random()},standingWaterDepthMm:random()*20,surfaceTemperatureC:random()*80}});
  for(const key of Object.keys(cell))if(typeof cell[key]==='number'&&random()<.05)cell[key]=[NaN,Infinity,-Infinity,-0][i%4];
  cell.optional=undefined;
  const result=copy(cell);
  assert.deepEqual(result,reference(cell));
  assert.equal(JSON.stringify(result),JSON.stringify(reference(cell)));
  assert.notStrictEqual(result.normal,cell.normal);
  result.normal.x=999;assert.notEqual(cell.normal.x,999);
 }
});
test('extended checkpoint records retain JSON fallback semantics',()=>{
 const values=[undefined,null,0,'x',[1,,undefined],{normal:{x:1,extra:{z:2}}},
  {date:new Date('2020-01-01T00:00:00Z')},{normal:[1,2,3]},
  {toJSON(){return {custom:3};}},Object.fromEntries([['__proto__',{x:2}],['f',()=>{}],['s',Symbol('x')]])];
 for(const value of values)assert.deepEqual(copy(value),reference(value));
 assert.throws(()=>copy({huge:1n}),TypeError);
});
