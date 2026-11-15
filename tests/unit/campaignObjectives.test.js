import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {campaignConditionSnapshot,campaignRunSummary,evaluateCampaignRun} from '../../src/garage/CampaignObjectives.js';
import {awardCampaignRace,raceRewardQuote} from '../../src/garage/CampaignEconomy.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import parts from '../../src/content/garage-parts.json' with {type:'json'};
const ref='Mount Washington Auto Road — point-to-point';
test('feedback measures only new damage; missing telemetry, debug and recoveries cannot set records',()=>{
 const mechanical={components:{radiator:{damage:50},damper_fl:{damage:20}}};
 const session={mechanical,campaignStartCondition:campaignConditionSnapshot(mechanical),elapsedMs:10000,carId:'RTG-001'};
 mechanical.components.damper_fl.damage=32;
 let run=campaignRunSummary(session);assert.equal(run.worstDamage,12);assert.equal(run.worstPart,'damper_fl');
 assert.equal(evaluateCampaignRun(ref,run).objectiveBonus,0);
 assert.match(evaluateCampaignRun(ref,run).feedback,/12% damage to FL damper/);
 session.campaignRecoveries=1;assert.equal(evaluateCampaignRun(ref,campaignRunSummary(session)).personalBest,false);
 session.campaignRecoveries=0;session.debugEnvironment={};assert.equal(evaluateCampaignRun(ref,campaignRunSummary(session)).personalBest,false);
 delete session.debugEnvironment;delete session.campaignStartCondition;
 const missing=evaluateCampaignRun(ref,campaignRunSummary(session));assert.equal(missing.objectiveBonus,0);assert.equal(missing.feedback,'');
});
test('Tower timed exit can earn the care bonus but cannot claim a full-course personal best',()=>{
 const result=evaluateCampaignRun('Tower Hill Road',{eligible:true,measured:true,finished:false,elapsedMs:210000,recoveries:0,worstDamage:0});
 assert.equal(result.objectiveBonus,150);assert.equal(result.personalBest,false);
});
test('first three authored races fund service and modest damage repair without bonus grinding',async()=>{
 const read=p=>JSON.parse(fs.readFileSync(p));
 const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
 const stages=read('data/campaigns/america/catalog.json').slice(0,3);
 const car=decode(read('data/server-storage/files/cars/RTG-001/document.json')).car;
 const game={player:{credits:500},abilities:{}};
 const items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true}),library:{load:async id=>normalizeItemDocument(parts.items.find(p=>p.id===id))}});
 game.items=items;const garage=items.garage;await garage.load();
 for(const stage of stages){
  const race=decode(read('data/server-storage/files/'+stage.documentPath)).race;
  const quote=raceRewardQuote(stage.name,race,garage.progress);
  const reward=await awardCampaignRace(garage,{ref:stage.name,race,runId:stage.id});
  assert.equal(reward.objectiveBonus,0,'base economy must stand without optional rewards');
  await garage.equip('RTG-001',quote.part);
  const mechanical=createMechanicalState({fuel:0,oil:0,coolant:0,charge:0},{},car?.mechanics);
  for(const id of ['damper_fl','damper_fr','damper_rl','damper_rr'])if(mechanical.components[id])mechanical.components[id].damage=10;
  await garage.saveCondition('RTG-001',{mechanical});
  const repair=garage.repairRows('RTG-001',car||{}).find(r=>r.id==='all');
  assert.ok(repair.cost<reward.base,'repeat payout covers this modest damage scenario');
  await garage.repair('RTG-001','all',car||{});
  assert.ok(game.player.credits>=500,'no spending of starting safety reserve');
  console.log(`${stage.name}: first ${reward.scrap}, repeat ${reward.base}, service + modest repair ${repair.cost}, balance ${game.player.credits}`);
 }
 assert.ok(garage.installed('RTG-001').some(i=>i.id==='rally-suspension'));
 assert.equal(items.progress.bags.items['snow-tires'],1);
 assert.equal(items.progress.bags.items['rain-tires'],1);
});
test('result summary uses the existing menu and stays within eight entries',()=>{
 const editor=Object.create(RaceEditor.prototype);
 Object.defineProperty(editor,'selectedRace',{value:{}});editor.playtestSession={raceResults:true,elapsedMs:60000,campaignReward:{scrap:1000,partName:'Snow Tires',objectiveStatus:'Objective met',objectiveBonus:150,personalBest:true,bestTimeMs:60000}};
 const rows=editor.getRacePauseMenuRows();assert.ok(rows.length<=8);assert.equal(rows.at(-1).id,'race-results-continue');assert.ok(rows.some(r=>r.id==='race-result-best'));
});
