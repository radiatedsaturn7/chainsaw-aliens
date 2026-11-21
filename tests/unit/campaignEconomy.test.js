import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemProgress} from '../../src/items/ItemEffects.js';
import {awardCampaignRace,raceRewardQuote,ownedCampaignCars,campaignCarPrice} from '../../src/garage/CampaignEconomy.js';
import {commitMenuCar} from '../../src/menus/MenuProgress.js';
import {CampaignSaves} from '../../src/menus/CampaignSaves.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import parts from '../../src/content/garage-parts.json' with {type:'json'};
function fixture(){
 let saved;const game={player:{credits:500},menuProgress:{selectedGameCar:'RTG-001'},abilities:{}};
 const items=new ItemSystem(game,{load:async()=>({}),save:async(_key,value)=>{saved=structuredClone(value);return {ok:true};},library:{load:async id=>normalizeItemDocument(parts.items.find(i=>i.id===id))}});game.items=items;
 return {game,items,garage:items.garage,saved:()=>saved};
}
const race={campaign:{lengthM:12000},road:{surface:'snow'}};
test('distance-based payouts have first-clear bonus, predictable repeats and no speed farming',()=>{
 const first=raceRewardQuote('test',race);assert.equal(first.scrap,450);assert.equal(first.total,900);assert.ok(['snow-tires','rally-suspension','rally-differential'].includes(first.part));
 const repeat=raceRewardQuote('test',race,{rewards:{test:{clears:1}}});assert.equal(repeat.total,450);assert.equal(repeat.part,null);
 assert.ok(raceRewardQuote('long',{campaign:{lengthM:20000}}).scrap>first.scrap);
});
test('win pays scrap and a reusable part once; retries are idempotent; next run pays repeat reward',async()=>{
 const {game,garage,items,saved}=fixture();await garage.load();
 const first=await awardCampaignRace(garage,{ref:'Providence, RI — Landmark Run',race,runId:'run1'});
 assert.equal(first.scrap,1200);assert.equal(game.player.credits,1700);assert.equal(items.progress.bags.items['snow-tires'],1);
 assert.equal(items.progress.garage.cars['RTG-001'],undefined,'reward must not install itself');
 await awardCampaignRace(garage,{ref:'Providence, RI — Landmark Run',race,runId:'run1'});assert.equal(game.player.credits,1700);assert.equal(items.events.length,1);
 await awardCampaignRace(garage,{ref:'Providence, RI — Landmark Run',race,runId:'run2'});assert.equal(game.player.credits,2300);assert.equal(items.progress.bags.items['snow-tires'],1);
 assert.equal(saved().stats.credits,2300);assert.equal(normalizeItemProgress(saved()).garage.rewards['Providence, RI — Landmark Run'].clears,2);
});
test('failed missions and failed saves do not award anything; retry after failed save succeeds',async()=>{
 const {garage,items,game}=fixture();await garage.load();
 assert.equal(await awardCampaignRace(garage,{ref:'test',race,runId:'1',success:false}),null);
 const save=items.savePreference;items.savePreference=async()=>({ok:false,reason:'offline'});
 await assert.rejects(awardCampaignRace(garage,{ref:'test',race,runId:'1'}),/offline/);assert.equal(game.player.credits,500);assert.equal(items.events.length,0);
 items.savePreference=save;await awardCampaignRace(garage,{ref:'test',race,runId:'1'});assert.equal(game.player.credits,1400);
});
test('already-owned prize is salvaged; restored travel snapshot keeps currency without duplicating parts',async()=>{
 const {garage,items,game}=fixture();await garage.load();items.progress.bags.items[raceRewardQuote('test',race).part]=1;
 const snapshot={itemProgress:structuredClone(items.progress),itemRevision:0};
 const result=await awardCampaignRace(garage,{ref:'test',race,runId:'1'});assert.ok(result.salvage>0);assert.equal(result.partName,'');
 game.player.credits=500;items.restoreAfterTravel(snapshot);assert.equal(game.player.credits,500+result.scrap);assert.equal(items.progress.bags.items[raceRewardQuote('test',race).part],1);
});
test('owned car migration and switching preserve separate builds, reject unowned cars',async()=>{
 const {game,garage,items}=fixture();await garage.load();assert.deepEqual(ownedCampaignCars(garage.progress,'RTG-001'),['RTG-001']);
 await garage.transaction(next=>{next.garage.ownedCars=['RTG-001','RTG-S'];next.garage.cars['RTG-001']={installed:{},tune:{torqueScale:.9}};});
 await commitMenuCar(game,'RTG-S',{allowSwitch:true,save:async()=>({ok:true})});assert.equal(game.menuProgress.selectedGameCar,'RTG-S');assert.equal(garage.configuration('RTG-001').tune.torqueScale,.9);
 await assert.rejects(commitMenuCar(game,'STI Airslayer',{allowSwitch:true}),/do not own/);
 assert.ok(campaignCarPrice(900)>campaignCarPrice(300));assert.deepEqual(normalizeItemProgress(items.progress).garage.ownedCars,['RTG-001','RTG-S']);
});
test('economy and owned cars belong to each save slot',async()=>{
 const {game,items,garage}=fixture();await garage.load();game.menuPlayer={preview:false,flow:{parameters:{}},settings:{parameters:()=>({}),restore:()=>{}}};
 const saves=new CampaignSaves(game,{load:async()=>({version:1,slots:[null,null,null]}),save:async()=>({ok:true})});game.campaignSaves=saves;
 await saves.startNew(0);game.menuProgress.selectedGameCar='RTG-001';
 await garage.transaction(next=>{next.garage.ownedCars=['RTG-001','RTG-S'];});
 await awardCampaignRace(garage,{ref:'test',race,runId:'1'});await saves.save();
 await saves.startNew(1);assert.equal(items.progress.garage.ownedCars.length,0);assert.equal(game.player.credits,500);
 assert.equal(saves.slots[0].items.stats.credits,1400);assert.equal(saves.slots[0].items.garage.ownedCars.length,2);
});

