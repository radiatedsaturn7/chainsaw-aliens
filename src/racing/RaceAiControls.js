import { wheelRadiusFor } from './TireSizes.js';
import {getRaceAiRoadPlan} from './RaceAiDirector.js';
import {raceAiRoadPlanIndex} from './RaceAiRoadPlan.js';
import {clamp,RACE_WHEEL_IDS} from './simulation/SimulationMath.js';

// Shared driver decisions. Physical forces belong to whichever chassis model
// is active, rather than being calculated twice for detailed opponents.
export function planRaceAiControls(editor,ai,tuning,targetMps,profile={}) {
 const speed=Math.max(0,Number(ai.speedMps||0));
 const target=Math.max(0,Number(targetMps)||0);
 const error=target-speed;
 // A stopped traffic queue still needs brake pressure on a grade. Releasing
 // at zero speed caused rollback, collisions and repeated detailed simulation.
 const holding=target<=.05 && speed<.5;
 const plannedDeceleration=Math.max(0,Number(ai.drivingPlan?.plannedDecelerationMps2)||0);
 const physicalBrakeDeceleration=Number(tuning.brakeForceN)/Math.max(450,Number(tuning.weightKg)||1400);
 const feedForward=Number.isFinite(physicalBrakeDeceleration)&&physicalBrakeDeceleration>0
   ? clamp(plannedDeceleration/physicalBrakeDeceleration,0,1)*clamp((speed-target+1)/1,0,1) : 0;
 const braking=holding||error<-.35||feedForward>.01;
 let throttle=braking?0:clamp(error/Math.max(4,20-Number(profile.pace||.8)*8),0,1);
 const brake=holding?1:braking?clamp(feedForward+Math.max(0,-error)/Math.max(5,22-Number(profile.brake||.7)*10),0,1):0;
 let gear=clamp(Math.round(Number(ai.gear||1)),1,Math.max(1,tuning.gearRatios.length));
 const projectedRpm=editor.getRaceProjectedEngineRpmForGear(tuning,speed,gear);
 const upshift=editor.getRaceAutomaticUpshiftRpm(tuning),downshift=editor.getRaceAutomaticDownshiftRpm(tuning);
 if(!braking&&projectedRpm>upshift*(ai.difficulty==='expert'?.99:.92)&&gear<tuning.gearRatios.length)gear++;
 if((braking||projectedRpm<downshift*Number(profile.shift||.8))&&gear>1&&editor.canRaceAutomaticDownshift(tuning,speed,gear-1))gear--;
 let automaticOverrevUpshifts=0;
 while(gear<tuning.gearRatios.length&&editor.getRaceProjectedEngineRpmForGear(tuning,speed,gear)>Math.max(upshift,tuning.revLimitRpm*.985)){
  gear++;automaticOverrevUpshifts++;
 }
 const cvt=tuning.powertrainType !== 'electric' && tuning.cvt;
 // Detailed CVT opponents retain their actual ratio through distance changes.
 // Before the first authoritative sample, estimate the continuous target ratio.
 const targetRpm=cvt ? cvt.cruiseRpm+(cvt.powerRpm-cvt.cruiseRpm)*throttle : 0;
 const cvtRatio=cvt ? clamp(Number(ai.vehicleDynamicsRunner?.state?.powertrainState?.cvt?.ratio)
   || targetRpm*2*Math.PI*Math.max(.01,tuning.wheelRadiusM)/(60*Math.max(.01,speed)*tuning.finalDrive),cvt.minRatio,cvt.maxRatio) : 0;
 const rpm=clamp(cvt ? speed/Math.max(.01,tuning.wheelRadiusM)*cvtRatio*tuning.finalDrive*60/(2*Math.PI)
   : editor.getRaceProjectedEngineRpmForGear(tuning,speed,gear),tuning.idleRpm,tuning.revLimitRpm);
 // Proportional speed control alone cannot restart a slow uphill queue: a
 // 0.5 m/s target requested almost no torque, less than gravity/resistance.
 // Add force-based launch feed-forward, fading out as the car gains speed.
 if(!braking && target>.05 && speed<3 && editor.getRaceDriveForceComponents
   && editor.getRaceRoadSurfaceProfileAtDistance && editor.getRaceLongitudinalResistanceForces){
  const mass=Math.max(450,Number(tuning.weightKg)||1400);
  const roadPlan=getRaceAiRoadPlan(editor);
  const grade=roadPlan?roadPlan.grade[raceAiRoadPlanIndex(roadPlan,ai.projectedDistance??ai.distance??0)]:Number(editor.getRaceRoadSurfaceProfileAtDistance(ai.projectedDistance??ai.distance??0,
   {runtimeType:editor.playtestSession?.routeRuntimeType}).grade)||0;
  const resistance=editor.getRaceLongitudinalResistanceForces({tuning,speedMps:speed,
   setupModifiers:editor.getRaceSetupPhysicsModifiers(tuning,speed),terrainResistance:1,
   looseSurfaceFactor:0,tirePressureRollingMultiplier:1,tireContactScale:1});
  const force=editor.getRaceDriveForceComponents({tuning,gearRatio:cvt ? cvtRatio : editor.getRaceGearRatio(tuning,gear),
   engineTorqueNm:editor.getRaceTorqueNmAtRpm(rpm,tuning),availablePowerW:tuning.powerHp*745.7,speedMps:speed}).baseForceN
   * tuning.accelerationCalibration;
  const required=Math.max(0,mass*9.81*editor.getRaceGradeGravityRatio(grade)
   + resistance.totalN + mass*clamp(error*.5,.05,.75));
  throttle=Math.max(throttle,clamp(required/Math.max(1,force),0,1)*clamp(3-speed,0,1));
 }
 return {throttle,brake,braking,gear,automaticOverrevUpshifts,automaticUpshiftRpm:upshift,rpm};
}

