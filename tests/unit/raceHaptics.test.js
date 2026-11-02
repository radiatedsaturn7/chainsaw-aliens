import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceHaptics,raceHapticSample} from '../../src/racing/RaceHaptics.js';
function session(surface='asphalt',slip=0){return {speedMps:20,elapsedMs:1000,projectedDistance:10,vehicleDynamicsRunner:{state:{contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{normalLoadN:3000,validTreadContact:true,slipRatio:slip,material:{surfaceId:surface,roughness:0}}]))}}};}
test('off-road is stronger than tarmac; slip is independent; stationary and airborne are quiet',()=>{
 const road=raceHapticSample(session()),dirt=raceHapticSample(session('dirt')),skid=raceHapticSample(session('asphalt',.6));
 assert.ok(dirt.road>road.road*5);assert.ok(skid.slip>road.slip);assert.equal(skid.road,road.road);
 const stopped=session('dirt');stopped.speedMps=0;const still=raceHapticSample(stopped);assert.equal(still.road+still.slip,0);
 stopped.speedMps=20;stopped.airborne=true;const air=raceHapticSample(stopped);assert.equal(air.road+air.slip+air.bump,0);
});
test('ABS needs actual intervention and braking; collision impulses fire once',()=>{
 const s=session();s.vehicleDynamicsRunner.state.powertrainState={absModulationByWheel:{fl:.4}};
 assert.equal(raceHapticSample(s).braking,0);assert.ok(raceHapticSample(s,{},.016,{brakeAxis:1}).braking>0);
 s.vehicleDynamicsRunner.impactHistory=[];const first=raceHapticSample(s);
 s.vehicleDynamicsRunner.impactHistory.push({sequence:1,bodyNormalImpulseNs:4000});const hit=raceHapticSample(s,first.previous);
 assert.ok(hit.impact>0);assert.equal(raceHapticSample(s,hit.previous).impact,0);
});
test('controller outputs are bounded and throttled, and stopped when paused',()=>{
 const calls=[];let resets=0;const actuator={playEffect:(...a)=>{calls.push(a);return Promise.resolve('complete');},reset:()=>resets++};
 const h=new RaceHaptics({navigator:{getGamepads:()=>[{connected:true,vibrationActuator:actuator}]},window:null,document:null});
 const s=session('gravel',.7);for(let i=0;i<60;i++)h.update(s,{},1/60,{active:true,gamepadIndex:0});
 assert.ok(calls.length>=8&&calls.length<=12);
 for(const [kind,v] of calls){assert.equal(kind,'dual-rumble');assert.ok(v.strongMagnitude>=0&&v.strongMagnitude<=1);assert.ok(v.weakMagnitude>=0&&v.weakMagnitude<=1);assert.ok(v.duration<=120);}
 h.update(s,{},1/60,{active:false});assert.equal(resets,1);h.update(s,{},1/60,{active:false});assert.equal(resets,1);
});
test('phone fallback uses pulses; unsupported controller rejection falls back without throwing',async()=>{
 const pulses=[],actuator={playEffect:()=>Promise.reject(Error('unsupported')),reset(){}};
 const h=new RaceHaptics({navigator:{getGamepads:()=>[{connected:true,vibrationActuator:actuator}],vibrate:p=>{pulses.push(p);return true;}},window:null,document:null});
 h.send(.4,.1,0);await new Promise(r=>setTimeout(r,0));h.send(.4,.1,0);assert.equal(typeof pulses.at(-1),'number');
 h.send(.1,.6,0);assert.ok(Array.isArray(pulses.at(-1)));h.stop();assert.equal(pulses.at(-1),0);
});
test('disabled, hidden and focus loss stop feedback; resetting the car creates no artificial kick',()=>{
 const events={},pulses=[],doc={hidden:false,addEventListener:(k,fn)=>events[k]=fn};
 const h=new RaceHaptics({navigator:{vibrate:p=>{pulses.push(p);return true;}},document:doc,window:{addEventListener:(k,fn)=>events[k]=fn}}),s=session('dirt');
 h.update(s,{},.1,{active:true});assert.ok(pulses.length);events.blur();assert.equal(pulses.at(-1),0);
 const n=pulses.length;h.update(s,{},.1,{active:true});assert.equal(pulses.length,n);events.focus();
 h.update(s,{},.1,{active:true});doc.hidden=true;events.visibilitychange();assert.equal(pulses.at(-1),0);
 doc.hidden=false;h.setSettings({enabled:false});const count=pulses.length;h.update(s,{},.1,{active:true});assert.equal(pulses.length,count);
});

