import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import {raceStartsWithHeadlights,raceBrightness,applyRaceEnvironmentDraft,rallyLightPose,installRaceLighting,updateRaceLighting,RALLY_LIGHT_REACH_M} from '../../src/racing/RaceLighting.js';
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
 assert.equal(previous,1);assert.ok(shader.uniforms.existing);assert.equal(shader.uniforms.rtgLampLeft,u.rtgLampLeft);assert.ok(shader.vertexShader.includes('instanceMatrix*rtgWorld'));assert.ok(shader.fragmentShader.includes('outgoingLight = rtgFog(outgoingLight * pow(rtgLighting(), 2.2))'));assert.match(m.customProgramCacheKey(),/^mipmap-test\|rtg/);
 const hook=m.onBeforeCompile;updateRaceLighting(renderer,{brightness:.05,pose:{x:80,y:2,z:0,yaw:Math.PI/2}});assert.equal(m.onBeforeCompile,hook);assert.ok(u.rtgLampLeft.value.x>80);assert.ok(u.rtgLampForward.value.x>.999);
 const custom=new THREE.ShaderMaterial();installRaceLighting(custom,u);const c={vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'void main(){gl_FragColor=vec4(1.0);}',uniforms:{}};custom.onBeforeCompile(c);assert.match(c.vertexShader,/vRtgWorld=\(modelMatrix/);assert.match(c.fragmentShader,/gl_FragColor.rgb = rtgFog/);
 updateRaceLighting(renderer,{brightness:1,pose:{}});assert.equal(u.rtgHeadlights.value,1);assert.equal(u.rtgAmbient.value,1);
});
test('headlamp specification uses two half-power beams rated at 900m with a soft range cutoff',()=>{
 assert.equal(RALLY_LIGHT_REACH_M,900);assert.equal(2*405000/(900*900),1);
 const material=new THREE.MeshBasicMaterial();installRaceLighting(material,{});const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/ahead<=0.0/);assert.match(shader.fragmentShader,/smoothstep\(reach,reach\*1.33,distanceM\)/);assert.match(shader.fragmentShader,/.57735/);
});

test('headlight initial state follows the race, while pause settings override weather',()=>{
 assert.equal(raceStartsWithHeadlights({timeOfDay:'day'}),false);
 assert.equal(raceStartsWithHeadlights({timeOfDay:'night'}),true);
 assert.equal(raceStartsWithHeadlights({timeOfDay:'day',brightness:.2}),true);
 assert.equal(raceStartsWithHeadlights({timeOfDay:'night',mechanicalMission:{headlights:false}}),false);
 assert.equal(raceStartsWithHeadlights({timeOfDay:'day',mechanicalMission:{headlights:true}}),true);
 const e=new RaceEditor({},{mode:'car'});e.selectedRace.timeOfDay='day';e.selectedRace.brightness=1;
 e.playtestSession={mechanical:{headlights:false}};e.raceInput.pauseMenuMode='main';
 assert.ok(!e.getRacePauseMenuRows().some(r=>r.id==='race-headlights'));
 e.raceInput.pauseMenuMode='car-controls';const rows=e.getRacePauseMenuRows();const index=rows.findIndex(r=>r.id==='race-headlights');assert.equal(rows[index-1].id,'race-toggle-tc');
 rows[index].onClick();assert.equal(e.raceHeadlightsEnabled(),true);assert.equal(e.playtestSession.mechanical.headlights,true);
 e.selectedRace.timeOfDay='night';rows[index].onAdjust();assert.equal(e.raceHeadlightsEnabled(),false);assert.equal(e.playtestSession.mechanical.headlights,false);
 const renderer={scene:{traverse(){}}};
 for(const brightness of [1,.05]){
  assert.equal(updateRaceLighting(renderer,{brightness,pose:{},headlightIntensity:0}).rtgHeadlights.value,0);
  assert.equal(updateRaceLighting(renderer,{brightness,pose:{},headlightIntensity:1}).rtgHeadlights.value,1);
 }
});

test('snow and rain fade through fog instead of acquiring dark fog-colored edges',()=>{
 const e=new RaceEditor({}),m=e.getRaceThreeEnvironmentSnowMaterial({});
 assert.equal(m.userData.racePrecipitation,true);
 assert.equal(m.depthWrite,false);
 const renderer={scene:{traverse(fn){fn({material:m});}}};
 const uniforms=updateRaceLighting(renderer,{brightness:.8,visibilityDistanceM:100});
 const shader={vertexShader:m.vertexShader,fragmentShader:m.fragmentShader,uniforms:{}};
 m.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/gl_FragColor.a \*= exp\(-2.996/);
 assert.match(shader.fragmentShader,/gl_FragColor.rgb \*= rtgLighting\(\)/);
 assert.ok(!shader.fragmentShader.includes('gl_FragColor.rgb = rtgFog'));
 // Both precipitation branches must reach the common lighting/alpha step.
 const main=shader.fragmentShader.slice(shader.fragmentShader.indexOf('void main()'));
 assert.ok(!main.includes('return;'));
 assert.equal(shader.uniforms.rtgAmbient,uniforms.rtgAmbient);
 updateRaceLighting(renderer,{brightness:.05});assert.equal(shader.uniforms.rtgAmbient.value,.05);
 assert.match(m.customProgramCacheKey(),/precipitation/);
});

test('emitting car lamps bypass ambient dimming while retaining distance fog',()=>{
 const m=new THREE.ShaderMaterial();m.userData.raceSpriteEmissive=true;installRaceLighting(m,{});
 const shader={vertexShader:'void main(){gl_Position=vec4(position,1.0);}',fragmentShader:'uniform sampler2D emissiveMap;uniform float hasEmissive;varying vec2 vUv;void main(){gl_FragColor=vec4(1.0);}',uniforms:{}};
 m.onBeforeCompile(shader);assert.match(shader.fragmentShader,/mix\(litCar,emission.rgb,emission.a\)/);assert.match(shader.fragmentShader,/rtgFog\(litCar\)/);assert.match(m.customProgramCacheKey(),/emissive-sprite/);
});
