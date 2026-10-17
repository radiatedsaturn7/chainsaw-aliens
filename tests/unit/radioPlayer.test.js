import AudioSystem from '../../src/game/Audio.js';
import {RadioMenu} from '../../src/radio/RadioMenu.js';
import Pause from '../../src/ui/Pause.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {normalizeRaceDoodadDocument,serializeRaceDoodadDocument} from '../../src/racing/raceDoodads.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RadioPlayer, RADIO_LIBRARY_KEY, RADIO_PROGRESS_KEY } from '../../src/radio/RadioPlayer.js';
import { normalizeRadioLibrary, radioStationTracks } from '../../src/radio/RadioLibrary.js';
const library={tracks:[{id:'a',title:'A',src:'data:audio/mpeg;base64,AA',artist:'Artist',album:'Album',image:{artRef:'Cover'}},{id:'b',title:'B',src:'/b.mp3',initiallyUnlocked:true},{id:'c',title:'C',src:'/c.mp3'}],stations:[{id:'station',name:'Station',logo:{artRef:'Logo'},trackIds:['a','b','c']}]};
function fixture(progress={}){
 const stored=new Map([[RADIO_LIBRARY_KEY,structuredClone(library)],[RADIO_PROGRESS_KEY,progress]]),audios=[];
 const player=new RadioPlayer({load:async(key,fallback)=>stored.get(key)||fallback,save:async(key,value)=>{stored.set(key,structuredClone(value));return {ok:true};},createAudio:()=>{const audio={currentTime:0,play:async()=>{audio.paused=false;},pause:()=>{audio.paused=true;},removeAttribute:()=>{},load:()=>{}};audios.push(audio);return audio;}});
 return {player,stored,audios};
}
test('radio library retains artwork and metadata, rejects duplicate IDs and dangling station membership',()=>{
 const normalized=normalizeRadioLibrary({...library,tracks:[...library.tracks,library.tracks[0]],stations:[{...library.stations[0],trackIds:['a','a','missing','b']}]});
 assert.equal(normalized.tracks.length,3);assert.deepEqual(normalized.stations[0].trackIds,['a','b']);assert.equal(normalized.tracks[0].image.artRef,'Cover');assert.equal(normalized.tracks[0].artist,'Artist');assert.equal(normalized.tracks[0].album,'Album');assert.equal(normalized.stations[0].logo.artRef,'Logo');
});
test('mix tape unlocks persist, are idempotent and survive title and station changes',async()=>{
 const {player,stored}=fixture();await Promise.all([player.unlock('a'),player.unlock('c')]);assert.deepEqual(stored.get(RADIO_PROGRESS_KEY).unlocked,['a','c']);assert.equal(await player.unlock('a'),false);assert.equal(await player.unlock('missing'),false);
 const renamed=structuredClone(library);renamed.tracks[0].title='Renamed';renamed.stations[0].name='Renamed station';await player.saveLibrary(renamed);
 const restored=new RadioPlayer({load:async key=>stored.get(key)});await restored.load();assert.deepEqual(restored.tracks.map(track=>track.id),['a','b','c']);assert.equal(restored.tracks[0].title,'Renamed');
});
test('playback excludes locked and disabled songs; skip wraps; rewind restarts then selects previous',async()=>{
 const {player,audios}=fixture();await player.load();player.setContext(true);await player.play('a');assert.equal(player.trackId,'b');
 await player.unlock('a');await player.skip();assert.equal(player.trackId,'a');audios.at(-1).currentTime=12;await player.rewind();assert.equal(audios.at(-1).currentTime,0);assert.equal(player.trackId,'a');await player.rewind();assert.equal(player.trackId,'b');
 await player.setTrackEnabled('b',false);assert.equal(player.trackId,'a');assert.equal(player.playing,true);
 assert.deepEqual(radioStationTracks(player.library,player.progress,'station',{includeDisabled:true}).map(track=>track.id),['a','b']);
 await player.setTrackEnabled('a',false);assert.equal(player.playing,false);assert.equal(player.audio,null);
});
test('global and per-level/race radio switches stop playback and gate the pause entry',async()=>{
 const {player,stored}=fixture();await player.load();assert.equal(player.available,false);player.setContext(true);await player.play();assert.equal(player.playing,true);
 player.setContext(false);assert.equal(player.available,false);assert.equal(await player.play(),false);
 player.setContext(true);await player.play();await player.setEnabled(false);assert.equal(player.available,false);assert.equal(player.audio,null);assert.equal(stored.get(RADIO_PROGRESS_KEY).enabled,false);
 await player.setEnabled(true);assert.equal(player.available,true);assert.equal(player.playing,true);
});
test('late audio promises cannot restart playback after disable, and ended advances',async()=>{
 const {player,audios}=fixture({unlocked:['a']});await player.load();player.setContext(true);await player.play('a');audios[0].onended();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(player.trackId,'b');
 let resolvePlay;player.audio.play=()=>new Promise(resolve=>{resolvePlay=resolve;});const pending=player.play();await new Promise(resolve=>setTimeout(resolve,0));player.setContext(false);resolvePlay();assert.equal(await pending,false);assert.equal(player.playing,false);assert.equal(player.audio,null);
});
test('failed storage is reported and later writes can still save',async()=>{
 const {player,stored}=fixture();await player.load();const save=player.savePreference;player.savePreference=async()=>({ok:false,reason:'disk full'});
 await assert.rejects(player.unlock('a'),/disk full/);assert.equal(player.error,'disk full');player.savePreference=save;await player.unlock('c');assert.deepEqual(stored.get(RADIO_PROGRESS_KEY).unlocked,['a','c']);
});

