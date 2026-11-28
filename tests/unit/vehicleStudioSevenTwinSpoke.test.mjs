import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('seven twin spokes cluster as seven splayed pairs without changing the tire',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/audi-rs7-c7-sportback-2013.json',import.meta.url),'utf8'));
 const opts={quality:'drive',compact:3},a=buildWheels(g,opts);
 const spokes=a.filter(p=>p.material==='wheel').slice(2);
 assert.equal(spokes.length,14);
 const angles=spokes.map(p=>{const q=p.geometry.attributes.position;return Math.atan2(q.getZ(7),q.getY(7));});
 const sorted=angles.map(x=>(x+2*Math.PI)%(2*Math.PI)).sort((x,y)=>x-y);
 const gaps=sorted.map((x,i)=>((sorted[(i+1)%14]-x+2*Math.PI)%(2*Math.PI)));
 assert.equal(gaps.filter(g=>g<.33).length,7);
 assert.equal(gaps.filter(g=>g>.54).length,7);
 const old=structuredClone(g);old.components.wheels.type='15-spoke';
 const tire=xs=>xs.find(p=>p.material==='rubber').geometry.attributes.position.array;
 assert.deepEqual(tire(a),tire(buildWheels(old,opts)));
 const result=exportVehicle(g,{quality:'drive'});
 assert.ok(result.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),result);
});
