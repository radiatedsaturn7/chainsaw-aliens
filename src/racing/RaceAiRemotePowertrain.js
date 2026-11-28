import {calculateBrushTireForce} from './simulation/ContactPatchTireModel.js';
import {createVehicleDynamicsConfigFromTuning} from './simulation/VehicleDynamicsRunner.js';
import {PowertrainModel} from './simulation/PowertrainModel.js';
const remotePowertrain=new PowertrainModel();
import {getRaceAiRouteMotion} from './RaceAiRouteMotion.js';
import { tireSizeForWheel } from './TireSizes.js';
import {clamp,RACE_WHEEL_IDS} from './simulation/SimulationMath.js';
import {planRaceAiControls} from './RaceAiControls.js';

// Healthy, supported cars outside the interaction envelope use an aggregate
// friction circle instead of repeated differential/load-transfer solves. This
// only supplies longitudinal forces to the existing swept, terrain-following
// distant chassis; obstacles and traffic still promote detailed physics.
export function useRaceAiRemotePowertrain(ai, session, tuning = {}) {
  return !tuning.wheelRadiusByWheelM && !tuning.cvt && tuning.powertrainType !== 'electric' && session?.debugAiDetailedLongitudinal !== true
    && (ai.physicsBudgetDetail === 'cheap' || Math.hypot(ai.worldX-session.worldX,ai.worldZ-session.worldZ)>120);
}
const scratchByCar=new WeakMap();
export function stepRaceAiRemotePowertrain(editor,ai,{car,tuning,contactState,profile,targetMps,seconds}) {
  const speed=Math.max(0,Number(ai.speedMps)||0),dt=Math.max(0,Number(seconds)||0);
  const controls=planRaceAiControls(editor,ai,tuning,targetMps,profile);
  const setup=editor.getRaceCarSetup(car),weather=editor.getRaceWeatherState(editor.selectedRace,editor.playtestSession);
  const modifiers=editor.getRaceSetupPhysicsModifiers(tuning,speed);
  const loose=editor.getRaceLooseSurfaceFactor(contactState.contacts);
  const mass=Math.max(450,Number(tuning.weightKg)||1400);
  const loads=editor.getRaceWheelNormalLoads(tuning,0,0,speed,{aeroLoadEffectiveness:editor.getRaceAeroLoadEffectiveness(loose)});
  const driven=editor.getRaceDrivenWheelIds(tuning);
  const gripFactor=clamp(Number(tuning.tireGrip)||1,.35,1.4)
    * clamp(Number(contactState.averageSurfaceGrip)||1,.22,1.2)*modifiers.grip
    * (editor.playtestSession.trackState ? 1 : editor.getRaceWeatherGripMultiplier(weather));
  let records=scratchByCar.get(ai);
  if(!records){records={dynamicNormalLoads:{},tireSlipByWheel:{},wheelContactScaleByWheel:{},
    contactWheelSpinRatioByWheel:{},brakeState:{lockByWheel:{},appliedByWheel:{}},temperature:{},grip:{},brush:{}};scratchByCar.set(ai,records);}
  let traction=0,drivenTraction=0,rolling=0,pressureRolling=0,snow=0;
  for(const id of RACE_WHEEL_IDS){
    const contact=contactState.contacts.contacts[id];
    const surface=contact.surface||contact.surfaceId||'asphalt';
    const temperature=Number(ai.tireTemperature?.[id]??70);
    const tire=ai.tireConfigByWheel?.[id] || {compound:editor.getRaceTireCompound(setup.tireCompoundByWheel[id],car),...tireSizeForWheel(setup,id)};
    const cell=contact.trackState?.cell;
    const material={...(cell||{}),baseSurfaceId:cell?.baseSurfaceId||contact.baseSurfaceId||surface,
      surfaceId:surface,surfaceGripScale:Number(cell?.baseGrip??contact.friction??contactState.averageSurfaceGrip??1)
        * Number(contact.trackState?.effectiveGripMultiplier??1),trackStateConditionApplied:Boolean(cell)};
    const patch=calculateBrushTireForce({normalLoadN:loads[id],kinematics:{slipRatio:0,slipAngleRad:0,camberAngleRad:0},
      tire:{...tire,pressurePsi:setup.tirePressurePsi[id],temperatureF:temperature,
        wear:ai.vehicleDynamicsRunner?.state?.tireState?.[id]?.wear||0,damage:Number(ai.damage?.tires?.[id])||0},
      material,target:records.brush[id] ||= {}});
    const capacity=patch.combinedSlipLimitN;
    records.grip[id]=capacity;traction+=capacity;if(driven.includes(id))drivenTraction+=capacity;
    records.dynamicNormalLoads[id]=loads[id];records.wheelContactScaleByWheel[id]=1;
    rolling+=Number(contact.trackState?.rollingResistanceMultiplier||1)/Math.max(.2,Number(contact.trackState?.cell?.baseRollingResistance||1));
    snow+=Number(contact.snowDepthInches??weather.snowDepthInches??0);
    const pressure=editor.getRaceTirePressureDynamics({pressurePsi:setup.tirePressurePsi[id],
      compoundId:editor.getRaceTireCompound(setup.tireCompoundByWheel[id],car).id,
      surfaceId:surface,tireSize:tireSizeForWheel(setup, id),temperatureF:temperature});
    pressureRolling+=Number(pressure.rollingMultiplier||1);
    records.temperature[id]=editor.getRaceUpdatedTireTemperature({previousTemperatureF:temperature,
      seconds:dt,speedMps:speed,loadRatio:1,slip:Number(ai.engineDrive?.tireSlipByWheel?.[id]||0),pressureDynamics:pressure,handbrake:0,
      wheelId:id,contactLoadScale:1,surfaceId:surface,terrain:'road'});
  }
  // Reserve tire capacity for the requested turn; no unlimited acceleration
  // around hairpins even though individual contact-patch relaxation is omitted.
  const steer=Number(ai.drivingPlan?.steeringAngleRad)||0;
  const routeMotion=getRaceAiRouteMotion(editor,ai,{tuning,averageSpeed:speed,seconds:dt});
  // Use the turn this chassis will actually execute. Pure pursuit may still
  // request a corrective wheel angle while distant motion follows a straight;
  // reserving a full corner's grip there falsely starved the driven wheels.
  const lateralForce=routeMotion ? mass*speed*routeMotion.yawRate
    : mass*speed*speed*Math.tan(steer)/Math.max(1,tuning.wheelbaseM||2.65);
  const remaining=Math.sqrt(Math.max(0,1-Math.min(1,Math.abs(lateralForce)/Math.max(1,traction))**2));
  const totalCapacity=traction;
  traction*=remaining;drivenTraction*=remaining;
  // Use the same engine, clutch take-up and shift interruptions as nearby
  // cars. Instant projected RPM/gear changes gave distant leaders free pace.
  const state=ai.vehicleDynamicsRunner?.state || (ai.remotePowertrainState ||= {});
  const config=ai.vehicleDynamicsRunner?.config || (records.config ||= createVehicleDynamicsConfigFromTuning(tuning));
  const kinematics={},capacity={};
  for(const id of RACE_WHEEL_IDS){
    const radius=Math.max(.1,Number(config.wheelRadiusM||tuning.wheelRadiusM)||.33);
    kinematics[id]={wheelAngularVelocityRadps:speed/radius,longitudinalVelocityMps:speed,
      effectiveRollingRadiusM:radius,slipRatio:0};
    capacity[id]=records.grip[id]*remaining;
  }
  const shares=remotePowertrain.getDriveForceShareByWheel(tuning,driven);
  const power=remotePowertrain.stepAuthoritativeWheelTorques({tuning,config,
    controls:{...controls,requestedGear:controls.gear,assists:{autoShift:true,tractionControlEnabled:true}},
    previous:state.powertrainState||{gear:ai.gear||1,engineRpm:ai.rpm||tuning.idleRpm},
    state:{...state,groundSpeedMps:speed},kinematicsByWheel:kinematics,
    capacityByWheel:capacity,driveShareByWheel:shares,damage:ai.damage||{},dt});
  state.powertrainState={...power.state,telemetry:power.telemetry};
  const radius=Math.max(.1,Number(config.wheelRadiusM||tuning.wheelRadiusM)||.33);
  const demand=RACE_WHEEL_IDS.reduce((sum,id)=>sum+power.wheelDriveTorqueNm[id]/radius,0);
  const drive=Math.min(Math.max(0,demand),drivenTraction);
  const engineBrake=Math.max(-drivenTraction,Math.min(0,demand));
  const brake=Math.min(traction,RACE_WHEEL_IDS.reduce((sum,id)=>sum+power.wheelBrakeTorqueNm[id]/radius,0));
  const resistance=editor.getRaceLongitudinalResistanceForces({tuning,speedMps:speed,setupModifiers:modifiers,
    terrainResistance:(1+loose*.32+editor.getRaceSnowResistanceMultiplier(snow/4))*rolling/4,
    looseSurfaceFactor:loose,tirePressureRollingMultiplier:pressureRolling/4,tireContactScale:1});
  const grade=Number(editor.getRaceRoadSurfaceProfileAtDistance(ai.projectedDistance??ai.distance??0,
    {runtimeType:editor.playtestSession.routeRuntimeType}).grade)||0;
  const acceleration=(drive+engineBrake-brake-resistance.totalN)/mass-9.81*editor.getRaceGradeGravityRatio(grade);
  const topSpeed=editor.getRaceRuntimeTopSpeedLimitMps(car,tuning,{setupModifiers:modifiers,gripFactor,
    looseSurfaceFactor:loose,tirePressureRollingMultiplier:pressureRolling/4});
  const slip=Math.max(0,demand/Math.max(1,drivenTraction)-1);
  for(const id of RACE_WHEEL_IDS){
    records.tireSlipByWheel[id]=driven.includes(id)?Math.min(1,slip):0;
    records.contactWheelSpinRatioByWheel[id]=driven.includes(id)?Math.min(1.8,demand/Math.max(1,drivenTraction)):0;
    records.brakeState.appliedByWheel[id]=brake*records.grip[id]/Math.max(1,totalCapacity);
    records.brakeState.lockByWheel[id]=0;
  }
  records.brakeState.force=brake;
  ai.engineDrive={...controls,...records,combinedBrakeState:records.brakeState,driveForceN:drive,
    tractionLimitN:drivenTraction,driveDemandRatio:demand/Math.max(1,drivenTraction),
    topSpeedLimitMps:topSpeed,approximation:'remote-aggregate'};
  ai.gear=power.state.gear;ai.rpm=power.state.engineRpm;ai.tireTemperature=records.temperature;
  return {speedMps:Math.max(0,Math.min(speed+acceleration*dt,
    controls.throttle>0&&acceleration>0?topSpeed*1.02:Infinity)),acceleration,
    braking:controls.braking,gripFactor,looseSurfaceFactor:loose};
}
