import {DRIFT_CHALLENGES} from '../../src/menus/DriftChallenges.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {motorsportCatalog,motorsportRaceMetadata,createMotorsportEvent,readMotorsportEvent,completeMotorsportRound,seriesStandings,serviceMotorsportEvent,availableSeriesService,applyMotorsportRace} from '../../src/menus/MotorsportEvents.js';
import {MotorsportMenu,installMotorsportNavigation} from '../../src/menus/MotorsportMenu.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
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
 const entries=['A','B','C','D','E','F'].map((ref,i)=>({ref,stageSeconds:100,rally:{id:'local',name:'Local Rally',section:i+1}}));
 const {rallies}=motorsportCatalog(entries);assert.deepEqual(rallies.map(r=>r.rounds.length),[4,12]);
 assert.equal(rallies[1].rounds[6].pass,2);assert.equal(rallies[1].serviceEvery,3);
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
 assert.deepEqual(doc.screens[0].elements.map(e=>e.id),['map','world-race-index','world-championships']);
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
test('installed catalog has all twelve cups and all saved rally collections; menus stay under eight controls',()=>{
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 const catalog=motorsportCatalog(menu.parameters.raceIndex);assert.equal(catalog.championships.length,12);
 assert.ok(catalog.rallyGroups.length>=15);
 for(const r of catalog.rallies)assert.equal(new Set(r.rounds.map(s=>s.ref)).size,r.rounds.length===4?4:6);
 const {controller:c,player:p}=menuFixture();p.flow.document.parameters.raceIndex=menu.parameters.raceIndex;
 for(const kind of ['championships','rallies','drift']){
  c.open(kind);const count=c.entries().length;
  for(let i=0;i<count;i++){
   assert.equal(c.lists[kind].index,i);
   const buttons=p.flow.screen.elements.filter(e=>e.type==='button');
   assert.ok(buttons.length<=8);assert.ok(buttons.some(e=>e.id===`motorsport-pick-${i}`));
   if(kind==='championships'){
    const entry=c.entries()[i],details=p.flow.screen.elements.filter(e=>e.id.startsWith('detail-')).map(e=>e.label);
    assert.deepEqual(details,[`Difficulty: ${entry.heat} / 3`,...entry.rounds.map((r,j)=>`${j+1}. ${r.ref}`)]);
   }
   assert.ok(!buttons.some(e=>['Previous','Next','Resume Event'].includes(e.label)));
   c.scroll(1);
  }
  assert.equal(c.lists[kind].index,count-1);
  for(let i=count-1;i>=0;i--){assert.equal(c.lists[kind].index,i);c.scroll(-1);}
  assert.equal(c.lists[kind].index,0);
 }
});

test('Back works during button dispatch and service returns without a navigation loop',async()=>{
 const {controller:c,player:p}=menuFixture();c.open();
 p.flow.busy=true;await c.activate('motorsport-back');assert.equal(p.flow.screenId,'world-map');p.flow.busy=false;
 c.open('rallies');await c.save({...run(rally),phase:'between',round:3,serviceBudget:30});c.showEvent();
 const history=[...p.flow.history];c.showService();await c.activate('motorsport-service-back');
 assert.equal(p.flow.screenId,'motorsport-event');assert.deepEqual(p.flow.history,history);
});

test('championship categories and rally format selection preserve Back and saved events',async()=>{
 const {controller:c,player:p}=menuFixture();
 p.flow.document.parameters.raceIndex=Array.from({length:6},(_,i)=>({ref:`Stage ${i+1}`,rally:{id:'test',name:'Test Rally',section:i+1},stageSeconds:240}));
 c.home();assert.equal(p.flow.screenId,'motorsport-home');
 await c.activate('motorsport-rallies');
 assert.equal(p.flow.screen.elements.find(e=>e.id==='motorsport-pick-0').label,'Test Rally');
 await c.activate('motorsport-pick-0');assert.equal(p.flow.screenId,'motorsport-formats');
 await c.activate('motorsport-format-12');assert.equal(c.selection.rounds.length,12);
 await c.activate('motorsport-back');assert.equal(p.flow.screenId,'motorsport-formats');
 await c.activate('motorsport-format-4');assert.equal(c.selection.rounds.length,4);
 for(const expected of ['motorsport-formats','motorsport-list','motorsport-home','world-map']){
  await c.activate('motorsport-back');assert.equal(p.flow.screenId,expected);
 }
});

test('incomplete stage collections never pad a format with repeated or parent roads',()=>{
 const entries=Array.from({length:6},(_,i)=>({ref:`S${i}`,rally:{id:'test',name:'Test',section:i+1}}));
 assert.equal(motorsportCatalog(entries.slice(0,3)).rallies.length,0);
 assert.deepEqual(motorsportCatalog(entries.slice(0,4)).rallies.map(r=>r.rounds.length),[4]);
 assert.equal(motorsportCatalog(entries.map(e=>({...e,rally:{id:'test',name:'Test'}}))).rallies.length,0);
 const full=motorsportCatalog(entries).rallies[1];
 assert.deepEqual(full.rounds.slice(0,6).map(r=>r.ref),full.rounds.slice(6).map(r=>r.ref));
 assert.ok(full.rounds.slice(0,6).every(r=>r.pass===1));assert.ok(full.rounds.slice(6).every(r=>r.pass===2));
});

