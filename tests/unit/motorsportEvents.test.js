import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {motorsportCatalog,motorsportRaceMetadata,createMotorsportEvent,readMotorsportEvent,completeMotorsportRound,seriesStandings,serviceMotorsportEvent,availableSeriesService,applyMotorsportRace} from '../../src/menus/MotorsportEvents.js';
import {MotorsportMenu,installMotorsportNavigation} from '../../src/menus/MotorsportMenu.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
import {normalizeMenuVariables} from '../../src/menus/MenuProgress.js';
const circuit={type:'circuit',laps:3,source:{layoutName:'Grand Prix'},road:{width:10,nodes:[{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500},{x:0,y:0}],segments:[]}};
const cup={id:'cup',name:'Test Cup',kind:'championship',heat:2,rounds:[{ref:'A',laps:3},{ref:'B',laps:3},{ref:'C',laps:3}]};
const rally={id:'rally',name:'Test Rally',kind:'rally',heat:2,serviceEvery:3,rounds:Array.from({length:12},(_,i)=>({ref:`Stage ${i%4}`,seconds:100,pass:Math.floor(i/4)+1}))};
const run=(definition=cup)=>({...createMotorsportEvent(definition,'RTG-001',{},'run-1'),phase:'racing'});
function session(){return {elapsedMs:90000,routeLength:1000,aiRuntime:Array.from({length:5},(_,i)=>({id:`series-ai-${i}`,lap:3,distance:900-i*50})),menuConfiguration:{motorsportId:'run-1',motorsportRound:0}};}

