import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {campaignRegionState,campaignRaceAccess,migrateCampaignProgress,refreshCampaignScreen,PROVIDENCE_BOSS} from '../../src/menus/CampaignProgression.js';
import {raceCompletionKey,worldMapNodes} from '../../src/menus/MenuWorldMap.js';
import {setMenuProgress} from '../../src/menus/MenuProgress.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const config=menu.parameters.campaignProgression,first=config.regions[0];
const clear=(p,ref)=>p[raceCompletionKey(ref)]=true;
test('fresh campaigns open four local events, keep Providence locked, and launch Tower Hill first',()=>{
 assert.equal(menu.parameters.campaignOpeningRace,'Tower Hill Road');assert.equal(first.bossRef,PROVIDENCE_BOSS);
 assert.deepEqual(first.events.slice(0,4),['Tower Hill Road','RI 116 — North Smithfield Scituate','Blue Hills — Reservation Parkways','RI 44 — Putnam Pike Glocester']);
 assert.equal(campaignRegionState(config,first.bossRef).available.length,4);
 assert.equal(campaignRaceAccess(config,first.bossRef).allowed,false);
 assert.equal(campaignRaceAccess(config,config.regions[1].events[0]).allowed,false);
 const detours=menu.screens.find(s=>s.id==='campaign-hub-1-detours');assert.ok(detours.elements.some(e=>e.action?.value==='Tower Hill Road'));
 assert.ok(!menu.screens.filter(s=>s.id.startsWith('campaign-hub-1-cities')).flatMap(s=>s.elements).some(e=>e.action?.value===PROVIDENCE_BOSS));
});
test('every region offers four at a time, nine distinct wins unlock boss, victory opens all and next region',()=>{
 const p={campaignProgressionVersion:1};
 for(const region of config.regions){
  const state=()=>campaignRegionState(config,region.bossRef,p);
  assert.equal(state().available.length,4);assert.equal(state().bossReady,false);
  for(let wins=0;wins<9;wins++){
   const next=state().available.find(ref=>!p[raceCompletionKey(ref)]);assert.ok(next,'must never run out of accessible new events');
   assert.ok(campaignRaceAccess(config,next,p).allowed);clear(p,next);
   assert.equal(state().wins,wins+1);assert.equal(state().available.length,Math.min(region.events.length,4*(1+Math.floor(Math.min(wins+1,6)/3))));
  }
  assert.equal(state().bossReady,true);clear(p,region.bossRef);
  assert.equal(state().available.length,region.events.length);
  for(const ref of region.events)assert.ok(campaignRaceAccess(config,ref,p).allowed);
 }
});
test('replays do not count twice; a second save remains independent; TRAVEL bypasses gates',()=>{
 const p={};clear(p,first.events[0]);const garage={rewards:{[first.events[0]]:{clears:99}}};
 assert.equal(campaignRegionState(config,first.bossRef,p,garage).wins,1);
 assert.equal(campaignRegionState(config,first.bossRef,{}).wins,0);
 assert.ok(campaignRaceAccess(config,config.regions.at(-1).bossRef,{}, {},{'cheat.travel':true}).allowed);
 assert.equal(campaignRaceAccess(config,first.bossRef,{}, {},{'cheat.skipme':true}).allowed,false);
});
test('old Tower boss completions migrate once, while new optional Tower wins cannot skip Providence',()=>{
 const legacy=migrateCampaignProgress({[raceCompletionKey('Tower Hill Road')]:true});assert.ok(legacy[raceCompletionKey(PROVIDENCE_BOSS)]);
 const fresh=migrateCampaignProgress({});clear(fresh,'Tower Hill Road');assert.equal(migrateCampaignProgress(fresh)[raceCompletionKey(PROVIDENCE_BOSS)],undefined);
 assert.deepEqual(migrateCampaignProgress(legacy),legacy);
});
test('losing a replay cannot revoke a saved completion',async()=>{
 const key=raceCompletionKey(first.events[0]);let saved;
 const game={menuProgress:{campaignProgressionVersion:1,[key]:true},campaignSaves:{hasActive:true,save:async({progress})=>{saved=progress;return {ok:true}}}};
 await setMenuProgress(game,{[key]:false});assert.equal(saved[key],true);assert.equal(game.menuProgress[key],true);
});
test('locked buttons remain focusable and explain progress; race launch also enforces the gate',async()=>{
 const screen=structuredClone(menu.screens.find(s=>s.id==='campaign-hub-1'));
 refreshCampaignScreen(screen,config,{}, {},{});assert.equal(screen.elements.find(e=>e.action?.value===first.bossRef).label,'Main Mission (0/9)');
 const player=Object.create(MenuPlayer.prototype);player.flow={document:menu,parameters:{},busy:false,run:()=>assert.fail('locked action ran')};player.resources={};
 await player.activate(screen.elements.find(e=>e.action?.value===first.bossRef));assert.match(player.flow.error,/9 different/);
 await assert.rejects(()=>player.launchRace(first.bossRef,{}),/9 different/);
});
test('world-map pins represent open regions, not whether their boss is ready',()=>{
 const map=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 const nodes=worldMapNodes(map,{},menu,{});assert.equal(nodes[0].locked,false);assert.equal(nodes[1].locked,true);
 const p={[raceCompletionKey(first.bossRef)]:true};assert.equal(worldMapNodes(map,{},menu,p)[1].locked,false);
});
