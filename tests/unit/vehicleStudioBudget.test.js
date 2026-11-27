import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,newOutlet} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';
const count=e=>{
 const [body,wheel]=Object.values(e.models);
 const n=body.faces.length+4*wheel.faces.length;
 assert.equal(e.metrics.carTriangles,n);
 assert.equal(e.metrics.bodyTriangles,body.faces.length);
 assert.equal(e.metrics.wheelTriangles,wheel.faces.length);
 return n;
};
test('all four Studio style presets export gameplay bundles with four measured wheels below the 15,000 cap',()=>{
 for(const key of ['classic','rally','hyper','compound']){
  const g=createFasciaDemo(key),drive=exportVehicle(g);
  assert.equal(drive.metrics.quality,'drive');
  assert.equal(drive.metrics.triangleBudget,GAMEPLAY_TRIANGLE_BUDGET);
  assert.ok(count(drive)<=15000,key);
  assert.ok(count(exportVehicle(g,{quality:'opponent'}))<=15000,key+' opponent');
 }
});
test('wrapped lights, boxed wing, fluted bowls, a third row and trim survive a deterministic capped export',()=>{
 const g=createFasciaDemo('rally');
 Object.assign(g.optics.front,{sideWrap:.9,layout:'factory-split',flutedBowls:.9,roundBowls:.9,modules:6});
 Object.assign(g.optics.rear,{sideWrap:.8,layout:'factory-split',silverUpper:1,modules:6});
 Object.assign(g.fascia.rear,{plateMount:.9,paintedPocket:1,deckPanel:.65,terminalTuck:.07,cornerTuck:.05,valanceRise:.09});
 Object.assign(g.construction.cabin,{layout:'three-row',rearPillarFoot:.15});
 g.components.spoiler.type='boxed wing';g.components.mirrors.type='folded rectangle';g.components.handles.type='painted lever';
 g.construction.exhaust=[newOutlet('left',-.43,2),newOutlet('right',.43,2)];
 const e=exportVehicle(g),again=exportVehicle(loadVehicle(serializeVehicle(g)));
 assert.deepEqual(e,again);assert.ok(count(e)<=15000);
 const [body,wheel]=Object.values(e.models),slots=new Set(body.faces.map(f=>f.component));
 for(const part of ['headlights','tails','frontBumper','trunk','spoiler','seats','underbody','mirrors'])assert.ok(slots.has(part),part);
 for(const slot of ['HeadlightMount_L','TaillightMount_R','WheelMount_FL','WheelMount_RR'])assert.ok(e.attachments[slot],slot);
 assert.ok(wheel.faces.some(f=>f.component==='tires'));
 assert.ok(count(exportVehicle(g,{quality:'preview'}))>count(e));
});
