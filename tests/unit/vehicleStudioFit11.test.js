import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign,OPTIC_HOUSINGS} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('rounded twin-bowl is an editable, scale-safe and mirrored lens housing',()=>{
 const initial=createFasciaDemo('rally');
 const newDesign=updateDesign(initial,'optics','front','round-twin','housing');
 assert.equal(OPTIC_HOUSINGS['round-twin'],'Rounded twin-bowl');
 assert.equal(newDesign.optics.front.housing,'round-twin');
 assert.equal(loadVehicle(serializeVehicle(newDesign)).optics.front.housing,'round-twin');
 const factory=updateDesign(newDesign,'optics','front','factory-split','layout');
 assert.equal(factory.optics.front.housing,'round-twin','outline is independent of the internal optics layout');
 const openings=makeOpenings({end:'front',g:factory}).filter(v=>v.kind==='lamp');
 assert.equal(openings.length,2);
 for(let i=0;i<openings[0].outline.length;i++){
  const [x,y]=openings[0].outline[i],[mx,my]=openings[1].outline[i];
  assert.ok(Math.abs(x+mx-1)<1e-9&&Math.abs(y-my)<1e-9);
 }
 assert.notDeepEqual(openings[0].outline,makeOpenings({end:'front',g:initial})[0].outline);
 const geometry=generateVehicle(factory,{quality:'drive'});
 try {
  assert.equal(geometry.fascia.front.trimArea.unmatched,0);
  assert.deepEqual(geometry.diagnostics.issues,[]);
 } finally {disposeDesign(geometry);}
 const result=exportVehicle(factory);
 assert.ok(result.metrics.carTriangles<=15000);
 const models=Object.values(result.models);
 assert.ok(models[0].materials.some(m=>m.name.startsWith('[studio9:head]')));
 assert.ok(models[0].materials.some(m=>m.name.startsWith('[studio9:brake]')));
 assert.ok(models[0].materials.some(m=>m.name.startsWith('[studio9:reverse]')));
 assert.deepEqual(result,exportVehicle(loadVehicle(serializeVehicle(factory))));
});
