import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {CampaignSaves} from '../../src/menus/CampaignSaves.js';
import {commitMenuCar} from '../../src/menus/MenuProgress.js';
import {createAmericaWorldMap} from '../../src/menus/AmericaWorldMap.js';
import {worldMapNodes,worldMapSelectableNodes,raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
import {createMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {campaignConditionSnapshot} from '../../src/garage/CampaignObjectives.js';
import {garageDialogueContext,garageDialogueText} from '../../src/garage/GarageDialogue.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const decode=d=>d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;
const catalog=read('data/campaigns/america/catalog.json');
const stages=catalog.slice(0,3);
const races=stages.map(s=>decode(read('data/server-storage/files/'+s.documentPath)).race);
const car=decode(read('data/server-storage/files/cars/RTG-001/document.json')).car;
const parts=read('src/content/garage-parts.json').items;
const map=createAmericaWorldMap(catalog);
const prizes=['snow-tires','rally-suspension','rain-tires'];

async function boot(store){
 const load=async(key,fallback)=>structuredClone(store.get(key)??fallback);
 const save=async(key,value)=>{store.set(key,structuredClone(value));return {ok:true};};
 const game={player:{health:5,maxHealth:5,armor:0,credits:0},abilities:{},input:{},transitionTo(){},setActiveMusicTrack(){}};
 game.items=new ItemSystem(game,{load,save,library:{load:async id=>normalizeItemDocument(parts.find(p=>p.id===id))}});
 await game.items.load();
 game.campaignSaves=new CampaignSaves(game,{load,save});await game.campaignSaves.load();
 return game;
}
const selectable=game=>worldMapSelectableNodes(worldMapNodes(map,null,null,game.menuProgress)).map(n=>n.raceRef);

// These are injected race outcomes, not an AI driver or a physics simulation.
// The authored races and real completion/equipment/repair/save APIs are exercised.
for(const rough of [false,true])test(`opening sequence: ${rough?'rough runs miss bonuses but still progress':'clean runs earn care bonuses'} across save reloads`,async t=>{
 const store=new Map();let game=await boot(store);
 await game.campaignSaves.startNew(0);await commitMenuCar(game,'RTG-001');
 assert.equal(game.player.credits,500);
 assert.deepEqual(selectable(game),[stages[0].name]);
 let expectedCredits=500;
 for(const [index,stage] of stages.entries()){
  const garage=game.items.garage;
  assert.deepEqual(selectable(game),catalog.slice(0,index+1).map(s=>s.name));
  if(index){
   const before=game.player.credits;
   await garage.equip('RTG-001',prizes[index-1]);
   assert.equal(game.player.credits,before,'earned equipment installs without purchase');
   assert.ok(garage.installed('RTG-001').some(p=>p.id===prizes[index-1]));
  }
  if(index===2)assert.ok(garage.installed('RTG-001').some(p=>p.id==='snow-tires'),'suspension installation preserves tires');
  const mechanical=createMechanicalState(garage.configuration('RTG-001').condition?.mechanical,{},car.mechanics);
  const session={raceId:stage.id,raceDocumentName:stage.name,carId:'RTG-001',elapsedMs:[210000,840000,660000][index],
   finishReason:index===0?'time-limit':'finish',mechanical,campaignStartCondition:campaignConditionSnapshot(mechanical),campaignRecoveries:rough?1:0};
  // Fixed, disclosed wear scenario: all fluids depleted; four dampers at 10%/20% damage.
  for(const key of ['fuel','oil','coolant','charge'])mechanical[key]=0;
  for(const wheel of ['fl','fr','rl','rr'])mechanical.components['damper_'+wheel].damage=rough?20:10;
  game.raceTravelSession={carSelection:{documentName:'RTG-001'},garage};
  const editor=Object.create(RaceEditor.prototype);editor.game=game;editor.mode='race';editor.playtestSession=session;
  Object.defineProperty(editor,'selectedRace',{value:structuredClone(races[index])});
  await editor.saveCampaignRaceResult(session);
  const reward=session.campaignReward;
  assert.equal(reward.objectiveBonus,rough?0:[150,250,250][index]);
  assert.equal(reward.objectiveStatus,rough?'Objective missed':'Objective met');
  assert.equal(reward.personalBest,!rough&&index>0,'scripted Tower ending and recovered runs cannot set full-course records');
  assert.equal(game.items.progress.bags.items[prizes[index]],1);
  assert.equal(game.menuProgress[raceCompletionKey(stage.name)],true);
  assert.deepEqual(selectable(game),catalog.slice(0,index+2).map(s=>s.name));
  expectedCredits+=reward.scrap;assert.equal(game.player.credits,expectedCredits);
  const receipt=structuredClone(garage.progress.rewards[stage.name]);
  await editor.saveCampaignRaceResult(session);
  assert.equal(game.player.credits,expectedCredits,'reopening result cannot award twice');
  assert.deepEqual(garage.progress.rewards[stage.name],receipt);
  const context=garageDialogueContext({id:'garage',elements:[]},{garage},{},new Map(),'garage-play');
  assert.match(garageDialogueText(context),new RegExp(`${rough?20:10}% damage to FL damper`));
  const bill=garage.repairRows('RTG-001',car).find(r=>r.id==='all');
  assert.ok(bill.cost>0&&bill.cost<reward.base,'normal repeat payout covers this repair scenario without bonuses');
  await garage.repair('RTG-001','all',car);
  expectedCredits-=bill.cost;assert.equal(game.player.credits,expectedCredits);
  assert.equal(garage.repairRows('RTG-001',car).find(r=>r.id==='all').cost,0);
  assert.ok(expectedCredits>=500,'preserve the starting safety reserve');
  await game.campaignSaves.save();
  game=await boot(store);await game.campaignSaves.resume(0);
  assert.equal(game.player.credits,expectedCredits);
  assert.deepEqual(game.items.garage.progress.rewards[stage.name],receipt);
  assert.equal(game.items.garage.configuration('RTG-001').condition.mechanical.components.damper_fl.damage,0);
  assert.deepEqual(selectable(game),catalog.slice(0,index+2).map(s=>s.name));
  if(index)assert.ok(game.items.garage.installed('RTG-001').some(p=>p.id===prizes[index-1]));
  t.diagnostic(`${stage.label||stage.name}: reward ${reward.scrap}, repairs ${bill.cost}, balance ${expectedCredits}`);
 }
 const completed=structuredClone(game.campaignSaves.slots[0]);
 await game.campaignSaves.startNew(1);
 assert.equal(game.player.credits,500);assert.deepEqual(game.items.garage.progress.rewards,{});
 assert.deepEqual(game.campaignSaves.slots[0],completed,'new game does not overwrite the tested slot');
});
