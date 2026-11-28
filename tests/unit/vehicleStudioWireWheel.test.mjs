import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
test('cross-laced spokes are two true compact banks inside the unchanged wheel envelope',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/aston-martin-db5-uk-1964.json',import.meta.url),'utf8'));
 const old=structuredClone(g);old.components.wheels.type='mesh';
 assert.notEqual(createVehicle().components.wheels.type,'wire cross-laced');
 const geometry=(v,detail)=>{const realized=[];buildWheels(v,{quality:detail?'garage':'drive',compact:detail?0:2,emit:(comp,mat,geo)=>realized.push({comp,mat,geo})});return realized;};
 const compact=geometry(g,false),showroom=geometry(g,true);
 const rods=arr=>arr.filter(p=>p.geo.type==='CylinderGeometry'&&p.mat==='wheel');
 assert.equal(rods(compact).length,24);
 assert.equal(rods(showroom).length,48);
 for(const {geo} of rods(compact)){
  geo.computeBoundingBox();
  assert.ok(geo.boundingBox.max.x<g.dimensions.tireWidth*.5);
  assert.ok(geo.boundingBox.min.x>-g.dimensions.tireWidth*.5);
 }
 const body=(v)=>generateVehicle(v,{quality:'drive',compact:2});
 assert.deepEqual(body(g).wheels,body(old).wheels);
 assert.deepEqual(body(g).lampMounts,body(old).lampMounts);
 const [frame,wheel]=Object.values(exportVehicle(g,{quality:'drive'}).models);
 assert.ok(frame.faces.length+2*(wheel.faces.length+(wheel.rearAxleModel?.faces.length??wheel.faces.length))<=15000);
});