test('both pause menus hide radio when disabled and expose the shared transport when enabled',async()=>{
 const {player}=fixture();await player.load();const pause=new Pause(player),race=Object.assign(Object.create(RaceEditor.prototype),{game:{radio:player},raceInput:{pauseMenuMode:'main'}});
 assert.ok(!pause.getItems().some(row=>row.id==='radio'));assert.ok(!race.getRacePauseMenuRows().some(row=>row.id==='race-radio'));
 player.setContext(true);pause.selection=pause.getItems().findIndex(row=>row.id==='radio');pause.confirm();
 assert.deepEqual(pause.getItems().map(row=>row.id),['radio-stations','radio-play','radio-skip','radio-rewind','radio-tracks','radio-back']);
 race.getRacePauseMenuRows().find(row=>row.id==='race-radio').onClick();assert.deepEqual(race.getRacePauseMenuRows().map(row=>row.id),pause.getItems().map(row=>row.id));
 await player.setEnabled(false);assert.ok(!pause.getItems().some(row=>row.id.startsWith('radio')));assert.ok(!race.getRacePauseMenuRows().some(row=>row.id.startsWith('radio')||row.id==='race-radio'));
});
test('mix tape item type and stable track reference survive doodad save/open',()=>{
 const original=normalizeRaceDoodadDocument({name:'Night Drive Tape',itemType:'mix-tape',unlockTrackId:'a',artRef:'Cassette'});
 const restored=normalizeRaceDoodadDocument(JSON.parse(JSON.stringify(serializeRaceDoodadDocument(original))));
 assert.equal(restored.itemType,'mix-tape');assert.equal(restored.unlockTrackId,'a');assert.equal(restored.artRef,'Cassette');assert.equal(normalizeRaceDoodadDocument({}).itemType,'scenery');
});

test('radio owns music bus while playing without changing the saved music volume',()=>{
 const audio=Object.assign(Object.create(AudioSystem.prototype),{midiBus:{gain:{value:0.5}},midiBusVolume:0.5,midiBusHeadroom:0.8,ensureMidiSampler(){}});
 audio.setRadioPlaying(true);assert.equal(audio.midiBus.gain.value,0);assert.equal(audio.midiBusVolume,0.5);
 audio.setMidiVolume(0.7);assert.equal(audio.midiBus.gain.value,0);audio.setRadioPlaying(false);assert.ok(Math.abs(audio.midiBus.gain.value-0.56)<1e-8);assert.equal(audio.midiBusVolume,0.7);
});
test('radio lists page all unlocked tracks with bounded visible rows',async()=>{
 const {player}=fixture();await player.load();player.library.tracks=Array.from({length:20},(_,i)=>({id:String(i),title:'Track '+i,initiallyUnlocked:true}));
 const menu=new RadioMenu(player);menu.page='tracks';const seen=new Set();
 while(true){const rows=menu.rows();assert.ok(rows.length<=6);rows.filter(row=>row.id.startsWith('radio-track:')).forEach(row=>seen.add(row.id));const next=rows.find(row=>row.id==='radio-next-page');if(!next)break;next.onClick();}
 assert.equal(seen.size,20);menu.rows().find(row=>row.id==='radio-previous-page').onClick();assert.equal(menu.offset,15);
});

