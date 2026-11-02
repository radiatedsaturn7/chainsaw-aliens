// Isolate driver planning cost from rendering, collision physics and weather.
// Fixed generic 8 km route and identical queries in both modes.
import {performance} from 'node:perf_hooks';
import {prepareRaceAiRoadPlan,getRaceAiDirector} from '../../src/racing/RaceAiDirector.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
function fixture(enabled) {
 let queries=0;
 const editor={selectedRace:{},playtestSession:{routeLength:8000,routeRuntimeType:'circuit',aiRuntime:[],debugAiNoRoadPlan:!enabled},
  getRaceWorldPoseAtDistance(d){queries++;return {x:0,z:d,yaw:.5*Math.sin(d/60),elevation:Math.sin(d/150)*2,segment:{}};},
  getRaceRoadHalfWidthWorld:()=>5,getRaceRightVector:y=>({x:-Math.cos(y),z:Math.sin(y)})};
 const start=performance.now();if(enabled)prepareRaceAiRoadPlan(editor);
 const loadMs=performance.now()-start;
 const tuning={widthM:1.8,wheelbaseM:2.6,tireGrip:1,weightKg:1400,brakeForceN:12000};
 const ai={worldX:0,worldZ:0,projectedDistance:0,carYaw:0,speedMps:20};
 for(let i=0;i<2000;i++)planRaceAiDriving(editor,ai,tuning);
 const before=queries,times=[];let checksum=0;
 for(let round=0;round<5;round++){
  const start=performance.now();
  for(let i=0;i<10000;i++){
   const d=(i*1.7)%8000;Object.assign(ai,{worldZ:d,projectedDistance:d,carYaw:.5*Math.sin(d/60),speedMps:10+i%30});
   checksum+=planRaceAiDriving(editor,ai,tuning,{grip:[.3,.6,1][i%3]}).targetSpeedMps;
  }
  times.push(performance.now()-start);
 }
 times.sort((a,b)=>a-b);
 return {enabled,loadMs,medianMsPer10000Decisions:times[2],roadQueriesPerDecision:(queries-before)/50000,
  samples:getRaceAiDirector(editor).plan?.count,profileBuilds:getRaceAiDirector(editor).plan?.profileBuilds,checksum};
}
console.log(JSON.stringify({scope:'planning only, synthetic 8 km route; not frame rate',online:fixture(false),precomputed:fixture(true)},null,2));
