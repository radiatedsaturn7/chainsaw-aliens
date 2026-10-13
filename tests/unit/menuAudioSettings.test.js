import test from 'node:test';
import assert from 'node:assert/strict';
import AudioSystem from '../../src/game/Audio.js';

test('FX mute keeps fallback MIDI connected to the independent music bus',()=>{
 const previous=globalThis.window;globalThis.window={setTimeout(){}};
 const nodes=[];const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=extra=>{const value={connections:[],connect(to){this.connections.push(to)},disconnect(){},...extra};nodes.push(value);return value};
 try{
  const audio=new AudioSystem();audio.gmEnabled=false;audio.master=node({gain:param()});audio.effectsBus=node({gain:param()});audio.midiBus=node({gain:param()});audio.ensure=()=>{};audio.ensureMidiSampler=()=>{};audio.getMidiPreset=()=>({});audio.ctx={currentTime:0,createGain:()=>node({gain:param()}),createOscillator:()=>node({frequency:param(),start(){},stop(){}})};
  audio.setMidiVolume(0.4);audio.setEffectsVolume(0);audio.playMidiNote(60);assert.equal(audio.effectsBus.gain.value,0);assert.equal(audio.midiBusVolume,0.4);assert.ok(nodes.some(n=>n.connections.includes(audio.midiBus)));assert.ok(!nodes.some(n=>n.connections.includes(audio.effectsBus)));
  audio.tone(440,0.1);assert.ok(nodes.some(n=>n.connections.includes(audio.effectsBus)));assert.equal(audio.midiBusVolume,0.4);
 }finally{globalThis.window=previous}
});
