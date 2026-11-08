import test from 'node:test';
import assert from 'node:assert/strict';
import {CampaignSaves,CAMPAIGN_SAVE_KEY} from '../../src/menus/CampaignSaves.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {commitMenuCar,setMenuProgress} from '../../src/menus/MenuProgress.js';
import {raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

async function fixture(store=new Map()){
 let fail=false;
 const load=async(key,fallback)=>structuredClone(store.get(key)??fallback);
 const save=async(key,value)=>{if(fail)return {ok:false};store.set(key,structuredClone(value));return {ok:true};};
 const game={player:{health:5,maxHealth:5,armor:0,credits:0},abilities:{},input:{},transitionTo(state){this.state=state;},setActiveMusicTrack(){}};
 game.items=new ItemSystem(game,{load,save});await game.items.load();
 game.campaignSaves=new CampaignSaves(game,{load,save,now:()=>1234});await game.campaignSaves.load();
 return {game,saves:game.campaignSaves,store,fail:value=>{fail=value;}};
}

test('three independent slots restore progress, scrap, tuning, parts and condition across reload',async()=>{
 const {game,saves,store}=await fixture();
 await saves.startNew(0);await commitMenuCar(game,'RTG-001');
 game.player.credits=650;game.items.savedStats.credits=650;
 await game.items.garage.transaction(next=>{next.garage.cars['RTG-001']={installed:{transmission:'race-transmission'},tune:{tirePressureFrontLeftPsi:28}};next.bags.items['race-transmission']=1;});
 await game.items.garage.saveCondition('RTG-001',{damage:{engine:.25}});
 await setMenuProgress(game,{[raceCompletionKey('North 01')]:true,lastCompletedRace:'North 01'});
 const first=structuredClone(saves.slots[0]);
 await saves.startNew(1);assert.equal(game.player.credits,0);assert.deepEqual(game.items.progress.garage.cars,{});
 await commitMenuCar(game,'Other Car');await setMenuProgress(game,{lastCompletedRace:'South 01'});
 assert.deepEqual(saves.slots[0],first);
 const restarted=await fixture(store);await restarted.saves.resume(0);
 assert.equal(restarted.game.menuProgress.selectedGameCar,'RTG-001');assert.equal(restarted.game.player.credits,650);
 assert.equal(restarted.game.items.garage.configuration('RTG-001').installed.transmission,'race-transmission');
 assert.equal(restarted.game.items.garage.configuration('RTG-001').tune.tirePressureFrontLeftPsi,28);
 assert.ok(restarted.game.items.garage.configuration('RTG-001').condition);
 assert.equal(restarted.saves.slots.length,3);
});
test('overwrite requires confirmation and failed persistence preserves the slot and active game',async()=>{
 const {game,saves,store,fail}=await fixture();await saves.startNew(0);await commitMenuCar(game,'Keep Me');
 const original=structuredClone(store.get(CAMPAIGN_SAVE_KEY));
 await assert.rejects(saves.startNew(0),/Confirm/);fail(true);
 await assert.rejects(saves.startNew(0,{overwrite:true}),/Could not save/);
 assert.deepEqual(store.get(CAMPAIGN_SAVE_KEY),original);assert.equal(game.menuProgress.selectedGameCar,'Keep Me');
 fail(false);await saves.startNew(0,{overwrite:true});assert.deepEqual(game.menuProgress,{});
 assert.equal(game.player.credits,0);assert.equal(saves.slots[1],null);
});
test('legacy car and garage migrate once into Slot 1 without deleting legacy data',async()=>{
 const legacy={selectedGameCar:'Existing',lastCompletedRace:'North 03'};
 const store=new Map([['menu-progress',legacy],['rtg-item-progress',{stats:{credits:345},garage:{cars:{Existing:{installed:{},tune:{boost:.8}}}}}]]);
 const {saves}=await fixture(store);assert.equal(saves.slots[0].progress.selectedGameCar,'Existing');
 await saves.resume(0);assert.equal(saves.game.player.credits,345);
 assert.deepEqual(store.get('menu-progress'),legacy);
 await saves.startNew(0,{overwrite:true});const restarted=await fixture(store);assert.deepEqual(restarted.saves.slots[0].progress,{});
});
test('concurrent progress and inventory writes keep both updates in the active slot',async()=>{
 const {game,saves}=await fixture();await saves.startNew(2);
 await Promise.all([setMenuProgress(game,{chapter:'west'}),game.items.garage.transaction(next=>{next.bags.items.medkit=2;})]);
 assert.equal(saves.slots[2].progress.chapter,'west');assert.equal(saves.slots[2].items.bags.items.medkit,2);
 assert.equal(saves.slots[0],null);assert.equal(saves.slots[1],null);
});
test('results autosave waits for condition, includes completion, and retries failed saves',async()=>{
 const {game,saves,fail}=await fixture();await saves.startNew(0);await commitMenuCar(game,'RTG-001');
 game.raceTravelSession={carSelection:{documentName:'RTG-001'},garage:game.items.garage};
 const editor=new RaceEditor(game);editor.mode='race';editor.selectedRace.type='destination';
 const session={raceId:'test-stage',raceDocumentName:'North 01',damage:{engine:.2},mechanical:{}};
 editor.playtestSession=session;
 editor.getRacePauseMenuRows=()=>[{}];
 editor.showRaceResults();await session.campaignSaveTask;
 assert.equal(session.campaignProgressSaved,true);
 assert.equal(saves.slots[0].progress[raceCompletionKey('North 01')],true);
 assert.equal(saves.slots[0].progress.garageReturnCount,1);
 assert.ok(saves.slots[0].items.garage.cars['RTG-001'].condition);
 await editor.saveCampaignRaceResult(session);assert.equal(saves.slots[0].progress.garageReturnCount,1);
 const retry={...session,raceDocumentName:'North 02',campaignProgressSaved:false,campaignSaveTask:null};
 fail(true);await assert.rejects(editor.saveCampaignRaceResult(retry));assert.equal(retry.campaignProgressSaved,false);
 fail(false);await editor.saveCampaignRaceResult(retry);assert.equal(saves.slots[0].progress.garageReturnCount,2);
});
test('Start uses standard screens and clear/copy require confirmation',async()=>{
 const {game,saves}=await fixture();
 const player=new MenuPlayer(game);game.menuPlayer=player;player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};player.resources.prepareScreen=async()=>{};
 const press=async label=>{await player.screenEntryTask;const slot=/^Slot ([ABC])/.exec(label);const e=slot?player.interactive().find(e=>e.action?.value?.index==='ABC'.indexOf(slot[1])):player.interactive().find(e=>e.label===label);assert.ok(e,label);await player.activate(e);await player.screenEntryTask;};
 await player.open(createMenuDocument());
 assert.deepEqual(player.interactive().map(e=>e.label),['Start','Option Mode']);
 await press('Start');assert.equal(player.choicePopup,null);assert.equal(player.flow.screen.background,'#000000');
 await press('Slot A — Empty');assert.equal(player.flow.screenId,'cars');await commitMenuCar(game,'Saved Car');
 await player.open(createMenuDocument());await press('Start');await press('Copy');await press('Slot A');await press('Slot B — Empty');
 assert.equal(saves.slots[1],null);assert.equal(player.interactive()[0].label,'Cancel');
 await press('Cancel');assert.equal(saves.slots[1],null);
 await press('Slot B — Empty');await press('Confirm');assert.deepEqual(saves.slots[1],saves.slots[0]);
 await press('Clear');await press('Slot A');await press('Cancel');assert.ok(saves.slots[0]);
 await press('Slot A');await press('Confirm');assert.equal(saves.slots[0],null);assert.equal(saves.activeSlot,null);
 await press('Slot B');assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.lockedCarRef,'Saved Car');
});
test('copy and clear are atomic on failure and copied saves are independent',async()=>{
 const {saves,game,fail}=await fixture();await saves.startNew(0);await commitMenuCar(game,'Source');
 await saves.startNew(1);await commitMenuCar(game,'Destination');
 const before=structuredClone(saves.slots);fail(true);
 await assert.rejects(saves.copySlot(0,1));await assert.rejects(saves.clear(1));
 assert.deepEqual(saves.slots,before);assert.equal(saves.activeSlot,1);
 fail(false);await saves.copySlot(0,1);assert.equal(saves.activeSlot,null);
 saves.slots[1].progress.selectedGameCar='Changed';assert.equal(saves.slots[0].progress.selectedGameCar,'Source');
 await saves.clear(0);assert.equal(saves.slots[0],null);
});
test('vibration uses shared black and white screens and persists sliders',async()=>{
 const {game}=await fixture();let saved;
 game.raceHaptics={settings:{enabled:true,output:'auto',strength:.65,road:.7,slip:.85,braking:.6,impacts:.9,phonePulse:16},setSettings(value){this.settings=value;},savePreference:async(key,value)=>{saved=value;return {ok:true};}};
 const player=new MenuPlayer(game);player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};player.resources.prepareScreen=async()=>{};
 await player.open(createMenuDocument());await player.flow.run({type:'haptics'});await player.screenEntryTask;
 assert.equal(player.flow.screenId,'vibration');assert.equal(player.flow.screen.background,'#000000');
 assert.ok(player.interactive().every(e=>e.color==='#ffffff'&&e.background==='#000000'&&e.useDefaultFont));
 player.flow.setParameter('haptics.strength',.4);await player.hapticSave;assert.equal(saved.strength,.4);
 await player.flow.run({type:'haptics',target:'effects'});assert.equal(player.flow.screenId,'vibration-effects');
});

