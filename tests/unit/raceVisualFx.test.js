import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceVisualFx,raceFxPreset,skyboxImageGeometry,skySunPositions,raceSpeedFxAmount,drawRaceSpeedFx,drawRaceSkySun} from '../../src/racing/RaceVisualFx.js';
import {editRaceVisualFx,pickSkySun,sunPreviewRect} from '../../src/ui/RaceVisualFxEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('FX opt in, clamp settings and provide distinct lighting presets',()=>{
 assert.equal(normalizeRaceVisualFx().enabled,false);
 assert.equal(normalizeRaceVisualFx({motionBlur:4,sunY:-1,sunColor:'oops'}).motionBlur,1);
 for(const name of ['morning','noon','evening','night'])assert.equal(raceFxPreset(name).visualFx.preset,name);
 assert.equal(raceFxPreset('night').brightness,.05);assert.equal(raceFxPreset('night').visualFx.sunEnabled,false);
 assert.ok(raceFxPreset('evening').visualFx.sunY>raceFxPreset('noon').visualFx.sunY);
});
test('sun picker preserves exact image coordinates and ignores letterboxing',()=>{
 const art={width:512,height:171},r=sunPreviewRect(art);
 assert.deepEqual(pickSkySun({x:r.x+r.w*.73,y:r.y+r.h*.61},art),{sunX:.73,sunY:.61});
 assert.deepEqual(pickSkySun({x:160,y:179},art),{});
});
test('sun remains attached to artwork through camera yaw, sky offsets and scale',()=>{
 const b={x:12,y:25,w:600,h:400},fx=normalizeRaceVisualFx({sunX:.73,sunY:.61});
 for(const yaw of [0,Math.PI/4,Math.PI,Math.PI*2,Math.PI*12+.4])for(const scale of [.5,1,3]){
  const geom=skyboxImageGeometry(b,{offsetXTurns:.315,offsetYRatio:-.19,scaleX:scale,scaleY:1.5},3,{yaw,horizon:220,hillPitch:.15});
  for(const p of skySunPositions(b,geom,fx)){
   const turns=(p.x-geom.x-fx.sunX*geom.width)/geom.width;assert.ok(Math.abs(turns-Math.round(turns))<1e-10);
   assert.equal(p.y,geom.y+geom.height*.61);
  }
  const wrap=skyboxImageGeometry(b,{scaleX:scale},3,{yaw:yaw+Math.PI*2});
  const original=skyboxImageGeometry(b,{scaleX:scale},3,{yaw});assert.ok(Math.abs(wrap.x-original.x-original.width)<1e-8);
 }
});
test('speed FX ramp smoothly, work in reverse, and stop when paused',()=>{
 const fx=normalizeRaceVisualFx({enabled:true,speedStartMph:40,speedFullMph:100});
 assert.equal(raceSpeedFxAmount(fx,10),0);assert.equal(raceSpeedFxAmount(fx,100),1);assert.equal(raceSpeedFxAmount(fx,100,true),0);
 assert.equal(raceSpeedFxAmount(fx,30),raceSpeedFxAmount(fx,-30));assert.ok(raceSpeedFxAmount(fx,30)<raceSpeedFxAmount(fx,31));
});
test('FX off allocates nothing; blur reuses two capped buffers with fixed sampling cost',()=>{
 const previous=globalThis.OffscreenCanvas;let allocations=0,draws=0;
 const gradient={addColorStop(){}};
 const context=()=>new Proxy({drawImage(){draws++;},createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;this.ctx=context();allocations++;}getContext(){return this.ctx;}};
 try{
  const c=context();c.canvas={};c.getTransform=()=>null;const state={},bounds={x:0,y:0,w:390,h:1800};
  drawRaceSpeedFx(c,bounds,normalizeRaceVisualFx(),{speedMps:80,state});assert.equal(allocations,0);
  const fx=normalizeRaceVisualFx({enabled:true,motionBlur:.2});
  for(let i=0;i<60;i++)drawRaceSpeedFx(c,bounds,fx,{speedMps:80,state,time:i/60});
  assert.equal(allocations,2);assert.ok(state.source.height<=640&&state.source.width<=640);assert.equal(draws,60*5);
 }finally{globalThis.OffscreenCanvas=previous;}
});
test('race FX Apply persists, cancel leaves the race unchanged, and undo restores it',async()=>{
 const e=new RaceEditor({},{mode:'race'}),before=JSON.stringify(e.selectedRace.visualFx);
 await editRaceVisualFx(e,{showForm:async()=>null});assert.equal(JSON.stringify(e.selectedRace.visualFx),before);
 await editRaceVisualFx(e,{showForm:async(_,fields)=>{
  const values=Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value]));
  return {...values,...fields.find(f=>f.id==='apply-preset').onClick({preset:'evening'}),sunX:.73,sunY:.61};
 }});
 const saved=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument()).visualFx;assert.equal(saved.preset,'evening');assert.equal(saved.sunX,.73);assert.equal(saved.sunY,.61);
 e.undoRaceHistory();assert.equal(JSON.stringify(e.selectedRace.visualFx),before);
});

