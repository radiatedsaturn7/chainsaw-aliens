import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {createEndSurface} from '../../src/ui/vehicleStudio/fascia.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const make=f=>createEndSurface({
 settings:f,end:'rear',tip:-2.15,seam:-1.68,archEnd:1.64,cabin:-1.37,floor:.145,
 deckAt:(z,u)=>[(2*u-1)*.83,.84+.032*Math.sin(u*Math.PI),z],
 sideAt:(z,v,s)=>[s*(.857-.025*v),.85-.70*v,z],bumper:{shape:.5,size:1,depth:1,type:'sport'}
});
test('smooth rear face dials quiet center reflections while preserving the lamp-side and lower attachment rails',()=>{
 const settings=createFasciaDemo('rally').fascia.rear;
 const a=make({...settings,upperEndSweep:.078,bumperMidReach:.08,terminalTuck:.09,bumperBeltRise:.021});
 const b=make({...settings,upperEndSweep:.078,bumperMidReach:.08,terminalTuck:.09,bumperBeltRise:.021,deckSurfaceBlend:1,bumperFaceBlend:.9});
 const deviation=panel=>{
  const zs=Array.from({length:13},(_,i)=>panel.face(.5,.090+.029*i)[2]);
  return zs.slice(1,-1).reduce((t,z,i)=>t+Math.abs(zs[i]-2*z+zs[i+2]),0);
 };
 assert.ok(deviation(b)<.25*deviation(a));
 for(const u of [0,.05,.96,1])for(const v of [0,.1,.3,.45,.5,.6,.8,1])assert.deepEqual(a.face(u,v),b.face(u,v));
 for(const u of [0,.1,.2,.35,.5,.6,.73,.88,1])assert.deepEqual(a.face(u,1),b.face(u,1));
});
test('curved trunk seam and taller plate retain closed shared trim and deterministic gameplay cap',()=>{
 const a=createFasciaDemo('rally'),g=structuredClone(a);
 Object.assign(g.fascia.rear,{deckPanel:.3,deckRailCurve:.40,deckLowerRoll:.71,deckSurfaceBlend:.96,bumperFaceBlend:.88,plateMount:.9,plateOpeningStretch:.26,plateHeight:.97,platePosition:.662});
 Object.assign(g.optics.rear,{sideWrap:.77,tallHousing:.23,layout:'factory-split',silverUpper:1,rearCells:1});
 const d=generateVehicle(g,{quality:'drive'});
 try{
  assert.ok(d.fascia.rear.openings.some(o=>o.id==='rear-deck-insert'));
  for(const m of ['opticSilver','opticRed','runningRed'])assert.ok(d.parts.some(p=>p.component==='tails'&&p.material===m));
  assert.equal(d.fascia.rear.trimArea.unmatched,0);
  assert.deepEqual(d.diagnostics.issues,[]);
  const x=exportVehicle(g),y=exportVehicle(loadVehicle(serializeVehicle(g)));assert.deepEqual(x,y);assert.ok(x.metrics.carTriangles<=15000);
 }finally{disposeDesign(d);}
});
