import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {campaignRegionState,campaignRaceAccess,migrateCampaignProgress,refreshCampaignScreen,PROVIDENCE_BOSS} from '../../src/menus/CampaignProgression.js';
import {raceCompletionKey,worldMapNodes} from '../../src/menus/MenuWorldMap.js';
import {setMenuProgress} from '../../src/menus/MenuProgress.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const config=menu.parameters.campaignProgression,first=config.regions[0];
const clear=(p,ref)=>p[raceCompletionKey(ref)]=true;
test('fresh campaigns open the first path stop, keep Providence locked, and launch Tower Hill first',()=>{
 assert.equal(menu.parameters.campaignOpeningRace,'Tower Hill Road');assert.equal(first.bossRef,PROVIDENCE_BOSS);
 assert.deepEqual(first.events.slice(0,4),['Tower Hill Road','RI 116 — North Smithfield Scituate','Blue Hills — Reservation Parkways','RI 44 — Putnam Pike Glocester']);
 assert.deepEqual(campaignRegionState(config,first.bossRef,{}, {},menu).available,['Tower Hill Road']);
 assert.equal(campaignRaceAccess(config,first.bossRef,{}, {},{},menu).allowed,false);
 assert.equal(campaignRaceAccess(config,config.regions[1].events[0]).allowed,false);
 const detours=menu.screens.find(s=>s.id==='campaign-hub-1-detours');assert.ok(detours.elements.some(e=>e.action?.value==='Tower Hill Road'));
 assert.ok(!menu.screens.filter(s=>s.id.startsWith('campaign-hub-1-cities')).flatMap(s=>s.elements).some(e=>e.action?.value===PROVIDENCE_BOSS));
});
test('legacy progression without a regional widget preserves its saved main-path gates',()=>{
 const p={campaignProgressionVersion:1};
 for(const region of config.regions){
  const state=()=>campaignRegionState(config,region.bossRef,p);
  assert.equal(state().bossReady,false);
  assert.deepEqual(state().available,[region.mainPath[0]]);
  for(const ref of region.events.filter(ref=>!region.mainPath.includes(ref)))clear(p,ref);
  assert.equal(state().wins,0);assert.equal(state().bossReady,false);
  for(const [i,ref] of region.mainPath.entries()){
   assert.ok(campaignRaceAccess(config,ref,p).allowed);
   if(i<4)assert.equal(campaignRaceAccess(config,region.mainPath[i+1],p).allowed,false);
   clear(p,ref);assert.equal(state().wins,i+1);
  }
  assert.equal(state().bossReady,true);clear(p,region.bossRef);
  for(const ref of region.events)assert.ok(campaignRaceAccess(config,ref,p).allowed);
 }
});
function graphFixture(){
 const node=(id,raceRef,kind='race')=>({id,raceRef,kind});
 const region={stage:1,bossRef:'Boss',mainPath:['Entry','Other'],events:['Entry','Other','Branch','Beyond','Disconnected','Abandoned','Off-map']};
 const graph={type:'world-map',property:'campaign-path',assetRef:'Boss',nodes:[
  node('junction-start','','junction'),node('entry','Entry'),node('junction-choice','','junction'),
  node('other','Other'),node('branch','Branch'),node('beyond','Beyond'),node('junction-boss','','junction'),
  node('final','Boss'),node('off-left','Disconnected'),node('off-right','Abandoned'),
 ],connections:[
  ['junction-start','entry'],['entry','junction-choice'],['junction-choice','other'],['junction-choice','branch'],
  ['branch','beyond'],['branch','junction-boss'],['junction-boss','final'],['off-left','off-right'],
 ].map(([from,to])=>({from,to}))};
 const config={regions:[region,{stage:2,bossRef:'Next Boss',events:['Next First']}]};
 const document={screens:[{id:'campaign-hub-1',elements:[graph]}]};
 return {config,document,graph};
}
test('authored widget roads govern reachable stops and boss access after completing the main path',()=>{
 const {config,document}=graphFixture(),p={};
 const state=()=>campaignRegionState(config,'Boss',p,{},document);
 const access=ref=>campaignRaceAccess(config,ref,p,{},{},document);
 assert.equal(state().graphBased,true);assert.ok(!('required' in state()));
 assert.deepEqual(state().available,['Entry']);assert.equal(access('Boss').allowed,false);
 assert.equal(access('Next First').allowed,false);
 clear(p,'Disconnected');assert.equal(access('Disconnected').allowed,true,'earned older clears remain replayable');
 assert.equal(access('Abandoned').allowed,false,'disconnected saved clears cannot reveal an edge');
 clear(p,'Entry');
 assert.deepEqual(state().available,['Entry','Other','Branch']);
 assert.equal(state().cleared('Branch'),false);
 assert.equal(access('Boss').allowed,false,'a merely available frontier cannot unlock the boss');
 clear(p,'Other');clear(p,'Branch');assert.equal(access('Boss').allowed,true);
 assert.equal(access('Beyond').allowed,true,'cleared branch opens its normal neighbor');
 assert.equal(access('Off-map').allowed,false,'no open by optional win tally');
 clear(p,'Boss');assert.ok(access('Next First').allowed);assert.ok(access('Off-map').allowed);
});
test('authored graph edits remove old routes and never connect a boss across an uncleared intervening race',()=>{
 const {config,document,graph}=graphFixture(),p={};
 graph.connections=graph.connections.filter(c=>c.from!=='branch'||c.to!=='junction-boss');
 graph.connections.push({from:'beyond',to:'junction-boss'});
 const access=ref=>campaignRaceAccess(config,ref,p,{},{},document);
 clear(p,'Entry');
 assert.equal(access('Boss').allowed,false);
 assert.equal(access('Branch').allowed,true);
 clear(p,'Branch');assert.equal(access('Boss').allowed,false);clear(p,'Other');clear(p,'Beyond');assert.equal(access('Boss').allowed,true);
 graph.connections=graph.connections.filter(c=>c.to!=='final');
 assert.equal(access('Boss').allowed,false,'boss availability follows live road edits');
 graph.connections.push({from:'off-right',to:'final'});
 clear(p,'Disconnected');clear(p,'Abandoned');
 assert.equal(access('Boss').allowed,false,'a disconnected authored branch cannot expose the boss');
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
 const screen=structuredClone(menu.screens.find(s=>s.id==='campaign-hub-1-events'));
 refreshCampaignScreen(screen,config,{}, {},{},menu);assert.equal(screen.elements.find(e=>e.action?.value===first.bossRef).label,'Main Mission (Locked)');
 const player=Object.create(MenuPlayer.prototype);player.flow={document:menu,parameters:{},busy:false,run:()=>assert.fail('locked action ran')};player.resources={};
 await player.activate(screen.elements.find(e=>e.action?.value===first.bossRef));assert.match(player.flow.error,/main route/);
 await assert.rejects(()=>player.launchRace(first.bossRef,{}),/main route/);
});
test('world-map pins represent open regions, not whether their boss is ready',()=>{
 const map=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 const nodes=worldMapNodes(map,{},menu,{});assert.equal(nodes[0].locked,false);assert.equal(nodes[1].locked,true);
 const p={[raceCompletionKey(first.bossRef)]:true};assert.equal(worldMapNodes(map,{},menu,p)[1].locked,false);
});
