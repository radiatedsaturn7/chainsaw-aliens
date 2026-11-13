import { tireSizeForWheel } from './TireSizes.js';
import {clamp,RACE_WHEEL_IDS} from './simulation/SimulationMath.js';
import {getRaceServiceBrakeForceN} from './simulation/RaceSimulationConfig.js';
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
    contactWheelSpinRatioByWheel:{},brakeState:{lockByWheel:{},appliedByWheel:{}},temperature:{},grip:{}};scratchByCar.set(ai,records);}
  let traction=0,drivenTraction=0,rolling=0,pressureRolling=0,snow=0;
  for(const id of RACE_WHEEL_IDS){
    const contact=contactState.contacts.contacts[id];
    const surface=contact.surface||contact.surfaceId||'asphalt';
    const temperature=Number(ai.tireTemperature?.[id]??70);
    const grip=editor.getRaceWheelGripForSurface({car,normalizedSetup:setup,wheelId:id,
      surfaceId:surface,baseSurfaceId:contact.baseSurface||surface,
      snowDepthInches:contact.snowDepthInches??weather.snowDepthInches,weather:weather.id,
      material:contact.trackState?.cell||null,damage:ai.damage||{},
      terrainGripScale:contact.terrainGripScale||1,temperatureF:temperature});
    const capacity=Math.max(0,loads[id]*grip*gripFactor);
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
  const lateralForce=mass*speed*speed*Math.tan(steer)/Math.max(1,tuning.wheelbaseM||2.65);
  const remaining=Math.sqrt(Math.max(0,1-Math.min(1,Math.abs(lateralForce)/Math.max(1,traction))**2));
  const totalCapacity=traction;
  traction*=remaining;drivenTraction*=remaining;
  const ratio=editor.getRaceGearRatio(tuning,controls.gear);
  const demand=editor.getRaceDriveForceComponents({tuning,gearRatio:ratio,
    engineTorqueNm:editor.getRaceTorqueNmAtRpm(controls.rpm,tuning),
    availablePowerW:tuning.powerHp*745.7,speedMps:speed}).baseForceN
    * tuning.accelerationCalibration*controls.throttle;
  const mechanical=ai.vehicleDynamicsRunner?.state?.mechanical;
  const effects=mechanical?.config?.enabled?mechanical.effects:null;
  const driveScale=mechanical?.engineRunning===false?0:clamp(Number(effects?.torque??1),0,1)*clamp(Number(effects?.drive??1),0,1);
  const brakeScale=RACE_WHEEL_IDS.reduce((sum,id)=>sum+clamp(Number(effects?.brakes?.[id]??1),0,1),0)/4;
  const drive=Math.min(Math.max(0,demand)*driveScale,drivenTraction);
  const brake=Math.min(getRaceServiceBrakeForceN(tuning)*controls.brake*brakeScale,traction);
  const engineBrake=editor.getRaceEngineBrakingForce({tuning,gearRatio:ratio,throttle:controls.throttle,
    speedMps:speed,engineRpm:controls.rpm,drivenTractionLimit:drivenTraction,tireContactScale:1}).force;
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
  ai.gear=controls.gear;ai.rpm=controls.rpm;ai.tireTemperature=records.temperature;
  return {speedMps:Math.max(0,Math.min(speed+acceleration*dt,
    controls.throttle>0&&acceleration>0?topSpeed*1.02:Infinity)),acceleration,
    braking:controls.braking,gripFactor,looseSurfaceFactor:loose};
}
