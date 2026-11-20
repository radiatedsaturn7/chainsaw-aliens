import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';
import {campaignCourse,campaignTargets,campaignRecordKey,startCampaignChallenge,updateCampaignSectors,evaluateCampaignChallenge,normalizeCampaignRecords} from '../../src/garage/CampaignChallenges.js';
import {OPENING_MISSIONS,openingObjective,evaluateCampaignRun} from '../../src/garage/CampaignObjectives.js';
import {raceRewardQuote,awardCampaignRace,campaignCarPrice} from '../../src/garage/CampaignEconomy.js';
import {normalizeGarageProgress} from '../../src/garage/GarageProgress.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {CampaignSaves} from '../../src/menus/CampaignSaves.js';
import parts from '../../src/content/garage-parts.json' with {type:'json'};
import featured from '../../src/content/campaign-featured-rewards.json' with {type:'json'};
const race={id:'test',campaign:{optional:true,sideEventId:'detour-squaw-creek'},road:{nodes:[{x:0,y:0},{x:0,y:1000},{x:0,y:2000},{x:0,y:3000}],segments:Array.from({length:3},()=>({surface:'gravel'}))}};
const run={eligible:true,measured:true,finished:true,carRef:'RTG-001',pi:500,elapsedMs:100000,recoveries:0,worstDamage:0,sectors:[30000,60000]};
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
function fixture(){const game={player:{credits:500},abilities:{}};const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>normalizeItemDocument(parts.items.find(p=>p.id===id))}});game.items=items;return {game,items,garage:items.garage};}
test('every main mission has an attainable distinct goal; only the opener permits timed exit',()=>{
 assert.equal(Object.keys(OPENING_MISSIONS).length,12);
 for(const [ref,goal] of Object.entries(OPENING_MISSIONS)){
  const clean={...run,elapsedMs:1000,componentDamage:{damper_fl:0,pads_fl:0}};
  assert.ok(openingObjective(ref,{},race));assert.equal(evaluateCampaignRun(ref,clean,{},race).objectiveBonus,goal.bonus,ref);
  assert.equal(evaluateCampaignRun(ref,{...clean,recoveries:1},{},race).objectiveBonus,0);
  assert.equal(evaluateCampaignRun(ref,{...clean,finished:false},{},race).objectiveBonus,ref==='Tower Hill Road'?goal.bonus:0);
 }
 assert.equal(evaluateCampaignRun('Moki Dugway',{...run,componentDamage:{pads_fl:9}},{},race).objectiveBonus,0);
 assert.equal(evaluateCampaignRun('Ozark Backroads',run,{},race).objectiveBonus,0,'missing component telemetry is not a clean suspension');
});
test('planning targets use timed geometry and class; snow and corners cost time and laps count',()=>{
 assert.equal(campaignCourse(race).lengthM,3000);
 const stale={...race,campaign:{lengthM:50000}};assert.equal(campaignCourse(stale).lengthM,3000);
 assert.deepEqual(campaignTargets(race,450),campaignTargets(race,499));
 assert.ok(campaignTargets(race,900).goldMs<campaignTargets(race,400).goldMs);
 assert.equal(campaignCourse({...race,type:'circuit',laps:3}).lengthM,3000,'open roads stay point-to-point even if mislabeled');
 const closed={...race,type:'circuit',laps:3,road:{...race.road,nodes:[...race.road.nodes,{x:0,y:0}]}};
 assert.equal(campaignCourse(closed).lengthM,18000);
 const snow={...race,road:{...race.road,segments:race.road.segments.map(()=>({surface:'snow'}))}};
 assert.ok(campaignCourse(snow).seconds>campaignCourse(race).seconds);
 assert.notEqual(campaignRecordKey(snow,'RTG-001',500),campaignRecordKey(race,'RTG-001',500));
});
test('sector crossings interpolate times, survive reverse travel, and compare the matching class record',()=>{
 const session={carId:'RTG-001',raceDocumentName:'test',distance:0,elapsedMs:0,routeLength:3000};startCampaignChallenge(session,race,{});
 session.campaignChallenge.previous={sectors:[1000,2500,4000]};
 session.distance=1500;session.elapsedMs=1500;updateCampaignSectors(session);assert.deepEqual(session.campaignChallenge.sectors,[1000]);
 session.distance=1000;session.elapsedMs=2000;updateCampaignSectors(session);assert.deepEqual(session.campaignChallenge.sectors,[1000]);
 session.distance=2500;session.elapsedMs=3500;updateCampaignSectors(session);assert.deepEqual(session.campaignChallenge.sectors,[1000,3000]);assert.equal(session.campaignChallenge.split.deltaMs,500);
});
test('medals cannot be farmed by changing class; debug, incomplete and recovered runs never set records',()=>{
 const first=evaluateCampaignChallenge(race,run);assert.equal(first.medal,'Gold');assert.equal(first.medalBonus,300);
 const prior={medalRank:3,records:{[first.recordKey]:first.record}};
 const repeat=evaluateCampaignChallenge(race,{...run,pi:600,elapsedMs:1000,sectors:[]},prior);assert.equal(repeat.medalBonus,0);assert.equal(repeat.recordBest,true);
 for(const invalid of [{eligible:false},{measured:false},{finished:false},{recoveries:1},{elapsedMs:NaN}]){
  const result=evaluateCampaignChallenge(race,{...run,...invalid},prior);assert.equal(result.recordBest,false);assert.equal(result.medalBonus,0);
 }
 const result=evaluateCampaignChallenge(race,{...run,elapsedMs:90000,sectors:[25000,55000]},prior);assert.deepEqual(result.sectorDeltas,[-5000,-5000,-10000]);
 const normalized=normalizeGarageProgress({rewards:{test:prior}});assert.deepEqual(normalized.rewards.test.records,prior.records);assert.equal(normalized.rewards.test.medalRank,3);
 assert.deepEqual(normalizeCampaignRecords({bad:{timeMs:-1},fine:{timeMs:10,sectors:[3,2,10]}}),{fine:{timeMs:10,medalRank:0,sectors:[]}});
});
test('featured prizes are valid, advertised, saved once; failed saves roll back medals too',async()=>{
 const ids=new Set(parts.items.map(p=>p.id));for(const prize of Object.values(featured))assert.ok(ids.has(prize.part),prize.part);
 const {garage,items,game}=fixture();await garage.load();const quote=raceRewardQuote('test',race);assert.equal(quote.part,'rally-differential');assert.match(quote.featured,/Gravel expedition/);
 const save=items.savePreference;items.savePreference=async()=>({ok:false,reason:'offline'});
 await assert.rejects(awardCampaignRace(garage,{ref:'test',race,runId:'one',run}),/offline/);assert.equal(game.player.credits,500);assert.equal(garage.progress.rewards.test,undefined);
 items.savePreference=save;const first=await awardCampaignRace(garage,{ref:'test',race,runId:'one',run});assert.equal(first.medalBonus,300);
 const credits=game.player.credits;await awardCampaignRace(garage,{ref:'test',race,runId:'one',run});assert.equal(game.player.credits,credits);
 const repeat=await awardCampaignRace(garage,{ref:'test',race,runId:'two',run});assert.equal(repeat.medalBonus,0);assert.equal(repeat.partName,'');assert.equal(items.progress.bags.items['rally-differential'],1);
});
test('eleven-mission economy funds service and broad modest wear without needing bonuses; cars remain a reachable goal',async()=>{
 const {garage,game}=fixture();await garage.load();const car=read('data/server-storage/files/cars/RTG-001/document.json').car,report=[];
 for(const stage of read('data/campaigns/america/catalog.json')){
  const road=read('data/server-storage/files/'+stage.documentPath).race;
  const reward=await awardCampaignRace(garage,{ref:stage.name,race:road,runId:stage.id});
  const mechanical=createMechanicalState({fuel:0,oil:0,coolant:0,charge:0},{},car.mechanics);
  for(const c of Object.values(mechanical.components))c.damage=5;
  await garage.saveCondition('RTG-001',{mechanical});const cost=garage.repairRows('RTG-001',car).find(r=>r.id==='all').cost;
  assert.ok(reward.base>cost,`${stage.name}: repeat ${reward.base}, repairs ${cost}`);
  await garage.repair('RTG-001','all',car);report.push({name:stage.name,first:reward.scrap,repeat:reward.base,repair:cost,balance:game.player.credits});
 }
 assert.ok(game.player.credits>campaignCarPrice(700));
 fs.mkdirSync('artifacts/campaign-quality',{recursive:true});fs.writeFileSync('artifacts/campaign-quality/economy.json',JSON.stringify({scenario:'All eleven main missions, no medals/objective cash; full fluids and 5% new damage to every component repaired after each race. Synthetic wear, not a driven playthrough.',carPrices:[300,500,700,900].map(pi=>({pi,price:campaignCarPrice(pi)})),missions:report},null,2));
});
test('results keep sector comparisons within the eight-row menu',()=>{
 const editor=Object.create(RaceEditor.prototype);Object.defineProperty(editor,'selectedRace',{value:{campaign:{scoring:'drift'}}});
 editor.playtestSession={raceResults:true,elapsedMs:100000,campaignReward:{scrap:1000,partName:'Prize',objectiveStatus:'Objective met',objectiveBonus:150,bestTimeMs:90000,medal:'Gold',targets:{class:'F'},sectorDeltas:[-1000,2000,-3000]}};
 const rows=editor.getRacePauseMenuRows();assert.ok(rows.length<=8);assert.equal(rows.at(-1).id,'race-results-continue');assert.ok(rows.some(r=>r.id==='race-result-sectors'));
});
test('light damage costs proportionally less, while worn-out tires still cost full replacement',async()=>{
 const {garage}=fixture();await garage.load();const car=read('data/server-storage/files/cars/RTG-001/document.json').car;
 const mechanical=createMechanicalState({}, {},car.mechanics);
 mechanical.components.damper_fl.damage=1;await garage.saveCondition('RTG-001',{mechanical});
 const light=garage.repairRows('RTG-001',car).find(r=>r.id==='damper_fl').cost;
 mechanical.components.damper_fl.damage=10;mechanical.tires.fl.tread=0;
 await garage.saveCondition('RTG-001',{mechanical});const rows=garage.repairRows('RTG-001',car);
 assert.ok(rows.find(r=>r.id==='damper_fl').cost>light);
 const worn=rows.find(r=>r.id==='tire_fl').cost;mechanical.components.tire_fl.failed=true;
 await garage.saveCondition('RTG-001',{mechanical});assert.equal(garage.repairRows('RTG-001',car).find(r=>r.id==='tire_fl').cost,worn);
});
test('drift medals reward controlled slide score rather than a fast straight run',()=>{
 const drift={...race,campaign:{...race.campaign,scoring:'drift'}};
 assert.equal(evaluateCampaignChallenge(drift,{...run,elapsedMs:10,driftScore:0}).medal,'Unranked');
 const first=evaluateCampaignChallenge(drift,{...run,driftScore:9000});assert.equal(first.medal,'Gold');
 const prior={records:{[first.recordKey]:first.record},medalRank:3};
 const better=evaluateCampaignChallenge(drift,{...run,elapsedMs:200000,driftScore:10000},prior);assert.equal(better.recordBest,true);assert.equal(better.record.score,10000);
 assert.equal(normalizeCampaignRecords({[first.recordKey]:better.record})[first.recordKey].score,10000);
});
test('existing clears can claim newly featured rewards once without receiving another first-clear cash bonus',async()=>{
 const {garage,items}=fixture();await garage.load();
 await garage.transaction(next=>{next.garage.rewards.test={clears:2,bestTimes:{}};});
 const quote=raceRewardQuote('test',race,garage.progress);assert.equal(quote.firstBonus,0);assert.equal(quote.part,'rally-differential');
 await awardCampaignRace(garage,{ref:'test',race,runId:'migration'});
 assert.equal(items.progress.bags.items['rally-differential'],1);
 const saved=normalizeGarageProgress(garage.progress);assert.equal(saved.rewards.test.featuredRewardId,'rally-differential');
 const repeat=raceRewardQuote('test',race,saved);assert.equal(repeat.part,null);assert.equal(repeat.featuredEarned,true);
});

