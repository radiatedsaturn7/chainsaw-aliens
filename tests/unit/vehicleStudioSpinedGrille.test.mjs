import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
test('opt-in spined grille uses a real inset aperture and separated front lamp circuits',()=>{
 const g=createVehicle('sedan');
 Object.assign(g.components.grille,{type:'spined chrome bars',size:1.06,depth:1.13});
 Object.assign(g.fascia.front,{grilleWidth:1,grilleHeight:1,grilleHeightPosition:.59,grilleShape:'round-rect',grilleBezel:.90,grilleLampPair:1});
 Object.assign(g.optics.front,{layout:'factory-split',width:1,height:.88,outboard:.93});
 const wire=loadVehicle(serializeVehicle(g));
 const openings=makeOpenings({g:wire,end:'front',segments:24});
 const grille=openings.find(o=>o.id==='upper-grille');
 assert.equal(grille.style,'spined-bars');assert.ok(grille.height>.39);
 const leftEdge=Math.min(...grille.outline.map(p=>p[0])),rightEdge=Math.max(...grille.outline.map(p=>p[0]));
 for(const lamp of openings.filter(o=>o.kind==='lamp')){
  assert(lamp.center[0]<.5?Math.max(...lamp.outline.map(p=>p[0]))<leftEdge:Math.min(...lamp.outline.map(p=>p[0]))>rightEdge);
 }
 const mats=new Map();
 emitOpenings({end:'front',openings:[grille],surface:(x,y)=>[x,-y,1],put:(component,mat,geo)=>{mats.set(mat,geo);}});
 assert(mats.has('chrome')&&mats.has('trim'));assert(!mats.has('head'));
 for(const mesh of mats.values()){
  const pos=mesh.attributes.position;
  for(const v of pos.array)assert(Number.isFinite(v));
  for(let i=0;i<pos.count;i++)assert(pos.getZ(i)>.88&&pos.getZ(i)<1.001);
  mesh.dispose();
 }
 const e=exportVehicle(g);assert(e.metrics.carTriangles<=15000);assert.deepEqual(e.models,exportVehicle(wire).models);
});
test('classic broad grille remains opt-in and does not gain the center style',()=>{
 const g=createVehicle('sedan');g.components.grille.type='broad chrome bars';
 const opening=makeOpenings({g,end:'front'}).find(o=>o.id==='upper-grille');
 assert.equal(opening.style,'broad-bars');
});