test('only explicitly imported, closed circuits qualify; street loops and open roads do not',()=>{
 assert.equal(motorsportRaceMetadata(circuit).properCircuit,true);
 assert.equal(motorsportRaceMetadata({...circuit,type:'sprint'}).properCircuit,false);
 assert.equal(motorsportRaceMetadata({...circuit,source:{}}).properCircuit,false);
 assert.equal(motorsportRaceMetadata({...circuit,road:{...circuit.road,nodes:circuit.road.nodes.slice(0,-1)}}).properCircuit,false);
 assert.equal(motorsportRaceMetadata({...circuit,road:{...circuit.road,network:{}}}).properCircuit,false);
});
test('catalog uses three authored rounds and refuses to substitute missing circuits',()=>{
 const entries=['WeatherTech Raceway Laguna Seca','Watkins Glen — Long Course','Road America — Full Course'].map(ref=>({ref,properCircuit:true}));
 assert.equal(motorsportCatalog(entries).championships.length,1);
 assert.equal(motorsportCatalog(entries.slice(0,2)).championships.length,0);
});
test('short and full rallies use installed stages, named passes, and service intervals',()=>{
 const entries=['A','B','C'].map(ref=>({ref,stageSeconds:100,rally:{id:'local',name:'Local Rally'}}));
 const {rallies}=motorsportCatalog(entries);assert.deepEqual(rallies.map(r=>r.rounds.length),[4,12]);
 assert.equal(rallies[1].rounds[3].pass,2);assert.equal(rallies[1].serviceEvery,3);
 assert.ok(rallies[1].rounds.every(r=>entries.some(e=>e.ref===r.ref)));
});
test('race overlay supplies five stable AI drivers without changing saved road geometry',()=>{
 const original=structuredClone(circuit),race=applyMotorsportRace(circuit,run());
 assert.equal(race.competition.aiDrivers.length,5);assert.equal(race.competition.trafficEnabled,false);
 assert.ok(race.competition.aiDrivers.every(d=>d.rubberBanding===0));
 assert.equal(race.finishBehavior.menuScreen,'motorsport-event');assert.deepEqual(circuit,original);
 assert.throws(()=>applyMotorsportRace({...circuit,type:'sprint'},run()),/closed/);
 const stage=applyMotorsportRace({...circuit,type:'sprint'},run(rally));assert.equal(stage.competition.mode,'solo');assert.equal(stage.competition.aiDrivers.length,0);
});
test('classification respects real AI finish times before ranking trailing cars by progress',()=>{
 const s=session();s.aiRuntime[3].seriesFinishMs=80000;s.aiRuntime[3].lap=4;
 const result=completeMotorsportRound(run(),s);
 assert.deepEqual(result.results[0].classification.map(r=>r.id),['series-ai-3','player','series-ai-0','series-ai-1','series-ai-2','series-ai-4']);
 assert.equal(seriesStandings(result).find(r=>r.id==='player').points,18);
 assert.equal(result.phase,'between');assert.equal(result.round,1);
 assert.deepEqual(completeMotorsportRound(result,s),result,'duplicate completion must not score twice');
});
test('championship accumulates all three rounds then completes',()=>{
 let state=run();for(let i=0;i<3;i++)state=completeMotorsportRound({...state,phase:'racing'},session());
 assert.equal(state.phase,'complete');assert.equal(state.round,3);assert.equal(seriesStandings(state)[0].points,75);
});
test('rally competitor times are reproducible and independent of player pace',()=>{
 const a=completeMotorsportRound(run(rally),{...session(),elapsedMs:50000});
 const b=completeMotorsportRound(run(rally),{...session(),elapsedMs:180000});
 for(const id of ['series-ai-0','series-ai-4'])assert.equal(a.results[0].classification.find(r=>r.id===id).timeMs,b.results[0].classification.find(r=>r.id===id).timeMs);
 assert.equal(seriesStandings(a)[0].id,'player');assert.notEqual(seriesStandings(b)[0].id,'player');
});
test('DNF awards no points and ends the event',()=>{
 const state=completeMotorsportRound(run(),session(),{dnf:true});
 assert.equal(state.phase,'complete');assert.equal(seriesStandings(state).find(r=>r.id==='player').points,0);
});
test('service is scheduled, budgeted, component-specific, and preserves other damage',()=>{
 let state=run(rally);state.condition.mechanical.components.gearbox.damage=80;
 assert.throws(()=>serviceMotorsportEvent(state,'tires'),/scheduled/);
 state={...state,phase:'between',round:3,serviceBudget:30};
 assert.ok(!availableSeriesService(state).some(g=>g.id==='engine'));
 assert.throws(()=>serviceMotorsportEvent(state,'engine'),/unavailable/);
 state.condition.mechanical.components.tire_fl.damage=70;state.condition.mechanical.tires.fl.tread=.2;
 const repaired=serviceMotorsportEvent(state,'tires');assert.equal(repaired.serviceBudget,18);
 assert.equal(repaired.condition.mechanical.components.tire_fl.damage,0);assert.equal(repaired.condition.mechanical.tires.fl.tread,1);
 assert.equal(repaired.condition.mechanical.components.gearbox.damage,80);
 assert.throws(()=>serviceMotorsportEvent(repaired,'suspension'),/points/);
 assert.equal(state.condition.mechanical.tires.fl.tread,.2,'transaction does not mutate old snapshot');
 const full=serviceMotorsportEvent({...state,round:6,serviceBudget:60},'drivetrain');assert.equal(full.condition.mechanical.components.gearbox.damage,0);assert.equal(full.serviceBudget,30);
});
test('full rally grants limited, full, limited service with no budget carryover',()=>{
 let state=run(rally);for(let i=0;i<9;i++){
  state=completeMotorsportRound({...state,phase:'racing'},session());
  assert.equal(state.serviceBudget,({3:30,6:60,9:30})[i+1]||0);
 }
});
test('event state survives primitive-only profile normalization and rejects corrupt JSON',()=>{
 const state=run(rally),progress=normalizeMenuVariables({motorsportEvent:JSON.stringify(state)});
 assert.deepEqual(readMotorsportEvent(progress.motorsportEvent),state);
 assert.equal(readMotorsportEvent('oops'),null);assert.equal(readMotorsportEvent({...state,round:100}),null);
});
function menuFixture(){
 const document={startScreen:'world-map',parameters:{raceIndex:[],carRef:'RTG-001'},screens:[{id:'world-map',elements:[]}]};
 installMotorsportNavigation(document);
 const player={flow:new MenuFlow(document),game:{menuProgress:{}},resources:{garage:{configuration:()=>({installed:{},tune:{}})}},cleanupScreen(){}};
 player.game.menuPlayer=player;const controller=new MotorsportMenu(player);player.motorsport=controller;
 controller.save=async state=>{player.flow.parameters.motorsportEvent=state?JSON.stringify(state):'';};return {player,controller};
}
test('navigation replaces old collections without removing races; installation is idempotent',()=>{
 const doc={screens:[{id:'world-map',elements:[{id:'world-space'},{id:'world-international'},{id:'world-rallies'},{id:'map'}]}]};installMotorsportNavigation(doc);installMotorsportNavigation(doc);
 assert.deepEqual(doc.screens[0].elements.map(e=>e.id),['map','world-race-index','world-championships','world-rally']);
});
test('series menu actions enter, save, resume, service and confirm retirement with standard controls',async()=>{
 const {controller:c,player:p}=menuFixture();c.selection=rally;await c.activate('motorsport-enter');
 assert.equal(c.state.carRef,'RTG-001');assert.equal(p.flow.screenId,'motorsport-event');
 await c.save({...c.state,phase:'between',round:6,serviceBudget:60});await c.activate('motorsport-service');
 assert.equal(p.flow.screen.elements.filter(e=>e.type==='button').length,8);
 await c.activate('motorsport-repair-tires');assert.equal(c.state.serviceBudget,48);
 await c.activate('motorsport-retire');assert.ok(c.state);await c.activate('motorsport-retire-confirm');assert.equal(c.state,null);
});
test('driver launch uses locked entry and retained condition, blocks mid-event setup changes',async()=>{
 const {controller:c,player:p}=menuFixture();await c.save({...run(rally),phase:'between',round:3,serviceBudget:30});
 let args;p.game.startRaceTravel=async value=>{args=value;return true;};await c.drive();
 assert.equal(args.carRef,'RTG-001');assert.equal(args.menuConfiguration.motorsportRound,3);assert.equal(args.motorsportEvent.serviceBudget,0);
 assert.ok(args.motorsportEvent.condition.mechanical);
 p.resources.garage.configuration=()=>({installed:{tires:'race'},tune:{}});await assert.rejects(c.drive(),/Restore/);
});
test('duplicate and stale result callbacks never advance another round',async()=>{
 const {controller:c}=menuFixture();await c.save(run());const s=session();await c.record(s);await c.record(s);assert.equal(c.state.round,1);
 await c.save({...c.state,phase:'racing'});await c.record(s);assert.equal(c.state.round,1);
});
test('installed catalog has all four cups and all saved rally collections; menus stay under eight controls',()=>{
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 const catalog=motorsportCatalog(menu.parameters.raceIndex);assert.equal(catalog.championships.length,4);
 assert.equal(catalog.rallies.length,new Set(menu.parameters.raceIndex.filter(e=>e.rally).map(e=>e.rally.id)).size*2);
 const {controller:c,player:p}=menuFixture();p.flow.document.parameters.raceIndex=menu.parameters.raceIndex;
 p.flow.parameters.motorsportEvent=JSON.stringify(run());
 for(let page=0;page<Math.ceil(catalog.rallies.length/4);page++){c.open('rallies',page);assert.ok(p.flow.screen.elements.filter(e=>e.type==='button').length<=8);}
});

test('Back works during button dispatch and service returns without a navigation loop',async()=>{
 const {controller:c,player:p}=menuFixture();c.open();
 p.flow.busy=true;await c.activate('motorsport-back');assert.equal(p.flow.screenId,'world-map');p.flow.busy=false;
 c.open('rallies');await c.save({...run(rally),phase:'between',round:3,serviceBudget:30});c.showEvent();
 const history=[...p.flow.history];c.showService();await c.activate('motorsport-service-back');
 assert.equal(p.flow.screenId,'motorsport-event');assert.deepEqual(p.flow.history,history);
});
