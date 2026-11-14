import test from 'node:test';
import assert from 'node:assert/strict';
import {layerRoadside} from '../../tools/campaigns/layered_roadside.mjs';
const definition=ref=>({widthM:/tree/.test(ref)?5:1,heightM:/tree/.test(ref)?8:1,defaultRule:{behavior:'flatten'}});
function fixture(){
 const race={id:'woodland',name:'Woodland',road:{width:7,segments:[{surface:'asphalt'}]},scenery:Array.from({length:50},(_,i)=>({id:'original-'+i,doodadRef:i%2?'local-tree':'local-bush',x:i%2?70:-70,z:i*20,widthM:3,trackDistance:i*20,trackLateral:70}))};
 const helpers={length:1000,definition,pose:d=>({x:0,z:d,yaw:0,elevation:0,segment:{roadWidthM:7}}),project:p=>({distance:p.z,lateral:p.x}),ground:()=>0,hasGround:()=>true};
 return {race,helpers};
}
test('layered vegetation reaches four times baseline and repeats without accumulating',()=>{
 const {race,helpers}=fixture();const report=layerRoadside(race,helpers);
 assert.equal(report.multiplier,4);assert.equal(race.scenery.length,200);
 const before=structuredClone(race.scenery);layerRoadside(race,helpers);assert.deepEqual(race.scenery,before);
 for(const p of race.scenery.filter(p=>p.ecologyLayer)){
  const edge=Math.abs(p.x)-3.5-p.widthM/2;
  if(p.ecologyLayer==='verge'){assert.ok(p.heightM<=.82);assert.ok(edge>=1.59&&edge<=10.61);}
  if(p.ecologyLayer==='shrub')assert.ok(edge>=9.99);
  if(p.ecologyLayer==='canopy')assert.ok(edge>=31.99);
 }
 assert.equal(report.hazards.length,0,'a straight is not an apex hazard');
});
test('water and missing terrain never receive generated vegetation',()=>{
 const {race,helpers}=fixture();helpers.hasGround=()=>false;
 const report=layerRoadside(race,helpers);assert.equal(report.added,0);assert.equal(report.status,'space-limited');
});