test('rallies awaiting road coverage explain unavailable formats without offering Enter',()=>{
 const {controller:c,player:p}=menuFixture();
 p.flow.document.parameters.raceIndex=[{ref:'Parent',rally:{id:'test',name:'Test Rally'}}];
 c.open('rallies');c.formats(c.catalog.rallyGroups[0]);
 assert.deepEqual(p.flow.screen.elements.filter(e=>e.type==='button').map(e=>e.label),['Back']);
 assert.ok(p.flow.screen.elements.some(e=>e.label==='More mapped sections needed.'));
});

test('active event replaces browsing and Back requires confirmed quitting',async()=>{
 const {controller:c,player:p}=menuFixture();c.preview(cup);await c.enter();
 assert.deepEqual(p.flow.history,[]);
 assert.deepEqual(p.flow.screen.elements.filter(e=>e.type==='button').map(e=>e.label),['Start Next','Quit Event']);
 c.home();assert.equal(p.flow.screenId,'motorsport-event');
 c.open('rallies');assert.equal(p.flow.screenId,'motorsport-event');
 const id=c.state.id;assert.equal(c.back(),true);assert.equal(p.flow.screenId,'motorsport-retire');assert.equal(c.state.id,id);
 assert.equal(c.back(),true);assert.equal(p.flow.screenId,'motorsport-event');assert.equal(c.state.id,id);
 await c.activate('motorsport-retire');await c.activate('motorsport-retire-confirm');
 assert.equal(c.state,null);assert.equal(p.flow.screenId,'motorsport-home');
 c.back();assert.equal(p.flow.screenId,'world-map');
});
test('saved event and race return intercept world-map entry before rendering',async()=>{
 const {controller:c,player:p}=menuFixture();await c.save(run(rally));
 MenuPlayer.prototype.enterScreen.call(p);
 assert.equal(p.flow.screenId,'motorsport-event');assert.deepEqual(p.flow.history,[]);
 assert.equal(c.state.phase,'racing');
 p.flow.goTo('world-map');assert.equal(c.guard(),true);assert.equal(p.flow.screenId,'motorsport-event');
 assert.equal(c.guard(),false,'event screen must not recursively redirect itself');
});
test('completed event can be closed with Back, and service Back keeps the active event',async()=>{
 const {controller:c,player:p}=menuFixture();await c.save({...run(rally),phase:'between',round:3,serviceBudget:30});
 c.showEvent();c.showService();assert.equal(c.back(),true);assert.equal(p.flow.screenId,'motorsport-event');assert.ok(c.state);
 await c.save({...c.state,phase:'complete'});c.showEvent();c.back();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(c.state,null);assert.equal(p.flow.screenId,'motorsport-home');
});
test('list scrolling does not push history or reset the screen timer, and keeps independent positions',()=>{
 const {controller:c,player:p}=menuFixture();const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 p.flow.document.parameters.raceIndex=menu.parameters.raceIndex;c.home();c.open('rallies');
 const history=[...p.flow.history];p.flow.time=20;
 for(let i=0;i<10;i++)c.scroll(1);
 assert.deepEqual(p.flow.history,history);assert.equal(p.flow.time,20);assert.equal(c.lists.rallies.top,6);
 c.open('championships');assert.equal(c.lists.championships.index,0);
 c.open('rallies');assert.equal(c.lists.rallies.index,10);
});

test('circuit preview shows three fixed route cards and returns without a Back button',()=>{
 const {controller:c,player:p}=menuFixture();c.open();c.preview(cup);
 const elements=p.flow.screen.elements,cards=elements.filter(e=>e.property==='route-preview');
 assert.deepEqual(cards.map(e=>e.assetRef),cup.rounds.map(r=>r.ref));
 assert.equal(cards.length,3);
 assert.ok(cards[0].x+cards[0].w<cards[1].x&&cards[1].x+cards[1].w<cards[2].x);
 assert.equal(elements.filter(e=>e.type==='button').length,0);
 assert.ok(!elements.some(e=>e.id==='difficulty'||e.id==='return-hint'));
 assert.equal(elements.find(e=>e.id==='heading').label,cup.name);
 assert.equal(c.back(),true);assert.equal(p.flow.screenId,'motorsport-list');
 const buttons=p.flow.screen.elements.filter(e=>e.type==='button');
 assert.equal(buttons.find(e=>e.id==='motorsport-up').label,'▲');
 assert.equal(buttons.find(e=>e.id==='motorsport-down').label,'▼');
 assert.ok(!buttons.some(e=>e.label==='Back'));
});

