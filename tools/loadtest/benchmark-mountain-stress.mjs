import {createRacePhaseProfiler} from './race-phase-profiler.mjs';
import {getRaceAiDirector} from '../../src/racing/RaceAiDirector.js';
import {RACE_THREE_ELEVATION_M} from '../../src/racing/simulation/RaceSimulationConfig.js';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
import {PerformanceObserver} from 'node:perf_hooks';
import {createRaceTrackStateWeatherForcing} from '../../src/racing/trackState/TrackStateIntegration.js';
import {driveMountainBenchmark} from './mountain-autodrive.mjs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceTransferPackage} from '../../src/ui/raceWorldBakeWorker.js';
const read=path=>{const d=JSON.parse(fs.readFileSync(path));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const sourceHash=createHash('sha256');
for(const path of ['src/racing/simulation/TireStatePublication.js','src/racing/simulation/PackedRaceWorkerEnvironment.js','src/racing/RaceFrameBudget.js','src/racing/RaceAheadPreparation.js','src/racing/simulation/PhysicsTerrainQueryFrame.js','src/racing/RaceAiPhysicsBudget.js','src/racing/simulation/VehicleDynamicsRunner.js','src/racing/RaceBakedSurfaceSampler.js','tools/loadtest/race-phase-profiler.mjs','src/racing/RaceAiRoadContacts.js','src/racing/RaceAiRoadPlan.js','src/racing/RaceAiRecoveryWatchdog.js','src/racing/RaceAiDirector.js','src/racing/RaceAiDriving.js','src/racing/RaceAiRouteMotion.js','src/racing/RaceAiRemotePowertrain.js','src/racing/RaceAiScheduling.js','src/racing/RaceSurfaceModel.js','src/racing/trackState/TrackStateCell.js','src/racing/trackState/TrackStateCheckpointCell.js','src/racing/trackState/TrackStateIntegration.js','src/racing/simulation/VehicleTrackStateAuthority.js','src/racing/trackState/TrackStateSerialization.js','src/racing/trackState/TrackStateEvents.js','src/racing/RaceAiSurfaceProbe.js','src/racing/simulation/PowertrainModel.js','src/racing/trackState/TrackStateContactAccumulator.js','src/racing/simulation/ContactPatchTireModel.js','src/racing/simulation/WheelCylinderCollision.js','tools/loadtest/benchmark-mountain-stress.mjs','tools/loadtest/mountain-autodrive.mjs','src/racing/trackState/TrackState.js','src/racing/simulation/RigidBodyMath.js','src/ui/RaceEditor.js','src/racing/RaceAiControls.js','src/racing/simulation/StaticRaceColliderWorld.js','src/racing/RaceAiSimulation.js','src/racing/RaceAiDistantPhysics.js','src/racing/RaceAiTrafficBounds.js','src/racing/RaceVehicleSurfaceContact.js','src/racing/simulation/RaceSimulationConfig.js'])sourceHash.update(fs.readFileSync(path));
const sourceDigest=sourceHash.digest('hex');
let stopRequested=false;process.on('SIGINT',()=>{stopRequested=true;});
const weather=process.argv[2]||'storm',frames=Number(process.argv[3]||60);
const detailedStress=process.env.RTG_DETAILED_STRESS==='1';
const aiCount=Number(process.env.RTG_AI_COUNT ?? 29);
if (!Number.isInteger(aiCount) || aiCount < 0 || aiCount > (detailedStress?200:29)) throw Error('RTG_AI_COUNT must be 0–29 (30 total cars maximum)');
const warmupFrames=Math.max(5,Math.trunc(Number(process.env.RTG_WARMUP_FRAMES)||5));
const sourcePath=process.env.RTG_RACE_SOURCE||'artifacts/mountain-stress/candidate.json';
const doc=read(sourcePath);doc.race.weather=weather;doc.race.weatherIntensity=1;
doc.race.competition.aiDrivers=doc.race.competition.aiDrivers.slice(0,aiCount);
if(process.env.RTG_TIME_OF_DAY)doc.race.timeOfDay=process.env.RTG_TIME_OF_DAY;
if(process.env.RTG_BRIGHTNESS!==undefined)doc.race.brightness=Number(process.env.RTG_BRIGHTNESS);

const e=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}},{mode:'race'});
e.applyLoadedRaceDocument(doc,{name:doc.race.name});
for(const name of ['RTG-001','CT-86','PZ-24','BUSE-019'])e.applyLoadedCarDocument(read(`data/server-storage/files/cars/${name}/document.json`),{name});
e.hydrateProjectCarsFromSavedFiles=()=>{};
e.preloadSelectedRaceArtRefs=()=>{};e.prewarmRacePlaytestRenderResources=()=>{};
const car=e.project.cars.find(c=>c.__playtestDocumentName==='RTG-001');
const started=performance.now();console.log('prepare',weather);
const p=await buildRaceTransferPackage(e.selectedRace,{sourceNormalized:true,includeArtAssets:false,options:e.getRacePlaytestWorldBakeOptions(),reportProgress:(_,phase)=>console.log(phase,Math.round(performance.now()-started))});
const preparedMs=performance.now()-started;
const randomSeed=Number(process.env.RTG_RANDOM_SEED??8730)>>>0;
let randomState=randomSeed;
const originalRandom=Math.random;
try {
 Math.random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/4294967296);
 e.startPlaytest(e.getRaceCarProjectIdentity(car),{hydrateCars:false,preparedWorldBake:{...p.header,surfaceSampler:p.packedSampler,packedTerrain:p.packedTerrain}});
} finally {Math.random=originalRandom;}

