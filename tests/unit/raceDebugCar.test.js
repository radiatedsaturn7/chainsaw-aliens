import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {raceFxPreset} from '../../src/racing/RaceVisualFx.js';
import {applySideRaceLighting} from '../../tools/campaigns/side_race_lighting.mjs';
function fixture(){
 const editor=Object.create(RaceEditor.prototype),calls=[];
 editor.playtestSession={worldBake:{key:'loaded'},raceTravelPreparedArtOnly:true};
 editor.raceInput={autoShift:false};editor.game={raceTravelSession:{}};
 editor.normalizeLoadedCarDocument=car=>structuredClone(car);
 editor.withSavedRaceCarRuntimeIdentity=(car,name)=>({...car,__playtestId:'saved:'+name});
 editor.getRaceCarProjectIdentity=car=>car.__playtestId;
 editor.collectRaceCarArtRefs=()=>['body'];
 editor.hydrateRaceArt=async()=>({data:{frames:[{}]}});
 editor.getRaceArtSpriteCanvas=()=>({canvas:true});
 editor.selectPlaytestCarEntry=entry=>{calls.push(['select',entry]);return true;};
 editor.disposeRacePlaytestSession=()=>calls.push(['dispose']);
 editor.resetRacePlaytestInputs=()=>{editor.raceInput.autoShift=true;};
 editor.startPlaytest=(id,options)=>calls.push(['start',id,options]);
 return {editor,calls};
}
const picker=async()=>({action:'open',name:'New Car',payload:{data:{id:'new',engine:{power:500}}}});
test('debug car swap installs the new base car, prepares art and reuses track without old car overrides',async()=>{
 const {editor,calls}=fixture(),world=editor.playtestSession.worldBake;
 await editor.selectRaceDebugCar(picker);
 assert.deepEqual(calls.map(c=>c[0]),['select','dispose','start']);
 assert.equal(calls[0][1].car.engine.power,500);
 assert.equal(calls[2][1],'saved:New Car');
 assert.equal(calls[2][2].preparedWorldBake,world);
 assert.equal(calls[2][2].runtimeCarOverrides,undefined);
 assert.equal(calls[2][2].debugCarOverride,true);
 assert.equal(editor.raceInput.autoShift,false);
 assert.ok(editor.racePreparedArtFrames.has('body:frame:0'));
 assert.equal(editor.playtestSession.raceTravelPreparedArtOnly,true);
});
test('cancelled or stale car picker leaves current race alone',async()=>{
 for(const stale of [false,true]){
  const {editor,calls}=fixture();
  await editor.selectRaceDebugCar(async()=>{if(stale)editor.playtestSession={};return stale?picker():null;});
  assert.deepEqual(calls,[]);
 }
});
test('failed car artwork preparation keeps old session alive',async()=>{
 const {editor,calls}=fixture();editor.getRaceArtSpriteCanvas=()=>null;
 await assert.rejects(editor.selectRaceDebugCar(picker),/prepare car artwork/);
 assert.deepEqual(calls,[]);assert.equal(editor.playtestSession.raceTravelPreparedArtOnly,true);
});
test('lighting presets and deterministic imports match sky and scene brightness',()=>{
 for(const name of ['morning','noon','evening','night']){
  const preset=raceFxPreset(name);assert.equal(preset.visualFx.skyBrightness,preset.brightness);
 }
 for(let i=0;i<30;i++){
  const race={};applySideRaceLighting(race,'lighting-test-'+i);
  assert.equal(race.visualFx.skyBrightness,race.brightness);
 }
});

test('debug car condition never overwrites the campaign garage car',async()=>{
 const {editor}=fixture();editor.mode='race';
 let saves=0;editor.game.raceTravelSession.garage={saveCondition:()=>saves++};
 await editor.persistRaceMechanicalCondition({mechanical:{},debugCarOverride:true});
 assert.equal(saves,0);
 await editor.persistRaceMechanicalCondition({mechanical:{},carId:'original'});
 assert.equal(saves,1);
});
