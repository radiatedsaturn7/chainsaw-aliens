import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {reconcileRaceRouteAdvance,calculateAuthoritativeRouteAdvance} from '../../src/racing/RaceSimulation.js';
import {updateWrongWay} from '../../src/racing/RaceDrivingAssists.js';
const root='data/server-storage/files/',manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));
for(const name of ['Providence, RI — Landmark Run','New Hampshire Motor Speedway — Loudon']){
 test(`${name}: center, wide and shoulder lines retain progress through every turn`,()=>{
  let doc=JSON.parse(fs.readFileSync(root+manifest.folders.races[name]));
  if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
  const e=new RaceEditor({});e.applyLoadedRaceDocument(doc);
  const length=e.getRaceRouteLength(),type=e.getSelectedRaceRuntimeType();
  // Freeze caches exactly as a geometry read frame does; no terrain bake or
  // dynamics are needed to replay measured chassis positions against progress.
  const cached=new Map([4,10,18].map(step=>[step,e.getRacePathSamplesCached({step})]));
  e.getRacePathSamplesCached=({step=18}={})=>cached.get(step);e.getRaceRouteLength=()=>length;
  const checkpoints=e.getRaceCheckpointDistances({routeLength:length});
  for(const offset of [0,2,-2,4,-4,6,-6]){
   let distance=0,old=e.getRaceWorldPoseAtDistance(0),maxError=0,warnings=0;const warning={};
   e.playtestSession={routeLength:length,routeRuntimeType:type,checkpointDistances:checkpoints,checkpointIndex:checkpoints.findIndex(d=>d>8)};
   for(let actual=1;actual<length;actual+=1){
    const center=e.getRaceWorldPoseAtDistance(actual),p={x:center.x+Math.cos(center.yaw)*offset,z:center.z-Math.sin(center.yaw)*offset};
    const dx=p.x-old.x,dz=p.z-old.z,travel=Math.hypot(dx,dz),pose=e.getRaceWorldPoseAtDistance(distance);
    const projection=e.getRaceRouteProjectionForWorldPoint({...p,routeDistanceHint:distance});
    const halfWidth=e.getRaceRoadHalfWidthWorld(projection.segment);
    const advance=reconcileRaceRouteAdvance({previousDistance:distance,
     predictedAdvance:calculateAuthoritativeRouteAdvance({velocityWorld:{x:dx,z:dz},roadYaw:pose.yaw,seconds:1}),
     projectedDistance:projection.distance,routeLength:length,circuit:type==='circuit',travelM:travel,
     onRoad:projection.distanceToRoute<=halfWidth,routeOffsetM:projection.distanceToRoute,roadHalfWidthM:halfWidth});
    e.updateRaceCheckpointProgress({previousDistance:distance,nextDistance:distance+advance,routeAdvance:advance});distance+=advance;
    updateWrongWay(warning,{...p,yaw:e.getRaceWorldPoseAtDistance(projection.distance).yaw,dt:.1,active:true});if(warning.wrongWay)warnings++;
    maxError=Math.max(maxError,Math.abs(actual-distance));old=p;
   }
   assert.ok(distance>length-2,`${offset}m line stuck at ${distance}/${length}`);
   assert.ok(maxError<20,`${offset}m line lost route occurrence (${maxError}m)`);
   assert.equal(warnings,0,`${offset}m line reported wrong way`);
   assert.ok(e.playtestSession.checkpointIndex>=checkpoints.length-1,'all intermediate checkpoints passed');
   const end=cached.get(4).at(-1),finish=e.getRaceRouteProjectionForWorldPoint({...end,routeDistanceHint:distance});
   const advance=reconcileRaceRouteAdvance({previousDistance:distance,predictedAdvance:1,projectedDistance:finish.distance,
    routeLength:length,circuit:type==='circuit',travelM:2,onRoad:true,routeOffsetM:0,roadHalfWidthM:4});
   const next=type==='circuit'?((distance+advance)%length+length)%length:Math.min(length,distance+advance);
   e.updateRaceCheckpointProgress({previousDistance:distance,nextDistance:next,routeAdvance:advance});
   assert.equal(e.playtestSession.checkpointIndex,checkpoints.length,'finish requires every checkpoint');
   if(type==='circuit')assert.ok(advance>0&&distance>length*.72&&next<length*.28,'completed lap crosses start');
   else assert.ok(next>=length-.001,'point-to-point race reaches finish');
  }
 });
}
test('local corner allowance does not accept a distant crossing or an off-course shortcut',()=>{
 const base={previousDistance:100,predictedAdvance:.3,routeLength:1000,travelM:.5,roadHalfWidthM:4,routeOffsetM:4,onRoad:true};
 assert.equal(reconcileRaceRouteAdvance({...base,projectedDistance:110}),10);
 assert.equal(reconcileRaceRouteAdvance({...base,projectedDistance:300}),.3);
 assert.equal(reconcileRaceRouteAdvance({...base,projectedDistance:110,routeOffsetM:20,onRoad:false}),.3);
 assert.equal(reconcileRaceRouteAdvance({...base,projectedDistance:90}),-10);
});