test('Skybox owns lighting/FX as one cancellable draft with one undo step',async()=>{
 const e=new RaceEditor({},{mode:'race'});Object.assign(e.selectedRace,raceFxPreset('evening'));
 const before=JSON.stringify(e.selectedRace.visualFx),brightness=e.selectedRace.brightness;
 const form=async(_,fields)=>({...Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value])),...fields.find(f=>f.id==='apply-preset').onClick({preset:'night'})});
 e.openRaceSkyboxDialog();let draft=e.raceSettingsDialogDraft;
 await editRaceVisualFx(e,{skybox:draft,deferApply:true,showForm:form});
 assert.equal(e.selectedRace.brightness,brightness);assert.equal(JSON.stringify(e.selectedRace.visualFx),before);assert.equal(draft.environment.brightness,.05);
 e.closeRaceSettingsDialog({accept:false});assert.equal(e.selectedRace.brightness,brightness);assert.equal(JSON.stringify(e.selectedRace.visualFx),before);
 e.openRaceSkyboxDialog();draft=e.raceSettingsDialogDraft;draft.offsetXTurns=.2;
 await editRaceVisualFx(e,{skybox:draft,deferApply:true,showForm:form});e.closeRaceSettingsDialog({accept:true});
 assert.equal(e.selectedRace.brightness,.05);assert.equal(e.selectedRace.timeOfDay,'night');assert.equal(e.selectedRace.skyboxSettings.offsetXTurns,.2);
 const loaded=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());assert.equal(loaded.visualFx.preset,'night');assert.equal(loaded.brightness,.05);
 e.undoRaceHistory();assert.equal(e.selectedRace.brightness,brightness);assert.equal(JSON.stringify(e.selectedRace.visualFx),before);
});
test('Weather cannot overwrite lighting even with stale lighting values in its draft',()=>{
 const e=new RaceEditor({},{mode:'race'});Object.assign(e.selectedRace,raceFxPreset('night'));const fx=JSON.stringify(e.selectedRace.visualFx);
 e.openRaceWeatherDialog();assert.ok(!('brightness' in e.raceSettingsDialogDraft));assert.ok(!('timeOfDay' in e.raceSettingsDialogDraft));
 Object.assign(e.raceSettingsDialogDraft,{brightness:1,timeOfDay:'day',weather:'rain',intensity:.6,weatherTemperatureC:8});e.closeRaceSettingsDialog({accept:true});
 assert.equal(e.selectedRace.weather,'rain');assert.equal(e.selectedRace.weatherTemperatureC,8);assert.equal(e.selectedRace.brightness,.05);assert.equal(e.selectedRace.timeOfDay,'night');assert.equal(JSON.stringify(e.selectedRace.visualFx),fx);
});
test('Skybox is the single menu entry and terrain sun follows its image position and offsets',()=>{
 const e=new RaceEditor({},{mode:'race'}),ids=e.getMenuItems('settings').map(i=>i.id);
 assert.ok(ids.includes('skybox-next'));assert.ok(!ids.includes('race-sun'));assert.ok(!ids.includes('race-fx'));
 Object.assign(e.selectedRace,raceFxPreset('evening'));e.selectedRace.sun={angleDeg:10,intensity:.99};
 const before=e.getRaceSunSettings();e.setRaceSkyboxSettings({...e.getRaceSkyboxSettings(),offsetXTurns:.4});const after=e.getRaceSunSettings();
 assert.notEqual(before.angleDeg,after.angleDeg);assert.equal(after.intensity,e.selectedRace.visualFx.sunIntensity);
 e.selectedRace.visualFx.sunEnabled=false;assert.equal(e.getRaceSunSettings().intensity,0);
 e.openRaceSunDialog();assert.equal(e.raceSettingsDialog,'skybox');
});

