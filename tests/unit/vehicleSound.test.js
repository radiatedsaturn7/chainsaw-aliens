import test from 'node:test';
import assert from 'node:assert/strict';
import {VehicleSound,vehicleSoundSettings} from '../../src/audio/VehicleSound.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import AudioSystem from '../../src/game/Audio.js';
function fixture(){
 const sources=[];
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
 const node=()=>({connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;},gain:param(),frequency:param()});
 const ctx={currentTime:0,sampleRate:8000,createGain:node,createBiquadFilter:node,createOscillator:node,createBufferSource(){const n=node();sources.push(n);return n;},createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}};
 return {ctx,sources,sound:new VehicleSound(ctx,node())};
}
test('turbo spools under load, lift triggers configured pop and release, sustained coast does not repeat',()=>{
 const {ctx,sources,sound}=fixture();const settings={turboEnabled:true,backfireToneHz:400,backfireDuration:.2};
 for(let i=0;i<20;i++){ctx.currentTime+=.05;sound.update({rpm:4500,throttle:1,settings});}
 assert.ok(sound.boost>.5);assert.ok(sound.whistleGain.gain.value>0);
 const bursts=[];const burst=sound.burst.bind(sound);sound.burst=(...args)=>{bursts.push(args);burst(...args);};
 ctx.currentTime+=.05;sound.update({rpm:4500,throttle:0,settings});
 assert.equal(bursts.length,2);assert.deepEqual(bursts[0],[400,.2,.35]);
 ctx.currentTime+=.05;sound.update({rpm:4500,throttle:0,settings});assert.equal(bursts.length,2);
 const whistle=sound.whistle;sound.stop();assert.equal(whistle.stopped,true);assert.ok(sources.every(n=>n.stopped&&n.disconnected));assert.equal(sound.nodes.length,0);
});
test('disabled effects, idle lifts and zero volumes stay quiet; normalization bounds settings',()=>{
 const {ctx,sound}=fixture();sound.update({rpm:900,throttle:1});ctx.currentTime=1;sound.update({rpm:900,throttle:0});assert.equal(sound.nodes.length,0);
 sound.update({rpm:5000,throttle:1,settings:{backfireEnabled:false,turboEnabled:false}});
 ctx.currentTime=2;sound.update({rpm:5000,throttle:0,settings:{backfireEnabled:false,turboEnabled:false}});assert.equal(sound.nodes.length,0);assert.equal(sound.whistle,undefined);
 assert.equal(vehicleSoundSettings({backfireVolume:0}).backfireVolume,0);
 assert.equal(vehicleSoundSettings({turboToneHz:99999}).turboToneHz,6000);
 const audio=Object.create(AudioSystem.prototype);audio.vehicleSound=sound;audio.setEngineRev(false);assert.equal(audio.vehicleSound,null);
});
test('car sound form cancels cleanly, persists with car document, and supports undo',async()=>{
 const editor=new RaceEditor({}, {mode:'car'});const before=structuredClone(editor.selectedCar.audio);
 await editor.openCarSoundSettings(async()=>null);assert.deepEqual(editor.selectedCar.audio,before);
 await editor.openCarSoundSettings(async()=>({backfireEnabled:true,backfireToneHz:480,backfireVolume:.6,backfireDuration:.23,turboEnabled:true,turboVolume:.7,turboToneHz:3100,turboReleaseVolume:.4}));
 const document=editor.serializeSelectedCarDocument();const loaded=editor.normalizeLoadedCarDocument(document);assert.equal(loaded.audio.turboToneHz,3100);assert.equal(document.car.audio.backfireToneHz,480);assert.equal(document.car.audio.turboToneHz,3100);
 editor.undoRaceHistory();assert.deepEqual(editor.selectedCar.audio,before);
 editor.redoRaceHistory();assert.equal(editor.selectedCar.audio.turboVolume,.7);
});
test('custom engine samples receive per-car turbo/backfire settings without resetting effects every frame',()=>{
 const calls=[];const editor=new RaceEditor({audio:{setVehicleSound:(...args)=>calls.push(args),setEngineRev:()=>assert.fail('custom sample must not reset effects')},playSfxById(){}},{mode:'car'});
 editor.selectedCar.audio={engineSoundId:'custom',backfireToneHz:330,turboEnabled:true};
 editor.playtestSession={running:true,carId:editor.selectedCar.id,engineSoundId:'custom',engineRpm:4000};
 editor.updateRaceEngineAudio({tuning:{redlineRpm:7000},throttle:1});
 assert.equal(calls[0][0],true);assert.equal(calls[0][1].settings.backfireToneHz,330);
});
