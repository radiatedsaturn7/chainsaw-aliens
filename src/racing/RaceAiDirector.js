import { buildRaceAiRoadPlan, getRaceAiSpeedEnvelope, raceAiRoadPlanIndex } from './RaceAiRoadPlan.js';
// Shared race knowledge, not a replacement for vehicle physics. Road curvature
// is immutable during a playtest; traffic is rebuilt once before driver updates.
const directors = new WeakMap();
const CELL_M = 64;
const ROAD_STEP_M = 8;
const MAX_ROAD_SAMPLES = 4096;
const angleDelta = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function getRaceAiDirector(editor) {
  const session = editor.playtestSession;
  if (!session || session.debugAiIndependentPlanning) return null;
  const runtimeType = session.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const routeLength = Math.max(1,Number(session.routeLength || editor.getRaceRouteLength()));
  let director = directors.get(session);
  if (!director || director.race !== editor.selectedRace || director.runtimeType !== runtimeType
      || director.routeLength !== routeLength
      || director.poseProvider !== editor.getRaceWorldPoseAtDistance
      || director.widthProvider !== editor.getRaceRoadHalfWidthWorld
      || director.gradeProvider !== editor.getRaceRoadSurfaceProfileAtDistance) {
    director = {race:editor.selectedRace,runtimeType,routeLength,
      poseProvider:editor.getRaceWorldPoseAtDistance,widthProvider:editor.getRaceRoadHalfWidthWorld,
      gradeProvider:editor.getRaceRoadSurfaceProfileAtDistance,road:new Map(),headings:new Map(),traffic:null,
      stats:{roadQueries:0,roadHits:0,trafficBuilds:0,trafficCandidates:0}};
    directors.set(session,director);
  }
  return director;
}

export function prepareRaceAiDirector(editor) {
  const director = getRaceAiDirector(editor);
  if (!director) return;
  const session = editor.playtestSession;
  director.recoveryAttemptsThisUpdate=0;
  const grid = new Map();
  // Capture positions as well as cell membership so every driver sees the same
  // traffic snapshot, independent of which opponent is advanced first.
  for (const car of [...session.aiRuntime,session]) {
    if (!Number.isFinite(car.worldX) || !Number.isFinite(car.worldZ)) continue;
    const record = {car,worldX:car.worldX,worldZ:car.worldZ,
      carYaw:Number(car.carYaw)||0,speedMps:Number(car.speedMps)||0};
    const key = `${Math.floor(record.worldX/CELL_M)},${Math.floor(record.worldZ/CELL_M)}`;
    let cell = grid.get(key);
    if (!cell) grid.set(key,cell=[]);
    cell.push(record);
  }
  director.traffic = grid;
  director.stats.trafficBuilds++;
}

export function getRaceAiNearbyTraffic(editor,ai,radius) {
  const director = getRaceAiDirector(editor);
  if (!director?.traffic || !Number.isFinite(ai.worldX) || !Number.isFinite(ai.worldZ)) {
    return [...(editor.playtestSession?.aiRuntime || []),editor.playtestSession]
      .filter(Boolean).map(car=>({car,worldX:car.worldX,worldZ:car.worldZ,
        carYaw:car.carYaw,speedMps:car.speedMps}));
  }
  const result=[];
  for(let x=Math.floor((ai.worldX-radius)/CELL_M);x<=Math.floor((ai.worldX+radius)/CELL_M);x++) {
    for(let z=Math.floor((ai.worldZ-radius)/CELL_M);z<=Math.floor((ai.worldZ+radius)/CELL_M);z++) {
      const cell=director.traffic.get(`${x},${z}`);
      if(cell) for(const record of cell) result.push(record);
    }
  }
  director.stats.trafficCandidates+=result.length;
  return result;
}

export function getRaceAiSharedCurvature(editor,distance) {
  const director=getRaceAiDirector(editor);
  if(!director) return null;
  if(director.plan && !editor.playtestSession?.debugAiNoRoadPlan)
    return director.plan.curvature[raceAiRoadPlanIndex(director.plan,distance)];
  const d=director.runtimeType==='circuit'
    ? ((distance%director.routeLength)+director.routeLength)%director.routeLength
    : Math.max(0,Math.min(director.routeLength,distance));
  const index=Math.floor(d/ROAD_STEP_M);
  const cached=director.road.get(index);
  if(cached!==undefined){director.stats.roadHits++;return cached;}
  const start=index*ROAD_STEP_M;
  const options={runtimeType:director.runtimeType,allowVisualExtension:true};
  // Neighboring intervals guard against underestimating a corner at a bin
  // boundary. Slightly early braking is preferable to perfect per-car samples.
  const heading=(position)=>{
    let yaw=director.headings.get(position);
    if(yaw===undefined) {
      yaw=editor.getRaceWorldPoseAtDistance(position,options).yaw||0;
      director.stats.roadQueries++;
      if(director.headings.size>=MAX_ROAD_SAMPLES+4)director.headings.delete(director.headings.keys().next().value);
      director.headings.set(position,yaw);
    }
    return yaw;
  };
  let a=heading(start-ROAD_STEP_M);
  let curvature=0;
  for(let i=0;i<3;i++) {
    const b=heading(start+i*ROAD_STEP_M);
    curvature=Math.max(curvature,Math.abs(angleDelta(b,a))/ROAD_STEP_M);
    a=b;
  }
  if(director.road.size>=MAX_ROAD_SAMPLES)director.road.delete(director.road.keys().next().value);
  director.road.set(index,curvature);
  return curvature;
}

// Called during race startup, before countdown/running updates. Lazy fallback
// supports injected/debug AI and small unit fixtures that do not use startup.
export function prepareRaceAiRoadPlan(editor) {
  const director=getRaceAiDirector(editor);
  if(!director)return null;
  if(director.planPrepared)return director.plan;
  director.planPrepared=true;
  director.plan=buildRaceAiRoadPlan(editor,director);
  if(director.plan)for(const ratio of [.25,.5,.75,.875,1,1.25,1.5,2])getRaceAiSpeedEnvelope(director.plan,ratio);
  return director.plan;
}
export function getRaceAiRoadPlan(editor) {
  if(editor.playtestSession?.debugAiNoRoadPlan)return null;
  return prepareRaceAiRoadPlan(editor);
}
