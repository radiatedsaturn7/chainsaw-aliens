import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=key=>loadVehicle(fs.readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+key+'.json',import.meta.url),'utf8'));
function validate(g){
 const d=generateVehicle(g);
 try{assert.deepEqual(d.diagnostics.issues,[]);assert.deepEqual(d.diagnostics.warnings,[]);}finally{disposeDesign(d);}
 const e=exportVehicle(g,{quality:'drive'});
 assert(e.metrics.carTriangles<=15000);assert.equal(e.metrics.carTriangles,e.metrics.bodyTriangles+4*e.metrics.wheelTriangles);
 return Object.values(e.models)[0].faces;
}
test('C4 hatch-edge lights flank both rear panes instead of staying in the bumper',()=>{
 const g=load('citroen-c4');
 assert.equal(g.optics.rear.housing,'upright-wrap');
 assert(g.optics.rear.sideWrap>0);
 assert.equal(g.optics.rear.layout,'factory-split');
 assert.equal(loadVehicle(serializeVehicle(g)).construction.cabin.rearHatchFold,1);
 const d=generateVehicle(g);
 try{
  assert(!d.fascia.rear.openings.some(o=>o.component==='tails'));
  assert.equal(d.features.filter(x=>x.type==='lamp'&&x.end==='rear').length,2);
  const mounted=Object.entries(d.lampMounts).filter(([k])=>k.startsWith('TaillightMount_')).map(([,p])=>p);
  assert.equal(mounted.length,2);
  assert.ok(mounted.every(([x,y])=>Math.abs(x)>.5&&y>g.dimensions.height*g.dimensions.belt));
 }finally{disposeDesign(d);}
 const f=validate(g);
 for(const material of ['opticRed','runningRed','opticClear'])
  assert(f.some(x=>x.component==='tails'&&x.material==='studio-mat-'+material));
 assert(f.some(x=>x.component==='glass'&&x.material==='studio-mat-seamDark'));
});
test('Carnival gets geometry-matched applique and sliding track without losing seventh seat',()=>{
 const g=load('kia-carnival');
 assert(loadVehicle(serializeVehicle(g)).construction.cabin.vanSideTrim>0);
 const d=generateVehicle(g);
 try{assert.equal(d.cabin.capacity,7);}finally{disposeDesign(d);}
 const f=validate(g);
 assert(f.some(x=>x.component==='pillars'&&x.material==='studio-mat-chrome'));
 assert(f.some(x=>x.component==='rearFenders'&&x.material==='studio-mat-seamDark'));
});
