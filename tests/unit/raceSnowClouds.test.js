import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {normalizeSnowClouds,snowCloudStrength,snowCloudOpacity,updateSnowClouds,syncSnowClouds,disposeSnowClouds} from '../../src/racing/RaceSnowClouds.js';
import {editSnowClouds} from '../../src/ui/RaceSnowCloudEditor.js';
import {RACE_THREE_ELEVATION_M} from '../../src/racing/simulation/RaceSimulationConfig.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('snow clouds range from zero at level one to 30 percent at level ten',()=>{
 assert.equal(snowCloudStrength('snow',.1),0);assert.equal(snowCloudStrength('snow',1),1);
 for(const weather of ['clear','rain','storm'])assert.equal(snowCloudStrength(weather,1),0);
 assert.equal(snowCloudOpacity(1,.5),.3);assert.equal(snowCloudOpacity(1,0),0);assert.equal(snowCloudOpacity(1,1),0);
 const visible=s=>Array.from({length:18},(_,i)=>snowCloudOpacity(s,.5,i)).filter(a=>a>.001).length;
 assert.ok(visible(.2)<visible(.7));assert.ok(visible(.7)<visible(1));
});
test('clouds move in world space with wind and gusts, freeze while paused, fade and respawn',()=>{
 const state={};const args={x:30,z:40,strength:1,settings:{windDirectionDeg:90,windSpeedMps:3},gustX:1,gustZ:2};
 updateSnowClouds(state,{...args,timeMs:0});const p=state.clouds[0],x=p.x,z=p.z,age=p.age;
 updateSnowClouds(state,{...args,timeMs:100});assert.ok(Math.abs(p.x-x-.4)<1e-9);assert.ok(Math.abs(p.z-z-.2)<1e-9);
 updateSnowClouds(state,{...args,timeMs:100});assert.ok(Math.abs(p.age-age-.1)<1e-9);
 p.age=p.lifetime;updateSnowClouds(state,{...args,timeMs:100});assert.equal(state.clouds[0].age,0);assert.equal(state.clouds[0].opacity,0);
 updateSnowClouds(state,{...args,timeMs:200,strength:0});assert.equal(state.clouds.length,0);
});
test('upright cloud sprites preserve artwork proportions, sit on terrain, and release GPU resources',()=>{
 const renderer={scene:new THREE.Scene()},canvas={width:128,height:64};
 const e={playtestSession:{elapsedMs:0},selectedRace:{snowClouds:{artRef:'snowcloud'}},getRaceWeatherVisualIntensity:()=>1,getRaceArtSpriteCanvas:()=>canvas,getRaceCompositedSurfaceAtWorldPoint:()=>({elevation:3})};
 syncSnowClouds(e,renderer,{camera:{x:5,z:10},cameraYaw:.4,weatherState:{id:'snow'}});
 const meshes=renderer.snowCloudRenderer.meshes.filter(Boolean);assert.ok(meshes.length);
 for(const m of meshes){assert.ok(m.position.y>3*RACE_THREE_ELEVATION_M);assert.ok(Math.abs(m.position.y-m.scale.y/2-(3*RACE_THREE_ELEVATION_M+.05))<1e-9);assert.equal(m.scale.x/m.scale.y,canvas.width/canvas.height);assert.equal(m.rotation.x,0);assert.equal(m.rotation.z,0);assert.equal(m.rotation.y,.4);assert.equal(m.material.depthTest,true);assert.equal(m.material.depthWrite,false);assert.ok(m.material.opacity<=.3);}
 assert.equal(renderer.snowCloudRenderer.textures.size,1);
 canvas.height=128;
 syncSnowClouds(e,renderer,{camera:{x:5,z:10},cameraYaw:.4,weatherState:{id:'snow'}});
 for(const m of meshes){assert.equal(m.scale.x,m.scale.y);assert.ok(m.scale.y>=6 && m.scale.y<=12);}
 syncSnowClouds(e,renderer,{weatherState:{id:'rain'}});assert.ok(meshes.every(m=>!m.visible));
 disposeSnowClouds(renderer);assert.equal(renderer.scene.children.length,0);assert.equal(renderer.snowCloudRenderer,undefined);
});
test('cloud settings and artwork survive race normalization and enter loading references',()=>{
 const e=new RaceEditor({});e.selectedRace.snowClouds={enabled:true,artRef:'snowcloud',windSpeedMps:4};
 const loaded=e.normalizeLoadedRaceDocument(e.selectedRace);
 assert.equal(loaded.snowClouds.artRef,'snowcloud');assert.equal(loaded.snowClouds.windSpeedMps,4);
 assert.ok(e.collectSelectedRaceArtRefs().includes('snowcloud'));
 assert.equal(normalizeSnowClouds().enabled,true);assert.equal(normalizeSnowClouds().artRef,'');
});
test('snow cloud property edits are transactional within the weather draft',async()=>{
 const e={raceSettingsDialogDraft:{snowClouds:{artRef:'before'}}};
 await editSnowClouds(e,{showForm:async()=>null});assert.equal(e.raceSettingsDialogDraft.snowClouds.artRef,'before');
 await editSnowClouds(e,{showForm:async()=>({enabled:true,artRef:'snowcloud',windSpeedMps:7,windDirectionDeg:180})});
 assert.equal(e.raceSettingsDialogDraft.snowClouds.artRef,'snowcloud');assert.equal(e.raceSettingsDialogDraft.snowClouds.windSpeedMps,7);
});