test('pause cancels a pending station switch resume',async()=>{
 const {player}=fixture({unlocked:['a']});await player.load();player.library.stations.push({id:'second',name:'Second',trackIds:['a']});player.setContext(true);await player.play();
 let resolveSave;player.savePreference=()=>new Promise(resolve=>{resolveSave=resolve;});const pending=player.selectStation('second');await new Promise(resolve=>setTimeout(resolve,0));player.pause();resolveSave({ok:true});await pending;assert.equal(player.playing,false);assert.equal(player.audio,null);
});
test('rewind before starting selects the final eligible track',async()=>{const {player}=fixture({unlocked:['a','c']});await player.load();player.setContext(true);await player.rewind();assert.equal(player.trackId,'c');});

test('race station restrictions filter menu/playback and restore global preferences when leaving',async()=>{
 const {player}=fixture({stationId:'station'});await player.load();
 player.library.stations.push({id:'other',name:'Other',trackIds:['b']});
 player.setContext(true);await player.play();const progress=structuredClone(player.progress);
 player.setContext(true,['other']);assert.equal(player.audio,null);assert.equal(player.stationId,'other');
 assert.deepEqual(player.stations.map(s=>s.id),['other']);
 const menu=new RadioMenu(player);menu.page='stations';
 assert.deepEqual(menu.rows().map(row=>row.id),['radio-station:other','radio-back']);
 await player.selectStation('station');assert.equal(player.stationId,'other');assert.deepEqual(player.progress,progress);
 await player.play();assert.equal(player.trackId,'b');
 player.setContext(true,[]);assert.equal(player.playing,false);assert.equal(player.stationId,'');assert.equal(await player.play(),false);
 player.setContext(true);assert.equal(player.stationId,'station');assert.equal(player.stations.length,2);
 assert.deepEqual(player.progress,progress);
});

test('race radio dialog defaults to all, cancels atomically, saves selections and supports undo',async()=>{
 const {player}=fixture();await player.load();player.library.stations.push({id:'other',name:'Other',trackIds:['b']});
 const e=new RaceEditor({radio:player,input:{reset(){}}});
 const before=structuredClone(e.selectedRace);let fields;
 await e.openRaceRadioSettings(async(title,rows,options)=>{fields=rows;assert.equal(title,'Race Radio');assert.equal(options.applyLabel,'OK');return null;});
 assert.equal(fields[0].value,'on');assert.ok(fields.slice(1).every(f=>f.value===true));
 assert.deepEqual(e.selectedRace,before);
 await e.openRaceRadioSettings(async()=>({enabled:'off',station0:false,station1:true}));
 assert.equal(e.selectedRace.radioEnabled,false);assert.deepEqual(e.selectedRace.radioStationIds,['other']);
 const loaded=e.normalizeLoadedRaceDocument(e.serializeSelectedRaceDocument());
 assert.equal(loaded.radioEnabled,false);assert.deepEqual(loaded.radioStationIds,['other']);
 await e.openRaceRadioSettings(async(title,rows)=>{assert.equal(rows[1].value,false);assert.equal(rows[2].value,true);return null;});
 e.undoRaceHistory();assert.equal(e.selectedRace.radioEnabled,before.radioEnabled);assert.equal(e.selectedRace.radioStationIds,undefined);
 e.redoRaceHistory();assert.deepEqual(e.selectedRace.radioStationIds,['other']);
 await e.openRaceRadioSettings(async()=>({enabled:'on',station0:false,station1:false}));
 assert.deepEqual(e.selectedRace.radioStationIds,[]);
 await e.openRaceRadioSettings(async()=>({enabled:'on',station0:true,station1:true}));
 assert.equal(e.selectedRace.radioStationIds,null);
});

test('turning radio on chooses a random eligible song; explicit selection and resume retain their track',async()=>{
 const {player}=fixture({enabled:false,unlocked:['a','c'],disabled:['c']});await player.load();player.setContext(true);player.random=()=>.99;
 await player.setEnabled(true);assert.equal(player.trackId,'b');assert.equal(player.playing,true);assert.equal(player.audio.preload,'auto');
 await player.play('a');player.audio.currentTime=12;player.pause();await player.play();assert.equal(player.trackId,'a');assert.equal(player.audio.currentTime,12);
 await player.setEnabled(false);await player.setEnabled(true);assert.equal(player.trackId,'b');
});