const s=e.playtestSession;
s.debugFrameBudgetDisabled=process.env.RTG_FRAME_BUDGET==='0';
if(process.env.RTG_AHEAD_WEATHER==='0')s.trackState.prepareNewCellWeather=undefined;
if(detailedStress){
 const drivers=Array.from({length:aiCount},(_,i)=>({id:`stress-${i}`,carId:e.getRaceCarProjectIdentity(car),difficulty:'hard'}));
 s.aiRuntime=drivers.flatMap(driver=>e.createRaceAiRuntime([driver],{routeLength:s.routeLength}));
 for(let i=0;i<s.aiRuntime.length;i++){
  const ai=s.aiRuntime[i];ai.id=`stress-${i}`;
  // Test-only override: the production three-car selector still runs, but
  // cannot downgrade these actors. Verify real runner step counts below.
  Object.defineProperty(ai,'physicsBudgetDetail',{get:()=> 'full',set:()=>{},configurable:true});
 }
}
if(process.env.RTG_WEATHER_STEP_BUDGET!==undefined)s.trackState.maxWeatherStepsPerStep=Number(process.env.RTG_WEATHER_STEP_BUDGET);
s.debugAiNoContactCache=process.env.RTG_NO_CONTACT_CACHE==='1';s.debugAiFullConvoyPhysics=process.env.RTG_FULL_CONVOY_PHYSICS==='1';s.trackState.debugFullWeatherClamp=process.env.RTG_FULL_WEATHER_CLAMP==='1';s.trackState.debugLegacyContactEvents=process.env.RTG_LEGACY_CONTACT_EVENTS==='1';s.debugAiLegacyRoadMetrics=process.env.RTG_AI_LEGACY_ROAD_METRICS==='1';s.debugAiNoRoadPlan=process.env.RTG_AI_NO_ROAD_PLAN==='1';s.debugAiCenterSlow=process.env.RTG_AI_CENTER_SLOW==='1';s.debugAiIndependentPlanning=process.env.RTG_AI_INDEPENDENT_PLANNING==='1';s.debugAiBicycleOnly=process.env.RTG_AI_BICYCLE_ONLY==='1';s.debugAiDetailedLongitudinal=process.env.RTG_AI_DETAILED_LONGITUDINAL==='1';s.debugAiFullRate=process.env.RTG_AI_FULL_RATE==='1';Object.assign(s,{preparing:false,running:true,startupFramePending:false,countdownRemainingMs:0,launchLockMs:0,raceMusicPending:false});if(s.raceIntro)s.raceIntro.active=false;
if(s.aiRuntime.length!==aiCount)throw Error(`Expected ${aiCount} opponents; got ${s.aiRuntime.length}`);
// Optional diagnostic grid, on authored road rather than the extension behind
// the start. Change only initial poses: ordinary physics owns motion afterward.
const spacedGrid=process.env.RTG_AI_SPACED_GRID==='1';
if(spacedGrid)for(let i=0;i<s.aiRuntime.length;i++){
 const ai=s.aiRuntime[i],distance=detailedStress ? 100+(s.aiRuntime.length-1-i)*(s.routeLength-300)/Math.max(1,s.aiRuntime.length) : 200+(s.aiRuntime.length-1-i)*20;
 if(distance>=s.routeLength)throw Error('Diagnostic grid exceeds the route');
 const pose=e.getRaceWorldPoseAtDistance(distance,{runtimeType:s.routeRuntimeType});
 Object.assign(ai,{distance,projectedDistance:distance,worldX:pose.x,worldZ:pose.z??pose.y,
   carYaw:pose.yaw,lineOffset:0,trackStateTargetLineOffset:0,awaitingStartLine:false});
}

