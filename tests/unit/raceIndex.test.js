import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {raceIndexEntries,raceIndexScreen} from '../../src/menus/RaceIndex.js';
import {normalizeRaceLocation} from '../../src/racing/RaceLocation.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {drawRouteFlag,drawCampaignRoutePreview} from '../../src/menus/CampaignRoutePreview.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const entries=raceIndexEntries(menu.parameters.raceIndex);
test('index covers every saved track with previews and explicit state/foreign/unknown groups',()=>{
 const manifest=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json'));
 assert.deepEqual(entries.map(e=>e.ref).sort(),Object.keys(manifest.folders.races).sort());
 for(const e of entries)assert.ok(menu.parameters.campaignRoutePreviews[e.ref]);
 assert.equal(entries.find(e=>e.ref==='Tower Hill Road').group.key,'RI');
 assert.equal(entries.find(e=>e.ref==='Col de Turini').group.key,'FR');
 assert.equal(entries.find(e=>e.ref==='Demo Track').group.key,'unknown');
});
test('scroll visits every race in both directions with headers and at most eight controls',()=>{
 let top=0;
 for(const index of [...entries.keys(),...Array.from(entries.keys()).reverse()]){
  const r=raceIndexScreen(entries,index,top);top=r.top;
  assert.ok(r.screen.elements.some(e=>e.id===`index-race-${index}`));
  const rows=r.screen.elements.filter(e=>e.id.startsWith('index-race-'));
  assert.ok(r.screen.elements.filter(e=>e.type==='button').length<=8);
  assert.ok(r.screen.elements.some(e=>e.id.startsWith('state-')&&e.label===entries[index].group.label));
  assert.ok(rows.every(e=>e.x+e.w<.53));
 }
});
test('index opens without loading tracks, scrolling preserves history, Back returns to map',async()=>{
 const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map(),widgetStates:new Map(),campaignAccess:()=>({allowed:true})});
 player.flow=new MenuFlow({...menu,startScreen:'world-map'});player.flow.screenId='world-map';player.openRaceIndex();
 assert.equal(player.flow.screenId,'race-index');assert.deepEqual(player.flow.history,['world-map']);
 player.scrollRaceIndex(12);assert.equal(player.raceIndexState.index,12);
 await player.activate(player.flow.screen.elements.find(e=>e.id==='index-down'));
 assert.equal(player.raceIndexState.index,13);assert.deepEqual(player.flow.history,['world-map']);
 const ref=player.raceIndexEntries[13].ref;
 player.campaignAccess=()=>({allowed:false,reason:'Locked test'});
 await player.activate(player.flow.screen.elements.find(e=>e.action?.value===ref));
 assert.equal(player.flow.screenId,'race-index');assert.equal(player.flow.error,'Locked test');
 player.campaignAccess=()=>({allowed:true});
 await player.activate(player.flow.screen.elements.find(e=>e.action?.value===ref));
 assert.equal(player.flow.screenId,'garage');assert.equal(player.flow.parameters.raceRef,ref);
 player.flow.back();player.flow.back();assert.equal(player.flow.screenId,'world-map');
});
test('location normalizes legacy metadata and keeps authored locations authoritative',()=>{
 assert.deepEqual(normalizeRaceLocation({source:{state:'Rhode Island',origin:{lat:41,lon:-71}}}),{country:'US',stateCode:'RI',place:'',lat:41,lon:-71});
 assert.equal(normalizeRaceLocation({location:{stateCode:'MA'},source:{stateCode:'RI'}}).stateCode,'MA');
});
test('flags use a green start, checkerboard finish, and opposite sides at a circuit seam',()=>{
 const fills=[],scales=[];const ctx=new Proxy({fillRect(...rect){fills.push({color:this.fillStyle,rect});},scale(...v){scales.push(v);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawRouteFlag(ctx,0,0);assert.ok(fills.some(f=>f.color==='#5cdb88'));
 fills.length=0;drawRouteFlag(ctx,0,0,true);
 assert.equal(fills.filter(f=>f.rect[2]===3&&f.rect[3]===3).length,12);
 assert.equal(fills.filter(f=>f.color==='#ffffff'&&f.rect[2]===3).length,6);
 scales.length=0;
 drawCampaignRoutePreview(ctx,{x:0,y:0,w:400,h:350},{points:'0,0 1000,1000 0,0',surfaces:{asphalt:100},timeOfDay:'day',weather:'clear',distanceM:1000,laps:1,climbM:0},'test',{},()=>{},'testfont');
 assert.ok(scales.some(s=>s[0]===-1&&s[1]===1));assert.ok(scales.some(s=>s[0]===1&&s[1]===1));
});

test('physical SELECT and simulated SELECT both open the index only from the world map',()=>{
 for(const simulated of [false,true]){
  const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map(),widgetStates:new Map(),campaignAccess:()=>({allowed:true}),
   surface:{pressed:()=>key=>simulated&&key==='nextWeapon',previous:{}},navigationRepeat:{},screenTransition:{active:false},cutscene:{active:false}});
  player.flow=new MenuFlow({...menu,startScreen:'world-map'});player.flow.screenId='world-map';
  player.update({wasGamepadPressed:key=>!simulated&&key==='gamepadSelect'},.016);
  assert.equal(player.flow.screenId,'race-index');
  player.flow.back();assert.equal(player.flow.screenId,'world-map');
 }
});

test('International includes every overseas layout, grouped by venue, without US or unknown tracks',()=>{
 const overseas=raceIndexEntries(menu.parameters.raceIndex,'international');
 assert.equal(overseas.filter(e=>!Number.isInteger(e.rally?.section)).length,130);
 assert.equal(overseas.filter(e=>e.venue==='Silverstone').length,4);
 assert.equal(overseas.filter(e=>e.venue==='Fuji Speedway').length,5);
 assert.ok(overseas.every(e=>e.location.country&&e.location.country!=='US'));
 let top=0;
 for(let index=0;index<overseas.length;index++){
  const result=raceIndexScreen(overseas,index,top,()=>({allowed:true}),'international');top=result.top;
  assert.equal(result.category,'international');
  assert.equal(result.screen.elements.find(e=>e.id==='heading').label,'International');
  assert.ok(result.screen.elements.some(e=>e.label===overseas[index].venue));
  assert.ok(result.screen.elements.some(e=>e.action?.value===overseas[index].ref));
  assert.ok(result.screen.elements.filter(e=>e.type==='button').length<=8);
 }
});

test('Race Index opens the complete preview list, preserves scroll and returns to map',async()=>{
 const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map(),widgetStates:new Map(),campaignAccess:()=>({allowed:true})});
 player.flow=new MenuFlow({...menu,startScreen:'world-map'});player.flow.screenId='world-map';
 const button=player.flow.screen.elements.find(e=>e.id==='world-race-index');assert.ok(button);
 await player.activate(button);
 assert.equal(player.raceIndexState.category,'all');
 player.scrollRaceIndex(12);
 assert.equal(player.raceIndexState.category,'all');
 assert.equal(player.widgetStates.get('route-preview:race-index'),player.raceIndexEntries[12].ref);
 assert.deepEqual(player.flow.history,['world-map']);
 player.flow.back();assert.equal(player.flow.screenId,'world-map');
 player.openRaceIndex();assert.equal(player.raceIndexState.index,12);
 assert.equal(player.raceIndexEntries.length,entries.length);
});

test('gamepad can reach Race Index by moving above the northernmost map location',async()=>{
 const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map(),widgetStates:new Map(),resources:{},focus:0});
 player.flow=new MenuFlow({...menu,startScreen:'world-map'});player.flow.screenId='world-map';
 const map=player.flow.screen.elements.find(e=>e.type==='world-map');
 player.flow.setParameter(map.binding,map.nodes.reduce((a,b)=>a.y<b.y?a:b).raceRef);
 await player.activate(map,1,{mapDirection:'up'});
 assert.equal(player.interactive()[player.focus].id,'world-race-index');
});