test('slot cards show a static car, saved condition and time instead of descriptions',async()=>{
 const {game,saves}=await fixture();assert.equal(saves.describeSlot(0),null);
 await saves.startNew(0);assert.equal(saves.describeSlot(0).time,'00:00:00');
 await commitMenuCar(game,'RTG-001');
 assert.equal(saves.describeSlot(0).condition,100);
 const {normalizeCarCondition}=await import('../../src/garage/GarageRepairs.js');
 const condition=normalizeCarCondition();
 for(const c of Object.values(condition.mechanical.components)){c.damage=100;c.failed=true;}
 saves.slots[0].items.garage.cars['RTG-001']={condition};
 saves.playTimes.set(0,3661);await saves.startNew(1);
 assert.ok(saves.describeSlot(0).condition<25);assert.equal(saves.describeSlot(0).time,'01:01:01');
 const player=new MenuPlayer(game);player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};player.resources.prepareScreen=async()=>{};
 await player.open(createMenuDocument());player.openSaveSlots();
 const elements=player.flow.screen.elements,icon=elements.find(e=>e.type==='car-preview');
 assert.equal(icon.assetRef,'RTG-001');assert.equal(icon.animation,'none');assert.equal(icon.angle,135);
 assert.ok(elements.some(e=>e.label==='01:01:01'));
 assert.ok(elements.some(e=>e.label===`${saves.describeSlot(0).condition}%`));
 assert.ok(elements.some(e=>e.label==='CAR C'));
 assert.ok(!elements.some(e=>/scrap|Last finished/.test(e.label)));
});
test('play time excludes pauses and save menus, persists in partial saves, copies and resets',async()=>{
 const {game,saves,store}=await fixture();await saves.startNew(0);
 game.state='menu-player';game.menuPlayer={flow:{active:true,screenId:'garage',parameters:{},setParameter(key,value){this.parameters[key]=value;}},preview:false};
 saves.tick(.5);saves.tick(.5);assert.equal(saves.playSeconds(0),1);
 game.menuPlayer.paused=true;saves.tick(1);game.menuPlayer.paused=false;
 game.menuPlayer.flow.screenId='saves-start';saves.tick(1);
 game.menuPlayer.preview=true;saves.tick(1);game.menuPlayer.preview=false;
 assert.equal(saves.playSeconds(0),1);
 game.state='race-editor';game.raceTravelSession={};game.raceEditor={playtestSession:{running:true},raceInput:{}};
 saves.tick(1);game.raceEditor.raceInput.paused=true;saves.tick(1);
 await setMenuProgress(game,{chapter:'west'});assert.equal(saves.slots[0].playTimeSeconds,2);
 const reload=await fixture(store);assert.equal(reload.saves.describeSlot(0).time,'00:00:02');
 await saves.copySlot(0,1);assert.equal(saves.describeSlot(1).time,'00:00:02');
 await saves.startNew(0,{overwrite:true});assert.equal(saves.describeSlot(0).time,'00:00:00');
 assert.equal(saves.describeSlot(1).time,'00:00:02');
});

