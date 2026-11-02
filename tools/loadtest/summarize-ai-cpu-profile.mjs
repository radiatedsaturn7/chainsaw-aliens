import fs from 'node:fs';
const [path,output]=process.argv.slice(2);
if(!path)throw Error('Usage: node tools/loadtest/summarize-ai-cpu-profile.mjs input.cpuprofile [output.json]');
const p=JSON.parse(fs.readFileSync(path));
const nodes=new Map(p.nodes.map(n=>[n.id,n])),parents=new Map();
for(const n of p.nodes)for(const id of n.children||[])parents.set(id,n.id);
const stack=id=>{const out=[];while(nodes.has(id)){out.push(nodes.get(id).callFrame);id=parents.get(id);}return out;};
const categories=frame=>{
 const f=frame.functionName||'',u=frame.url||'';
 if(/recoverUpsideDown|resetAuthoritativeState|solveStaticVehicleSupport|recoverPenetration/.test(f))return 'Recovery/reset';
 if(/ChassisBodyCollision|StaticRaceColliderWorld|WheelCylinderCollision|PersistentCollisionManifold/.test(u))return 'Body/scenery collision';
 if(/TerrainQuery|SurfaceModel|TerrainSampler|SurfaceSampler|RaceVehicleSurfaceContact|RaceAiSurfaceProbe/.test(u)||/getRace.*(SurfaceAt|GroundElevation|Terrain|RouteProjection)|sampleRecoveryTerrain/.test(f))return 'Terrain/surface queries';
 if(/ContactPatchTireModel|SuspensionGeometry|TireThermalModel/.test(u))return 'Tires/suspension';
 if(/PowertrainModel|MechanicalModel|RaceAiRemotePowertrain/.test(u)||f==='getRaceAiLongitudinalPhysicsStep')return 'Engine/transmission/mechanical';
 if(/RaceAiDriving|RaceAiRoadPlan|RaceAiDirector|RaceAiControls|RaceAiTrafficBounds|RaceAiRouteMotion/.test(u))return 'Driving/traffic planning';
 if(/trackState\/|VehicleTrackStateAuthority/.test(u))return 'Track state';
 if(/VehicleRenderState|VehicleState/.test(u)||/Telemetry|telemetry/.test(f))return 'State/telemetry construction';
 if(/VehicleDynamicsRunner/.test(u))return 'Chassis/physics integration';
 if(/RaceAiDistantPhysics/.test(u))return 'Distant-car integration';
 return null;
};
const aiOutsideDetailed={},aiOutsideDetailedFunctions={},excluded={};let aiOutsideDetailedMs=0;
const player={},playerFunctions={},allWork={},groups={},ai={},functions={},aiSampleCounts={},groupSampleCounts={},aiInclusiveActivities={},aiPaths={};let total=0,aiTotal=0,aiSamples=0,playerTotal=0;
for(let i=0;i<p.samples.length;i++){
 const ms=(p.timeDeltas?.[i]??1000)/1000;
 const frames=stack(p.samples[i]),leaf=frames[0]||{};
 // Profiler.stop can serialize a large profile synchronously. That is harness
 // overhead, not a race stall; preserve its cost separately from gameplay.
 if(frames.some(f=>f.url==='node:inspector' && f.functionName==='post')) {
  excluded.inspectorPostMs=(excluded.inspectorPostMs||0)+ms;
  excluded.samples=(excluded.samples||0)+1;continue;
 }
 total+=ms;
 const isPlayer=frames.some(f=>f.functionName==='profilePlayerAdvance');
 const isAi=frames.some(f=>f.functionName==='updateRaceAiDrivers');
 const group=leaf.functionName==='(garbage collector)'?'GC (unattributed)':isAi?'AI':leaf.functionName==='(idle)'?'Idle':'Other/player/runtime';
 const workCategory=group==='GC (unattributed)'||group==='Idle'?group:frames.map(categories).find(Boolean)||'Other runtime/orchestration';
 allWork[workCategory]=(allWork[workCategory]||0)+ms;
 groups[group]=(groups[group]||0)+ms;groupSampleCounts[group]=(groupSampleCounts[group]||0)+1;
 if(isAi){
  aiTotal+=ms;const category=frames.map(categories).find(Boolean)||'Other AI orchestration';ai[category]=(ai[category]||0)+ms;aiSamples++;aiSampleCounts[category]=(aiSampleCounts[category]||0)+1;
  for(const category of new Set(frames.map(categories).filter(Boolean)))aiInclusiveActivities[category]=(aiInclusiveActivities[category]||0)+ms;
  const path=frames.find(f=>['advanceRaceAiDistantPhysics','getRaceAiLongitudinalPhysicsStep','getRaceAiContactState','updateRaceAiVehiclePhysics','getRaceAiDrivingPlan'].includes(f.functionName))?.functionName||'Other driver work';
  aiPaths[path]=(aiPaths[path]||0)+ms;
 }
 const key=`${leaf.functionName||'(anonymous)'} ${leaf.url?.replace(/^.*\/src\//,'src/')||''}:${(leaf.lineNumber??-1)+1}`;
 functions[key]=(functions[key]||0)+ms;
 if(isAi && !frames.some(f=>f.functionName==='updateRaceAiVehiclePhysics')) {
  aiOutsideDetailedMs+=ms;
  const category=frames.map(categories).find(Boolean)||'Other AI orchestration';
  aiOutsideDetailed[category]=(aiOutsideDetailed[category]||0)+ms;
  aiOutsideDetailedFunctions[key]=(aiOutsideDetailedFunctions[key]||0)+ms;
 }
 if(isPlayer){playerTotal+=ms;player[workCategory]=(player[workCategory]||0)+ms;playerFunctions[key]=(playerFunctions[key]||0)+ms;}
}
const rank=(obj,denominator,valueLabel='ms')=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([name,ms])=>({name,[valueLabel]:+ms.toFixed(2),percent:+(100*ms/(denominator||1)).toFixed(2)}));
const result={excluded,aiOutsideDetailed:{sampledMs:aiOutsideDetailedMs,categories:rank(aiOutsideDetailed,aiOutsideDetailedMs),topSelf:rank(aiOutsideDetailedFunctions,aiOutsideDetailedMs).slice(0,40),note:'AI driver work outside updateRaceAiVehiclePhysics, including shared work and contact/event preparation for detailed cars. Not exclusively cheap cars.'},playerSampledMs:playerTotal,player:rank(player,playerTotal),playerTopSelf:rank(playerFunctions,playerTotal).slice(0,40),allWork:rank(allWork,total),source:path,method:'V8 sampled wall-time attribution; exclusive categories using nearest recognized stack frame. GC cannot be attributed to AI; no rendering. Sampling includes scheduling delays, not exact CPU cycles.',totalSampledMs:total,sampleCount:p.samples.length-(excluded.samples||0),rawSampleCount:p.samples.length,longSampleIntervals:(p.timeDeltas||[]).filter(us=>us>10000).length,groupSampleCounts:rank(groupSampleCounts,p.samples.length-(excluded.samples||0),'samples'),aiSampleCounts:rank(aiSampleCounts,aiSamples,'samples'),aiPaths:rank(aiPaths,aiTotal),aiInclusiveActivities:rank(aiInclusiveActivities,aiTotal),groups:rank(groups,total),ai:rank(ai,aiTotal),topSelf:rank(functions,total).slice(0,35)};
if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
