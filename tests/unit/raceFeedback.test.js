import test from 'node:test';
import assert from 'node:assert/strict';
import {raceHapticSample} from '../../src/racing/RaceHaptics.js';
import {phoneDrivingPattern} from '../../src/racing/PhoneHaptics.js';
import {controlLamp} from '../../src/racing/MechanicalInstruments.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const session=()=>({speedMps:15,elapsedMs:1000,vehicleDynamicsRunner:{state:{contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{validTreadContact:true,normalLoadN:3000,slipAngleRad:0,material:{surfaceId:'asphalt'}}]))}}});
test('front/rear contact slip gives distinct phone patterns without mutating physics',()=>{
 const s=session();s.vehicleDynamicsRunner.state.contactPatches.fl.slipAngleRad=.3;s.vehicleDynamicsRunner.state.contactPatches.fr.slipAngleRad=.3;
 const before=structuredClone(s),front=raceHapticSample(s);assert.deepEqual(s,before);
 assert.ok(front.frontSlip>front.rearSlip);assert.equal(phoneDrivingPattern(front).kind,'front-slip');
 for(const [id,p] of Object.entries(s.vehicleDynamicsRunner.state.contactPatches))p.slipAngleRad=id[0]==='r'?.3:0;
 const rear=raceHapticSample(s);assert.equal(phoneDrivingPattern(rear).kind,'rear-slip');
 s.airborne=true;const air=raceHapticSample(s);assert.equal(air.frontSlip+air.rearSlip,0);
});
test('TC lamp flashes for torque intervention, not merely enabled TC or launch control',()=>{
 const s=session();s.tractionControlEnabled=true;s.vehicleDynamicsRunner.state.powertrainState={tractionTorqueScale:.6};
 assert.equal(controlLamp('tractioncontrolofflight',s),1);s.elapsedMs+=125;assert.equal(controlLamp('tractioncontrolofflight',s),0);
 s.elapsedMs=1000;s.vehicleDynamicsRunner.state.powertrainState.tractionTorqueScale=1;assert.equal(controlLamp('tractioncontrolofflight',s),0);
 Object.assign(s.vehicleDynamicsRunner.state.powertrainState,{tractionTorqueScale:.5,launchControl:{phase:'launching'}});assert.equal(controlLamp('tractioncontrolofflight',s),0);
 s.tractionControlEnabled=false;assert.equal(controlLamp('tractioncontrolofflight',s),1);
});
test('tire audio distinguishes snow, wet pavement and loose surfaces and quiets at rest',()=>{
 const calls=[],editor=Object.create(RaceEditor.prototype);editor.playtestSession={};editor.game={audio:{setTireScreech:(...args)=>calls.push(args)}};
 for(const [surface,material] of [['snow','snow'],['wet-asphalt','wet'],['gravel','dirt'],['asphalt','pavement']]){
  editor.updateRaceTireAudio({surface,slip:.5,speedMps:10});assert.equal(calls.at(-1)[1].material,material);
 }
 editor.updateRaceTireAudio({slip:.5,speedMps:0});assert.equal(calls.at(-1)[0],false);
 editor.updateRaceTireAudio({slip:.5,speedMps:0,slipSpeedMps:5});assert.equal(calls.at(-1)[0],true);
});
