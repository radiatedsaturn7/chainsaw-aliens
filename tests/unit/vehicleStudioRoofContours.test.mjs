import test from 'node:test';
import assert from 'node:assert/strict';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {createVehicle,serializeVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const cabinParams={roofShoulderTaper:.105,screenShoulderRoll:.117,centerPillarLean:.082};
const feature=(d,key)=>d.features.find(f=>f.id===key).points;
function centerPillar(d) {
 const part=d.parts.find(p=>p.component==='pillars'&&p.material==='trim'&&p.geometry.attributes.position.getX(0)<0&&Math.abs(p.geometry.attributes.position.getZ(0))<.32);
 const v=part.geometry.attributes.position;
 return {foot:v.getZ(0),top:v.getZ(v.count-2)};
}
test('real roof contour rolls rails inward but leaves chassis, header height and door feet rooted',()=>{
 const base=createVehicle('sedan'), fit=structuredClone(base); Object.assign(fit.construction.cabin,cabinParams);
 const b=generateVehicle(base,{quality:'drive',compact:2}), a=generateVehicle(fit,{quality:'drive',compact:2});
 try{
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.stations,b.stations);
  assert.deepEqual(a.lampMounts,b.lampMounts);
  const rail=feature(a,'roof-L'),old=feature(b,'roof-L');
  for(const i of [0,26]){
   assert(Math.abs(old[i][0])-Math.abs(rail[i][0])>.099,'roof corner tumbles inward from its original wide edge');
   assert(rail[i][1]<old[i][1]-.038,'roof corner lowers without flattening center crown');
  }
  assert(Math.abs(old[13][0])-Math.abs(rail[13][0])<.035,'roof center has graduated rather than uniform taper');
  const A=centerPillar(a),B=centerPillar(b);
  assert.equal(A.foot,B.foot);
  assert.ok(A.top>B.top+.07,'upper B-pillar path moves independently');
  assert.deepEqual(a.diagnostics.issues,[]);
 }finally{disposeDesign(a);disposeDesign(b);}
 const reloaded=loadVehicle(serializeVehicle(fit));
 assert.equal(reloaded.construction.cabin.roofShoulderTaper,cabinParams.roofShoulderTaper);
 assert.deepEqual(exportVehicle(reloaded).models,exportVehicle(fit).models);
 assert.ok(exportVehicle(fit).metrics.carTriangles<=15000);
});
test('new greenhouse geometry defaults to exactly the normalized legacy mesh',()=>{
 const g=createVehicle('sedan'), untouched=structuredClone(g);
 for(const k of Object.keys(cabinParams))delete untouched.construction.cabin[k];
 assert.deepEqual(exportVehicle(untouched).models,exportVehicle(g).models);
});
