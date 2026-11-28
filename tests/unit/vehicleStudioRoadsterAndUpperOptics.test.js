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

test('paired raised lamp pods raise both inset projectors without changing wheel or beam mounts',()=>{
 const g=createFasciaDemo('compound');
 g.construction.hood={...g.construction.hood,lampLids:'inset',lidWidth:.245,lidLength:.37,lidSpread:.35,lidSetback:.06};
 const stock=run(g),raised=run(updateDesign(g,'construction','hood',{...g.construction.hood,lampPodRise:.108}));
 try{
  assert.deepEqual(raised.diagnostics.issues,[]);
  const lenses=q=>of(q,'headlights','opticCover').map(bound);
  const a=lenses(stock),b=lenses(raised);
  assert.equal(b.length,2);
  for(let i=0;i<2;i++)assert.ok(b[i].max.y-a[i].max.y>.035);
  assert.deepEqual(raised.wheels,stock.wheels);
  assert.deepEqual(raised.lampMounts,stock.lampMounts);
  const position=p=>p.geometry.attributes.position;
  const key=(x,i)=>[x.getX(i),x.getY(i),x.getZ(i)].map(v=>v.toFixed(5)).join(',');
  const skin=new Set(of(raised,'hood','paint').flatMap(p=>{
   const a=position(p);return Array.from({length:a.count},(_,i)=>key(a,i));
  }));
  for(const p of of(raised,'headlights','seamDark')){
   const ring=position(p);
   assert.ok(Array.from({length:ring.count/3},(_,i)=>key(ring,i)).every(k=>skin.has(k)));
  }
 }finally{disposeDesign(stock);disposeDesign(raised);}
});
