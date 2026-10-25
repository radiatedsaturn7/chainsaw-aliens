import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {raceBrightness,applyRaceEnvironmentDraft,rallyLightPose,installRaceLighting,updateRaceLighting,RALLY_LIGHT_REACH_M} from '../../src/racing/RaceLighting.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('night defaults to .05, day to 1, and explicit darkness is preserved',()=>{
 assert.equal(raceBrightness({timeOfDay:'night'}),.05);assert.equal(raceBrightness({timeOfDay:'day'}),1);assert.equal(raceBrightness({timeOfDay:'night',brightness:0}),0);assert.equal(raceBrightness({timeOfDay:'night',brightness:.2}),.2);
 const e=new RaceEditor({},{mode:'race'});e.selectedRace.timeOfDay='night';delete e.selectedRace.brightness;e.openRaceSkyboxDialog();assert.equal(e.raceSettingsDialogDraft.environment.brightness,.05);
});
test('switching to night resets unchanged brightness, preserving an explicit simultaneous adjustment',()=>{
 let d={timeOfDay:'day',brightness:1};applyRaceEnvironmentDraft(d,{timeOfDay:'night',brightness:1});assert.equal(d.brightness,.05);
 applyRaceEnvironmentDraft(d,{timeOfDay:'day',brightness:.05});assert.equal(d.brightness,1);
 applyRaceEnvironmentDraft(d,{timeOfDay:'night',brightness:.3});assert.equal(d.brightness,.3);
 applyRaceEnvironmentDraft(d,{timeOfDay:'night',brightness:.1});assert.equal(d.brightness,.1);
});
test('rally lamps are paired at the front and follow yaw, pitch and roll',()=>{
 const p=rallyLightPose({x:10,y:2,z:20});assert.ok(p.left.z>20&&p.right.z>20);assert.ok(p.left.x!==p.right.x);assert.equal(p.left.y,p.right.y);assert.deepEqual(p.forward,{x:0,y:0,z:1});
 const turn=rallyLightPose({yaw:Math.PI/2});assert.ok(turn.forward.x>.999);assert.ok(Math.abs(turn.forward.z)<.001);
 const hill=rallyLightPose({pitchRad:.2});assert.ok(Math.abs(hill.forward.y)>.1);
 const flip=rallyLightPose({rollRad:Math.PI});assert.ok(flip.up.y<-.99);assert.ok(flip.left.y<0);
});
test('basic, instanced and custom shader hooks preserve existing hooks and share moving uniforms',()=>{
 const scene=new THREE.Scene();const m=new THREE.MeshBasicMaterial();let previous=0;m.onBeforeCompile=shader=>{previous++;shader.uniforms.existing={value:1};};m.customProgramCacheKey=()=> 'mipmap-test';scene.add(new THREE.Mesh(new THREE.BoxGeometry(),m));
 const renderer={scene},u=updateRaceLighting(renderer,{brightness:.05,pose:{x:0,y:1,z:0}});
 const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);
 assert.equal(previous,1);assert.ok(shader.uniforms.existing);assert.equal(shader.uniforms.rtgLampLeft,u.rtgLampLeft);assert.ok(shader.vertexShader.includes('instanceMatrix*rtgWorld'));assert.ok(shader.fragmentShader.includes('outgoingLight *= pow(rtgLighting(), 2.2)'));assert.match(m.customProgramCacheKey(),/^mipmap-test\|rtg/);
 const hook=m.onBeforeCompile;updateRaceLighting(renderer,{brightness:.05,pose:{x:80,y:2,z:0,yaw:Math.PI/2}});assert.equal(m.onBeforeCompile,hook);assert.ok(u.rtgLampLeft.value.x>80);assert.ok(u.rtgLampForward.value.x>.999);
 const custom=new THREE.ShaderMaterial();installRaceLighting(custom,u);const c={vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main(){gl_FragColor=vec4(1.0);}',uniforms:{}};custom.onBeforeCompile(c);assert.match(c.vertexShader,/vRtgWorld=\(modelMatrix/);assert.match(c.fragmentShader,/gl_FragColor.rgb \*= rtgLighting\(\)/);
 updateRaceLighting(renderer,{brightness:1,pose:{}});assert.equal(u.rtgHeadlights.value,0);assert.equal(u.rtgAmbient.value,1);
});
test('headlamp specification uses two half-power beams rated at 900m with a soft range cutoff',()=>{
 assert.equal(RALLY_LIGHT_REACH_M,900);assert.equal(2*405000/(900*900),1);
 const material=new THREE.MeshBasicMaterial();installRaceLighting(material,{});const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/ahead<=0.0/);assert.match(shader.fragmentShader,/smoothstep\(900.0,1200.0,distanceM\)/);assert.match(shader.fragmentShader,/0.57735/);
});
