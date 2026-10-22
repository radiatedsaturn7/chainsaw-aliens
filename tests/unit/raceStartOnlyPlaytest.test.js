import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createEmptyRace} from '../../src/racing/RaceExample.js';
import {findNetworkRoute,validateRaceRouteNetwork,sampleNetworkRoute,advanceNetworkRaceProgress} from '../../src/racing/RaceRouteNetwork.js';

test('start-only track has a driving route and spawn pose without adding a finish',()=>{
 const editor=new RaceEditor({}),network=editor.selectedRace.road.network;
 assert.deepEqual(validateRaceRouteNetwork(network,{requireFinish:false}),[]);
 assert.ok(validateRaceRouteNetwork(network).includes('Choose a finish junction.'));
 assert.equal(findNetworkRoute(network).lengthM,100);assert.ok(sampleNetworkRoute(network).length>1);
 const pose=editor.getRaceStartPose();assert.equal(pose.x,0);assert.equal(pose.z,0);assert.equal(pose.yaw,0);
 assert.equal(editor.getRaceRouteLength(),100);assert.equal(network.finishNodeId,'');
 const progress=advanceNetworkRaceProgress(network,{x:0,z:-1,heightM:0},{x:0,z:1,heightM:0});
 assert.equal(progress.started,true);assert.equal(progress.finished,false);
 assert.equal(advanceNetworkRaceProgress(network,{x:0,z:99,heightM:0},{x:0,z:101,heightM:0},progress).finished,false);
});

test('disconnected start or invalid authored finish still fails with an actionable message',()=>{
 const editor=new RaceEditor({}),network=editor.selectedRace.road.network;
 network.finishNodeId='missing';assert.ok(validateRaceRouteNetwork(network,{requireFinish:false}).includes('Choose a finish junction.'));
 network.finishNodeId='';network.edges=[];assert.equal(editor.startPlaytest(),false);assert.match(editor.status,/Connect a drivable road/);assert.ok(!editor.playtestSession);
});

test('free-drive route chooses a reachable path and respects one-way roads',()=>{
 const network=createEmptyRace().road.network;
 network.nodes.push({id:'far',x:100,z:100,heightM:0},{id:'isolated',x:1000,z:1000,heightM:0});
 network.edges.push({...network.edges[0],id:'extension',from:'end',to:'far',bidirectional:false});
 assert.equal(findNetworkRoute(network).lengthM,200);
 assert.deepEqual(findNetworkRoute(network).steps.map(s=>s.edgeId),['straight','extension']);
});

test('new start-only race bakes and starts a running playtest session',()=>{
 const editor=new RaceEditor({});
 // Rendering assets need a browser; retain the real world bake and vehicle setup.
 editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};
 const bake=editor.buildRaceWorldBake({validate:false});assert.equal(bake.terrainTopology,'route-network');
 editor.startPlaytest(editor.project.selectedCarId,{hydrateCars:false});
 assert.equal(editor.playtestSession.running,true);assert.equal(editor.playtestSession.routeLength,100);
 assert.ok(Number.isFinite(editor.playtestSession.worldX));assert.ok(Number.isFinite(editor.playtestSession.worldZ));
 assert.equal(editor.selectedRace.road.network.finishNodeId,'');
});
