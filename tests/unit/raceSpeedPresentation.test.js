import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {gaugeValue} from '../../src/racing/CarGauges.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {roadMotionMix,RoadMotionSound} from '../../src/audio/RoadMotionSound.js';
import {normalizeRaceDoodadDocument,getDoodadRuleForSpeed} from '../../src/racing/raceDoodads.js';

for(const mph of [30,60,100])test(`${mph} MPH: physical displacement agrees with integrated speed and the gauge`,t=>{
 const speed=mph*.44704;
 const runner=new VehicleDynamicsRunner({initialState:{position:{x:0,y:.6,z:0},velocity:{x:0,y:0,z:speed},speedMps:speed},
  inputTimeline:[{timeSeconds:0,input:{requestedGear:0}}],environmentProvider:()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0}})});
 let integrated=0,previous=runner.state.speedMps;
 const start=runner.state.position.z;
 for(let i=0;i<240;i++){
  runner.advance(1/120);
  const s=runner.state;
  integrated+=(previous+s.speedMps)/2/120;previous=s.speedMps;
  assert.ok(Math.abs(gaugeValue({source:'speed',units:'mph'},{session:s})-Math.abs(s.velocity.z)/.44704)<.02);
 }
 const measured=runner.state.position.z-start;
 assert.ok(Math.abs(measured-integrated)<.1,`${measured}m vs ${integrated}m`);
 t.diagnostic(JSON.stringify({initialMph:mph,seconds:2,measuredM:measured,integratedSpeedM:integrated}));
});

test('native chase framing is closer, keeps physical dimensions and exposes the road on slopes',()=>{
 const e=new RaceEditor({}),car={...e.selectedCar,art:{bodyModel:{ref:'test-model'}},dimensions:{lengthM:4.5}};
 e.playtestSession={runtimeCar:car};
 assert.equal(e.getRaceThirdPersonChaseDistance(car),8);
 assert.equal(e.getRaceThreeCameraFov(),54);
 assert.equal(e.getRaceThreeCameraFov('first-person'),58);
 assert.equal(e.getRaceThirdPersonChaseDistance({...car,dimensions:{lengthM:12}}),10);
 for(const grade of [-.12,0,.12])for(const aspect of [16/9,9/16]){
  const c=new THREE.PerspectiveCamera(e.getRaceThreeCameraFov(),aspect,.06,2000);
  c.position.set(0,2.1,-8);c.lookAt(0,2.1-2.1*.82,72);c.updateProjectionMatrix();
  const horizon=grade<0?.18:grade>0?.45:.31;
  e.alignRaceThreeCameraHorizon(c,{horizonRatio:horizon},0,{w:960*aspect,h:960});c.updateMatrixWorld(true);
  for(const distance of [25,50,90]){
   const p=new THREE.Vector3(0,distance*grade,distance).project(c);
   assert.ok(p.y>-1&&p.y<1,`${grade} / ${aspect} / ${distance}: ${p.y}`);
  }
 }
});

test('road/wind audio follows ground speed, surface and cockpit; stops on pause',()=>{
 const values=[0,30,60,100].map(mph=>roadMotionMix({speedMps:mph*.44704}));
 assert.equal(values[0].roadGain,0);assert.equal(values[0].windGain,0);
 for(let i=1;i<values.length;i++)assert.ok(values[i].windGain>values[i-1].windGain);
 assert.ok(roadMotionMix({speedMps:20,surface:'gravel'}).roadGain>roadMotionMix({speedMps:20,surface:'snow'}).roadGain);
 assert.equal(roadMotionMix({speedMps:30,grounded:false}).roadGain,0);
 assert.ok(roadMotionMix({speedMps:40,cockpit:true}).windGain<roadMotionMix({speedMps:40}).windGain);
 const nodes=[],param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
 const node=()=>{const n={gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;}};nodes.push(n);return n;};
 const ctx={sampleRate:8000,currentTime:0,createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:node,createBiquadFilter:node,createGain:node};
 const sound=new RoadMotionSound(ctx,{}),count=nodes.length;
 for(let i=0;i<100;i++)sound.update({speedMps:i});assert.equal(nodes.length,count,'no per-frame audio graph construction');
 sound.stop();assert.ok(nodes.every(n=>n.disconnected));assert.ok(nodes[0].stopped);
 const calls=[],e=new RaceEditor({audio:{setRoadMotion:(...args)=>calls.push(args),setTireScreech(){}}});
 e.playtestSession={running:true};e.updateRaceTireAudio({speedMps:30,slip:0});assert.equal(calls.at(-1)[0],true);
 e.playtestSession.running=false;e.updateRaceTireAudio({speedMps:30});assert.equal(calls.at(-1)[0],false);
});

test('old imported grass cannot regain rigid collision or slowdown when normalized',()=>{
 for(const ref of ['expanded-grass-clump','expanded-fern-bracken-dry-01','expanded-grass-roadside-weeds-01']){
  const def=normalizeRaceDoodadDocument({artRef:ref,defaultRule:{behavior:'collide',speedDrainPercent:45},rules:[{minSpeedMph:120,behavior:'fly-off',speedDrainPercent:16}]});
  for(const mph of [0,30,100,160]){const rule=getDoodadRuleForSpeed(def,mph);assert.equal(rule.behavior,'flatten');assert.equal(rule.speedDrainPercent,0);assert.deepEqual(rule.damage,{panels:0,suspension:0,engine:0});}
 }
 assert.equal(normalizeRaceDoodadDocument({artRef:'fencebushes',isFence:true}).defaultRule.behavior,'collide');
});