test('game only enables feedback for live driving, not intro/countdown/loading/results',async()=>{
 globalThis.window ||= {location:{search:''}};
 const {default:Game}=await import('../../src/game/GameCore.js');
 const game=Object.create(Game.prototype);let active;
 game.updatePlaytestFps=()=>{};game.stateManager={update(){}};game.updateProjectBrowserMusicPreview=()=>{};
 game.input={gamepadIndex:2};game.raceHaptics={update:(_s,_i,_dt,options)=>{active=options.active;assert.equal(options.gamepadIndex,2);}};
 game.state='race-editor';game.raceEditor={raceInput:{paused:false},playtestSession:{running:true}};
 game.update(.016);assert.equal(active,true);
 for(const field of ['preparing','startupFramePending','countdownRemainingMs','raceResults','finishing']){
  game.raceEditor.playtestSession[field]=true;game.update(.016);assert.equal(active,false,field);delete game.raceEditor.playtestSession[field];
 }
 game.raceEditor.playtestSession.raceIntro={active:true};game.update(.016);assert.equal(active,false);
 delete game.raceEditor.playtestSession.raceIntro;game.raceEditor.raceInput.paused=true;game.update(.016);assert.equal(active,false);
 game.raceEditor.raceInput.paused=false;game.state='menu-player';game.update(.016);assert.equal(active,false);
});

test('car reset clears suspension change history',()=>{
 const h=new RaceHaptics({navigator:{vibrate:()=>true},document:null,window:null}),s=session('dirt');
 s.wheelContacts3d={fl:{compressionRatio:.2}};h.update(s,{},.1,{active:true});
 s.wheelContacts3d.fl.compressionRatio=1;s.vehicleDynamicsRunner.state.vehicleResetGeneration=1;
 h.update(s,{},.1,{active:true});assert.equal(h.kick,0);assert.equal(h.previous.compression.fl,1);
});

test('device status recognizes Backbone and wheel hints without claiming steering force feedback',async()=>{
 const {drivingDeviceStatus,drivingDeviceDescription}=await import('../../src/racing/RaceHaptics.js');
 const pads=[{index:0,connected:true,id:'Backbone One'},{index:1,connected:true,id:'Logitech G923 Racing Wheel',vibrationActuator:{playEffect(){},effects:['dual-rumble']}}];
 const nav={getGamepads:()=>pads,vibrate(){}};
 const phone=drivingDeviceStatus(nav,0);assert.equal(phone.kind,'backbone');assert.equal(phone.rumble,false);assert.equal(phone.phone,true);
 assert.match(drivingDeviceDescription(phone),/Auto uses phone/);
 const wheel=drivingDeviceStatus(nav,1);assert.equal(wheel.kind,'wheel');assert.equal(wheel.rumble,true);assert.equal(wheel.forceFeedback,false);
 assert.match(drivingDeviceDescription(wheel),/does not configure pedal mappings/);
 assert.equal(drivingDeviceStatus({getGamepads(){throw Error('blocked');}}).rumble,false);
});
test('actuators advertising no dual-rumble fall back to phone immediately',()=>{
 const pulses=[];const h=new RaceHaptics({navigator:{getGamepads:()=>[{connected:true,vibrationActuator:{effects:['trigger-rumble'],playEffect(){assert.fail('unsupported effect');}}}],vibrate:p=>{pulses.push(p);return true;}},window:null,document:null});
 h.send(.5,.1);assert.equal(pulses.length,1);assert.equal(typeof pulses[0],'number');h.stop();
});