test('Skybox preview rotates a full turn on elapsed time without changing race or camera settings',()=>{
 const e=new RaceEditor({},{mode:'race'});let now=100;e.getNowMs=()=>now;e.openRaceSkyboxDialog();
 const bounds={x:0,y:0,w:320,h:160},yaws=[],ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const originalSettings=e.selectedRace.skyboxSettings,originalFx=e.selectedRace.visualFx,state={normalized:.5,continuous:7};e.raceSkyboxYawState=state;
 e.drawRaceParallaxBackground=(_,__,options)=>{yaws.push(options.cameraYaw);e.raceSkyboxYawState={normalized:2,continuous:2};};
 for(const elapsed of [0,5000,10000,15000,20000,20016]){now=100+elapsed;e.drawRaceSkyboxSettingsPreview(ctx,bounds);assert.equal(e.selectedRace.skyboxSettings,originalSettings);assert.equal(e.selectedRace.visualFx,originalFx);assert.equal(e.raceSkyboxYawState,state);}
 for(let i=0;i<5;i++)assert.ok(Math.abs(yaws[i]-i*Math.PI/2)<1e-10);
 assert.ok(yaws[5]>yaws[4]&&yaws[5]-yaws[4]<.01);
 e.openRaceSkyboxDialog();e.drawRaceSkyboxSettingsPreview(ctx,bounds);assert.equal(yaws.at(-1),0);
});

test('sun glare brightens toward the sun, fades at edges/rain and stops facing away or at night',async()=>{
 const {sunFacingAmount,drawRaceSunGlare}=await import('../../src/racing/RaceVisualFx.js');
 const b={x:0,y:0,w:600,h:400},fx=normalizeRaceVisualFx({enabled:true,sunGlare:.8,lensFlare:.4}),center={x:300,y:168};
 const front=sunFacingAmount(b,center,fx);assert.ok(front>.5);assert.ok(sunFacingAmount(b,{x:50,y:168},fx)<front);assert.ok(sunFacingAmount(b,center,fx,'rain')<front);
 assert.equal(sunFacingAmount(b,{x:-1,y:168},fx),0);assert.equal(sunFacingAmount(b,center,{...fx,sunEnabled:false}),0);
 const fills=[],ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),fillRect(...rect){fills.push({rect,alpha:this.globalAlpha,mode:this.globalCompositeOperation});}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 drawRaceSunGlare(ctx,b,fx,[center]);assert.ok(fills.some(f=>f.rect.join()===Object.values(b).join()&&f.alpha>.2&&f.mode==='screen'));
 fills.length=0;drawRaceSunGlare(ctx,b,{...fx,sunGlare:0,lensFlare:0},[center]);assert.equal(fills.length,0);
});
test('sun projection survives viewport scaling, translation and first-person roll',async()=>{
 const {captureSkySun,localSunPoints}=await import('../../src/racing/RaceVisualFx.js');
 const fx=normalizeRaceVisualFx({sunX:.5,sunY:.2}),b={x:0,y:0,w:400,h:300},geom={x:0,y:0,width:400,height:300};
 const rotated={a:0,b:2,c:-2,d:0,e:500,f:20},base={a:2,b:0,c:0,d:2,e:100,f:20};
 const points=captureSkySun({getTransform:()=>rotated},b,geom,fx,200);assert.equal(points.length,1);
 const local=localSunPoints({getTransform:()=>base},points)[0];assert.deepEqual(local,{x:140,y:200});
});
test('Face sun aligns the actual sky image and FX fields provide sliders/live preview without saving test controls',async()=>{
 const {skySunFacingYaw}=await import('../../src/racing/RaceVisualFx.js');
 const e=new RaceEditor({},{mode:'race'}),b={x:0,y:0,w:320,h:180},settings={offsetXTurns:.315,offsetYRatio:-.19,scaleX:1,scaleY:1.5},fx=normalizeRaceVisualFx({sunX:.732,sunY:.608});
 const yaw=skySunFacingYaw(b,settings,3,fx),geom=skyboxImageGeometry(b,settings,3,{horizon:104.4,yaw});
 assert.ok(skySunPositions(b,geom,fx).some(p=>Math.abs(p.x-160)<1e-8));
 await editRaceVisualFx(e,{showForm:async(_,fields)=>{
  for(const id of ['lensFlare','sunGlare','brightness','skyBrightness','sunX','sunY','sunSize','motionBlur','speedLines'])assert.equal(fields.find(f=>f.id===id).type,'range');
  const preview=fields.find(f=>f.id==='live-preview');assert.equal(preview.animated,true);assert.equal(preview.sticky,true);
  const values=Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value]));
  assert.equal(fields.find(f=>f.id==='face-sun').onClick(values).previewRotate,false);
  assert.equal(fields.find(f=>f.id==='previewHeading').onInput().previewRotate,false);
  return {...values,enabled:true,sunGlare:.75,previewSpeed:140};
 }});
 assert.equal(e.selectedRace.visualFx.sunGlare,.75);assert.ok(!('previewSpeed' in e.selectedRace.visualFx));
});

