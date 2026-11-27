import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,createFasciaDemo,updateDesign,serializeVehicle,loadVehicle,newOutlet,newStyle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {compileFormula} from '../../src/ui/vehicleStudio/formula9.mjs';
import {auditVehicleGeometry} from '../../src/ui/vehicleStudio/audit9.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
import {studioLampLevels} from '../../src/model3d/RaceModelVehicle.js';
const use=(g,quality,fn)=>{const b=generateVehicle(g,{quality});try{return fn(b)}finally{disposeDesign(b)}};
test('bounded geometry grammar supports valid profiles but cannot access properties, globals or JS',()=>{
 assert.equal(compileFormula('sin(pi/2)+2^3^2')({}),10);
 assert.equal(compileFormula('mix(x, 4, clamp(u,0,1))')({x:2,u:.5}),3);
 assert.equal(compileFormula('1/0')({}),0);
 for(const x of ['globalThis','Math.sin(u)','u.constructor','u=0','while(u)','[u]','eval(u)'])assert.throws(()=>compileFormula(x),/formula|token/i);
});
test('linked and independent optical edits update placement in the exported mesh without moving other side',()=>{
 const g=createVehicle(),mirrored=updateDesign(g,'optics','front','0.3*cos(5*theta)','formula');
 use(g,'drive',a=>use(mirrored,'drive',b=>{
  assert.notDeepEqual(a.fascia.front.openings[0],b.fascia.front.openings[0]);
  assert.notDeepEqual(a.fascia.front.openings[1],b.fascia.front.openings[1]);
 }));
 const unlinked=updateDesign(g,'construction','symmetry',{...g.construction.symmetry,headlights:'independent'});
 const edited=updateDesign(unlinked,'sideOptic','L:front','0.25*cos(3*theta)','formula');
 use(g,'drive',a=>use(edited,'drive',b=>{
  assert.notDeepEqual(a.fascia.front.openings[0],b.fascia.front.openings[0]);
  assert.deepEqual(a.fascia.front.openings[1],b.fascia.front.openings[1]);
  assert.equal(b.fascia.front.trimArea.unmatched,0);
 }));
});
test('garage/drive/opponent budgets, real cabin layout/structure and all export maps have deterministic accounting',()=>{
 const g=createFasciaDemo('rally');
 const a=exportVehicle(g,{quality:'drive'}),b=exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'});
 assert.equal(a.metrics.quality,'drive');assert.deepEqual(a,b);
 assert.equal(a.metrics.triangleBudget,15000);assert.ok(a.metrics.carTriangles<=15000);
 assert.ok(a.metrics.textureMemory.dataBytes>10000);
 assert.ok(Object.keys(a.metrics.geometry.groups).some(k=>k.includes('panel seams')));
 assert.ok(Object.values(a.models).some(m=>m.materials.some(t=>t.automotive?.normal&&t.automotive?.orm)));
 assert.ok(exportVehicle(g,{quality:'opponent'}).metrics.carTriangles<=15000);
 use(g,'drive',d=>{assert.ok(d.structure.triangles>1000&&d.cabin.rows.length>=1);assert.equal(d.diagnostics.issues.length,0);});
});
test('custom exhaust group and styling curve persist, affect the mesh, and do not modify wheel mounts',()=>{
 let g=createVehicle();g=updateDesign(g,'construction','exhaust',[{...newOutlet('center-dual',0,2),shape:'oval'},{...newOutlet('right-tip',.44,1),yaw:18}]);
 g=updateDesign(g,'construction','features',[{...newStyle('crease-a'),side:'L',formula:'0.1*cos(2*pi*u)'}]);
 use(g,'drive',d=>{
  assert.equal(d.aero.outlets.length,3);
  assert.ok(d.features.some(f=>f.id==='style-crease-a-L'));
  assert.ok(!d.features.some(f=>f.id==='style-crease-a-R'));
  assert.deepEqual(d.genome.construction,loadVehicle(serializeVehicle(g)).construction);
  assert.equal(Object.keys(d.wheels).length,4);
 });
});
test('new named material lights are independently switchable without changing passive geometry',()=>{
 const s={mechanical:{headlights:false,turnSignal:'left'},elapsedMs:0},l=studioLampLevels(s,{braking:true,reversing:true});
 assert.equal(l.head,0);assert.equal(l.running,0);assert.ok(l.brake>0&&l.reverse>0);
 assert.ok(l['signal-left']>0);assert.equal(l['signal-right'],0);
 const both=studioLampLevels({mechanical:{headlights:true,hazards:true},elapsedMs:0},{enabled:false});
 assert.ok(Object.values(both).every(x=>x===0));
});

test('separate axle tracks, grille and intake tuning, lamp reach and blank fog covers affect only their intended subsystems',()=>{
 let g=createVehicle();
 for(const [key,value] of Object.entries({width:1.728,track:1.49098/1.728,archReserve:.0045,rearTrackBias:-.00508,tireWidth:.226}))
  g=updateDesign(g,'dimensions',key,value);
 g=updateDesign(g,'fascia','front',.12,'upperFasciaLift');
 g=updateDesign(g,'fascia','front','round-rect','intakeShape');
 g=updateDesign(g,'fascia','front',.14,'intakeHeightPosition');
 g=updateDesign(g,'components','fogs','blank','type');
 const reach=updateDesign(g,'optics','front',.88,'inboardReach');
 use(g,'drive',a=>use(reach,'drive',b=>{
  assert.equal(a.metadata.trackFrontM,1.49098);
  assert.equal(a.metadata.trackRearM,1.4859);
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.notDeepEqual(a.fascia.front.openings,b.fascia.front.openings);
  assert.deepEqual(a.fascia.rear.openings,b.fascia.rear.openings);
  assert.deepEqual(a.wheels,b.wheels);
  assert.equal(b.fascia.front.trimArea.unmatched,0);
 }));
});
