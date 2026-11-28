import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
test('optional center instruments relocate the binnacle without relocating the driver controls',()=>{
 const g=createVehicle('sedan');
 const standard=generateVehicle(g,{quality:'drive',compact:1});
 g.construction.cabin.centerInstruments=1;
 const copy=loadVehicle(JSON.stringify(g));
 assert.equal(copy.construction.cabin.centerInstruments,1);
 const centered=generateVehicle(copy,{quality:'drive',compact:1});
 const cluster=(p)=>{
  const binnacle=p.parts.find(x=>x.component==='instruments'&&x.material==='interior');
  binnacle.geometry.computeBoundingBox();
  const {min,max}=binnacle.geometry.boundingBox;
  return {x:(min.x+max.x)/2,y:(min.y+max.y)/2};
 };
 assert.ok(cluster(standard).x<-.2);
 assert.ok(Math.abs(cluster(centered).x)<.014);
 assert.ok(Math.abs(cluster(centered).x-cluster(standard).x+standard.cabin.steeringCenter[0])<1e-6);
 assert.ok(cluster(centered).y>cluster(standard).y+.025);
 for(const k of ['driverEye','steeringCenter','pedalCenters','seats'])assert.deepEqual(centered.cabin[k],standard.cabin[k]);
 assert.deepEqual(centered.wheels,standard.wheels);
 assert.equal(centered.cabin.triangles,standard.cabin.triangles);
 disposeDesign(standard);disposeDesign(centered);
});
