import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,updateDesign,serializeVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const run=(g)=>generateVehicle(g,{quality:'drive',compact:1});
const of=(d,c,m)=>d.parts.filter(p=>p.component===c&&(!m||p.material===m));
const bound=p=>{p.geometry.computeBoundingBox();return p.geometry.boundingBox;};
test('roadster mode leaves a fixed windshield and cockpit, removes covered roof and side/back glazing',()=>{
 const g=createFasciaDemo('compound');g.construction.cabin.layout='front-only';
 const q=updateDesign(g,'components','roof','roadster open','type');
 const a=run(g),b=run(q);
 try{
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.equal(of(a,'glass').length,4);
  assert.equal(of(b,'glass').length,1);
  assert.deepEqual(of(b,'glass')[0].geometry.attributes.position.array,of(a,'glass').sort((p,q)=>bound(q).min.z-bound(p).min.z)[0].geometry.attributes.position.array);
  assert.equal(of(b,'roof','paint').length,0);
  assert.equal(of(b,'roof','trim').length,1);
  assert.ok(bound(of(b,'roof','trim')[0]).max.y<bound(of(a,'roof')[0]).min.y-.10,'folded top must live below the roofline');
  assert.equal(b.cabin.capacity,a.cabin.capacity);
  assert.deepEqual(b.wheels,a.wheels);
  assert.deepEqual(b.lampMounts,a.lampMounts);
 }finally {disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(q),y=exportVehicle(g);
 assert.ok(x.metrics.carTriangles<=15000);
 assert.deepEqual(x.car,y.car);
 assert.deepEqual(x.attachments,y.attachments);
 assert.deepEqual(x,exportVehicle(loadVehicle(serializeVehicle(q))));
});
test('upper lamps cut two hood apertures and suppress bumper-face lenses without changing beam joints',()=>{
 const g=createFasciaDemo('compound');
 const q=updateDesign(g,'construction','hood',{...g.construction.hood,lampLids:'inset',lidWidth:.20,lidLength:.36,lidSpread:.34});
 const a=run(g),b=run(q);
 try {
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.ok(a.fascia.front.openings.some(o=>o.component==='headlights'));
  assert.ok(!b.fascia.front.openings.some(o=>o.component==='headlights'));
  assert.equal(b.fascia.front.trimArea.unmatched,0);
  const lenses=of(b,'headlights','opticCover');assert.equal(lenses.length,2);
  assert.equal(of(b,'headlights','projector').length,2);
  assert.ok(Math.min(...lenses.map(p=>bound(p).min.y))>Math.max(...of(a,'headlights','opticCover').map(p=>bound(p).min.y))+.09);
  assert.ok(bound(lenses[0]).max.x<0&&bound(lenses[1]).min.x>0);
  assert.deepEqual(b.lampMounts,a.lampMounts);
  assert.deepEqual(b.wheels,a.wheels);
 }finally{disposeDesign(a);disposeDesign(b);}
 const x=exportVehicle(q),y=exportVehicle(g);
 assert.deepEqual(x.car,y.car);assert.deepEqual(x.attachments,y.attachments);assert.ok(x.metrics.carTriangles<=15000);
 assert.deepEqual(x,exportVehicle(loadVehicle(serializeVehicle(q))));
});
