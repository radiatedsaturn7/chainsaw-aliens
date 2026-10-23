import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';
import * as THREE from '../../src/vendorBridge/three.js';
const read=path=>{let d=JSON.parse(fs.readFileSync(path));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const output=process.env.P2_REPORT||'artifacts/p2loadtest/cpu-lap.json';
fs.mkdirSync('artifacts/p2loadtest',{recursive:true});
globalThis.__RTG_PHYSICS_COST_ACCOUNTING__=process.env.P2_COSTS === '1';
const e=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}},{mode:'race'});
e.applyLoadedRaceDocument(read('data/server-storage/files/races/p2loadtest/document.json'),{name:'p2loadtest'});
for(const name of ['RTG-001','CT-86','PZ-24','BUSE-019'])e.applyLoadedCarDocument(read(`data/server-storage/files/cars/${name}/document.json`),{name});
const car=e.project.cars.find(c=>c.__playtestDocumentName==='RTG-001');
e.setRaceAiCount(11);
console.log('baking world');let t=performance.now();
const bake=e.buildRaceWorldBake({retainTerrainCells:false});
console.log(JSON.stringify({bakeMs:performance.now()-t,triangles:bake.mesh?.triangles.length}));
e.startPlaytest(e.getRaceCarProjectIdentity(car),{hydrateCars:false,preparedWorldBake:bake});
globalThis.__p2Editor=e;
const s=e.playtestSession;s.countdownRemainingMs=0;s.startupFramePending=false;s.launchLockMs=0;
if(s.aiRuntime.length!==11)throw Error(`Expected 11 AI, got ${s.aiRuntime.length}`);
const length=s.routeLength,renderer={scene:new THREE.Scene()};
const report={authority:'node-cpu-no-browser-no-gpu',race:'p2loadtest',routeLength:length,aiCount:s.aiRuntime.length,bakeTriangles:bake.mesh?.triangles.length,frames:[],sections:[],complete:false};
const totals={};
for(const name of ['updateRaceAiDrivers','getRaceTrackStateVisualCells','updateRaceTireTracks','getRaceRouteProjectionForWorldPoint']){
 const base=e[name].bind(e);e[name]=(...args)=>{const t=performance.now();try{return base(...args);}finally{totals[name]=(totals[name]||0)+performance.now()-t;}};
}
let finished=false;e.showRaceResults=()=>{finished=true;};
report.driver='AI route planner through gamepad steering inverse; manual pedal/gear inputs, no pose resets';
let distance=0,maxDistance=0,lastDistance=0,lastProgressFrame=0;
Object.assign(e.raceInput,{autoShift:true,analogThrottleActive:true,analogBrakeActive:true,analogSteeringActive:true,syntheticAnalogSteering:true,paused:false});
const dt=Number(process.env.P2_DT||1/60);
if(dt>8/120)throw Error('Update delta exceeds the player fixed-step catch-up budget');
report.updateDt=dt;
report.aiCars=s.aiRuntime.map(a=>({id:a.id,carId:a.carId}));
const maxFrames=Number(process.env.P2_FRAMES||Math.ceil(3000/dt));
for(let frame=0;frame<maxFrames;frame++){
 e.withRaceGeometryReadCache(()=>{
  const p=e.getRaceRouteProjectionForWorldPoint({x:s.worldX,z:s.worldZ,y:s.bodyY});
  distance=p.distance;
  const speed=Math.abs(s.speedMps||0);
  const tuning=e.getRaceCarTuning(s.runtimeCar);
  const plan=planRaceAiDriving(e,{...s,projectedDistance:distance,lineOffset:0},tuning,{grip:.8,topSpeedMps:30});
  const targetSpeed=plan.targetSpeedMps;
  // Invert the game's speed-sensitive gamepad steering map, rather than treating
  // stick deflection as an unscaled physical wheel angle.
  let low=0,high=1;
  for(let i=0;i<16;i++){
    const mid=(low+high)/2;
    const actual=e.getRaceResolvedCenterSteeringAngle(mid,speed,{wheelbaseM:tuning.wheelbaseM,availableLateralG:.95,handlingPreset:tuning.handlingPreset||'sport',maxPhysicalAngleRad:.52});
    if(Math.abs(actual)<Math.abs(plan.steeringAngleRad))low=mid;else high=mid;
  }
  const steer=-Math.sign(plan.steeringAngleRad)*(low+high)/2;
  const gear=speed<11?1:speed<21?2:speed<31?3:4;
  Object.assign(e.raceInput,{autoShift:false,gear,analogSteeringIntent:steer,keyboardThrottle:speed<targetSpeed,rawThrottleAxis:speed<targetSpeed?Math.min(.7,(targetSpeed-speed)*.22+.12):0,keyboardBrake:speed>targetSpeed+.5,rawBrakeAxis:speed>targetSpeed+.5?Math.min(.6,(speed-targetSpeed)*.15):0});
 });
 const t=performance.now();const ok=e.updatePlaytestSafely(dt);const updateMs=performance.now()-t;
 const drawStart=performance.now();e.withRaceGeometryReadCache(()=>{e.syncRaceThreeTrackState(renderer);e.syncRaceThreeTireTracks(renderer);});const renderPreparationMs=performance.now()-drawStart;
 maxDistance=Math.max(maxDistance,distance);
 if(distance>lastDistance+1){lastDistance=distance;lastProgressFrame=frame;}
 report.frames.push({frame,distance,speed:s.speedMps,updateMs,renderPreparationMs,cells:s.trackState?.cells?.size,marks:s.tireTrackSegments?.length});
 if(frame%120===0){
  const status={frame,seconds:frame*dt,distance,maxDistance,speed:s.speedMps,aiMin:Math.min(...s.aiRuntime.map(a=>a.distance)),aiMax:Math.max(...s.aiRuntime.map(a=>a.distance)),updateMs,renderPreparationMs,cells:s.trackState?.cells?.size,marks:s.tireTrackSegments?.length,events:s.trackState?.eventHistory?.length,checkpoints:s.trackState?.performanceCounters?.checkpointCompletedCount,rssMB:process.memoryUsage().rss/1048576};
  console.log(JSON.stringify(status));fs.writeFileSync(output+'.progress.json',JSON.stringify(status));
 }
 if(frame%600===0) { fs.writeFileSync(output,JSON.stringify({...report,maxDistance,totals})); await new Promise(resolve=>setImmediate(resolve)); }
 if(finished){report.complete=true;break;}
 if(!ok||(frame-lastProgressFrame)*dt>30){report.failure={reason:!ok?'simulation failed':'controller stuck',frame,distance,position:{x:s.worldX,z:s.worldZ},reset:s.lastVehicleResetReason,gear:s.gear,yaw:s.carYaw,damage:s.damage};break;}
}
const pct=(arr,q)=>arr.sort((a,b)=>a-b)[Math.min(arr.length-1,Math.floor(arr.length*q))]||0;
for(let km=0;km<Math.ceil(length/1000);km++){
 const rows=report.frames.filter(f=>f.distance>=km*1000&&f.distance<(km+1)*1000);
 report.sections.push({km,frames:rows.length,updateP50:pct(rows.map(r=>r.updateMs),.5),updateP95:pct(rows.map(r=>r.updateMs),.95),updateP99:pct(rows.map(r=>r.updateMs),.99),renderPreparationP95:pct(rows.map(r=>r.renderPreparationMs),.95)});
}
Object.assign(report,{maxDistance,totals,checkpoint:s.trackState?.performanceCounters,ai:s.aiRuntime.map(a=>({id:a.id,distance:a.distance,speed:a.speedMps})),lastPhysicsCost:s.vehicleDynamicsRunner?.physicsCostAccounting?.getLatestFrame()});
fs.writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify({...report,frames:report.frames.length}));