const physicalTireEffectRecords = new WeakMap();

export function syncRaceAiPhysicalTireEffects(ai) {
 const runner=ai.vehicleDynamicsRunner,state=runner?.state;
 if(!state || runner.dormant) return;
 const drive=ai.engineDrive || (ai.engineDrive={});
 let records=physicalTireEffectRecords.get(ai);
 if(!records){
  records={dynamicNormalLoads:{},tireSlipByWheel:{},wheelContactScaleByWheel:{},
   contactWheelSpinRatioByWheel:{},combinedBrakeState:{lockByWheel:{},appliedByWheel:{}},tireTemperature:{}};
  physicalTireEffectRecords.set(ai,records);
 }
 drive.dynamicNormalLoads=records.dynamicNormalLoads;
 drive.tireSlipByWheel=records.tireSlipByWheel;
 drive.wheelContactScaleByWheel=records.wheelContactScaleByWheel;
 drive.contactWheelSpinRatioByWheel=records.contactWheelSpinRatioByWheel;
 drive.combinedBrakeState=records.combinedBrakeState;
 ai.tireTemperature=records.tireTemperature;
 let demand=0;
 for(const id of RACE_WHEEL_IDS){
  const patch=state.contactPatches?.[id]||{};
  const load=Math.max(0,Number(patch.normalLoadN||0));
  const supported=state.validTreadContactByWheel?.[id]!==false&&load>1;
  const longitudinal=Number(patch.slipRatio||0),lateral=Math.abs(Math.tan(Number(patch.slipAngleRad||0)));
  drive.dynamicNormalLoads[id]=load;
  drive.wheelContactScaleByWheel[id]=supported?1:0;
  drive.tireSlipByWheel[id]=supported?Math.max(Math.abs(longitudinal),lateral):0;
  drive.contactWheelSpinRatioByWheel[id]=supported?Math.max(0,longitudinal):0;
  const brakeTorque=Math.max(0,Number(state.powertrainState?.telemetry?.appliedBrakeTorqueNm?.[id]||0));
  drive.combinedBrakeState.appliedByWheel[id]=brakeTorque/Math.max(.1,wheelRadiusFor(runner.config,id));
  drive.combinedBrakeState.lockByWheel[id]=supported&&brakeTorque>0?Math.max(0,-longitudinal):0;
  ai.tireTemperature[id]=Number(state.tireState?.[id]?.temperatureF??70);
  const driveTorque=Math.abs(Number(state.powertrainState?.telemetry?.wheelDriveTorqueNm?.[id]||0));
  demand=Math.max(demand,driveTorque/Math.max(1,Number(patch.combinedSlipLimitN||load)*wheelRadiusFor(runner.config,id)));
 }
 drive.driveDemandRatio=demand;
}