// Optional mature-storm scenario. Earlier startup comparisons retain their
// original buildup; full-route validation must explicitly exercise peak rain.
const fullWeather=process.env.RTG_FULL_WEATHER==='1';
if(fullWeather)s.debugEnvironment={weather,weatherIntensity:1,autoVisibility:true};
const weatherPrewarmSeconds=Math.max(0,Math.min(3600,Number(process.env.RTG_WEATHER_PREWARM_SECONDS)||0));
const initialWeatherState=e.getRaceWeatherState();
if(fullWeather && initialWeatherState.effectiveIntensity!==initialWeatherState.targetIntensity)throw Error('Full weather forcing did not initialize');
if(weatherPrewarmSeconds>0){
 const forcing=createRaceTrackStateWeatherForcing({weatherState:initialWeatherState,race:e.selectedRace});
 for(let i=0;i<Math.ceil(weatherPrewarmSeconds*10);i++)s.trackState.advance(Math.min(.1,weatherPrewarmSeconds-i*.1),forcing);
 console.log('weather-prewarmed',weatherPrewarmSeconds,initialWeatherState);
}
if(detailedStress)for(const ai of s.aiRuntime){
 const tuning=e.getRaceCarTuning(ai.runtimeCar);
 e.updateRaceAiVehiclePhysics(ai,{car:ai.runtimeCar,tuning,seconds:0});
 const costs=ai.vehicleDynamicsRunner.physicsCostAccounting;
 costs.enabled=true;costs.detailedCaptureActive=true;costs.latestFrameOnly=true;costs.detailedStepRecords=false;costs.stepHistoryMode='elapsed-ring';
 if(ai.vehicleDynamicsRunner.config.chassisHz!==60)throw Error('Unexpected AI physics rate');
}
const detailedTotals={},detailedCounters={},detailedSteps=new Map();
const stressProgress=[];
let finished=false;
e.showRaceResults=()=>{finished=true;};e.raceInput.keyboardThrottle=true;
const autodrive=process.env.RTG_AUTODRIVE==='1';let driveState=null;
const tag=String(process.env.RTG_BENCHMARK_TAG||'').replace(/[^a-zA-Z0-9_-]/g,'');
const readCpuKHz=()=>[0,7].map(cpu=>{try{return Number(fs.readFileSync(`/sys/devices/system/cpu/cpu${cpu}/cpufreq/scaling_cur_freq`,'utf8'));}catch{return null;}});
// Linux's last observed main-thread processor, not a claim of fixed affinity.
// Cluster probes alone cannot identify which core actually ran the benchmark.
const readCpuPlacement=()=>{
 try {
  const stat=fs.readFileSync('/proc/self/stat','utf8');
  const processor=Number(stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/)[36]);
  if(!Number.isInteger(processor)||processor<0)return null;
  let kHz=null;
  try{kHz=Number(fs.readFileSync(`/sys/devices/system/cpu/cpu${processor}/cpufreq/scaling_cur_freq`,'utf8'));}catch{}
  return {processor,kHz};
 } catch{return null;}
};
const cpuClockSamples=[];
// Optional retained-size diagnostics; kept outside timed simulation updates.
const memorySamples=[];
function collectionSizes(object) {
 return Object.fromEntries(Object.entries(object || {}).flatMap(([key,value]) => {
  if (Array.isArray(value)) return [[key,value.length]];
  if (value instanceof Map || value instanceof Set) return [[key,value.size]];
  return [];
 }));
}


