import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';

test('a front bench does not put the driver and controls in the center',()=>{
 const g=createVehicle('sedan');
 g.construction.cabin.frontBench=1;
 const designs=[];
 try{
  for(const [side,sign] of [['left',-1],['right',1]]){
   g.construction.cabin.driverSide=side;
   const d=generateVehicle(g,{quality:'drive',compact:1});
   designs.push(d);
   assert.equal(d.cabin.rows[0].count,3);
   assert.ok(sign*d.cabin.steeringCenter[0]>.14);
   assert.equal(d.cabin.driverEye[0],d.cabin.steeringCenter[0]);
   assert.ok(d.cabin.pedalCenters.every(p=>sign*p[0]>.04));
  }
  assert.deepEqual(designs[0].wheels,designs[1].wheels);
 }finally{designs.forEach(disposeDesign);}
});
