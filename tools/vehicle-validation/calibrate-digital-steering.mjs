// Repeatable button-input calibration against production vehicle physics.
// No tuning, grip, or force parameters are changed. Report failures separately
// from the chosen input rates; slower steering must not hide a physics failure.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {HandlingAssist} from '../../src/racing/simulation/HandlingAssist.js';
import {RACE_CONTROLLER_STEERING} from '../../src/racing/simulation/RaceSimulationConfig.js';
import {VehicleDynamicsRunner} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {installVehicleValidationInitialState} from './VehicleValidationHarness.mjs';

const wheels=['fl','fr','rl','rr'];
export function loadCalibrationVehicle() {
 const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
 for(const name of ['Stock','Street','Tarmac','Drift','Rally','Offroad','Rain','Snow']) {
  const data=read(`data/server-storage/files/tires/${name}/document.json`);
  upsertCachedProjectFile('tires',name,JSON.stringify({folder:'tires',name,savedAt:1,version:1,data}));
 }
 const saved=read('data/server-storage/files/cars/RTG-001/document.json');
 const editor=new RaceEditor({});
 const car=editor.normalizeLoadedCarDocument(structuredClone(saved.car||saved));
 editor.project.cars=[car];editor.project.selectedCarId=car.id;
 editor.preloadSelectedRaceArtRefs=()=>{};
 editor.startPlaytest(car.id,{hydrateCars:false});
 const session=editor.playtestSession;
 session.countdownRemainingMs=0;session.startupFramePending=false;session.launchLockMs=0;
 editor.updatePlaytestSafely(0);
 const config=structuredClone(session.vehicleDynamicsRunner.config);
 const tuning=editor.getRaceCarTuning(car,{transmissionType:session.transmissionType});
 editor.disposeRacePlaytestSession(session,'digital-calibration');
 return {config,tuning};
}
export function measureDigitalManeuver({config,tuning,speed=25,grip=1,maneuver='tap',profile,legacy=false,sign=1,absEnabled=true,tractionControlEnabled=true,stabilityControlEnabled=true}) {
 const runner=new VehicleDynamicsRunner({config:{...config,handlingPreset:'sport',chassisHz:120,tireHz:120},initialState:{heightM:config.cgHeightM},
  environmentProvider:()=>({groundHeightM:0,sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0}}),surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},gripByWheel:Object.fromEntries(wheels.map(id=>[id,grip]))})});
 installVehicleValidationInitialState({runner,tuning,speedMps:speed});
 const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
 let output=0,maxSlipDeg=0,maxRackDeg=0,maxYaw=0,tapOutput=0,centerTime=null,absInterventions=0,tcInterventions=0;
 for(let i=0;i<240;i++){
  const t=i/120;
  const intent=sign*(maneuver==='tap'?(t<.1?1:0):maneuver==='reverse'?(t<.35?1:t<.7?-1:0):(t<1?1:0));
  output=legacy?assist.stepControllerToRackInput({mode:'gamepad',intent,currentOutput:output,seconds:1/120})
   :assist.stepDigitalSteering({intent,currentOutput:output,speedMps:runner.state.groundSpeedMps,seconds:1/120,calibration:profile});
  if(i===11)tapOutput=output;
  if(maneuver==='reverse'&&t>=.35&&centerTime===null&&output*sign<=0)centerTime=t-.35;
  runner.addInputSample(t,{steering:output,steeringInputMode:legacy?'gamepad':'digital',throttle:maneuver==='power-turn'?.85:.15,
   brake:maneuver==='brake-turn'&&t<1?.7:0,assists:{stabilityControlEnabled,tractionControlEnabled,absEnabled}});
  runner.advance(1/120);
  const s=runner.state;
  const telemetry=s.powertrainState?.telemetry||{};
  if(Object.values(telemetry.absInterventionByWheel||{}).some(value=>value>.001))absInterventions++;
  if(Number(telemetry.tractionTorqueScale??1)<.999)tcInterventions++;
  maxSlipDeg=Math.max(maxSlipDeg,Math.abs(Math.atan2(s.bodyLateralSpeedMps,Math.max(.5,s.bodyLongitudinalSpeedMps)))*180/Math.PI);
  maxRackDeg=Math.max(maxRackDeg,Math.abs(s.steeringTelemetry.resolvedCenterRackAngleRad)*180/Math.PI);
  maxYaw=Math.max(maxYaw,Math.abs(s.yawRateRadps));
 }
 return {speed,grip,maneuver,sign,absEnabled,tractionControlEnabled,stabilityControlEnabled,absInterventions,tcInterventions,maxSlipDeg,maxRackDeg,maxYaw,tapOutput,centerTime,finalYaw:runner.state.yawRateRadps,finalSpeed:runner.state.groundSpeedMps};
}
// Begin with a known mild slide, detect arrest of the initial yaw, then delay
// releasing countersteer. A fixed-time reversal alone cannot test late release.
export function measureRecoveryOverhold({config,tuning,speed=25,grip=.65,profile,
 delay=.2,sign=1,recoveryGuard=true,absEnabled=true,tractionControlEnabled=true,stabilityControlEnabled=true}) {
 const runner=new VehicleDynamicsRunner({config:{...config,handlingPreset:'sport',chassisHz:120,tireHz:120},initialState:{heightM:config.cgHeightM},
  environmentProvider:()=>({groundHeightM:0,sampleTerrainAtWorldPoint:()=>({heightM:0,normal:{x:0,y:1,z:0}}),surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0},gripByWheel:Object.fromEntries(wheels.map(id=>[id,grip]))})});
 installVehicleValidationInitialState({runner,tuning,speedMps:speed});
 runner.replaceAuthoritativeState({...runner.createStateSnapshot(),
  velocity:{x:-sign*speed*Math.tan(5*Math.PI/180),y:0,z:speed},
  bodyLateralSpeedMps:-sign*speed*Math.tan(5*Math.PI/180),
  yawRateRadps:sign*.4,angularVelocityWorld:{x:0,y:sign*.4,z:0}});
 const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
 let output=0,correctedAt=null,oppositeSlipDeg=0,oppositeYaw=0,maxSlipDeg=0;
 let releasedAt=null,slipAtCorrectionDeg=null;
 for(let i=0;i<480;i++){
  const t=i/120,s=runner.state;
  const beta=Math.atan2(s.bodyLateralSpeedMps,Math.max(.5,s.bodyLongitudinalSpeedMps))*180/Math.PI;
  if(correctedAt===null&&sign*s.yawRateRadps<=.05){correctedAt=t;slipAtCorrectionDeg=beta;}
  const release=correctedAt!==null&&t>=correctedAt+delay;
  if(release&&releasedAt===null)releasedAt=t;
  const intent=release?0:-sign;
  output=assist.stepDigitalSteering({intent,currentOutput:output,speedMps:s.groundSpeedMps,seconds:1/120,calibration:profile});
  runner.addInputSample(t,{steering:output,steeringInputMode:recoveryGuard?'digital':'normalized',throttle:.25,
   assists:{absEnabled,tractionControlEnabled,stabilityControlEnabled}});
  runner.advance(1/120);
  const nextBeta=Math.atan2(runner.state.bodyLateralSpeedMps,Math.max(.5,runner.state.bodyLongitudinalSpeedMps))*180/Math.PI;
  maxSlipDeg=Math.max(maxSlipDeg,Math.abs(nextBeta));
  if(correctedAt!==null){
   oppositeSlipDeg=Math.max(oppositeSlipDeg,sign*nextBeta);
   oppositeYaw=Math.max(oppositeYaw,-sign*runner.state.yawRateRadps);
  }
  if(releasedAt!==null&&t>=releasedAt+1)break;
 }
 return {speed,grip,delay,sign,recoveryGuard,absEnabled,tractionControlEnabled,stabilityControlEnabled,
  correctedAt,releasedAt,slipAtCorrectionDeg,oppositeSlipDeg,oppositeYaw,maxSlipDeg};
}

