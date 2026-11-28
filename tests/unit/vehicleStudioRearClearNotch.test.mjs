import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';

const build=(notch)=>{
 const g=createVehicle('sedan');
 Object.assign(g.optics.rear,{housing:'upright-wrap', layout:'factory-split', rearCells:1, silverUpper:1, height:.78, width:.72, rearClearNotch:notch});
 const copy=loadVehicle(JSON.stringify(g));
 assert.equal(copy.optics.rear.rearClearNotch,notch);
 const openings=makeOpenings({end:'rear',g:copy}),parts=[];
 const surface=(u,v)=>[(u-.5)*1.78,1-v*.57,-(2.1-(u-.5)**2*.32)];
 const {mounts,issues}=emitOpenings({end:'rear',openings,surface,put:(component,material,geometry)=>parts.push({component,material,positions:Array.from(geometry.attributes.position.array)})});
 assert.ok(issues.length===0);
 return {outline:openings.map(o=>o.outline),parts,mounts};
};
test('rear clear notch changes the passive chamber without changing housing, lamp mounts or active masks',()=>{
 const without=build(0),withNotch=build(.72);
 assert.deepEqual(without.outline,withNotch.outline);
 assert.deepEqual(without.mounts,withNotch.mounts);
 const active=new Set(['brakeRed','runningRed','reverseWhite','signalL','signalR']);
 assert.deepEqual(without.parts.filter(p=>active.has(p.material)),withNotch.parts.filter(p=>active.has(p.material)));
 assert.notDeepEqual(withNotch.parts.filter(p=>p.material==='opticRed'),without.parts.filter(p=>p.material==='opticRed'));
 assert.notDeepEqual(withNotch.parts.filter(p=>p.material==='opticClear'),without.parts.filter(p=>p.material==='opticClear'));
});
