import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {disposeDesign,generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';

test('cab-forward face moves the glass forward with distinct high turn apertures and seven seats',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/volkswagen-bus-latebay-1978.json',import.meta.url),'utf8'));
 const van=generateVehicle(g,{quality:'drive',compact:3});
 g.construction.cabin.cabForwardFace=0;
 const legacy=generateVehicle(g,{quality:'drive',compact:3});
 try{
  assert.equal(van.cabin.capacity,7);
  assert.deepEqual(van.cabin.rows.map(r=>r.count),[2,2,3]);
  assert.deepEqual(van.diagnostics.issues,[]);
  const {cabinFront,roofFront}=van.stations;
  assert.ok(g.dimensions.wheelbase/2+g.dimensions.front-cabinFront<.30);
  assert.ok(cabinFront-roofFront>.05&&cabinFront-roofFront<.10);
  assert.ok(cabinFront>legacy.stations.cabinFront+.20);
  const a=van.fascia.front.openings;
  const ambers=a.filter(o=>o.id.startsWith('high-signal-'));
  const eyes=a.filter(o=>/^head[lr-]/.test(o.id));
  assert.equal(eyes.length,2);
  assert.equal(ambers.length,2);
  assert.ok(!legacy.fascia.front.openings.some(o=>o.id.startsWith('high-signal-')));
  const flank=o=>Math.sign(o.outline.reduce((sum,p)=>sum+p[0]-.5,0));
  for(const amber of ambers){
   const eye=eyes.find(o=>flank(o)===flank(amber));
   assert.ok(eye);
   assert.ok(Math.min(...eye.outline.map(p=>p[1]))-Math.max(...amber.outline.map(p=>p[1]))>.021);
  }
  assert.deepEqual(van.wheels,legacy.wheels);
 }finally{disposeDesign(van);disposeDesign(legacy);}
});
