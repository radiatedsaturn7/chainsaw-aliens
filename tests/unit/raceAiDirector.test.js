import test from 'node:test';
import assert from 'node:assert/strict';
import {getRaceAiDirector,prepareRaceAiDirector,getRaceAiNearbyTraffic,getRaceAiSharedCurvature} from '../../src/racing/RaceAiDirector.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
function fixture(){
 let queries=0;
 const editor={selectedRace:{},playtestSession:{routeLength:2000,routeRuntimeType:'sprint',aiRuntime:[]},
 getRaceWorldPoseAtDistance(d){queries++;return {x:0,z:d,yaw:d>=100?.4:0,segment:{}};},
 getRaceRoadHalfWidthWorld:()=>5,getRaceRightVector:()=>({x:-1,z:0})};
 return {editor,queries:()=>queries};
}
test('director shares conservative corner observations across drivers and resets with a new race',()=>{
 const {editor,queries}=fixture();
 const c=getRaceAiSharedCurvature(editor,96);
 assert.ok(c>=.4/8);
 assert.equal(queries(),4);
 for(let i=0;i<30;i++)assert.equal(getRaceAiSharedCurvature(editor,96+i/10),c);
 assert.equal(queries(),4);
 editor.selectedRace={};getRaceAiSharedCurvature(editor,96);
 assert.equal(queries(),8);
});
test('circuit road samples share wrapped distances and cache stays bounded',()=>{
 const {editor}=fixture();editor.playtestSession.routeRuntimeType='circuit';
 assert.equal(getRaceAiSharedCurvature(editor,-1),getRaceAiSharedCurvature(editor,1999));
 assert.equal(getRaceAiDirector(editor).road.size,1);
 editor.playtestSession.routeRuntimeType='sprint';editor.playtestSession.routeLength=100000;
 for(let d=0;d<40000;d+=8)getRaceAiSharedCurvature(editor,d);
 assert.equal(getRaceAiDirector(editor).road.size,4096);
});
test('traffic index handles cell boundaries and stable snapshots without losing nearby cars',()=>{
 const {editor}=fixture();
 const ai={worldX:63,worldZ:-1},near={worldX:65,worldZ:1,speedMps:4},far={worldX:900,worldZ:0};
 editor.playtestSession.aiRuntime=[ai,near,far];
 prepareRaceAiDirector(editor);
 near.worldX=500;
 const records=getRaceAiNearbyTraffic(editor,ai,10);
 assert.ok(records.some(r=>r.car===near&&r.worldX===65));
 assert.ok(!records.some(r=>r.car===far));
 prepareRaceAiDirector(editor);
 assert.ok(!getRaceAiNearbyTraffic(editor,ai,10).some(r=>r.car===near));
});
test('shared planning keeps stopped traffic braking and shares road work between a grid of cars',()=>{
 const {editor,queries}=fixture();
 const ai={worldX:0,worldZ:10,projectedDistance:10,speedMps:10,carYaw:0};
 const stopped={worldX:0,worldZ:16,speedMps:0,carYaw:0};
 editor.playtestSession.aiRuntime=[ai,stopped];prepareRaceAiDirector(editor);
 const first=planRaceAiDriving(editor,ai,{widthM:1.8,wheelbaseM:2.6});
 assert.equal(first.targetSpeedMps,0);
 const initialQueries=queries();
 for(let i=0;i<29;i++)assert.deepEqual(planRaceAiDriving(editor,ai,{widthM:1.8,wheelbaseM:2.6}),first);
 assert.equal(queries()-initialQueries,29,'only exact steering pose remains; safety and braking are precomputed');
 editor.playtestSession.debugAiIndependentPlanning=true;
 assert.equal(planRaceAiDriving(editor,ai,{widthM:1.8,wheelbaseM:2.6}).targetSpeedMps,0);
});

test('cold shared horizon reuses adjacent endpoints before any driver cache hits',()=>{
 const {editor,queries}=fixture();
 for(let d=0;d<=320;d+=8)getRaceAiSharedCurvature(editor,d);
 assert.equal(queries(),44);
});
