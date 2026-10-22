import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { upsertCachedProjectFile, clearCachedProjectFilesForTests } from '../../src/ui/serverStorage.js';
import { resetProjectFilesForTests } from '../../src/ui/projectFiles.js';
const documentRef={createElement(){const canvas={};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{canvas.pixels=image.data;}});return canvas;}};
test('interior assignments prepare exact frames and update prepared-only live previews',()=>{
 const previous=globalThis.document;resetProjectFilesForTests();clearCachedProjectFilesForTests();
 const e=new RaceEditor({}, {mode:'car'}),car=e.selectedCar;
 e.carEditorPreviewPlaytest={carId:e.getRaceCarProjectIdentity(car),session:{runtimeCar:structuredClone(car)}};
 const seed=(name,color)=>upsertCachedProjectFile('art',name,JSON.stringify({savedAt:1,data:{width:2,height:1,frames:[[color,color]]}}));
 try{
  globalThis.document=documentRef;seed('dash','#ff0000');seed('wheel','#00ff00');
  e.setSelectedCarArtRef('dashboard','dash');e.setSelectedCarArtRef('steering-wheel','wheel');
  e.playtestSession={...e.carEditorPreviewPlaytest.session,raceTravelPreparedArtOnly:true,steeringWheelRotation:.4};
  assert.equal(e.getRaceArtSpriteCanvas('dash').pixels[0],255);
  assert.equal(e.getRaceArtSpriteCanvas('wheel').pixels[1],255);
  const calls=[],ctx={save(){},restore(){},translate(){},rotate(r){calls.push(['rotation',r]);},drawImage(...args){calls.push(args);}};
  e.drawRaceSteeringWheel(ctx,{x:0,y:0,w:960,h:540});
  assert.ok(calls.some(c=>c[0]==='rotation'&&c[1]===.4));assert.equal(calls.filter(c=>typeof c[0]==='object').length,2);
  e.setCarArtScaleValue('dashboard-x',1.5);assert.equal(e.playtestSession.runtimeCar.art.interior.dashboard.scaleX,1.5);
  e.resetCarInteriorArtSize('dashboard');assert.equal(e.playtestSession.runtimeCar.art.interior.dashboard.scaleX,1);
  e.resetCarArtComponent('steering-wheel');assert.equal(e.playtestSession.runtimeCar.art.interior.steeringWheel.artRef,null);
  assert.equal(e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.interior.dashboard.artRef,'dash');
 }finally{globalThis.document=previous;resetProjectFilesForTests();clearCachedProjectFilesForTests();}
});
test('dashboard and wheel preserve source aspect ratio, offsets, and rotation',()=>{
 const e=new RaceEditor({}),dashboard={width:512,height:205},wheel={width:512,height:468};
 e.getRaceArtSpriteCanvas=ref=>ref==='dash'?dashboard:wheel;
 const car={art:{interior:{dashboard:{artRef:'dash'},steeringWheel:{artRef:'wheel',offsetX:.25,offsetY:-.1}}}};
 for(const b of [{x:0,y:0,w:960,h:540},{x:12,y:20,w:360,h:203}]){
  const draws=[],rotations=[],translations=[];
  const ctx={save(){},restore(){},drawImage(...a){draws.push(a);},translate(...a){translations.push(a);},rotate(r){rotations.push(r);}};
  e.drawCarInteriorLayers(ctx,b,car,{rotation:-.7});
  assert.equal(draws.length,2);assert.ok(Math.abs(draws[0][3]/draws[0][4]-512/205)<1e-8);
  assert.ok(Math.abs(draws[1][3]/draws[1][4]-512/468)<1e-8);
  assert.equal(draws[0][2]+draws[0][4],b.y+b.h);assert.deepEqual(rotations,[-.7]);
  assert.equal(translations[0][0],b.x+b.w/2+.25*b.w*.2);
 }
});

test('custom wheel hub stays at its screen anchor at every steering angle and survives save/load',()=>{
 const e=new RaceEditor({}),canvas={width:512,height:468};e.getRaceArtSpriteCanvas=()=>canvas;
 const car=e.selectedCar;e.ensureSelectedCarArt();car.art.interior.steeringWheel={artRef:'wheel',scaleX:1.125,scaleY:1.125,centerX:255/512,centerY:255/468};
 for(const rotation of [0,.7,-1.2,Math.PI]){
  let draw,anchor;const ctx={save(){},restore(){},fillRect(){},rotate(){},translate(x,y){anchor=[x,y];},drawImage(...args){draw=args;}};
  e.drawCarInteriorLayers(ctx,{x:0,y:0,w:960,h:540},car,{rotation});
  const hubX=draw[1]+draw[3]*255/512,hubY=draw[2]+draw[4]*255/468;
  assert.ok(Math.abs(hubX)<1e-8&&Math.abs(hubY)<1e-8);
  assert.deepEqual(anchor,[480,540*.82]);
 }
 const loaded=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());
 assert.equal(loaded.art.interior.steeringWheel.centerX,255/512);
 assert.equal(loaded.art.interior.steeringWheel.centerY,255/468);
});

test('center editor converts image pixels to normalized pivot and updates the runtime copy',async()=>{
 const previous=globalThis.document;resetProjectFilesForTests();clearCachedProjectFilesForTests();
 const e=new RaceEditor({}, {mode:'car'}),car=e.selectedCar;
 try{
  globalThis.document=documentRef;
  upsertCachedProjectFile('art','pivot-wheel',JSON.stringify({savedAt:1,data:{width:4,height:2,frames:[Array(8).fill('#ffffff')]}}));
  e.setSelectedCarArtRef('steering-wheel','pivot-wheel');
  e.carEditorPreviewPlaytest={carId:e.getRaceCarProjectIdentity(car),session:{runtimeCar:structuredClone(car)}};
  const before=e.getCarEditorPreviewTuningRevision(car);
  await e.openCarSteeringCenter(async(title,fields)=>{assert.equal(fields[0].value,2);assert.equal(fields[1].value,1);return {x:2,y:1.5};});
  assert.equal(car.art.interior.steeringWheel.centerY,.75);
  assert.equal(e.carEditorPreviewPlaytest.session.runtimeCar.art.interior.steeringWheel.centerY,.75);
  assert.equal(e.getCarEditorPreviewTuningRevision(car),before,'pivot changes must not restart preview preparation');
 }finally{globalThis.document=previous;resetProjectFilesForTests();clearCachedProjectFilesForTests();}
});