test('streak artwork renders as an overlay or repeated sprites with adjustable opacity',()=>{
 const art={width:64,height:8},draws=[],ctx=new Proxy({drawImage:(...args)=>draws.push({args,alpha:ctx.globalAlpha})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const b={x:10,y:20,w:600,h:400},fx=normalizeRaceVisualFx({enabled:true,speedLines:.8,speedLineOpacity:.25,speedLineArtRef:'Streaks'});
 drawRaceSpeedFx(ctx,b,fx,{speedMps:100,getArt:ref=>{assert.equal(ref,'Streaks');return art;}});
 assert.equal(draws.length,1);assert.deepEqual(draws[0].args,[art,10,20,600,400]);assert.equal(draws[0].alpha,.2);
 draws.length=0;drawRaceSpeedFx(ctx,b,{...fx,speedLineArtMode:'streak'},{speedMps:100,getArt:()=>art});assert.equal(draws.length,16);assert.ok(draws.every(d=>d.alpha===.2));
 draws.length=0;drawRaceSpeedFx(ctx,b,{...fx,speedLineOpacity:0},{speedMps:100,getArt:()=>{throw Error('invisible art should not load');}});assert.equal(draws.length,0);
});
test('darkened edges ramp with speed and vanish at rest or while paused',()=>{
 const stops=[],ctx=new Proxy({createRadialGradient:()=>({addColorStop:(n,color)=>{if(n===1)stops.push(color);}})},{get:(o,k)=>o[k]||(()=>{})});
 const fx=normalizeRaceVisualFx({enabled:true,vignette:.6,speedStartMph:40,speedFullMph:100}),b={x:0,y:0,w:600,h:400};
 drawRaceSpeedFx(ctx,b,fx,{speedMps:0});assert.equal(stops.length,0);
 drawRaceSpeedFx(ctx,b,fx,{speedMps:70/2.236936});assert.equal(stops.at(-1),'rgba(0,0,0,0.3)');
 drawRaceSpeedFx(ctx,b,fx,{speedMps:100});assert.equal(stops.at(-1),'rgba(0,0,0,0.6)');
 const count=stops.length;drawRaceSpeedFx(ctx,b,fx,{speedMps:100,paused:true});assert.equal(stops.length,count);
});
test('preview trees move with simulated distance and stop without teleporting when speed changes',async()=>{
 const {advanceFxPreviewDistance,racePreviewTrees}=await import('../../src/racing/RaceVisualFx.js'),state={},b={x:0,y:0,w:320,h:180};
 const start=advanceFxPreviewDistance(state,1000,20),trees=racePreviewTrees(b,start);assert.equal(trees.length,24);
 const next=advanceFxPreviewDistance(state,1100,20);assert.equal(next,2);assert.notDeepEqual(racePreviewTrees(b,next),trees);
 assert.equal(advanceFxPreviewDistance(state,2000,0),2);assert.deepEqual(racePreviewTrees(b,state.demoDistance),racePreviewTrees(b,next));
 assert.ok(trees.every((t,i)=>i===0||t.depth>=trees[i-1].depth));
});
test('streak picker is transactional, persists artwork/opacity and includes the graphic in race preloading',async()=>{
 const e=new RaceEditor({},{mode:'race'}),before=e.selectedRace.visualFx;
 const picker=async options=>{assert.equal(options.fixedFolder,'art');return {action:'open',name:'Speed overlay'};};
 const form=accept=>async(_,fields)=>{
  const values=Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value]));
  const picked=await fields.find(f=>f.id==='choose-streak-art').onClick(values);assert.equal(picked.speedLineArtRef,'Speed overlay');
  assert.equal(fields.find(f=>f.id==='previewTrees').value,true);assert.equal(fields.find(f=>f.id==='speedLineOpacity').type,'range');
  const preset=fields.find(f=>f.id==='apply-preset').onClick({...values,...picked,preset:'night'});assert.equal(preset.speedLineArtRef,'Speed overlay');
  return accept?{...values,...picked,enabled:true,speedLineOpacity:.4}:null;
 };
 await editRaceVisualFx(e,{showForm:form(false),pickArt:picker});assert.equal(e.selectedRace.visualFx,before);
 await editRaceVisualFx(e,{showForm:form(true),pickArt:picker});
 assert.ok(e.collectSelectedRaceArtRefs().includes('Speed overlay'));
 const race=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());assert.equal(race.visualFx.speedLineArtRef,'Speed overlay');assert.equal(race.visualFx.speedLineOpacity,.4);assert.equal(race.visualFx.speedLines,1);
 e.undoRaceHistory();assert.equal(e.selectedRace.visualFx,before);
});