test('drift challenges use installed real circuits, solo two-lap scoring and preserve original track data',()=>{
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 const events=motorsportCatalog(menu.parameters.raceIndex).drift;
 assert.equal(events.length,13);
 assert.equal(motorsportCatalog([]).drift.length,0);
 for(const event of events){
  assert.deepEqual([...event.targets].sort((a,b)=>a-b),event.targets);
  assert.equal(event.rounds.length,1);
  const original=structuredClone(circuit),race=applyMotorsportRace(circuit,run(event));
  assert.equal(race.laps,2);assert.equal(race.competition.mode,'solo');
  assert.equal(race.competition.aiDrivers.length,0);assert.equal(race.campaign.scoring,'drift');
  assert.equal(race.timeOfDay,'day');assert.equal(race.weather,'clear');
  assert.deepEqual(race.driftChallenge.targets,event.targets);assert.deepEqual(circuit,original);
  assert.equal(readMotorsportEvent(run(event)).definition.kind,'drift');
 }
});
test('drift medals and personal bests use score, survive profile normalization, and reject DNF results',async()=>{
 const {DRIFT_CHALLENGES,driftMedal,driftBestKey,driftResultVariables}=await import('../../src/menus/DriftChallenges.js');
 const definition=motorsportCatalog(DRIFT_CHALLENGES.map(c=>({ref:c.ref,properCircuit:true}))).drift[0];
 const result=completeMotorsportRound(run(definition),{...session(),driftScore:{points:7000.9}});
 assert.equal(result.phase,'complete');assert.equal(result.results[0].classification[0].score,7000);
 assert.equal(driftMedal(definition,7000),'Gold');assert.equal(driftMedal(definition,0),'No medal');
 const key=driftBestKey(definition);
 assert.deepEqual(normalizeMenuVariables(driftResultVariables(result)),{[key]:7000});
 assert.deepEqual(driftResultVariables(result,{[key]:8000}),{[key]:8000});
 assert.deepEqual(driftResultVariables(completeMotorsportRound(run(definition),{driftScore:{points:9000}},{dnf:true})),{});
});
test('Drift navigation includes a route preview, stores the best on completion and offers no phantom AI standings',async()=>{
 const {player:p,controller:c}=menuFixture();
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 p.flow.document.parameters.raceIndex=menu.parameters.raceIndex;
 c.save=async(state,variables={})=>Object.assign(p.flow.parameters,variables,{motorsportEvent:state?JSON.stringify(state):''});
 c.home();assert.ok(p.flow.screen.elements.some(e=>e.id==='motorsport-drift'));
 await c.activate('motorsport-drift');assert.equal(c.entries().length,13);
 await c.activate('motorsport-pick-0');
 assert.ok(p.flow.screen.elements.some(e=>e.property==='route-preview'));
 await c.enter();await c.save({...c.state,phase:'racing'});
 const s={...session(),driftScore:{points:7000},menuConfiguration:{motorsportId:c.state.id,motorsportRound:0}};
 await c.record(s);c.showEvent();
 assert.equal(c.state.phase,'complete');
 assert.ok(p.flow.screen.elements.some(e=>e.label==='7000 pts · Gold'));
 assert.ok(!p.flow.screen.elements.some(e=>/Vera|Service|Next:/.test(e.label)));
 await c.activate('motorsport-close');
 assert.equal(c.state,null);assert.equal(p.flow.parameters['driftBest.drift-horse-thief'],7000);
 await c.activate('motorsport-drift');
 assert.ok(p.flow.screen.elements.some(e=>e.label==='Best: 7000 · Gold'));
});

test('every offered drift track decodes, qualifies as a circuit and retains its imported road geometry',async()=>{
 const {gunzipSync}=await import('node:zlib');
 const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
 for(const event of motorsportCatalog(menu.parameters.raceIndex).drift){
  const folder=encodeURIComponent(event.rounds[0].ref).replaceAll('%20',' ');
  const stored=JSON.parse(fs.readFileSync('data/server-storage/files/races/'+folder+'/document.json'));
  const doc=stored.encoding?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;
  const race=doc.race||doc;
  assert.equal(motorsportRaceMetadata(race).properCircuit,true,event.name);
  const overlay=applyMotorsportRace(race,run(event));
  assert.deepEqual(overlay.road,race.road);assert.deepEqual(overlay.scenery,race.scenery);
  assert.ok(race.road.segments.every(s=>s.surface==='asphalt'));
 }
});

test('next Grand Prix grid reverses the previous result including second to penultimate',()=>{
 const first=run(),completed=completeMotorsportRound(first,session());
 const classification=completed.results[0].classification;
 const next=applyMotorsportRace(circuit,completed);
 assert.deepEqual(next.competition.startingGrid,classification.map(r=>r.id).reverse());
 assert.equal(next.competition.startingGrid.indexOf(classification[1].id),4);
 assert.equal(applyMotorsportRace(circuit,first).competition.startingGrid,null);
 assert.deepEqual(applyMotorsportRace(circuit,JSON.parse(JSON.stringify(completed))).competition.startingGrid,next.competition.startingGrid);
});