test('full-storm driving still has nearby forward clouds at 3:22 instead of leaving them behind',()=>{
 const state={};let minimum=18;
 for(let tick=0;tick<=202*60;tick++){
  const seconds=tick/60,z=seconds*15;
  updateSnowClouds(state,{timeMs:seconds*1000,z,strength:1});
  if(seconds>=120){
   const nearby=state.clouds.filter(p=>p.z>z+5&&p.z<z+55&&Math.abs(p.x)<15&&p.opacity>.025);
   minimum=Math.min(minimum,nearby.length);
  }
 }
 assert.ok(minimum>=2,`Minimum forward visible cloud count: ${minimum}`);
 assert.ok(state.clouds.every(p=>p.opacity<=.3));
});

test('new cloud positions rotate with the view heading, but existing clouds only follow wind',()=>{
 const a={},b={};
 updateSnowClouds(a,{timeMs:0,strength:1,settings:{windSpeedMps:0}});
 updateSnowClouds(b,{timeMs:0,strength:1,yaw:Math.PI/2,settings:{windSpeedMps:0}});
 for(let i=0;i<a.clouds.length;i++){
  assert.ok(Math.abs(b.clouds[i].x-a.clouds[i].z)<1e-9);
  assert.ok(Math.abs(b.clouds[i].z+a.clouds[i].x)<1e-9);
 }
 const positions=a.clouds.map(p=>[p.x,p.z]);
 updateSnowClouds(a,{timeMs:100,x:2,z:3,yaw:.1,strength:1,settings:{windSpeedMps:0}});
 assert.deepEqual(a.clouds.map(p=>[p.x,p.z]),positions);
});

test('powered high beams or rally lights increase cloud opacity ten percent without stacking',()=>{
 const renderer={scene:new THREE.Scene()},canvas={width:128,height:64};
 const mechanical={headlights:true,highBeams:false,auxLights:false,effects:{lights:1}};
 const e={playtestSession:{elapsedMs:0,mechanical},selectedRace:{snowClouds:{artRef:'snowcloud'}},getRaceWeatherVisualIntensity:()=>1,getRaceArtSpriteCanvas:()=>canvas,getRaceCompositedSurfaceAtWorldPoint:()=>({elevation:0}),raceHeadlightsEnabled:()=>mechanical.headlights};
 const draw=()=>{syncSnowClouds(e,renderer,{weatherState:{id:'snow'}});return renderer.snowCloudRenderer.meshes.filter(Boolean).map(m=>m.material.opacity);};
 const normal=draw();assert.ok(normal.length);
 const check=scale=>draw().forEach((opacity,i)=>assert.ok(Math.abs(opacity-normal[i]*scale)<1e-12));
 mechanical.highBeams=true;check(1.1);
 mechanical.auxLights=true;check(1.1);
 mechanical.highBeams=false;check(1.1);
 mechanical.headlights=false;check(1.1);
 mechanical.auxLights=false;mechanical.highBeams=true;check(1);
 mechanical.headlights=true;mechanical.effects.lights=0;check(1);
 mechanical.effects.lights=1;mechanical.highBeams=false;check(1);
 disposeSnowClouds(renderer);
});


test('cloud sheets dissolve before camera intersection without changing lifetime opacity',()=>{
 const renderer={scene:new THREE.Scene()},canvas={width:128,height:128};
 const e={playtestSession:{elapsedMs:0},selectedRace:{snowClouds:{artRef:'snowcloud',windSpeedMps:0}},getRaceWeatherVisualIntensity:()=>1,getRaceArtSpriteCanvas:()=>canvas,getRaceCompositedSurfaceAtWorldPoint:()=>({elevation:0})};
 const draw=camera=>syncSnowClouds(e,renderer,{camera,cameraYaw:0,weatherState:{id:'snow'}});
 draw({x:0,z:0});
 const i=renderer.snowCloudRenderer.meshes.findIndex(m=>m?.visible);
 const p=e.playtestSession.snowCloudState.clouds[i],mesh=renderer.snowCloudRenderer.meshes[i],opacity=p.opacity;
 draw({x:p.x,z:p.z-10});assert.equal(mesh.material.opacity,opacity);
 draw({x:p.x,z:p.z-4});assert.ok(Math.abs(mesh.material.opacity-opacity*.5)<1e-10);
 draw({x:p.x,z:p.z-1});assert.equal(mesh.material.opacity,0);assert.equal(mesh.visible,false);
 draw({x:p.x,z:p.z+1});assert.equal(mesh.material.opacity,0);assert.equal(p.opacity,opacity);
 disposeSnowClouds(renderer);
});