if(process.env.RTG_WORKER_PROBE==='1') {
 const {runMountainWorkerProbe}=await import('./mountain-worker-probe.mjs');
 let report;
 try {report=await runMountainWorkerProbe(e,p.packedSampler,{seconds:Number(process.env.RTG_WORKER_PROBE_SECONDS||8)});}
 catch(error){report={error:String(error.message),code:error.code,...error.probeContext};}
 fs.writeFileSync(`artifacts/mountain-stress/${tag||'mountain'}-worker-probe.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 process.exit(report.error?1:0);
}

const phaseProfiler=process.env.RTG_PHASE_PROFILE?createRacePhaseProfiler(e,undefined,{playerDetail:process.env.RTG_PLAYER_PROFILE==='1'}):null;
const phaseFrames=[];
const gcEvents=[],frameSpans=[];
const gcObserver=process.env.RTG_GC_PROFILE ? new PerformanceObserver(list=>{
 for(const entry of list.getEntries()) gcEvents.push({start:entry.startTime,duration:entry.duration,kind:entry.detail?.kind});
}) : null;
gcObserver?.observe({entryTypes:['gc']});
const totals={},rows=[],frameCpuRows=[],driverRows=[];let startupTotals={};
const profiler=process.env.RTG_CPU_PROFILE ? new Session() : null;
const profilePost=(method)=>new Promise((resolve,reject)=>profiler.post(method,(error,result)=>error?reject(error):resolve(result)));
let profiling=false;
if(profiler){profiler.connect();await profilePost('Profiler.enable');}
for(const method of ['updateRaceAiDrivers','updateRaceTireTracks','getRaceTrackStateVisualCells',
 ...(process.env.RTG_AI_PROFILE ? ['updateRaceAiVehiclePhysics','getRaceAiLongitudinalPhysicsStep',
 'getRaceAiContactState','getRaceWheelSurfaceState'] : [])]){const original=e[method].bind(e);e[method]=(...args)=>{const at=performance.now();try{return original(...args);}finally{totals[method]=(totals[method]||0)+performance.now()-at;}};}
const perCarCosts=new Map(),slowAiCalls=[],roadObservations=new Map();
let measuredFrame=-1;
for(const method of ['updateRaceAiVehiclePhysics','getRaceAiContactState','getRaceAiLongitudinalPhysicsStep']) {
 const original=e[method].bind(e);
 e[method]=(ai,...args)=>{
  const at=performance.now();
  try{return original(ai,...args);}finally{
   const ms=performance.now()-at;
   if(measuredFrame>=warmupFrames) {
    let cost=perCarCosts.get(ai.id);
    if(!cost){cost={id:ai.id,carId:ai.carId,methods:{},slowCalls:0,maxMs:0};perCarCosts.set(ai.id,cost);}
    const m=cost.methods[method]||(cost.methods[method]={calls:0,ms:0});m.calls++;m.ms+=ms;
    if(method==='updateRaceAiVehiclePhysics'){
     cost.maxMs=Math.max(cost.maxMs,ms);
     if(ms>16.67)cost.slowCalls++;
     if(slowAiCalls.length<40||ms>slowAiCalls.at(-1).ms){
      slowAiCalls.push({frame:measuredFrame,id:ai.id,ms,distance:ai.distance,speed:ai.speedMps,
       reason:ai.distantPhysicsReason,roll:ai.rollRad,height:ai.bodyY,
       penetrationRecoveries:ai.vehicleDynamicsRunner?.penetrationRecoveryState?.sequence||0,
       backlog:ai.vehicleDynamicsRunner?.diagnostics?.backlogSteps||0,
       physics:detailedStress?structuredClone(ai.vehicleDynamicsRunner?.physicsCostAccounting.getLatestFrame()):undefined,
       resetError:ai.lastUpsideDownResetError,
       wheels:detailedStress?Object.fromEntries(Object.entries(ai.vehicleDynamicsRunner?.state?.contactPatches||{}).map(([id,p])=>[id,{valid:p.validTreadContact,load:p.normalLoadN,iterations:p.contactSolveIterationCount,triangle:p.terrainTriangleId}])):undefined});
      slowAiCalls.sort((a,b)=>b.ms-a.ms);slowAiCalls.length=Math.min(40,slowAiCalls.length);
     }
    }
   }
  }
 };
}
const chassisProfile = process.env.RTG_CHASSIS_PROFILE === '1';
const chassisTotals = {player: {}, ai: {}};
if(chassisProfile)globalThis.__RTG_PHYSICS_COST_ACCOUNTING__ = true;
for(let frame=0;frame<frames;frame++){
 measuredFrame=frame;
 if(chassisProfile && process.env.RTG_ALL_PHYSICS_STAGES === '1') {
  const costs = e.vehicleDynamicsAuthority?.runner?.physicsCostAccounting;
  if(costs){costs.detailedCaptureActive=true; costs.latestFrameOnly=true; costs.detailedStepRecords=false; costs.stepHistoryMode='elapsed-ring';}
 }
 if(chassisProfile && process.env.RTG_CHASSIS_PROFILE_AI === '1') {
  for(const ai of s.aiRuntime) {
   const costs = ai.vehicleDynamicsRunner?.physicsCostAccounting;
   if(costs) {costs.enabled=true; costs.detailedCaptureActive=true; costs.latestFrameOnly=true;
    costs.detailedStepRecords=false; costs.stepHistoryMode='elapsed-ring';}
  }
 }
 if(profiler && frame===Number(process.env.RTG_CPU_PROFILE_START_FRAME||300)){await profilePost('Profiler.start');profiling=true;}
 phaseProfiler?.begin(frame);
 const cpuBefore=phaseProfiler?process.cpuUsage():null;
 const frameStarted=performance.now();let elapsed=0,driverMs=0;
 e.withRaceGeometryReadCache(()=>{
  if(autodrive){const started=performance.now();driveState=driveMountainBenchmark(e,car);driverMs=performance.now()-started;}
  const at=performance.now();if(!e.updatePlaytestSafely(1/60))throw Error('Simulation failed');elapsed=performance.now()-at;
 });
 const frameEnded=performance.now();
 const frameCpuMs=frameEnded-frameStarted;
 if(chassisProfile && frame >= warmupFrames) {
  for(const [kind, runners] of [['player', [e.vehicleDynamicsAuthority?.runner]],
    ['ai', s.aiRuntime.map(ai => ai.vehicleDynamicsRunner)]]) {
   for(const runner of runners) {
    const latest = runner?.physicsCostAccounting.getLatestFrame();
    for(const [name, entry] of Object.entries(latest?.timings || {})) {
     if(!name.startsWith('chassis') && process.env.RTG_ALL_PHYSICS_STAGES !== '1')continue;
     const total = chassisTotals[kind][name] ||= {ms: 0, calls: 0, maxFrameMs: 0};
     total.ms += entry.exclusiveMs; total.calls += entry.calls;
     total.maxFrameMs = Math.max(total.maxFrameMs, entry.exclusiveMs);
    }
   }
  }
 }
 if(phaseProfiler){const phase=phaseProfiler.end();phase.cpu=process.cpuUsage(cpuBefore);phaseFrames.push(phase);}
 if(gcObserver)frameSpans.push({frame,start:frameStarted,end:frameEnded});
 frameCpuRows.push(frameCpuMs);driverRows.push(driverMs);
 for(const ai of s.aiRuntime) if(![ai.worldX,ai.worldZ,ai.distance,ai.speedMps].every(Number.isFinite)) throw Error(`Invalid opponent state: ${ai.id}`);
 if(frame%60===0){
  for(const ai of s.aiRuntime){
   const pose=e.getRaceWorldPoseAtDistance(ai.projectedDistance??ai.distance,{runtimeType:s.routeRuntimeType,allowVisualExtension:true});
   const offset=Math.hypot(ai.worldX-pose.x,ai.worldZ-(pose.z??pose.y));
   const halfWidth=e.getRaceRoadHalfWidthWorld(pose.segment);
   let obs=roadObservations.get(ai.id);
   if(!obs){obs={id:ai.id,samples:0,offRoadSamples:0,stalledSamples:0,belowRoadSamples:0,maxOffsetM:0};roadObservations.set(ai.id,obs);}
   obs.samples++;obs.maxOffsetM=Math.max(obs.maxOffsetM,offset);
   if(offset>halfWidth)obs.offRoadSamples++;
   if(Math.abs(ai.speedMps)<1&&ai.drivingPlan?.targetSpeedMps>1)obs.stalledSamples++;
   if(offset<=halfWidth&&ai.vehicleDynamicsRunner?.state?.position?.y<pose.elevation*RACE_THREE_ELEVATION_M-6)obs.belowRoadSamples++;
  }
 }
 if(frame%100===0)cpuClockSamples.push({frame,kHz:readCpuKHz(),mainThread:readCpuPlacement()});
 if(detailedStress){
  for(const ai of s.aiRuntime){
   if(ai.physicsBudgetDetail!=='full'||ai.simulationDetail==='distant')throw Error('Cheap physics entered detailed stress');
   const runner=ai.vehicleDynamicsRunner;
   const prior=detailedSteps.get(ai.id)||0;
   const latest=runner.physicsCostAccounting.getLatestFrame();
   if(runner.stepIndex!==prior&&frame>=warmupFrames&&latest){
    for(const [name,value] of Object.entries(latest.timings)){
     const out=detailedTotals[name]||(detailedTotals[name]={inclusiveMs:0,exclusiveMs:0,calls:0,maxFrameMs:0});
     out.inclusiveMs+=value.inclusiveMs;out.exclusiveMs+=value.exclusiveMs;out.calls+=value.calls;out.maxFrameMs=Math.max(out.maxFrameMs,value.inclusiveMs);
    }
    for(const [name,value] of Object.entries(latest.counters))detailedCounters[name]=(detailedCounters[name]||0)+value;
   }
   detailedSteps.set(ai.id,runner.stepIndex);
  }
 }
 if(detailedStress && frame%60===0){
  stressProgress.push({frame,simulatedSeconds:frame/60,wallMs:performance.now()-started,
   steps:[...detailedSteps.values()].reduce((n,v)=>n+v,0),
   moving:s.aiRuntime.filter(ai=>ai.speedMps>1).length,
   speeds:s.aiRuntime.map(ai=>ai.speedMps).sort((a,b)=>a-b),
   heapMB:process.memoryUsage().heapUsed/1048576});
  fs.writeFileSync(`artifacts/mountain-stress/${tag}-progress.json`,JSON.stringify({stressProgress,detailedTotals,detailedCounters},null,2));
 }
 rows.push(elapsed);if(frame%10===0)console.log(JSON.stringify({frame,updateMs:elapsed,frameCpuMs,driverMs,speed:s.speedMps,driveState,ai:s.aiRuntime.length,aiResets:s.aiRuntime.reduce((n,ai)=>n+(ai.automaticVehicleResetCount||0),0),aiMaxBacklog:Math.max(0,...s.aiRuntime.map(ai=>ai.vehicleDynamicsRunner?.diagnostics?.backlogSteps||0)),aiMaxFallSpeed:Math.min(0,...s.aiRuntime.map(ai=>ai.vehicleDynamicsRunner?.state?.velocity?.y||0)),distantAi:s.aiRuntime.filter(ai=>ai.simulationDetail==='distant').length,reducedRateAi:s.aiRuntime.filter(ai=>ai.simulationPipelineHz===20).length,remotePowertrainAi:s.aiRuntime.filter(ai=>ai.simulationDetail==='distant'&&ai.engineDrive?.approximation==='remote-aggregate').length,detailReasons:s.aiRuntime.reduce((counts,ai)=>{const reason=ai.distantPhysicsReason||'initial';counts[reason]=(counts[reason]||0)+1;return counts;},{}),heapMB:process.memoryUsage().heapUsed/1048576,cpuKHz:frame%100===0?cpuClockSamples.at(-1).kHz:undefined}));
 if(process.env.RTG_MEMORY_PROFILE && frame%300===0){
  global.gc?.();
  const sample={frame,heapMB:process.memoryUsage().heapUsed/1048576,
   editor:collectionSizes(e),session:collectionSizes(s),trackState:collectionSizes(s.trackState),
   checkpoint:{completed:s.trackState.performanceCounters.checkpointCompletedCount,
    baseStep:s.trackState.historyBaseStepIndex,phase:s.trackState.checkpointBuilder?.phase,
    copies:s.trackState.checkpointBuilder?.cellCopies.size,
    targets:s.trackState.checkpointBuilder?.targetKeys?.length,
    hashCharacters:s.trackState.checkpointBuilder?.hashTask?.processedCharacters},
   ai:s.aiRuntime.map(ai=>({id:ai.id,runner:collectionSizes(ai.vehicleDynamicsRunner)}))};
  memorySamples.push(sample);
  fs.writeFileSync(`artifacts/mountain-stress/${tag||'current'}-memory.json`,JSON.stringify(memorySamples,null,2));
 }
 if(frame===warmupFrames-1)startupTotals={...totals};
 if(finished||stopRequested)break;
 await new Promise(r=>setImmediate(r));
}
if(profiling){const {profile}=await profilePost('Profiler.stop');fs.writeFileSync(`artifacts/mountain-stress/${weather}${tag?`-${tag}`:''}-ai-steady.cpuprofile`,JSON.stringify(profile));}
profiler?.disconnect();
if(gcObserver){await new Promise(resolve=>setImmediate(resolve));gcObserver.disconnect();}
const sorted=rows.slice(warmupFrames).sort((a,b)=>a-b),pct=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];
const frameSorted=frameCpuRows.slice(warmupFrames).sort((a,b)=>a-b);
const framePct=q=>frameSorted[Math.min(frameSorted.length-1,Math.floor(frameSorted.length*q))];
const result={aheadWeatherPreparationSteps:s.trackState.performanceCounters.aheadWeatherPreparationSteps,aheadWeatherPreparationSlices:s.trackState.performanceCounters.aheadWeatherPreparationSlices,chassisTotals,frameBudgetEnabled:!s.debugFrameBudgetDisabled,frameBudget:s.frameBudget?.stats,frameClock:s.frameSimulationClock,sourcePath,detailedStress,stressProgress,wallMs:performance.now()-started,detailedTotals,detailedCounters,detailedSteps:Object.fromEntries(detailedSteps),simulatedSeconds:rows.length/60,weatherStepBudget:Number.isFinite(s.trackState.maxWeatherStepsPerStep)?s.trackState.maxWeatherStepsPerStep:null,contactCacheEnabled:!s.debugAiNoContactCache,convoySimplificationEnabled:!s.debugAiFullConvoyPhysics,weatherPartialClampEnabled:!s.trackState.debugFullWeatherClamp,phaseFrames,gcEvents,frameSpans,trackStateChecksum:s.trackState.getChecksum(),legacyContactEvents:s.trackState.debugLegacyContactEvents,legacyRoadMetrics:s.debugAiLegacyRoadMetrics,roadPlanEnabled:!s.debugAiNoRoadPlan,roadPlanSamples:getRaceAiDirector(e)?.plan?.count,roadPlanProfileBuilds:getRaceAiDirector(e)?.plan?.profileBuilds,spacedGrid,roadObservations:[...roadObservations.values()],aiCenterSlow:s.debugAiCenterSlow,perCarCosts:[...perCarCosts.values()],slowAiCalls,randomSeed,aiIndependentPlanning:s.debugAiIndependentPlanning,aiBicycleOnly:s.debugAiBicycleOnly,aiDetailedLongitudinal:s.debugAiDetailedLongitudinal,aiFullRate:s.debugAiFullRate,aiCount,timeOfDay:e.selectedRace.timeOfDay,brightness:e.getRaceRenderBrightness(),warmupFrames,frameCpuP50Ms:framePct(.5),frameCpuP95Ms:framePct(.95),frameCpuP99Ms:framePct(.99),driverRows,frameCpuRows,authority:'Node CPU simulation; no browser or GPU; not FPS',weather,fullWeather,weatherPrewarmSeconds,initialWeatherState,finalWeatherState:e.getRaceWeatherState(),sourceDigest,cpuClockSamples,framesRequested:frames,interrupted:stopRequested,frames:rows.length,autodrive,finished,driveState,preparedMs,totalCars:s.aiRuntime.length+1,aiStates:s.aiRuntime.map(ai=>({id:ai.id,carId:ai.carId,lineOffset:ai.lineOffset,penetrationRecoveries:ai.vehicleDynamicsRunner?.penetrationRecoveryState?.sequence||0,heightM:ai.vehicleDynamicsRunner?.state?.position?.y,verticalSpeed:ai.vehicleDynamicsRunner?.state?.velocity?.y,backlogSteps:ai.vehicleDynamicsRunner?.diagnostics?.backlogSteps,resets:ai.automaticVehicleResetCount||0,resetReason:ai.lastVehicleResetReason,recoveryWait:ai.recoveryWait,recoveryNeedsLanding:ai.recoveryNeedsLanding,resetError:ai.lastUpsideDownResetError,watchdog:ai.recoveryWatchdog,engineRunning:ai.vehicleDynamicsRunner?.state?.mechanical?.engineRunning,failedComponents:Object.entries(ai.vehicleDynamicsRunner?.state?.mechanical?.components||{}).filter(([,c])=>c.failed||c.damage>=70).map(([id])=>id),worldX:ai.worldX,worldZ:ai.worldZ,yaw:ai.carYaw,blocker:ai.distantTrafficBlocker,distance:ai.distance,speedMps:ai.speedMps,detail:ai.simulationDetail||'full',reason:ai.distantPhysicsReason,roll:ai.rollRad,targetSpeedMps:ai.drivingPlan?.targetSpeedMps,throttle:ai.engineDrive?.throttle,brake:ai.engineDrive?.brake})),scenery:doc.race.scenery.length,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),totals,steadyTotals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v-(startupTotals[k]||0)])),rows};
fs.writeFileSync(`artifacts/mountain-stress/${weather}${autodrive?'-autodrive':''}${tag?`-${tag}`:''}-cpu.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined,driverRows:undefined,frameCpuRows:undefined,aiStates:undefined,gcEvents:undefined,frameSpans:undefined,phaseFrames:undefined}));