export function runCalibration(){
 const vehicle=loadCalibrationVehicle();
 const profiles=[null,...[1.6,2.2,2.8,3.4].map(rate=>({pressRateLowSpeed:rate,pressRateHighSpeed:rate/2,unwindRate:7,releaseRate:3.5}))];
 const results=[];
 for(const profile of profiles){
  const cases=[];
  for(const speed of [10,25,45,71.5264])for(const grip of [1,.65,.35])for(const maneuver of ['tap','reverse','hold','brake-turn']){
   cases.push(measureDigitalManeuver({...vehicle,speed,grip,maneuver,profile,legacy:!profile}));
  }
  // Gates constrain taps and recovery latency, while requiring useful low-speed
  // turn-in. Held full lock at highway speed is reported, never optimized away.
  const eligible=!!profile&&cases.filter(c=>c.maneuver==='tap').every(c=>c.maxSlipDeg<8&&c.tapOutput<=.3)
   &&cases.filter(c=>c.maneuver==='reverse').every(c=>c.centerTime!==null&&c.centerTime<=.15)
   &&cases.find(c=>c.speed===10&&c.grip===1&&c.maneuver==='hold').maxYaw>.25;
  results.push({profile:profile||'previous-analog-touch',eligible,cases});
  console.log(JSON.stringify({profile:profile||'previous-analog-touch',eligible,maxTapSlip:Math.max(...cases.filter(c=>c.maneuver==='tap').map(c=>c.maxSlipDeg))}));
 }
 const selected=results.filter(r=>r.eligible).at(-1)?.profile||null;
 const report={vehicle:'saved RTG-001, current installed stock definition',description:'120 Hz flat-ground maneuvers; effective grip sweep, not authored race terrain. Fastest candidate passing explicit tap/reversal/turn-in gates.',selected,results};
 mkdirSync('artifacts/vehicle-validation',{recursive:true});
 writeFileSync('artifacts/vehicle-validation/digital-steering-calibration.json',JSON.stringify(report,null,2)+'\n');
 console.log('Selected:',selected);
 return report;
}
export function selectRecoveryCalibration(results,noEscCandidates=[]){
 const baseline=results.find(result=>result.margin===null);
 const candidates=results.filter(result=>result.margin!==null).map(result=>({
  margin:result.margin,
  // Explicit acceptance budget for a 100–300 ms late release in this fixture.
  // Choose the least restrictive margin that meets it without delaying the catch.
  eligible:result.cases.every((c,i)=>c.correctedAt!==null
   &&c.oppositeSlipDeg<=8&&c.correctedAt<=baseline.cases[i].correctedAt+.05)
   &&(!noEscCandidates.length||!!noEscCandidates.find(c=>c.margin===result.margin)?.cases.every(c=>c.correctedAt!==null&&c.oppositeSlipDeg<=8)),
  maximumOppositeSlipDeg:Math.max(...result.cases.map(c=>c.oppositeSlipDeg))
 }));
 return {maximumOppositeSlipBudgetDeg:8,maximumCatchDelaySeconds:.05,candidates,
  selectedMarginDeg:candidates.filter(c=>c.eligible).at(-1)?.margin??null};
}
export function runAssistCalibration(){
 const vehicle=loadCalibrationVehicle();
 const combinations=[true,false].flatMap(absEnabled=>[true,false].map(tractionControlEnabled=>({absEnabled,tractionControlEnabled})));
 const results=[];
 for(const margin of [null,.5,1,2]){
  const cases=[];
  for(const aids of combinations){
   for(const speed of [15,25,45])for(const grip of [1,.65,.35])for(const delay of [0,.1,.2,.3]){
    cases.push(measureRecoveryOverhold({...vehicle,config:{...vehicle.config,digitalRecoverySlipAngleRad:(margin||1)*Math.PI/180},
     ...aids,speed,grip,delay,recoveryGuard:margin!==null}));
   }
   console.log(JSON.stringify({margin,aids,cases:cases.length,maxOppositeSlip:Math.max(...cases.map(c=>c.oppositeSlipDeg)),unrecovered:cases.filter(c=>c.correctedAt===null).length}));
  }
  results.push({margin,cases});
 }
 // ESC is independent of ABS and TC. Verify recovery without its yaw braking too.
 const noEscCandidates=[];
 for(const candidate of selectRecoveryCalibration(results).candidates.filter(c=>c.eligible)){
  const cases=[];
  for(const speed of [15,25,45])for(const grip of [1,.65,.35])for(const delay of [.1,.2,.3])for(const sign of [-1,1]){
   cases.push(measureRecoveryOverhold({...vehicle,config:{...vehicle.config,digitalRecoverySlipAngleRad:candidate.margin*Math.PI/180},speed,grip,delay,sign,absEnabled:false,tractionControlEnabled:false,stabilityControlEnabled:false}));
  }
  noEscCandidates.push({margin:candidate.margin,cases});
 }
 const selection=selectRecoveryCalibration(results,noEscCandidates);
 if(selection.selectedMarginDeg===null)throw new Error('No recovery calibration passed the assist matrix');
 const maneuvers=[];
 for(const aids of combinations){
  for(const speed of [10,25,45,71.5264])for(const grip of [1,.65,.35])for(const maneuver of ['tap','reverse','hold','brake-turn','power-turn']){
   maneuvers.push(measureDigitalManeuver({...vehicle,config:{...vehicle.config,digitalRecoverySlipAngleRad:selection.selectedMarginDeg*Math.PI/180},...aids,speed,grip,maneuver}));
  }
  console.log(JSON.stringify({completed:'button/braking/power',aids}));
 }
 const noEsc=noEscCandidates.find(c=>c.margin===selection.selectedMarginDeg)?.cases||[];
 const report={selection,maneuverMarginDeg:selection.selectedMarginDeg,description:'Saved RTG-001; flat ground and effective grip levels. Correction means original yaw falls to <=0.05 rad/s; lateral slip can remain. All ABS/TC combinations; ESC separately disabled. Margins do not change tire forces.',results,maneuvers,noEsc,noEscCandidates};
 mkdirSync('artifacts/vehicle-validation',{recursive:true});
 writeFileSync('artifacts/vehicle-validation/digital-steering-assists.json',JSON.stringify(report,null,2)+'\n');
 console.log('Recovery calibration:',report.selection);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.includes('--assists'))runAssistCalibration();else runCalibration();
}
