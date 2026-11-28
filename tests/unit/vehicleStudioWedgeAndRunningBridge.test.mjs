import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';

function load(id){
 return loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
}

test('Focus wedge lamps peak at outboard shoulders on both mirrored openings',()=>{
 for(const id of ['ford-focus-se-sedan-2002','ford-focus-svt-zx3-2003']){
  const g=load(id);
  assert.equal(g.optics.front.housing,'high-outer wedge');
  const lamps=makeOpenings({end:'front',g}).filter(o=>o.kind==='lamp');
  assert.equal(lamps.length,2);
  for(const lamp of lamps){
   const highest=lamp.outline.reduce((a,b)=>a[1]<b[1]?a:b);
   assert.ok((highest[0]-lamp.center[0])*lamp.side>.03);
  }
  for(let i=0;i<lamps[0].outline.length;i++){
   const a=lamps[0].outline[i],b=lamps[1].outline[i];
   assert.ok(Math.abs(a[0]+b[0]-1)<1e-7);
   assert.equal(a[1],b[1]);
  }
 }
});

test('A taller rear lamp bridge remains separate from the side housings and retains the old section at zero',()=>{
 const g=load('buick-lesabre-custom-2002');
 const parts=()=>makeOpenings({end:'rear',g});
 const bridge=()=>parts().find(o=>o.id==='rear-running-bridge');
 const active=bridge();
 assert.equal(active.height,.112);
 for(const lamp of parts().filter(o=>o.kind==='lamp')){
  const towardsCenter=o=>o.outline.map(([x])=>Math.abs(x-.5));
  assert.ok(Math.min(...towardsCenter(lamp))-Math.max(...towardsCenter(active))>=.014-1e-6);
 }
 g.fascia.rear.tailBridgeHeight=0;
 assert.equal(bridge().height,.020);
 assert.ok(active.center[1]>bridge().center[1]);
});
