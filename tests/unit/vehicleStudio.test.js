import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createVehicle,updateDesign,evaluateInteriorPatch,createDesignSession,serializeVehicle,loadVehicle,FAMILIES,COMPONENTS,FASCIA_DEMOS,createFasciaDemo} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
import {setParameter,setControl} from '../../src/ui/surfaceStudio/surface.mjs';
import {ModelAssetLibrary} from '../../src/model3d/ModelAssets.js';
const build=(g,fn)=>{const design=generateVehicle(g);try{return fn(design);}finally{disposeDesign(design);}};
const positions=(d,k)=>d.parts.filter(p=>p.component===k).flatMap(p=>Array.from(p.geometry.attributes.position.array));
const wheels=d=>d.wheelParts.flatMap(p=>Array.from(p.geometry.attributes.position.array));
test('three complete presets are distinct, validated and all have four wheels, glass, lights and interior',()=>{
 const signatures=[];
 for(const key of Object.keys(FAMILIES))build(createVehicle(key),d=>{
  assert.deepEqual(d.diagnostics.issues,[],key);
  for(const k of Object.keys(COMPONENTS)){
   const models=['wheels','tires'].includes(k)?d.wheelParts:d.parts;
   assert.equal(models.some(p=>p.component===k),d.genome.components[k].type!=='off'||k==='grille',key+' '+k);
  }
  assert.equal(d.diagnostics.floorContact,0);
  assert.equal(Object.keys(d.lampMounts).length,4);
  signatures.push([d.metadata.lengthM,d.stations.roofFront,d.stations.roofRear,d.wheelParts.length,
   d.genome.components.headlights.type]);
 });
 assert.equal(new Set(signatures.map(v=>JSON.stringify(v))).size,3);
});
test('major changes update dependent positions and invalid fit blocks export',()=>{
 const baseline=createVehicle(),next=updateDesign(updateDesign(updateDesign(baseline,'dimensions','width',1.92),'dimensions','height',1.55),'dimensions','diameter',.666);
 build(baseline,b=>build(next,d=>{
  assert.notEqual(d.wheels.fl[0],b.wheels.fl[0]);assert.equal(d.wheels.fl[1],.333);
  assert.notEqual(d.lampMounts.HeadlightMount_L[0],b.lampMounts.HeadlightMount_L[0]);
  assert.notDeepEqual(positions(d,'glass'),positions(b,'glass'));
  assert.notDeepEqual(wheels(d),wheels(b));
  assert.equal(d.metadata.trackFrontM,Math.abs(d.wheels.fl[0]-d.wheels.fr[0]));
  assert.equal(d.metadata.wheelbaseM,d.wheels.fl[2]-d.wheels.rl[2]);
 }));
 const stretched=updateDesign(baseline,'dimensions','length',4.6);
 assert.ok(Math.abs(stretched.dimensions.wheelbase+stretched.dimensions.front+stretched.dimensions.rear-4.6)<1e-10);
 const invalid=updateDesign(updateDesign(baseline,'dimensions','height',1.10),'dimensions','diameter',.755);
 assert.throws(()=>exportVehicle(invalid),/wheel opening/);
});
test('advanced fender edits shape the real car, and upper patch control points lock their shared edges',()=>{
 const g=createVehicle(), f=setControl(setParameter(g.surfaces.frontFenders,'flareDepth',.016),40,'x',.008);
 const h=updateDesign(g,'surfaces','frontFenders',f),hood=updateDesign(h,'surfaces','hood',{...h.surfaces.hood,points:[.030,-.019,.04,0]});
 build(g,d=>build(hood,l=>{
  assert.notDeepEqual(positions(d,'frontFenders'),positions(l,'frontFenders'));assert.notDeepEqual(positions(d,'hood'),positions(l,'hood'));
  assert.deepEqual(d.wheels,l.wheels);assert.deepEqual(d.stations,l.stations);
 }));
 for(const t of [0,.1,.5,.6,1]){
  for(const [a,b] of [[0,t],[1,t],[t,0],[t,1]])assert.equal(evaluateInteriorPatch(hood.surfaces.hood.points,a,b),0);
 }
});
test('native export round-trip has deterministic geometry, real mount joints and finite physics',()=>{
 const g=updateDesign(createVehicle(),'components','grille','closed','type'),saved=serializeVehicle(g);
 assert.deepEqual(loadVehicle(saved),g);
 const a=exportVehicle(g),b=exportVehicle(loadVehicle(saved));
 assert.deepEqual(a,b); const car=a.car.car;
 assert.equal(a.car.kind,'race-car');
 assert.ok(car.art.bodyModel.position.every(Number.isFinite));assert.ok(car.tuning.cgHeightM>.4);
 assert.ok(car.tuning.physics.bodyProfile.wheelWellAware);
 const body=a.models[car.art.bodyModel.ref],wheel=a.models[car.art.wheelModel.ref];
 assert.equal(body.joints.length,8);assert.ok(body.faces.every(f=>f.cornerNormals?.length===3));
 assert.equal(body.materials.find(m=>m.id==='studio-mat-glass').texture.pixels[0],'#ffffff48');
 assert.ok(wheel.materials.find(m=>m.id==='studio-mat-rubber').texture.pixels.length>400);
});
test('session undo, redo, duplicate, reset, reload and validation use one normalized genome',()=>{
 const w=createDesignSession();w.edit('dimensions','width',1.9);const s=w.save();assert.equal(w.undo().dimensions.width,1.74);
 assert.equal(w.redo().dimensions.width,1.9);
 assert.equal(w.duplicate().name.endsWith(' Copy'),true);
 assert.equal(w.reset().dimensions.width,1.74);
 assert.equal(w.load(s).dimensions.width,1.9);
 assert.throws(()=>w.edit('dimensions','width',NaN));
 assert.throws(()=>w.edit('components','wheels','invalid','type'));
 assert.throws(()=>w.load('{"schemaVersion":100}'));
});
test('temporary drive documents resolve through get and prepare without storage writes or fallback I/O',async()=>{
 const bad=()=>{throw Error('Read from disk unexpectedly');};
 const lib=new ModelAssetLibrary({load:bad,hydrate:bad});
 const a=exportVehicle(createVehicle('fastback'),{id:'studio-session-a',quality:'preview'});
 for(const [ref,m] of Object.entries(a.models)){
  const release=lib.adoptTemporary(ref,m);
  const entry=lib.get(ref);
  assert.strictEqual(await lib.prepare(ref),entry);assert.notStrictEqual(m,entry);
  assert.throws(()=>lib.adoptTemporary(ref,m));
  release();assert.equal(lib.temporary.has(ref),false);
 }
 assert.equal(lib.entries.size,0);
});

