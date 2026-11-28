import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
const slots=['head','signalL','signalR'];
const verts=(d)=>d.parts.filter(x=>x.component==='headlights'&&slots.includes(x.material));
test('active inset optics use separate left and right hood cavities without changing existing inset surfaces or beam mounts',()=>{
 const g=createVehicle('fastback');
 g.components.fogs.type='off';
 Object.assign(g.construction.hood,{lampLids:'inset',insetLampMounts:1,lidWidth:.28,lidLength:.31,lidSpread:.33,lidSetback:.051,lampPodRise:.057});
 const before=generateVehicle(g,{quality:'drive',compact:2});
 assert.equal(verts(before).length,0);
 g.construction.hood.activeInsetLamps=1;
 const option=loadVehicle(JSON.stringify(g));assert.equal(option.construction.hood.activeInsetLamps,1);
 const after=generateVehicle(option,{quality:'drive',compact:2}), parts=verts(after);
 assert.equal(parts.filter(p=>p.material==='head').length,2);
 for(const [m,sign] of [['signalL',-1],['signalR',1]]){
  const p=parts.find(x=>x.material===m).geometry.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(p.getX(i)*sign>0.30, m+' stayed inside its side of the hood');
 }
 const hood=(d)=>d.parts.filter(p=>p.component==='hood').map(p=>Array.from(p.geometry.attributes.position.array));
 assert.deepEqual(hood(before),hood(after));
 assert.deepEqual(before.lampMounts,after.lampMounts);
 assert.deepEqual(before.wheels,after.wheels);
 disposeDesign(before);disposeDesign(after);
});
