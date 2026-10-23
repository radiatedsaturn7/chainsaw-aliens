import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaceRouteNetwork, advanceNetworkRaceProgress, validateRaceRouteNetwork, joinNetworkJunctions } from '../../src/racing/RaceRouteNetwork.js';
import { getNetworkFinishNodes, resolveRaceNodeFinish } from '../../src/racing/RaceFinishNodes.js';
import { buildRaceMinimap } from '../../src/racing/RaceMinimap.js';
import { buildRaceNetworkGeometry } from '../../src/racing/RaceNetworkGeometry.js';
import { parseMenuVariableAssignments } from '../../src/menus/MenuProgress.js';
import { handleNetworkAction } from '../../src/ui/RaceNetworkEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

const fixture = () => normalizeRaceRouteNetwork({startNodeId:'start',finishNodeId:'north',nodes:[
 {id:'start',x:0,z:0},{id:'junction',x:0,z:50},
 {id:'north',name:'North exit',x:0,z:100,finish:{variables:{route:'north',northUnlocked:true}}},
 {id:'east',name:'East exit',x:50,z:50,finish:{variables:{route:'east',chapter:2},destination:{type:'menu',menuScreen:'east-map'}}}
],edges:[{id:'approach',from:'start',to:'junction'},{id:'n',from:'junction',to:'north'},{id:'e',from:'junction',to:'east'}]});
const p=(x,z,heightM=.55)=>({x,z,heightM});

test('both exits finish in the crossing direction; only the crossed exit is recorded',()=>{
 const network=fixture(),started=advanceNetworkRaceProgress(network,p(0,-1),p(0,1));
 assert.equal(advanceNetworkRaceProgress(network,p(49,50),p(51,50)).finished,false);
 assert.equal(advanceNetworkRaceProgress(network,p(51,50),p(49,50),started).finished,false);
 assert.equal(advanceNetworkRaceProgress(network,p(49,50,8),p(51,50,8),started).finished,false);
 const east=advanceNetworkRaceProgress(network,p(49,50),p(51,50),started);
 assert.deepEqual(east,{started:true,finished:true,finishNodeId:'east'});
 assert.equal(advanceNetworkRaceProgress(network,p(0,99),p(0,101),started).finishNodeId,'north');
 assert.deepEqual(advanceNetworkRaceProgress(network,p(0,99),p(0,101),east),east);
});

test('a fast crossing chooses the first finish and cannot finish before crossing the start',()=>{
 const network=normalizeRaceRouteNetwork({startNodeId:'start',nodes:[{id:'start',x:0,z:0},{id:'far',x:0,z:100,finish:{}},{id:'near',x:0,z:50,finish:{}}],edges:[{id:'a',from:'start',to:'near'},{id:'b',from:'near',to:'far'}]});
 assert.equal(advanceNetworkRaceProgress(network,p(0,-1),p(0,110)).finishNodeId,'near');
 network.startNodeId='far';
 assert.equal(advanceNetworkRaceProgress(network,p(0,-1),p(0,110)).finished,false);
});

test('finishes validate, survive serialization, appear on minimaps and retain road beyond their lines',()=>{
 const network=fixture();assert.deepEqual(validateRaceRouteNetwork(network),[]);
 const editor=new RaceEditor({});editor.selectedRace.road.network=network;
 const loaded=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument()).road.network;
 assert.deepEqual(loaded,network);
 assert.deepEqual(buildRaceMinimap({network:loaded}).finishes.map(n=>n.id),['north','east']);
 const geometry=buildRaceNetworkGeometry(network);
 assert.ok(geometry.paths.find(path=>path.edgeId==='e').sections.at(-1).center.x>50);
 network.edges=network.edges.filter(edge=>edge.id!=='e');
 assert.match(validateRaceRouteNetwork(network).join(' '),/East exit.*not reachable/);
});

test('old single finishes and start-only tracks remain supported',()=>{
 const network=fixture();for(const node of network.nodes)delete node.finish;
 assert.deepEqual(getNetworkFinishNodes(network).map(n=>n.id),['north']);
 network.finishNodeId='';assert.equal(getNetworkFinishNodes(network).length,0);
 assert.deepEqual(validateRaceRouteNetwork(network,{requireFinish:false}),[]);
});

test('exit variables override race variables while destinations inherit or override explicitly',()=>{
 const race={road:{network:fixture()},finishBehavior:{type:'menu',menuScreen:'world-map',variables:{chapter:1,route:'default',common:true}}};
 const north=resolveRaceNodeFinish(race,'north'),east=resolveRaceNodeFinish(race,'east');
 assert.equal(north.menuScreen,'world-map');assert.equal(north.variables.route,'north');assert.equal(north.variables.chapter,1);
 assert.equal(east.menuScreen,'east-map');assert.equal(east.variables.chapter,2);assert.equal(east.variables.common,true);
 assert.equal(east.variables.lastRaceExit,'east');assert.equal(east.variables.lastRaceExitName,'East exit');
 assert.equal(east.variables.northUnlocked,undefined);
});

