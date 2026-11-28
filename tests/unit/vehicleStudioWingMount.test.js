import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

function winged(){
 const g=createFasciaDemo('compound');
 g.components.spoiler.type='wing';
 Object.assign(g.components.spoiler,{size:1.05,shape:.66,depth:1.10});
 Object.assign(g.construction.wing,{elevation:.108,spacing:.44});
 return g;
}
const mount=(g,supportMount)=>updateDesign(g,'construction','wing',{...g.construction.wing,supportMount});
const spoiler=(geometry,material)=>geometry.parts.filter(p=>p.component==='spoiler'&&p.material===material);
const average=(buffer,start,count)=>Array.from({length:count},(_,i)=>start+i).reduce((a,i)=>[
 a[0]+buffer.getX(i)/count,a[1]+buffer.getY(i)/count,a[2]+buffer.getZ(i)/count],[0,0,0]);

test('swan necks have mirrored feet and attach to one foil from above across preview and compact meshes',()=>{
 const baseline=winged(), g=mount({...baseline,construction:{...baseline.construction,wing:{...baseline.construction.wing,elements:2}}},'top');
 for(const compact of [0,1,3]){
  const alt=generateVehicle(g,{quality:compact?'drive':'preview',compact}),base=generateVehicle(baseline,{quality:compact?'drive':'preview',compact});
  try{
   assert.deepEqual(alt.diagnostics.issues,[]);
   assert.deepEqual(alt.aero.wing,{elements:1,supports:2,mount:'top'});
   const foil=spoiler(alt,'paint')[0].geometry;
   assert.deepEqual(foil.attributes.position.array,spoiler(base,'paint')[0].geometry.attributes.position.array);
   foil.computeBoundingBox();
   const supporters=spoiler(alt,'trim');assert.equal(supporters.length,2);
   const points=supporters.map(({geometry})=>{
    const buf=geometry.attributes.position,n=compact?6:8;
    const foot=average(buf,0,n),contact=average(buf,buf.count-n,n);
    assert.ok(foot[1]<foil.boundingBox.min.y-.1,'foot must reach down to deck');
    assert.ok(foot[2]>contact[2],'upright must stand ahead of the wing contact');
    assert.ok(contact[1]>=foil.boundingBox.min.y&&contact[1]<=foil.boundingBox.max.y+.002,'contact must land within the airfoil thickness');
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.max.y>foil.boundingBox.max.y+.040,'support must arch above the foil');
    return {foot,contact};
   });
   assert.ok(Math.abs(points[0].foot[0]+points[1].foot[0])<1e-6);
   assert.ok(Math.abs(points[0].contact[1]-points[1].contact[1])<1e-6);
   assert.deepEqual(alt.wheels,base.wheels);
   assert.deepEqual(alt.lampMounts,base.lampMounts);
  }finally {disposeDesign(alt);disposeDesign(base);}
 }
});

test('old designs retain under-wing supports; swan neck exports deterministically and cannot alter tuning or wheel art',()=>{
 const legacy=winged();delete legacy.construction.wing.supportMount;
 const g=mount(legacy,'top'),d=loadVehicle(serializeVehicle(g));
 assert.equal(d.construction.wing.supportMount,'top');
 assert.throws(()=>mount(legacy,'invalid'),/Wing support mount/);
 const a=exportVehicle(legacy),b=exportVehicle(g);
 assert.equal(a.genome.construction.wing.supportMount,'under');
 assert.deepEqual(a,exportVehicle(mount(legacy,'under')));
 assert.deepEqual(b,exportVehicle(d));
 assert.ok(b.metrics.carTriangles<=15000);
 assert.deepEqual(a.attachments,b.attachments);
 assert.deepEqual(a.car,b.car);
 assert.deepEqual(Object.values(a.models)[1],Object.values(b.models)[1]);
});
