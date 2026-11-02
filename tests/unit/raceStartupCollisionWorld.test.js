import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRaceStartupCollisionWorld,createRaceStaticColliderWorld} from '../../src/racing/RaceSimulation.js';

test('loading prepares fence collision heights once; first simulation reuses identical world without advancing cars',()=>{
 let samples=0;
 const runner={step(){throw Error('loading advanced physics');}};
 const session={running:true,startupFramePending:true,routeLength:100,routeRuntimeType:'point-to-point',worldBake:{revision:'one'},vehicleDynamicsRunner:runner,countdownRemainingMs:4000,elapsedMs:0};
 const editor={playtestSession:session,selectedRace:{id:'mountain'},
  getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),
  ensureRaceScenery:()=>[{id:'fence',x:5,z:10}],
  getRaceDoodadForScenery:()=>({isFence:true,widthM:10,heightM:2}),
  sampleRaceDoodadGroundPoint:()=>{samples++;return {elevation:1};}
 };
 const world=prepareRaceStartupCollisionWorld(editor);
 assert.ok(world);assert.equal(samples,3);
 assert.equal(prepareRaceStartupCollisionWorld(editor),world);
 session.startupFramePending=false;
 assert.equal(createRaceStaticColliderWorld(editor,{authority:editor.vehicleDynamicsAuthority,worldBake:session.worldBake,runtimeType:session.routeRuntimeType,routeLength:session.routeLength}),world);
 assert.equal(samples,3);assert.equal(session.countdownRemainingMs,4000);assert.equal(session.elapsedMs,0);
 // New geometry must still invalidate the cache.
 session.worldBake={revision:'two'};
 assert.notEqual(prepareRaceStartupCollisionWorld(editor),world);assert.equal(samples,6);
});

test('collision warmup waits for completed preparation and running session',()=>{
 const editor={playtestSession:{running:true,preparing:true},getRaceSessionCar(){throw Error('premature preparation');}};
 assert.equal(prepareRaceStartupCollisionWorld(editor),undefined);
 editor.playtestSession={running:false};assert.equal(prepareRaceStartupCollisionWorld(editor),undefined);
});

test('editor prepares collisions before presenting the startup loading frame',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=Object.create(RaceEditor.prototype);
 let prepared=0,loading=0;
 Object.defineProperty(editor,'selectedRace',{value:{id:'test'}});
 editor.playtestSession={running:true,startupFramePending:true,carEditorPreview:false,routeLength:100,routeRuntimeType:'point-to-point',vehicleDynamicsRunner:{},raceIntro:{active:false}};
 editor.syncRacePhysicalGamepad=()=>{};
 editor.getRaceSessionCar=()=>({});editor.getRaceCarTuning=()=>({});
 editor.getRacePathSamplesCached=()=>[];
 editor.ensureRaceMarginSettings=()=>({});editor.ensureRaceScenery=()=>{prepared++;return [];};
 editor.drawRacePreparationScreen=()=>{assert.equal(prepared,1);loading++;};
 editor.draw({},800,600);
 assert.equal(loading,1);
 editor.draw({},800,600);assert.equal(prepared,1);
});

test('startup fence sampling shares the simulation geometry-read scope and releases it afterwards',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 let samples=0;
 const editor={withRaceGeometryReadCache:RaceEditor.prototype.withRaceGeometryReadCache,
  playtestSession:{running:true,worldBake:{revision:'test'},routeLength:100,
    routeRuntimeType:'point-to-point',vehicleDynamicsRunner:{}},
  selectedRace:{id:'mountain',road:{}},
  getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),
  ensureRaceScenery:()=>Array.from({length:20},(_,id)=>({id:`fence-${id}`,x:id,z:10})),
  getRaceDoodadForScenery:()=>({isFence:true,widthM:10,heightM:2}),
  sampleRaceDoodadGroundPoint(){
    assert.ok(this.raceGeometryReadCache,'loading must not bypass geometry memoization');
    samples++;return {elevation:1};
  }};
 const world=prepareRaceStartupCollisionWorld(editor);
 assert.ok(world);assert.equal(samples,60);
 assert.equal(editor.raceGeometryReadCache,undefined);
 assert.equal(prepareRaceStartupCollisionWorld(editor),world);assert.equal(samples,60);
 editor.playtestSession.worldBake={revision:'broken'};
 editor.sampleRaceDoodadGroundPoint=()=>{throw Error('missing surface');};
 assert.throws(()=>prepareRaceStartupCollisionWorld(editor),/missing surface/);
 assert.equal(editor.raceGeometryReadCache,undefined,'failure must also release the scope');
});

test('slow loading preparation starts a fresh presentation deadline only once',()=>{
 const session={running:true,startupFramePending:true,startupPresentationStartedAtMs:1,
  routeLength:100,routeRuntimeType:'point-to-point',vehicleDynamicsRunner:{},worldBake:{}};
 const editor={playtestSession:session,selectedRace:{},getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({})};
 const before=Date.now();prepareRaceStartupCollisionWorld(editor);
 assert.ok(session.startupPresentationStartedAtMs>=before);
 session.startupPresentationStartedAtMs=123;
 prepareRaceStartupCollisionWorld(editor);
 assert.equal(session.startupPresentationStartedAtMs,123,'cache hits cannot keep a stuck renderer alive');
});
