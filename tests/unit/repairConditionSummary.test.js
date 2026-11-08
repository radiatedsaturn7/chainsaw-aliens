import test from 'node:test';
import assert from 'node:assert/strict';
import {repairConditionSummary,repairConditionColor,repairRows,normalizeCarCondition} from '../../src/garage/GarageRepairs.js';
import {tuningMenu} from '../../src/garage/GarageMenuTree.js';
import {drawGarageTuner} from '../../src/menus/MenuTuningRenderer.js';

test('repair rollups count each component once across uneven nested groups',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:i<3?'oil'+i:'internal'+i,label:'Part '+i,repair:true,enabled:true,value:i===0?20:100}));
 rows.push({id:'tire_fl',label:'Front tire',repair:true,enabled:true,value:100});
 const tree=tuningMenu(rows,'repair'),engine=tree.find(r=>r.label==='Engine');
 assert.equal(engine.conditionSummary.count,12);
 assert.equal(engine.conditionSummary.average,1120/12);
 assert.equal(engine.conditionSummary.worst,20);
 assert.equal(repairConditionColor(engine.conditionSummary.worst),'#ef4444');
 assert.ok(engine.children.some(r=>r.children));
 const calls=[],ctx=new Proxy({fillText(text){calls.push({text,color:this.fillStyle});},measureText(text){return {width:text.length*6};}},{get:(o,k)=>k in o?o[k]:(()=>{})});
 for(const b of [{x:0,y:0,w:900,h:460},{x:0,y:0,w:350,h:210}]){
  drawGarageTuner(ctx,b,{mode:'list',index:0,rowIndex:0,pathLabels:()=>[],sectionRows:()=>tree,row:engine});
  assert.ok(calls.some(c=>c.text==='93%'&&c.color==='#ef4444'));
 }
 rows[0].value=100;
 assert.deepEqual(tuningMenu(rows,'repair')[0].conditionSummary,{average:100,worst:100,count:12});
});
test('condition colors use strict worst-part thresholds',()=>{
 for(const [value,color] of [[100,'#4ade80'],[75,'#4ade80'],[74.99,'#facc15'],[50,'#facc15'],[49.99,'#f97316'],[25,'#f97316'],[24.99,'#ef4444'],[0,'#ef4444']])assert.equal(repairConditionColor(value),color);
});
test('all/service rollups avoid duplicate parts and expose depleted fluid warning',()=>{
 const condition=normalizeCarCondition();condition.mechanical.oil=.2;
 const garage={configuration:()=>({condition}),items:{progress:{bags:{items:{}}}}};
 const rows=repairRows(garage,'car',{}),all=rows.find(r=>r.id==='all'),service=rows.find(r=>r.id==='service');
 assert.equal(service.value,84);assert.equal(service.conditionSummary.worst,20);
 assert.equal(all.conditionSummary.count,rows.length-2);
 assert.equal(all.conditionSummary.worst,20);
 assert.deepEqual(repairConditionSummary(rows),all.conditionSummary);
 assert.deepEqual(tuningMenu(rows,'repair').find(r=>r.label==='Service').conditionSummary,service.conditionSummary);
 condition.mechanical.oil=1;
 assert.equal(repairRows(garage,'car',{})[0].value,100);
});