test('driving preferences survive slot reload and apply to the next race without changing saved calls',async()=>{
 const {game,saves,store}=await fixture();await saves.startNew(0);game.raceTravelSession={};
 const editor=new RaceEditor(game);await editor.saveDrivingPreference({raceDrivingLine:false,racePaceMode:'Both',raceTransmission:'manual'});
 const loaded=await fixture(store);await loaded.saves.resume(0);loaded.game.raceTravelSession={};
 const next=new RaceEditor(loaded.game);next.preloadSelectedRaceArtRefs=()=>{};next.prewarmRacePlaytestRenderResources=()=>{};
 next.selectedRace.codriver={enabled:false,spoken:false,calls:[{at:200,text:'Right 6'}]};
 next.startPlaytest(next.selectedCar.id,{hydrateCars:false});
 assert.equal(next.selectedRace.drivingGuide.line,false);assert.equal(next.selectedRace.codriver.enabled,true);
 assert.equal(next.selectedRace.codriver.spoken,true);assert.equal(next.selectedRace.codriver.icons,true);
 assert.equal(next.selectedRace.codriver.calls[0].text,'Right 6');
 assert.equal(next.raceInput.transmissionMode,'manual');assert.equal(next.raceInput.autoShift,false);
 await loaded.saves.startNew(1);assert.equal(loaded.game.menuProgress.racePaceMode,undefined);
 await loaded.saves.resume(0);assert.equal(loaded.game.menuProgress.racePaceMode,'Both');
});
