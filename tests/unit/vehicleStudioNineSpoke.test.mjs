import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('9-spoke factory alloy uses one cast wheel with nine blades, not a 10-spoke fallback',()=>{
 const id='audi-rs4-b5-avant-2001';
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
 const opts={quality:'drive',compact:3};
 const original=buildWheels(g,opts);
 const alloy=original.filter(x=>x.material==='wheel');
 assert.equal(alloy.length,11,'nine independent cast radial blades plus rim and hub');
 const other=structuredClone(g);other.components.wheels.type='8-spoke';
 const alternative=buildWheels(other,opts);
 assert.equal(alternative.filter(x=>x.material==='wheel').length,10);
 const tire=a=>a.find(p=>p.material==='rubber').geometry.attributes.position.array;
 assert.deepEqual(tire(original),tire(alternative),'tire wear surface and wheel radius unchanged');
 const out=exportVehicle(g,{quality:'drive'});
 assert.ok(out.metrics.carTriangles<=15000);
 const restored=loadVehicle(serializeVehicle(g));
 assert.equal(restored.components.wheels.type,'9-spoke');
 assert.deepEqual(exportVehicle(restored,{quality:'drive'}),out);
});
