import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadVehicle, createVehicle } from '../../src/ui/vehicleStudio/genome.mjs';
import { generateVehicle } from '../../src/ui/vehicleStudio/geometry.mjs';

const read=id=>readFile(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8').then(loadVehicle);
const panes=d=>d.parts.filter(p=>p.component==='roof'&&p.material==='glass');
const vents=d=>d.parts.filter(p=>p.component==='trunk'&&p.geometry.userData.constructionRole==='raised engine-deck louver');
test('solid roof, one-piece sunroof and T-bar are separate fitted roofs, with opt-in SC deck louvers',async()=>{
 const inputs=await Promise.all(['toyota-mr2-aw11-na','toyota-mr2-aw11-sc','toyota-mr2-sw20-uk'].map(read));
 assert.equal(createVehicle().construction.cabin.roofGlazing,0);
 assert.equal(createVehicle().construction.cabin.raisedEngineLid,0);
 const results=inputs.map(g=>generateVehicle(g,{quality:'drive',compact:1}));
 assert.deepEqual(results.map(d=>panes(d).length),[0,2,1]);
 assert.deepEqual(results.map(d=>vents(d).length),[0,8,0]);
 const glass=panes(results[1]);
 for(const p of glass)p.geometry.computeBoundingBox();
 const boxes=glass.map(p=>p.geometry.boundingBox).sort((a,b)=>a.min.x-b.min.x);
 assert.ok(boxes[0].max.x<-.035&&boxes[1].min.x>.035,'a real center rail separates the two glass panes');
 const unvented=structuredClone(inputs[1]);
 unvented.construction.cabin.raisedEngineLid=0;
 const low=generateVehicle(unvented,{quality:'drive',compact:1});
 const peak=d=>Math.max(...d.parts.filter(p=>p.component==='trunk'&&p.material==='paint').map(p=>{
  p.geometry.computeBoundingBox();return p.geometry.boundingBox.max.y;
 }));
 assert.ok(peak(results[1])>=peak(low)+.015);
 for(const [i,d] of results.entries())assert.equal(d.diagnostics.issues.length,0,'design '+i);
});
