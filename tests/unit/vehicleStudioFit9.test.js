import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {createEndSurface} from '../../src/ui/vehicleStudio/fascia.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const make=(f,end)=>createEndSurface({
 settings:f,end,tip:end==='rear'?-2.15:2.15,seam:end==='rear'?-1.68:1.68,
 archEnd:1.64,cabin:end==='rear'?-1.37:1.37,floor:.145,
 deckAt:(z,u)=>[(2*u-1)*.83,.84+.032*Math.sin(u*Math.PI),z],
 sideAt:(z,v,s)=>[s*(.857-.025*v),.85-.70*v,z],bumper:{shape:.5,size:1,depth:1,type:'sport'}
});
test('the hood leading-edge drop changes the shared center rails, preserves shoulder option and leaves rear and chin alone',()=>{
 const f=createFasciaDemo('rally').fascia.front;
 const patch={...f,hoodNoseDrop:.042,hoodNoseShoulder:.80};
 const a=make(f,'front'),b=make(patch,'front');
 assert.ok(Math.abs(a.face(.5,0)[1]-b.face(.5,0)[1]-.042)<1e-10);
 assert.ok(Math.abs(a.face(0,0)[1]-b.face(0,0)[1]-.0084)<1e-10);
 for(const u of [0,.2,.5,.8,1]){
  assert.deepEqual(b.bridge(u,1),b.face(u,0));
  assert.deepEqual(b.bridge(u,0),b.upperPanel(1.68,u));
  assert.deepEqual(a.face(u,.52),b.face(u,.52));
  assert.deepEqual(make(f,'rear').face(u,.1),make(patch,'rear').face(u,.1));
 }
});
test('headlamp lower reach does not change the upper trim edge and still exports cleanly within the full-car cap',()=>{
 const a=createFasciaDemo('rally'),g=structuredClone(a);
 g.optics.front.lowerLensReach=.085;
 g.fascia.front.hoodNoseDrop=.038;
 g.fascia.front.hoodNoseShoulder=.82;
 const lamp=g=>makeOpenings({end:'front',g}).find(o=>o.kind==='lamp');
 const p=lamp(a),q=lamp(g);
 assert.ok(q.height>p.height+.07);
 assert.ok(Math.abs(q.center[1]-q.height/2-(p.center[1]-p.height/2))<1e-10);
 assert.ok(Math.max(...q.outline.map(x=>x[1]))<=.585);
 const old=generateVehicle(a,{quality:'drive'}),fresh=generateVehicle(g,{quality:'drive'});
 try{
  assert.deepEqual(old.wheels,fresh.wheels);
  assert.deepEqual(fresh.diagnostics.issues,[]);
  assert.equal(fresh.fascia.front.trimArea.unmatched,0);
 }finally{disposeDesign(old);disposeDesign(fresh);}
 const e=exportVehicle(g);
 assert.deepEqual(e,exportVehicle(loadVehicle(serializeVehicle(g))));
 assert.ok(e.metrics.carTriangles<=15000);
});
