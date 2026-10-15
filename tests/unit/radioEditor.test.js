import test from 'node:test';
import assert from 'node:assert/strict';
import {RadioEditor} from '../../src/ui/RadioEditor.js';
import {RadioPlayer} from '../../src/radio/RadioPlayer.js';
import {normalizeRadioLibrary} from '../../src/radio/RadioLibrary.js';
import {buildRacePortraitMenuModel} from '../../src/ui/RaceEditor.js';

const library=()=>normalizeRadioLibrary({tracks:[{id:'one',title:'One',src:'one.mp3'},{id:'two',title:'Two',src:'two.mp3'}],stations:[{id:'night',name:'Night',trackIds:['one']}]});
async function editor(){
 const saved=[];
 const game={input:{isGamepadConnected:()=>false},audio:{setRadioPlaying(value){this.playing=value;}},transitionTo(state){this.state=state;},radio:new RadioPlayer({load:async key=>key==='rtg-radio-library'?library():{},save:async(key,value)=>{saved.push({key,value});return {ok:true};}})};
 const e=new RadioEditor(game);await e.open();return {e,game,saved};
}
test('radio is a persistent editor with standard portrait menu/history/transport rail',async()=>{
 const {e,game}=await editor();assert.equal(game.state,'radio-editor');
 assert.deepEqual(buildRacePortraitMenuModel('radio').bottomRailActions,['menu','undo','redo','radio-play']);
 assert.equal(e.station.name,'Night');assert.equal(e.opened,false);
 assert.ok(e.getMenuItems('edit').every(row=>row.disabled));
});
test('membership, ordering, metadata and undo/redo save the actual library',async()=>{
 const {e,game,saved}=await editor();e.selectTrack('two');await e.membership();
 assert.deepEqual(e.station.trackIds,['one','two']);await e.moveTrack(-1);assert.deepEqual(e.station.trackIds,['two','one']);
 const next=structuredClone(e.library);next.tracks[1].artist='Artist';next.stations[0].logo.artRef='Logo';await e.commit(next);
 await e.history();assert.equal(e.library.tracks[1].artist,'');await e.history(true);assert.equal(e.library.tracks[1].artist,'Artist');
 assert.equal(game.radio.library.stations[0].logo.artRef,'Logo');assert.equal(saved.at(-1).value.tracks[1].artist,'Artist');
 await e.history();const change=structuredClone(e.library);change.stations[0].name='Other';await e.commit(change);assert.equal(e.redoLibraries.length,0);
});
test('failed save cannot move history stacks or replace the current editor library',async()=>{
 const {e,game}=await editor();e.selectTrack('two');await e.membership();const before=e.library;
 game.radio.saveLibrary=async()=>{throw Error('offline');};await assert.rejects(e.history(),/offline/);
 assert.equal(e.library,before);assert.equal(e.undoLibraries.length,1);assert.equal(e.redoLibraries.length,0);
});
test('station preview plays locked tracks and stops on exit without changing unlocks or selected gameplay station',async()=>{
 const {e,game}=await editor();let paused=0;
 e.preview.createAudio=()=>({currentTime:0,async play(){},pause(){paused++;},removeAttribute(){},load(){}});
 const progress=structuredClone(game.radio.progress);
 await e.togglePreview();assert.equal(e.preview.playing,true);assert.equal(e.preview.trackId,'one');assert.equal(game.audio.playing,true);
 assert.deepEqual(game.radio.progress,progress);await e.togglePreview();assert.equal(e.preview.playing,false);
 await e.togglePreview();e.exitToMainMenu();assert.equal(game.state,'title');assert.equal(e.preview.playing,false);assert.equal(game.audio.playing,false);assert.ok(paused>0);
});
test('thumbstick selects lists and scrolls long track lists in row units',async()=>{
 const {e}=await editor();e.library=normalizeRadioLibrary({stations:e.library.stations,tracks:Array.from({length:20},(_,i)=>({id:`t${i}`,title:`Track ${i}`,src:'a.mp3'}))});e.syncSelection();
 Object.assign(e.portraitThumbstick,{active:true,dx:1,dy:0});e.updateRaceMapThumbstickPan(0.2);assert.equal(e.focusList,'tracks');
 Object.assign(e.portraitThumbstick,{dx:0,dy:1});for(let i=0;i<10;i++)e.updateRaceMapThumbstickPan(0.2);
 assert.equal(e.trackId,'t10');assert.equal(e.menuScrollState['radio:tracks'],10);
});

for(const [mode,width,height,mobile,pad] of [['desktop',1280,800,false,false],['portrait',390,844,true,false],['landscape-touch',844,390,true,false],['gamepad',1280,800,true,true]])test(`${mode} radio shell draws real shared chrome and reachable controls`,async()=>{
 const {e,game}=await editor();game.deviceIsMobile=mobile;game.isMobile=mobile;game.viewport={width,height,isMobile:mobile};game.input.isGamepadConnected=()=>pad;
 const noop=()=>{},ctx=new Proxy({measureText:value=>({width:String(value).length*7}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop});
 e.draw(ctx,width,height);assert.equal(e.activeViewportMode,mode);
 assert.ok(e.buttons.some(b=>b.id==='radio-play'));assert.ok(e.buttons.some(b=>b.id==='station-new'));assert.ok(e.buttons.some(b=>b.id==='radio-import'));
 for(const b of e.buttons){assert.ok(b.bounds.x>=0&&b.bounds.y>=0,`${b.id} origin`);assert.ok(b.bounds.x+b.bounds.w<=width+1&&b.bounds.y+b.bounds.h<=height+1,`${b.id} viewport`);}
 if(mode==='portrait'||mode==='landscape-touch'){assert.ok(e.portraitThumbstick.radius>0);for(const id of ['menu','undo','redo'])assert.ok(e.buttons.some(b=>b.id===id));}
});
