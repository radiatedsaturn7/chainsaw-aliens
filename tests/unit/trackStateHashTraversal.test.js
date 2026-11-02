import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncrementalTrackStateHash as current} from '../../src/racing/trackState/TrackStateSerialization.js';
import {createIncrementalTrackStateHash as reference} from './fixtures/trackStateHashReference.js';

function compare(value,budget) {
  const a=current(value), b=reference(value);
  while(!b.done){
    assert.equal(a.process(budget),b.process(budget));
    assert.equal(a.processedCharacters,b.processedCharacters);
    assert.equal(a.done,b.done);
  }
  assert.equal(a.checksum,b.checksum);
}
test('iterative hash retains exact checksum and character budgets for nested canonical payloads',()=>{
  let seed=513;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  const leaf=()=>[undefined,null,true,false,NaN,Infinity,-0,random()*1e8,'rain ☔ 雪 🚘\n"'][Math.floor(random()*10)];
  function value(depth){
    if(!depth || random()<.4)return leaf();
    return random()<.5?Array.from({length:Math.floor(random()*8)},()=>value(depth-1))
      :Object.fromEntries(Array.from({length:Math.floor(random()*8)},(_,i)=>['key'+(7-i),value(depth-1)]));
  }
  for(let i=0;i<1000;i++)compare(value(4),1+Math.floor(random()*257));
  compare({empty:[],hole:[,undefined,()=>{},Symbol('x')],omit:undefined,nested:{z:null,a:-Infinity}},1);
  const ownProto=Object.fromEntries([['__proto__',{x:1}],['2','two'],['10','ten']]);
  compare(ownProto,3);
});
test('iterative hash traverses deep input without recursive generator delegation',()=>{
  let value='bottom';
  for(let i=0;i<10000;i++)value={child:value};
  const task=current(value);
  while(!task.done)task.process(256);
  assert.match(task.checksum,/^[0-9a-f]{8}$/);
});