test('class records and medals stay isolated in profile slots',async()=>{
 const {game,garage,items}=fixture();await garage.load();game.menuPlayer={preview:false,flow:{parameters:{}},settings:{parameters:()=>({}),restore:()=>{}}};
 const saves=new CampaignSaves(game,{load:async()=>({version:1,slots:[null,null,null]}),save:async()=>({ok:true})});game.campaignSaves=saves;
 await saves.startNew(0);game.menuProgress.selectedGameCar='RTG-001';
 await awardCampaignRace(garage,{ref:'test',race,runId:'one',run});await saves.save();
 assert.equal(saves.slots[0].items.garage.rewards.test.medalRank,3);
 assert.equal(Object.keys(saves.slots[0].items.garage.rewards.test.records).length,1);
 await saves.startNew(1);assert.equal(items.progress.garage.rewards.test,undefined);
 assert.equal(Object.keys(saves.slots[0].items.garage.rewards.test.records).length,1);
});
test('fractional circuit finish cannot round into an extra checkpoint beyond the finish line',()=>{
 const editor=Object.create(RaceEditor.prototype),routeLength=100.006;
 Object.defineProperty(editor,'selectedRace',{value:{road:{segments:[{length:routeLength}]}}});
 editor.getRaceEditableNodes=()=>[];editor.getRaceCarWorldWidth=()=>1.8;
 const checkpoints=editor.getRaceCheckpointDistances({routeLength});assert.equal(checkpoints.at(-1),routeLength);
 editor.playtestSession={routeLength,routeRuntimeType:'circuit',checkpointDistances:checkpoints,checkpointIndex:checkpoints.length-1,passedCheckpoints:[]};
 editor.updateRaceCheckpointProgress({previousDistance:routeLength-.5,nextDistance:0,routeAdvance:.5});
 assert.equal(editor.playtestSession.checkpointIndex,checkpoints.length);
});

test('displayed whole-second medal target is inclusive, without hidden fractional deadlines',()=>{
 const target=campaignTargets(race,500).goldMs;assert.equal(target%1000,0);
 assert.equal(evaluateCampaignChallenge(race,{...run,elapsedMs:target}).medal,'Gold');
 assert.equal(evaluateCampaignChallenge(race,{...run,elapsedMs:target+1}).medal,'Silver');
});
