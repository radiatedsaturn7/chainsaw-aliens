import test from 'node:test';
import assert from 'node:assert/strict';
import {worldMapNodes,worldMapNodePoint,worldMapNodeRadius} from '../../src/menus/MenuWorldMap.js';

test('automatic world map nodes keep the full selection ring inside portrait and wide bounds',()=>{
 for(const b of [{x:20,y:60,w:318,h:121},{x:50,y:80,w:864,h:329}]){
  const resources={choices:()=>Array.from({length:24},(_,i)=>({value:`race-${i}`,label:`Race ${i}`}))};
  for(const node of worldMapNodes({nodes:[]},resources,{},{})){
   const p=worldMapNodePoint(node,b),r=worldMapNodeRadius(b)+6.5;
   assert.ok(p.x-r>=b.x&&p.x+r<=b.x+b.w);
   assert.ok(p.y-r>=b.y&&p.y+r<=b.y+b.h);
  }
 }
});
test('authored edge nodes are inset while interior positions are preserved',()=>{
 const b={x:10,y:20,w:800,h:400};
 assert.deepEqual(worldMapNodePoint({x:.5,y:.5},b),{x:410,y:202});
 for(const node of [{x:0,y:0},{x:1,y:1}]){
  const p=worldMapNodePoint(node,b),r=worldMapNodeRadius(b)+6.5;
  assert.ok(p.x-r>=b.x&&p.x+r<=b.x+b.w&&p.y-r>=b.y&&p.y+r<=b.y+b.h);
 }
});
