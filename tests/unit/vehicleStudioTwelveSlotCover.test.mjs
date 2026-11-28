import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';
const build=(type)=>{
 const g=createVehicle('sedan');g.components.wheels.type=type;
 const model=loadVehicle(JSON.stringify(g));
 const buffers=[];
 buildWheels(model,{quality:'drive',compact:2,emit:(com,mat,geo)=>{buffers.push({mat,bounds:geo.computeBoundingBox()??geo.boundingBox.clone()});geo.dispose()}});
 return buffers;
};
test('the narrow silver wheel cover has twelve separate slots and unchanged tire bounds',()=>{
 const normal=build('stamped steel'),cover=build('12-slot steel cover');
 assert.equal(cover.filter(p=>p.mat==='seamDark').length,12);
 const tire=p=>p.find(v=>v.mat==='rubber').bounds;
 assert.deepEqual(tire(normal),tire(cover));
});
