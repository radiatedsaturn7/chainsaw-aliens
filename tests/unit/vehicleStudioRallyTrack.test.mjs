import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVehicle,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';

test('Group 4 rear track is authored at the stock offset without changing the standard default',()=>{
 const input=readFileSync(new URL('../../src/ui/vehicleStudio/examples/renault-5-turbo-monte-1981.json',import.meta.url),'utf8');
 const g=loadVehicle(serializeVehicle(loadVehicle(input)));
 assert.equal(createVehicle().dimensions.rearTrackBias,0);
 assert.ok(Math.abs(g.dimensions.rearTrackBias-.130)<1e-7);
 const mesh=generateVehicle(g,{quality:'drive',compact:3});
 try{
  const {fl,fr,rl,rr}=mesh.wheels;
  assert.ok(Math.abs((fr[0]-fl[0])-1.350)<1e-7);
  assert.ok(Math.abs((rr[0]-rl[0])-1.480)<1e-7);
  assert.deepEqual(mesh.diagnostics.issues,[]);
 }finally{disposeDesign(mesh);}
});