test('node editing creates/removes finishes with undo and cancel, and guards start/delete/join',async()=>{
 const editor=new RaceEditor({});editor.selectedRace.road.network=fixture();editor.networkNodeId='east';editor.networkSelectedNodeIds=['east'];
 const form=overrides=>async(title,fields)=>({...Object.fromEntries(fields.map(f=>[f.id,f.value])),...overrides});
 await handleNetworkAction(editor,'network-properties',form({finishVariables:'route = "coast"\ncoastOpen = true\nchapter = 3'}));
 assert.equal(editor.selectedRace.road.network.nodes.find(n=>n.id==='east').finish.variables.coastOpen,true);
 assert.equal(editor.undoRaceHistory(),true);assert.equal(editor.selectedRace.road.network.nodes.find(n=>n.id==='east').finish.variables.route,'east');
 editor.networkNodeId='east';editor.networkSelectedNodeIds=['east'];
 const before=JSON.stringify(editor.selectedRace.road.network);await handleNetworkAction(editor,'network-properties',async()=>null);assert.equal(JSON.stringify(editor.selectedRace.road.network),before);
 await assert.rejects(handleNetworkAction(editor,'network-delete'),/start \/ finish/);
 assert.throws(()=>joinNetworkJunctions(fixture(),'north','east'),/remain distinct/);
 await handleNetworkAction(editor,'network-properties',form({finish:false}));
 assert.deepEqual(getNetworkFinishNodes(editor.selectedRace.road.network).map(n=>n.id),['north']);
 editor.networkNodeId='start';editor.networkSelectedNodeIds=['start'];
 await assert.rejects(handleNetworkAction(editor,'network-properties',form({finish:true})),/distinct/);
});

test('results deliver selected exit settings exactly once; editor playtests do not dispatch progression',()=>{
 for(const mode of ['race','editor']){
  const received=[],editor=new RaceEditor({completeRaceTravel:(...args)=>{received.push(args);return true;}});
  editor.mode=mode;editor.selectedRace.road.network=fixture();editor.selectedRace.finishBehavior={type:'menu',menuScreen:'world-map'};
  editor.playtestSession={raceDocumentName:'P1',networkProgress:{started:true,finished:true,finishNodeId:'east'}};
  editor.getRaceSessionCar=()=>({audio:{}});editor.completeRaceGhost=()=>{};editor.resetRacePlaytestInputs=()=>{};editor.restoreRaceAuthoringMenuState=()=>{};
  editor.finishPlaytest();editor.finishPlaytest();
  assert.equal(received.length,mode==='race'?1:0);
  if(received.length){assert.equal(received[0][0].variables.route,'east');assert.equal(received[0][0].menuScreen,'east-map');}
 }
});

test('assignment parser supports typed values and rejects unsafe or structured variables',()=>{
 assert.deepEqual(parseMenuVariableAssignments('route = "north"\nunlocked = true\nchapter = 2'),{route:'north',unlocked:true,chapter:2});
 for(const value of ['bad key = true','constructor = 1','item = {}','x = [1]','no assignment'])assert.throws(()=>parseMenuVariableAssignments(value));
});

test('real race simulation recognizes the secondary exit before showing results',()=>{
 const editor=new RaceEditor({});editor.selectedRace.road.network=fixture();editor.setRaceAiCount(0);
 editor.getRaceStartSettings().countdown=false;
 editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 const session=editor.playtestSession;session.startupFramePending=false;
 editor.updatePlaytest(1/60);
 session.networkProgress={started:true,finished:false};
 const runner=session.vehicleDynamicsRunner;
 for(const x of [49,51]){
  runner.state.position={x,y:.55,z:50};runner.state.velocity={x:0,y:0,z:0};
  editor.updatePlaytest(0);
 }
 assert.equal(session.networkProgress.finishNodeId,'east');
 assert.equal(session.raceResults,true);
});

test('crossed exit variables unlock only the matching world-map branch',async()=>{
 const {setMenuProgress}=await import('../../src/menus/MenuProgress.js');
 const {worldMapNodes}=await import('../../src/menus/MenuWorldMap.js');
 const parameters={},game={menuPlayer:{preview:true,flow:{active:true,setParameter:(key,value)=>parameters[key]=value}}};
 const race={road:{network:fixture()},finishBehavior:{type:'menu',menuScreen:'world-map'}};
 await setMenuProgress(game,resolveRaceNodeFinish(race,'east').variables);
 const nodes=worldMapNodes({nodes:[{id:'n',unlockParameter:'route',unlockValue:'north'},{id:'e',unlockParameter:'route',unlockValue:'east'}]},null,null,parameters);
 assert.equal(nodes[0].locked,true);assert.equal(nodes[1].locked,false);
 assert.equal(parameters.lastRaceExit,'east');
});
