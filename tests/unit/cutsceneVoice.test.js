import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCutsceneRecordedAudio, collectCutsceneMidiRenderEvents, normalizeCutsceneDocument} from '../../src/ui/CutsceneEditor.js';
import {getEmbeddedCutsceneMusic} from '../../src/audio/MusicAsset.js';
import AudioMusicPlayer from '../../src/audio/AudioMusicPlayer.js';

test('scene-local voice survives the editor round trip and does not become MIDI', () => {
  const voice={id:'speech',type:'voice',name:'Spoken Dialogue',dataUrl:'data:audio/mpeg;base64,AAAA'};
  const doc=normalizeCutsceneDocument({assets:[voice,{id:'score',type:'music',ref:'theme'}],clips:[
    {id:'v',type:'music',assetId:'speech',startMs:100,durationMs:2000},
    {id:'m',type:'music',assetId:'score',startMs:500,durationMs:2500}
  ]});
  const midi={tempo:120,tracks:[{patterns:[{notes:[{startTick:0,pitch:56,durationTicks:8}]}]}]};
  const resolve=id=>id==='theme'?{song:midi}:null;
  assert.deepEqual(normalizeCutsceneDocument(JSON.parse(JSON.stringify(doc))),doc);
  assert.equal(collectCutsceneMidiRenderEvents(doc,resolve).length,1);
  const [line]=collectCutsceneRecordedAudio(doc,resolve);
  assert.equal(line.song.src,voice.dataUrl);
  assert.equal(line.song.dialogue,true);
  assert.equal(line.clip.startMs,100);
  assert.equal(getEmbeddedCutsceneMusic({...voice,dataUrl:'https://example.test/speech.mp3'}),null);
  assert.equal(getEmbeddedCutsceneMusic({...voice,dataUrl:'data:text/html;base64,AAAA'}),null);
});

test('cutscene dialogue still plays with score volume zero, but follows the master mute', () => {
  const fake={play:async()=>{},pause(){},load(){},removeAttribute(){}};
  const audio={volume:.5,midiBusVolume:0};
  const p=new AudioMusicPlayer(audio,{createAudio:()=>fake});
  const src='data:audio/mpeg;base64,AAAA';
  p.setSong(getEmbeddedCutsceneMusic({type:'voice',dataUrl:src}),'voice',{loop:false});
  p.setFade(.8,0);
  assert.equal(fake.volume,.4);
  assert.equal(fake.loop,false);
  audio.volume=0;
  p.update(.1);
  assert.equal(fake.volume,0);
  audio.volume=.5;
  p.setSong({src},'normal music');
  p.setFade(.8,0);
  assert.equal(fake.volume,0);
});
