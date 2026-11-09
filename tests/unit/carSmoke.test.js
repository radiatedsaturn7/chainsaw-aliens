import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_CAR_SMOKE,normalizeCarSmoke,carSmokeArtRef,carSmokeArtRefs,smokeAnimationFrame} from '../../src/racing/CarSmoke.js';
import {editCarSmoke} from '../../src/ui/CarSmokeEditor.js';
import {packRaceArtDocumentForRuntime} from '../../src/racing/RacePackedArt.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('surface smoke overrides effect defaults while skid marks retain their artwork',()=>{
 const car={art:{smoke:{dirt:'brown',skidSmoke:'black',dirtDust:'fallback'}}};
 assert.equal(carSmokeArtRef(car,'dirt','dirtDust'),'brown');
 assert.equal(carSmokeArtRef(car,'unknown','dirtDust'),'fallback');
 assert.equal(carSmokeArtRef(car,'asphalt','skidSmoke'),'black');
 assert.equal(carSmokeArtRef(car,'dirt','asphaltSkid'),'');
 assert.deepEqual(carSmokeArtRefs(car).sort(),['black','brown','fallback']);
 assert.equal(normalizeCarSmoke({snow:'  white  '}).snow,'white');
});
test('smoke editor saves selected artwork with history and cancel leaves car intact',async()=>{
 const car={art:{}},e={selectedCar:car,captureRaceHistory(){this.history=true;},invalidateCarEditorPreviewFrame(){}};
 const choices=['winter','snow'];
 await editCarSmoke(e,{choose:async()=>choices.shift(),form:async()=>({artRef:'custom snow'})});
 assert.equal(car.art.smoke.snow,'custom snow');assert.equal(e.history,true);
 const before=JSON.stringify(car);
 await editCarSmoke(e,{choose:async()=>null});assert.equal(JSON.stringify(car),before);
});
test('smoke frames retain authored timing through race preparation',()=>{
 const packed=packRaceArtDocumentForRuntime({width:1,height:1,frames:[['#ffffff'],['#000000']],editor:{frames:[{durationMs:70},{durationMs:230}]}});
 assert.deepEqual(packed.frames.map(f=>f.durationMs),[70,230]);
 assert.equal(smokeAnimationFrame([70,230],69),0);assert.equal(smokeAnimationFrame([70,230],70),1);assert.equal(smokeAnimationFrame([70,230],300),0);
});
test('emitter uses runtime car surface artwork and resets pooled particle tint flags',()=>{
 const e=Object.create(RaceEditor.prototype);
 e.playtestSession={runtimeCar:{art:{smoke:{dirt:'dirtsmoke'}}},elapsedMs:0};
 Object.defineProperty(e,'selectedRace',{value:{}});
 e.getRaceWheelFxEmissionPosition=()=>({x:0,z:0,elevation:0});
 e.getRaceTireFxVisualMaterialAtWorldPoint=()=>({region:'terrain',materialId:'dirt',surfaceId:'dirt',effectSlotId:'dirtDust',sampledColor:'#abcdef'});
 e.emitRaceTireFxParticles(1,{speedMps:20});
 assert.ok(e.playtestSession.tireFxParticles.length);
 assert.ok(e.playtestSession.tireFxParticles.every(p=>p.artRef==='dirtsmoke'&&p.preserveArtColor));
 e.playtestSession.runtimeCar.art.smoke={};e.selectedRace.tireFx.dirtDust.artRef='Race Dust';
 e.updateRaceTireFxParticles(5);e.emitRaceTireFxParticles(1,{speedMps:20});
 assert.ok(e.playtestSession.tireFxParticles.every(p=>p.artRef==='Race Dust'&&!p.preserveArtColor));
});
test('renderer animates car smoke without tinting the uploaded colors',()=>{
 const e=Object.create(RaceEditor.prototype);
 e.playtestSession={tireFxParticles:[{slotId:'snowDust',artRef:'snow',preserveArtColor:true,ageMs:100,lifetimeMs:800,sizeM:1,alpha:1}]};
 e.raceSmokeFrameDurations=new Map([['snow',[70,230]]]);
 e.projectRaceWorldVisualPoint=()=>({visible:true,screenX:20,screenY:20,cameraZ:10,renderZ:10});
 let frame=-1,drawn=false;
 e.getRaceArtSpriteCanvas=(ref,options)=>{frame=options.frameIndex;return {width:10,height:10};};
 e.getRaceTintedTireFxArtCanvas=()=>{throw Error('Artwork should keep its color');};
 const ctx={save(){},restore(){},drawImage(){drawn=true;}};
 e.drawRaceTireFxParticles(ctx,{x:0,y:0,w:300,h:200});
 assert.equal(frame,1);assert.equal(drawn,true);
});
test('all seven saved cars have smoke assignments for every surface and cloud type',()=>{
 const root='data/server-storage/files/cars';let count=0;
 for(const dir of fs.readdirSync(root)){
  const file=`${root}/${dir}/document.json`;if(!fs.existsSync(file))continue;
  const doc=JSON.parse(fs.readFileSync(file));if(!doc.car)continue;
  assert.deepEqual(doc.car.art.smoke,DEFAULT_CAR_SMOKE,dir);count++;
 }
 assert.equal(count,7);
});
test('car normalization preserves smoke choices and race loading includes smoke artwork',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}});
 const car=e.normalizeLoadedCarDocument({name:'Smoke test',art:{smoke:{...DEFAULT_CAR_SMOKE,water:'custom water'}}});
 assert.equal(car.art.smoke.water,'custom water');
 e.getRaceSessionCar=()=>car;
 const refs=e.collectSelectedRaceArtRefs();
 for(const ref of carSmokeArtRefs(car))assert.ok(refs.includes(ref),ref);
});
test('airborne plumes emit at rear tire contact points without spawn scatter and at twice the former size',()=>{
 const e=Object.create(RaceEditor.prototype);
 const contacts={fl:{x:20,y:1,z:25},fr:{x:22,y:1,z:25},rl:{x:20,y:1,z:21},rr:{x:22,y:1,z:21}};
 e.playtestSession={runtimeCar:{art:{smoke:{dirt:'dirtsmoke'}}},elapsedMs:0,vehicleRenderState:{wheels:Object.fromEntries(Object.entries(contacts).map(([key,point])=>[key,{contactPointWorld:point}]))}};
 Object.defineProperty(e,'selectedRace',{value:{}});
 e.getRaceTireFxVisualMaterialAtWorldPoint=()=>({region:'terrain',materialId:'dirt',surfaceId:'dirt',effectSlotId:'dirtDust',sampledColor:'#abcdef'});
 const random=Math.random;Math.random=()=>.5;
 try{e.emitRaceTireFxParticles(1,{speedMps:20});}finally{Math.random=random;}
 const particles=e.playtestSession.tireFxParticles;
 assert.ok(particles.length>0);
 assert.deepEqual([...new Set(particles.map(p=>p.wheelId))].sort(),['rl','rr']);
 const intensity=(20-3.2)/20*.34;
 for(const p of particles){assert.equal(p.x,contacts[p.wheelId].x);assert.equal(p.z,contacts[p.wheelId].z);assert.equal(p.rearContactPlume,true);assert.ok(Math.abs(p.sizeM-2*(.32+intensity*.95)*1.075)<1e-12);}
});
test('new plume artwork origin projects to its center at the rear contact',()=>{
 const e=Object.create(RaceEditor.prototype);
 e.playtestSession={tireFxParticles:[{slotId:'wetSpray',artRef:'waterspray',preserveArtColor:true,rearContactPlume:true,ageMs:0,lifetimeMs:800,sizeM:2,alpha:1}]};
 e.projectRaceWorldVisualPoint=()=>({visible:true,screenX:100,screenY:90,cameraZ:10,renderZ:10});
 e.getRaceArtSpriteCanvas=()=>({width:200,height:400});
 let rect;
 e.drawRaceTireFxParticles({save(){},restore(){},drawImage(image,...args){rect=args;}},{x:0,y:0,w:300,h:200});
 assert.equal(rect[0]+rect[2]/2,100);assert.equal(rect[1]+rect[3]/2,90);
});
