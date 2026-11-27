import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from '../../src/vendorBridge/three.js';
import {buildModelObject} from '../../src/model3d/ModelRender.js';
import {raceVehicleEnvironmentProfile,syncRaceModelLamps} from '../../src/model3d/RaceModelVehicle.js';
import {carFxDrivingState} from '../../src/racing/CarFx.js';
import {installRaceLighting} from '../../src/racing/RaceLighting.js';
import {automotiveEnvironment,applyAutomotiveEnvironment} from '../../src/model3d/AutomotiveMaterials.js';
import {garageEnvironmentProfile,garageModelPixelRatio} from '../../src/menus/GarageModelPreview.js';

test('Fit 10 native lamps follow the same inputs as the race light effects',()=>{
 const bytes=readFileSync(new URL('../../src/model3d/wrx/fit10-body.pack',import.meta.url));
 const model=JSON.parse(gunzipSync(bytes));
 const root=buildModelObject(model,{automotive:true});
 const instance={root,object:new THREE.Group(),model,binding:{ref:'Field-Forgetmenot'}};
 const part={userData:{modelInstance:instance}};
 const state={mechanical:{headlights:false,effects:{lights:1}}};
 const check=(input,override,expected)=>{
   const fx=carFxDrivingState(state,input);
   assert.equal(syncRaceModelLamps(part,state,{braking:fx.braking,reversing:fx.reverse,headlights:input.headlights,...override}),true);
   const levels=Object.fromEntries(instance.raceStudioLights.map(({role,mat})=>[role,mat.emissiveIntensity]));
   assert.deepEqual([levels.head,levels.running,levels.brake,levels.reverse],expected);
 };
 check({gear:1},{},[0,0,0,0]);
 check({gear:1,brakeAxis:.3},{},[0,0,2.7,0]);
 check({gear:-1},{},[0,0,0,1.65]);
 check({gear:-1,brakeAxis:.3,headlights:true},{},[1.35,.75,2.7,1.65]);
 check({gear:-1,brakeAxis:.3,headlights:true},{enabled:false},[0,0,0,0]);
 check({gear:1},{},[0,0,0,0]);
 assert.equal(instance.raceMountedLamps.size,0,'stock integrated assemblies replace glow spheres');
 for(const name of ['head','brake','running','reverse']){
   assert(instance.raceStudioLights.find(x=>x.role===name)?.mat.userData.raceVehicleLamp);
 }
});

test('native light emission survives dark ambient but stays behind fog',()=>{
 const material=new THREE.MeshStandardMaterial();
 material.userData.raceVehicleLamp=true;
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
 const uniform={rtgAmbient:{value:.05}};
 installRaceLighting(material,uniform);
 material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.rtgAmbient,uniform.rtgAmbient);
 assert.match(shader.fragmentShader,/outgoingLight = rtgFog\(\(outgoingLight - totalEmissiveRadiance\) \* .*? \+ totalEmissiveRadiance\);/);
 assert.match(material.customProgramCacheKey(),/native-lamp/);
 const solid=new THREE.MeshStandardMaterial();
 const stock={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
 installRaceLighting(solid,uniform);
 solid.onBeforeCompile(stock);
 assert.doesNotMatch(stock.fragmentShader,/outgoingLight - totalEmissiveRadiance/);
});

test('garage buffer follows the compositing transform without an unbounded mobile cost',()=>{
 const ctx=(a,d)=>({getTransform:()=>({a,b:0,c:0,d})});
 assert.equal(garageModelPixelRatio(ctx(1,1),480,300),1);
 assert.equal(garageModelPixelRatio(ctx(1.49,1.49),480,300),1.5);
 assert.equal(garageModelPixelRatio(ctx(2,2),480,300),2);
 assert.equal(garageModelPixelRatio(ctx(3,3),1000,600),1.6);
 assert.equal(garageModelPixelRatio({},480,300),1);
});

test('only the matched WRX Fit 10 bundle uses the garage bay reflection profile',()=>{
 const model=part=>JSON.parse(gunzipSync(readFileSync(new URL(
   `../../src/model3d/wrx/fit10-${part}.pack`,import.meta.url))));
 const body=model('body'),wheel=model('wheel');
 assert.equal(garageEnvironmentProfile(body,wheel),'garage-bay');
 assert.equal(garageEnvironmentProfile(body,null),'studio');
 assert.equal(garageEnvironmentProfile({name:'other'},wheel),'studio');
 const sample=name=>{
   const {data,width,height}=automotiveEnvironment(name).image;
   let lum=0,weights=0;
   for(let j=0;j<height;j++)for(let i=0;i<width;i++){
     const w=Math.cos(Math.PI*((j+.5)/height-.5)),k=(j*width+i)*4;
     const channel=n=>THREE.DataUtils.fromHalfFloat(data[k+n]);
     lum+=w*(.2126*channel(0)+.7152*channel(1)+.0722*channel(2));weights+=w;
   }
   return lum/weights;
 };
 assert(Math.abs(sample('garage-bay')/sample('studio')-1)<.001);
 assert.notDeepEqual(automotiveEnvironment('garage-bay').image.data,automotiveEnvironment('studio').image.data);
 assert(Math.abs(sample('track-clear-rally')/sample('track-clear')-1)<.001);
});

test('WebGL 2 accepts a half-float reflection target without full-float render targets',()=>{
 const root=new THREE.Group(),mat=new THREE.MeshPhysicalMaterial();
 mat.userData.automotive={reflection:1};root.userData.automotiveMaterials=[mat];
 const gl2=names=>({capabilities:{isWebGL2:true},extensions:{has:key=>names.includes(key)}});
 applyAutomotiveEnvironment(root,'garage-bay',gl2(['EXT_color_buffer_half_float']));
 assert.equal(mat.envMap,automotiveEnvironment('garage-bay'));
 assert.equal(mat.envMap.type,THREE.HalfFloatType);
 applyAutomotiveEnvironment(root,'garage-bay',gl2([]));
 assert.equal(mat.envMap,null);
 applyAutomotiveEnvironment(root,'garage-bay',gl2(['EXT_color_buffer_float']));
 assert.equal(mat.envMap,automotiveEnvironment('garage-bay'));
});

test('clear race reflections change only for the exact Fit 10 model and preserve other light conditions',()=>{
 const model=part=>JSON.parse(gunzipSync(readFileSync(new URL(
   `../../src/model3d/wrx/fit10-${part}.pack`,import.meta.url))));
 for(const part of ['body','wheel']){
   const doc=model(part);
   assert.equal(raceVehicleEnvironmentProfile('track-clear',doc,part),'track-clear-rally');
   assert.equal(raceVehicleEnvironmentProfile('track-overcast',doc,part),'track-overcast');
   assert.equal(raceVehicleEnvironmentProfile('track-night',doc,part),'track-night');
   assert.equal(raceVehicleEnvironmentProfile('track-clear',{name:'other'},part),'track-clear');
 }
});
