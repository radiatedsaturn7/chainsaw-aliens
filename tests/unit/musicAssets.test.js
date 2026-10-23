import test from 'node:test';
import assert from 'node:assert/strict';
import AudioMusicPlayer from '../../src/audio/AudioMusicPlayer.js';
import {midiMusicDocument} from '../../src/audio/MusicAsset.js';
import {MidiMedia} from '../../src/audio/MidiMedia.js';
import {externalizeRadioMusic} from '../../src/radio/RadioMusicAssets.js';
import {RadioPlayer} from '../../src/radio/RadioPlayer.js';
import {normalizeMenuDocument,createMenuDocument} from '../../src/menus/MenuDocument.js';
import MenuEditor from '../../src/ui/MenuEditor.js';

const media=()=>({currentTime:0,duration:40,play:async()=>{},pause(){this.paused=true;},removeAttribute(){this.src='';},load(){}});
test('MP3 transport applies fades, offset, loop and global volume; disposes at fade end',async()=>{
 const m=media(),engine={volume:.5,midiBusVolume:.4},p=new AudioMusicPlayer(engine,{createAudio:()=>m});
 p.setSong({src:'song.mp3'},'song',{loop:false,offsetMs:3000});m.onloadedmetadata();
 assert.equal(m.currentTime,3);assert.equal(m.loop,false);
 p.setFade(.8,2);p.update(1);assert.ok(Math.abs(m.volume-.08)<1e-9);
 engine.midiBusVolume=.2;p.update(1);assert.ok(Math.abs(m.volume-.08)<1e-9);
 p.setFade(0,1);p.update(.5);assert.ok(Math.abs(m.volume-.04)<1e-9);
 p.update(.5);assert.equal(m.paused,true);assert.equal(m.src,'');assert.equal(p.finished,true);
});
test('screen music fields persist through save/undo and clamp invalid durations',()=>{
 const editor=new MenuEditor({});editor.change(()=>Object.assign(editor.screen,{musicRef:'Title.mp3',musicLoop:false,musicVolume:.6,musicFadeIn:2,musicFadeOut:3,musicStart:4}));
 const saved=normalizeMenuDocument(JSON.parse(JSON.stringify(editor.menu))).screens[0];
 assert.equal(saved.musicRef,'Title.mp3');assert.equal(saved.musicLoop,false);assert.equal(saved.musicFadeOut,3);assert.equal(saved.musicStart,4);
 editor.history();assert.equal(editor.screen.musicRef,'');
 const doc=createMenuDocument();doc.screens[0].musicFadeIn=-4;assert.equal(normalizeMenuDocument(doc).screens[0].musicFadeIn,0);
});
test('MIDI conversion retains pitch, instrument, percussion channel and timing',()=>{
 const song=midiMusicDocument({bpm:120,timeSignature:{beats:4,unit:4},tracks:[{channel:9,program:3,notes:[{tStartSec:1,tEndSec:2,midi:38,vel:.7}]}]});
 assert.equal(song.tracks[0].channel,9);assert.equal(song.tracks[0].program,3);
 assert.deepEqual(song.tracks[0].patterns[0].notes[0],{id:'note-0',startTick:16,durationTicks:16,pitch:38,velocity:.7});assert.equal(song.loopEndTick,32);
});
test('legacy radio migration is retry-safe and preserves station/cues/unlocks',async()=>{
 const library={tracks:[{id:'a',title:'Title',src:'data:audio/mpeg;base64,AA',raceCues:{start:12,end:40},initiallyUnlocked:true}],stations:[{id:'s',trackIds:['a']}]},files=new Map();
 const deps={load:async(f,n)=>files.get(n),save:async(f,n,data)=>{files.set(n,{data});}};
 const result=await externalizeRadioMusic(library,deps);
 assert.equal(result.changed,true);assert.equal(files.size,1);assert.equal(result.library.tracks[0].src,'');
 assert.deepEqual(result.library.stations,library.stations);assert.deepEqual(result.library.tracks[0].raceCues,{start:12,end:40});
 await externalizeRadioMusic(library,deps);assert.equal(files.size,1);
 assert.equal((await externalizeRadioMusic(result.library,deps)).changed,false);
 assert.ok(library.tracks[0].src);
});
test('radio plays project MIDI and MP3 and cancels an in-flight music load',async()=>{
 let release;
 const song={tempo:120,tracks:[]},midi=media(),mp3=media(),player=new RadioPlayer({load:async()=>({}),save:async()=>({ok:true}),resolveMusic:async ref=>ref==='slow'?await new Promise(r=>release=r):ref==='midi'?song:{kind:'audio-music',src:'saved.mp3'},createMidi:async data=>{assert.equal(data,song);return midi;},createAudio:()=>mp3});
 await player.saveLibrary({tracks:['midi','mp3','slow'].map(id=>({id,musicRef:id,initiallyUnlocked:true})),stations:[{id:'s',trackIds:['midi','mp3','slow']}]});player.setContext(true);
 assert.equal(await player.play('midi'),true);assert.equal(player.audio,midi);
 assert.equal(await player.play('mp3'),true);assert.equal(mp3.src,'saved.mp3');
 const pending=player.play('slow');while(!release)await new Promise(r=>setImmediate(r));player.stop();release(song);
 assert.equal(await pending,false);assert.equal(player.audio,null);
});
test('MIDI radio media supports volume, seek, pause and stops its timer',async()=>{
 let tick,cancelled=0;
 const engine={midiVoices:[],ensure(){},preloadSongResources:async()=>{},setVolume(v){this.volume=v;}};
 const m=new MidiMedia({tempo:120,loopEndTick:160,tracks:[]},{engine,schedule:fn=>{tick=fn;return 1;},cancel:()=>cancelled++});
 assert.equal(m.duration,10);m.currentTime=4;assert.equal(m.currentTime,4);m.volume=.16;assert.equal(engine.volume,.16);
 await m.play();assert.equal(m.paused,false);assert.ok(tick);m.pause();assert.equal(m.paused,true);assert.ok(cancelled);assert.equal(m.timer,null);
});
test('uploaded composer MIDI plays at its saved 24-tick resolution',()=>{
 const engine={midiVoices:[],setVolume(){}};
 const m=new MidiMedia({schemaVersion:3,tempo:120,loopEndTick:480,tracks:[]},{engine});
 assert.equal(m.duration,10);m.currentTime=3;assert.equal(m.player.playheadTick,144);
});
test('menu playback passes screen music settings and ignores stale hydration after exit',async()=>{
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');
 const {upsertCachedProjectFile}=await import('../../src/ui/serverStorage.js');
 upsertCachedProjectFile('music','menu-test.mp3',JSON.stringify({savedAt:1,data:{kind:'audio-music',src:'test.mp3'}}));
 const calls=[],player=new MenuPlayer({setActiveMusicTrack:(...args)=>calls.push(args)});
 const doc=createMenuDocument(),screen=doc.screens[0];Object.assign(screen,{elements:[],musicRef:'menu-test.mp3',musicLoop:false,musicVolume:.7,musicFadeIn:1.5,musicFadeOut:2,musicStart:8});
 player.flow={screen,time:0};player.finishEnterScreen();await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls.at(-1),['menu-test.mp3',{restart:true,loop:false,volume:.7,fadeIn:1.5,fadeOut:0,offsetMs:8000}]);
 player.cleanupScreen();assert.deepEqual(calls.at(-1),[null,{fadeOut:2}]);
 calls.length=0;player.finishEnterScreen();player.cleanupScreen();await new Promise(r=>setImmediate(r));
 assert.ok(calls.every(([ref])=>ref===null));
});