test('loading race data can be absent without breaking route selection',()=>{assert.ok(Number.isFinite(raceRewardQuote('pending',null,null).total));});

test('optional goal can be earned on replay once; personal bests survive normalization per car',async()=>{
 const {garage,items,game,saved}=fixture();await garage.load();
 const ref='Mount Washington Auto Road — point-to-point';
 const run={eligible:true,measured:true,finished:true,carRef:'RTG-001',elapsedMs:840000,recoveries:1,worstDamage:20,worstPart:'radiator'};
 const first=await awardCampaignRace(garage,{ref,race,runId:'rough',run});
 assert.equal(first.objectiveBonus,0);assert.equal(first.personalBest,false);assert.match(first.feedback,/radiator/i);
 run.recoveries=0;run.worstDamage=4;
 const second=await awardCampaignRace(garage,{ref,race,runId:'clean',run});
 assert.equal(second.objectiveBonus,250);assert.equal(second.personalBest,true);
 const credits=game.player.credits;
 await awardCampaignRace(garage,{ref,race,runId:'clean',run});assert.equal(game.player.credits,credits);
 run.elapsedMs=900000;
 const third=await awardCampaignRace(garage,{ref,race,runId:'slower',run});
 assert.equal(third.objectiveBonus,0);assert.equal(third.personalBest,false);assert.equal(third.bestTimeMs,840000);
 const normalized=normalizeItemProgress(saved());
 assert.equal(normalized.garage.rewards[ref].objectiveEarned,true);
 assert.equal(normalized.garage.rewards[ref].bestTimes['RTG-001'],840000);
 items.progress=normalized;run.carRef='RTG-S';
 const other=await awardCampaignRace(garage,{ref,race,runId:'other',run});assert.equal(other.personalBest,true);
 assert.equal(garage.progress.rewards[ref].bestTimes['RTG-001'],840000);
});

test('failed bonus save rolls back bonus eligibility, time, inventory and currency together',async()=>{
 const {garage,items,game}=fixture();await garage.load();const save=items.savePreference;
 const params={ref:'Laurel Highlands Scenic Byway',race,runId:'clean',run:{eligible:true,measured:true,finished:true,carRef:'RTG-001',elapsedMs:600000,recoveries:0,worstDamage:0}};
 items.savePreference=async()=>({ok:false,reason:'offline'});
 await assert.rejects(awardCampaignRace(garage,params),/offline/);
 assert.equal(game.player.credits,500);assert.equal(garage.progress.rewards[params.ref],undefined);
 items.savePreference=save;const result=await awardCampaignRace(garage,params);assert.equal(result.objectiveBonus,250);
});
