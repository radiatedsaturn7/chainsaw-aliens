// Detached, bounded diagnostic snapshots. Never query terrain or advance physics.
const number = value => value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)*1000)/1000;
const vector = value => ({x:number(value?.x),y:number(value?.y),z:number(value?.z)});
const distance = (a,b) => [a.x,a.y,a.z,b.x,b.y,b.z].every(v=>v!==null)
  ? number(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)) : null;
const wheels = ['fl','fr','rl','rr'];

export function captureRaceAi(editor, {detailed=false}={}) {
 const s=editor.playtestSession || {}, length=number(s.routeLength), circuit=s.routeRuntimeType==='circuit';
 const entrants=[s,...(s.aiRuntime||[])];
 const cars=entrants.map((car,index)=>{
  const player=index===0, runner=car.vehicleDynamicsRunner;
  const worker=!!editor.vehicleDynamicsAuthority?.workerBridge;
  const local=!worker && runner?.dormant!==true && runner?.state;
  const state=local || car.vehicleDynamicsPresentationState || car.vehicleRenderState || {};
  const controls=player ? (!worker?editor.vehicleDynamicsAuthority?.latest?.telemetry?.controls:null) : car.engineDrive;
  const routeDistance=number(car.projectedDistance ?? car.distance);
  const lap=number(car.lap), awaiting=car.awaitingStartLine===true;
  // Before the first crossing, wrapped circuit coordinates belong behind the
  // start, not almost a whole lap ahead. Retain the raw fields for auditing.
  let progress=routeDistance;
  if(circuit) progress=length>0 && routeDistance!==null && lap!==null
   ? (awaiting ? (routeDistance>length/2?routeDistance-length:routeDistance)
      : (lap-1)*length+routeDistance) : null;
  const result={id:player?'player':String(car.id??car.carId??`ai-${index}`),
   carId:player?(s.carId??editor.selectedCar?.id??null):(car.carId??car.runtimeCar?.id??null),
   name:player?'You':car.name??null,difficulty:player?null:car.difficulty??null,
   skill:player?null:number(car.skill),aggression:player?null:number(car.aggression),rubberBanding:player?null:number(car.rubberBanding),
   stateSource:local?'local-authoritative':worker?'worker-presentation':'presentation-or-session',
   position:vector({x:state.position?.x??car.worldX,y:state.position?.y??car.bodyY,z:state.position?.z??car.worldZ}),
   lap,routeDistanceM:routeDistance,progressM:number(progress),awaitingStartLine:awaiting,
   finishMs:number(car.seriesFinishMs),speedMps:number(state.groundSpeedMps??car.speedMps),
   yawRad:number(state.yawRad??car.carYaw),pitchRad:number(state.pitchRad),rollRad:number(state.rollRad),
   physicsMode:player?'player':car.physicsBudgetDetail??car.simulationDetail??null,
   physicsReason:car.physicsBudgetReason??null,
   overtake:car.overtakePlan?{...car.overtakePlan}:null,
   competitionPI:car.competitionPI?{target:number(car.competitionPI.target),actual:number(car.competitionPI.actual),powerScale:number(car.competitionPI.powerScale)}:null,
   targetSpeedMps:number(car.drivingPlan?.targetSpeedMps),
   massKg:number(runner?.config?.massKg),powerHp:number(runner?.config?.powerHp),
   plan:{headingErrorRad:number(car.drivingPlan?.headingError),targetOffsetM:number(car.drivingPlan?.targetOffsetM),
    targetX:number(car.drivingPlan?.targetX),targetZ:number(car.drivingPlan?.targetZ),
    decelerationMps2:number(car.drivingPlan?.plannedDecelerationMps2)},
   controls:{throttle:number(controls?.throttle),brake:number(controls?.brake),
    steeringAngleRad:number(car.drivingPlan?.steeringAngleRad)},
   gear:number(state.gear??car.gear),rpm:number(state.engineRpm??car.rpm),
   held:car.cheapPhysicsHeld===true,heldSeconds:number(car.cheapHeldSeconds),blockedProgressSeconds:number(car.blockedProgressSeconds),
   movementReason:car.distantPhysicsReason??null,trafficBlocker:car.distantTrafficBlocker??null,
   cheapRecoveries:car.cheapRecoveryCount||0,resetCount:car.automaticVehicleResetCount||0};
  if(detailed){
   result.velocity=vector(state.velocity);result.angularVelocity=vector(state.angularVelocityWorld);
   result.grounded=typeof state.grounded==='boolean'?state.grounded:null;
   result.lateralSpeedMps=number(state.bodyLateralSpeedMps);
   result.wheels=Object.fromEntries(wheels.map(id=>{
    const patch=state.contactPatches?.[id]||{},suspension=state.suspensionState?.[id]||{};
    return [id,{loadN:number(patch.normalLoadN),supportN:number(patch.chassisSupportLoadN),
     compressionM:number(suspension.compressionM),overtravelM:number(patch.overtravelM),
     slipRatio:number(patch.rawSlipRatio??patch.slipRatio),validContact:typeof patch.validTreadContact==='boolean'?patch.validTreadContact:null,
     terrainSource:patch.terrainSampleSource??null,triangleId:patch.terrainTriangleId??null}];
   }));
   result.wheelTelemetryCurrent=!!state.contactPatches && (player||car.physicsBudgetDetail==='full');
  }
  return result;
 });
 const player=cars[0];
 const ordered=cars.filter(c=>c.progressM!==null).sort((a,b)=>b.progressM-a.progressM||a.id.localeCompare(b.id));
 for(const car of cars){
  const rank=ordered.indexOf(car),ahead=rank>0?ordered[rank-1]:null;
  car.progressRank=rank<0?null:rank+1;car.aheadId=ahead?.id??null;
  car.gapAheadM=ahead?number(ahead.progressM-car.progressM):null;
  car.distanceAheadCarM=ahead?distance(car.position,ahead.position):null;
  car.distanceToPlayerM=distance(car.position,player.position);
  car.progressRelativeToPlayerM=car.progressM!==null&&player.progressM!==null?number(car.progressM-player.progressM):null;
 }
 return {version:1,raceElapsedMs:number(s.elapsedMs),routeLengthM:length,routeType:s.routeRuntimeType??null,
  cars};
}
