import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {racingLineTrack} from '../fixtures/racingLineTrack.js';
import {prepareRaceAiRoadPlan} from '../../src/racing/RaceAiDirector.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
import {planRaceAiControls} from '../../src/racing/RaceAiControls.js';
import {sampleRaceRacingLine} from '../../src/racing/RaceRacingLine.js';

test('AI follows an optimized apex through real tire/chassis physics without teleporting or leaving the road',t=>{
 const track=racingLineTrack(),editor=new RaceEditor({});
 const race=editor.selectedRace;
 race.type='destination';race.road.network=null;race.scenery=[];race.hazards=[];
 race.road.nodes=Array.from({length:Math.ceil(track.length/6)+1},(_,i)=>{
   const d=Math.min(track.length,i*6),p=track.pose(d);return {x:p.x,y:p.z,elevation:0};
 });
 race.road.segments=race.road.nodes.slice(1).map((p,i)=>({length:Math.hypot(p.x-race.road.nodes[i].x,p.y-race.road.nodes[i].y),curve:0,elevation:0,surface:'asphalt',roadWidthM:12,bumpiness:0,hazardIds:[]}));
 race.road.tileMap={...(race.road.tileMap||{}),cells:{},defaultElevation:0};
 editor.clearRaceRuntimeSurfaceCaches();
 editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};
 editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 const session=editor.playtestSession;session.countdownRemainingMs=0;session.aiRuntime=[];
 const plan=prepareRaceAiRoadPlan(editor);assert.ok(plan.racingLine);
 const car=editor.selectedCar,tuning=editor.getRaceCarTuning(car),profile=editor.getRaceAiDifficultyProfile('hard');
 const pose=editor.getRaceWorldPoseAtDistance(20,{runtimeType:'destination'});
 const ai={id:'racing-line-physics',carId:car.id,difficulty:'hard',worldX:pose.x,worldZ:pose.z,carYaw:pose.yaw,
  projectedDistance:20,distance:20,speedMps:12,lineOffset:0,gear:2,rpm:3000,engineDrive:{throttle:.2,brake:0}};
 let maxBodyLateral=0,maxLateral=0,maxLineError=0,apexOffset=0,maxStep=0;
 for(let i=0;i<1500&&ai.projectedDistance<track.end+35;i++){
  editor.withRaceGeometryReadCache(()=>{
   const previous={x:ai.worldX,z:ai.worldZ};
   ai.drivingPlan=planRaceAiDriving(editor,ai,tuning,{profile,topSpeedMps:20});
   const controls=planRaceAiControls(editor,ai,tuning,ai.drivingPlan.targetSpeedMps,profile);
   ai.engineDrive=controls;ai.gear=controls.gear;ai.rpm=controls.rpm;
   editor.updateRaceAiVehiclePhysics(ai,{car,tuning,seconds:1/60});
   const projection=editor.getRaceRouteProjectionForWorldPoint({x:ai.worldX,z:ai.worldZ});
   ai.projectedDistance=projection.distance;ai.distance=projection.distance;
   const target=sampleRaceRacingLine(plan,projection.distance);
   maxLateral=Math.max(maxLateral,Math.abs(projection.lateral));
   const road=editor.getRaceWorldPoseAtDistance(projection.distance),heading=ai.carYaw-road.yaw;
   const bodyHalfWidth=Math.abs(Math.cos(heading))*tuning.widthM/2+Math.abs(Math.sin(heading))*tuning.lengthM/2;
   maxBodyLateral=Math.max(maxBodyLateral,Math.abs(projection.lateral)+bodyHalfWidth);
   if(projection.distance>40)maxLineError=Math.max(maxLineError,Math.hypot(target.x-ai.worldX,target.z-ai.worldZ));
   if(Math.abs(projection.distance-(track.entry+track.end)/2)<4)apexOffset=Math.max(apexOffset,Math.abs(projection.lateral));
   maxStep=Math.max(maxStep,Math.hypot(ai.worldX-previous.x,ai.worldZ-previous.z));
  });
 }
 t.diagnostic(JSON.stringify({distance:ai.projectedDistance,maxBodyLateral,maxLateral,maxLineError,apexOffset,maxStep}));
 assert.ok(ai.projectedDistance>track.end+30,`progress ${ai.projectedDistance}, speed ${ai.speedMps}`);
 assert.ok(maxBodyLateral<6,`body crossed edge: swept lateral extent ${maxBodyLateral}`);
 assert.ok(apexOffset>2,`AI stayed near center at apex: ${apexOffset}`);
 assert.ok(maxLineError<2,`tracking error ${maxLineError}`);
 assert.ok(maxStep<1,'physical continuous motion, not pose snapping');
});