test('legacy v1 design explicitly upgrades to generator v2 with its nose settings, not frozen replay',()=>{
 const g=loadVehicle(readFileSync(new URL('../fixtures/studio-genome-v1.json',import.meta.url),'utf8'));
 assert.equal(g.generatorVersion,2);assert.equal(g.schemaVersion,1);assert.equal(g.family,'coupe');
 assert.equal(g.fascia.front.profile,'v');assert.equal(g.fascia.front.sweep,.76);assert.equal(g.fascia.front.drop,.65);
 assert.deepEqual(loadVehicle(serializeVehicle(g)),g);
});
test('same wheelbase and width produce box, arc and V profiles, and independent rear edits',()=>{
 const baseline=createVehicle(),observed={};
 let before;
 for(const profile of ['square','round','v']){
  const g=structuredClone(baseline);Object.assign(g.fascia.front,{profile,sweep:.85,center:1,pointedness:0});
  build(g,d=>{
   assert.deepEqual(d.diagnostics.issues,[]);
   const z=d.fascia.front.samples.map(p=>p[2]),dz=z[4]-z[0];
   observed[profile]=[(z[4]-z[2])/dz,dz];
   if(!before)before=d.wheels;assert.deepEqual(d.wheels,before);
  });
 }
 assert.ok(observed.square[0]<.15&&observed.round[0]>.14&&observed.round[0]<.36);
 assert.ok(observed.v[0]>.42&&observed.v[1]>observed.square[1]*1.6);
 const varied=updateDesign(baseline,'fascia','rear',1,'taper');
 build(baseline,a=>build(varied,b=>{
  assert.deepEqual(positions(a,'frontBumper'),positions(b,'frontBumper'));
  assert.notDeepEqual(positions(a,'trunk'),positions(b,'trunk'));assert.notDeepEqual(positions(a,'rearFenders'),positions(b,'rearFenders'));
  assert.deepEqual(a.wheels,b.wheels);assert.deepEqual(a.metadata,b.metadata);
 }));
 const advanced=updateDesign(baseline,'fascia','front',{...baseline.fascia.front.curves,vertical:[0,.55,-.38,0]},'curves');
 build(baseline,a=>build(advanced,b=>assert.notDeepEqual(a.fascia.front.guides.vertical.points,b.fascia.front.guides.vertical.points)));
});
test('matched lens/rim vertices, four demos and preview/export resolution maintain valid trim boundaries',()=>{
 for(const k of Object.keys(FASCIA_DEMOS)){
  const g=createFasciaDemo(k);
  for(const quality of ['preview','export']){
   const d=generateVehicle(g,{quality});try{
    assert.deepEqual(d.diagnostics.issues,[],k+' '+quality);
    for(const end of ['front','rear']){
     const {trimArea,openings}=d.fascia[end];
     assert.ok(trimArea.holes>.05);
     assert.equal(trimArea.unmatched,0);assert.ok(Math.abs(trimArea.mesh-trimArea.expected)<1e-8);
     assert.ok(openings.filter(x=>x.component===(end==='front'?'headlights':'tails')).length===2);
    }
    assert.equal(Object.keys(d.lampMounts).length,4);
   }finally{disposeDesign(d);}
  }
 }
 const g=createFasciaDemo('compound'),different=updateDesign(g,'optics','rear','projector','layout');
 build(g,a=>build(different,b=>{
  assert.deepEqual(a.fascia.rear.openings,b.fascia.rear.openings);
  assert.notDeepEqual(positions(a,'tails'),positions(b,'tails'));
 }));
 const reshaped=updateDesign(g,'optics','front','circle','housing');
 build(g,a=>build(reshaped,b=>{
  assert.notDeepEqual(a.fascia.front.openings,b.fascia.front.openings);
  assert.notDeepEqual(positions(a,'frontBumper'),positions(b,'frontBumper'));
 }));
});
