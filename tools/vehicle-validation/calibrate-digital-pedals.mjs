// Headless simulated-button test; production tires, contacts, gears and steering.
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {tireSizeForWheel} from '../../src/racing/TireSizes.js';
import {RACE_SURFACES} from '../../src/racing/raceData.js';
import {createTrackStateCell,getTrackStateCellSample} from '../../src/racing/trackState/TrackStateCell.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {installVehicleValidationInitialState} from './VehicleValidationHarness.mjs';
import {HandlingAssist} from '../../src/racing/simulation/HandlingAssist.js';
import {RACE_CONTROLLER_STEERING} from '../../src/racing/simulation/RaceSimulationConfig.js';
import {digitalPedalFeedback} from '../../src/racing/DigitalPedalFeedback.js';
import {advanceDigitalThrottle} from '../../src/racing/DigitalThrottle.js';
import {advanceDigitalBrake} from '../../src/racing/DigitalBrake.js';
const ids=['fl','fr','rl','rr'],each=v=>Object.fromEntries(ids.map(id=>[id,v]));
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url)));
export const CARS=['RTG-001','CT-86','BUSE-019','PZ-24'];
export const QUARTER_MILE_M=402.336;
export function loadPedalVehicle(name,drivetrain){
 if(drivetrain&&!['awd','fwd','rwd'].includes(drivetrain))throw Error('Unknown drivetrain '+drivetrain);
 for(const name of ['Stock','Street','Tarmac','Drift','Rally','Offroad','Rain','Snow']){
  const data=read(`data/server-storage/files/tires/${name}/document.json`);
  upsertCachedProjectFile('tires',name,JSON.stringify({folder:'tires',name,savedAt:1,version:1,data}));
 }
 const editor=new RaceEditor({}),saved=read(`data/server-storage/files/cars/${name}/document.json`);
 const car=editor.normalizeLoadedCarDocument(structuredClone(saved.car||saved));
 const tuning=editor.getRaceCarTuning(car,{transmissionType:'automatic'});
 if(drivetrain)tuning.drivetrain=drivetrain;
 const config={...createVehicleDynamicsConfigFromTuning(tuning,{chassisHz:120,tireHz:120,telemetryRetention:'none',inputTimelineLimit:4})};
 config.tireByWheel=Object.fromEntries(ids.map(id=>[id,{compound:editor.getRaceTireCompound(car.setup.tireCompoundByWheel[id],car),pressurePsi:car.setup.tirePressurePsi[id],coldPressurePsi:car.setup.tirePressurePsi[id],targetPressurePsi:car.setup.tirePressurePsi[id],...tireSizeForWheel(car.setup,id),wear:0,damage:0,loadSensitivityExponent:.08}]));
 return {name,tuning,config};
}
export function pedalMaterial(surface){
 const definition=RACE_SURFACES.find(s=>s.id===surface);if(!definition)throw Error('Unknown surface '+surface);
 const cell=createTrackStateCell({base:{baseSurfaceId:surface,friction:definition.grip}});
 // One inch of fresh snow; all other authored material defaults retained.
 if(surface==='snow')cell.snowDepthMm=25.4;
 const sample=getTrackStateCellSample(cell);
 return {...cell,surfaceId:sample.effectiveSurfaceId,surfaceGripScale:cell.baseGrip*sample.effectiveGripMultiplier,trackStateConditionApplied:true};
}
// Encode actual button edges: a deliberate double tap for aggressive holds,
// and >=350ms released between traction holds so feathering cannot switch modes.
export function pedalGesture(previous={}, {demand,style='traction',dt}) {
 if(!['traction','aggressive'].includes(style))throw Error('Unknown throttle style '+style);
 const released=demand?0:(previous.released??1)+dt;
 if(!demand)return {raw:0,released,active:false,age:0};
 if(style==='traction'&&!previous.active&&(previous.released??1)<.35)
  return {raw:0,released:(previous.released??0)+dt,active:false,age:0};
 const age=previous.active?(previous.age+dt):0;
 return {raw:style==='aggressive'&&age>=.05&&age<.10?0:1,released,active:true,age};
}
export function runPedalCase({vehicle,throttleStyle='traction',surface='asphalt',aids=false,grade=0,kind='straight',throttleFn=advanceDigitalThrottle,brakeFn=advanceDigitalBrake,feedbackFn=digitalPedalFeedback,maxSeconds=90,controlHz=60}={}){
 if(!['straight','braking','slalom'].includes(kind))throw Error('Unknown test stage '+kind);
 if(!Number.isInteger(controlHz)||controlHz<10||controlHz%10)throw Error('Control rate must be a positive multiple of 10 Hz');
 const {config,tuning}=vehicle,dt=1/controlHz,material=pedalMaterial(surface),normal={x:0,y:1/Math.hypot(1,grade),z:-grade/Math.hypot(1,grade)};
 const runner=new VehicleDynamicsRunner({config,initialState:{heightM:config.cgHeightM,pitchRad:-Math.atan(grade)},environmentProvider:({state})=>({
  groundHeightM:grade*state.position.z,sampleTerrainAtWorldPoint:p=>({heightM:grade*p.z,normal}),surfaceNormalByWheel:each(normal),
  surfaceHeightByWheel:Object.fromEntries(ids.map(id=>[id,grade*(state.position.z+Math.cos(state.yawRad||0)*(id[0]==='f'?config.frontAxleDistanceFromCgM:-config.rearAxleDistanceFromCgM)+Math.sin(state.yawRad||0)*(id[1]==='l'?1:-1)*config.trackWidthM/2)])),
  materialByWheel:each(material),ambientTemperatureC:surface==='snow'?-5:20})});
 installVehicleValidationInitialState({runner,tuning,speedMps:kind==='straight'?0:kind==='braking'?26.8224:10});
 runner.replaceAuthoritativeState({...runner.createStateSnapshot(),velocity:{...runner.state.velocity,y:grade*runner.state.velocity.z}});
 const editor=new RaceEditor({});editor.playtestSession={vehicleDynamicsRunner:runner};
 Object.assign(editor.raceInput,{digitalThrottleMode:'on',brakeAssistEnabled:true,absEnabled:aids,tractionControlEnabled:aids});
 const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
 let steering=0,rawThrottle=0,rawBrake=0,intent=0,brakeAt=null,brakeStartSpeed=null,quarterSeconds=null,brakeDistance=0;
 if(kind==='braking'){brakeAt=0;brakeStartSpeed=runner.state.groundSpeedMps;}
 let distance=0,spinSeconds=0,lockSeconds=0,maxBeta=0,errorSquared=0,maxError=0,count=0,stopped=false,completed=false;
 let gesture={};
 const samples=[];let time=0,previousPosition={...runner.state.position};
 // Six alternating gates, three full left/right slalom cycles, 30m spacing.
 const path=z=>z<20||z>200?0:3*Math.sin((z-20)*Math.PI/30);
 for(let step=0;step<maxSeconds*controlHz;step++){
  time=step*dt;const s=runner.state,speed=s.groundSpeedMps;
  if(kind==='straight'&&brakeAt===null&&s.position.z>=QUARTER_MILE_M){brakeAt=time;quarterSeconds=time;brakeStartSpeed=speed;}
  // A repeatable 10Hz virtual driver sends only button states (no analog pedal).
  if(step%Math.round(controlHz/10)===0){
   if(kind==='straight'||kind==='braking'){rawThrottle=brakeAt===null?1:0;rawBrake=1-rawThrottle;
    const desired=Math.atan2(-s.position.x,Math.max(20,speed*1.2));
    const headingError=Math.atan2(Math.sin(desired-s.yawRad),Math.cos(desired-s.yawRad));
    intent=Math.abs(headingError)<.008?0:Math.sign(headingError);}
   else {
    const target=path(s.position.z+Math.max(8,speed*.8));
    const desired=Math.atan2(target-s.position.x,Math.max(8,speed*.8));
    const error=Math.atan2(Math.sin(desired-s.yawRad),Math.cos(desired-s.yawRad));
    intent=Math.abs(error)<.025?0:Math.sign(error);
    rawBrake=speed>11?1:0;rawThrottle=speed<9.5?1:0;
   }
  }
  gesture=pedalGesture(gesture,{demand:rawThrottle&&!rawBrake,style:throttleStyle,dt});
  const buttonThrottle=gesture.raw;
  Object.assign(editor.raceInput,{rawThrottleAxis:buttonThrottle,rawBrakeAxis:rawBrake});
  // Default run exercises the real RaceEditor pedal wiring. Candidate modules
  // replace only the two pedal transforms, with identical feedback and driver.
  if(throttleFn===advanceDigitalThrottle&&brakeFn===advanceDigitalBrake&&feedbackFn===digitalPedalFeedback)editor.updateRacePedalAxes(dt,{tuning});
  else {
   const f=feedbackFn(s,tuning),session=editor.playtestSession;
   session.digitalThrottle=throttleFn(session.digitalThrottle,{mode:'on',raw:buttonThrottle,brake:rawBrake,dt,...f,tractionControlEnabled:aids,engineRpm:s.engineRpm,lateralSpeedMps:s.bodyLateralSpeedMps,maxRpm:config.maxRpm,gear:s.gear,shifting:Number(s.powertrainState?.shiftTimeRemainingSeconds)>0,speedMps:s.bodyLongitudinalSpeedMps,revLimiterActive:s.powertrainState?.revLimiterActive===true});
   session.digitalBrake=brakeFn(session.digitalBrake,{enabled:true,raw:rawBrake,dt,...f,feedbackValid:f.brakeFeedbackValid,absEnabled:aids});
   editor.raceInput.throttleAxis=session.digitalThrottle.output;editor.raceInput.brakeAxis=session.digitalBrake.output;
  }
  steering=assist.stepDigitalSteering({intent,currentOutput:steering,speedMps:speed,seconds:dt});
  runner.addInputSample(runner.simulationTimeSeconds,{requestedGear:s.gear,throttle:editor.raceInput.throttleAxis,brake:editor.raceInput.brakeAxis,steering,steeringInputMode:'digital',assists:{autoShift:true,absEnabled:aids,tractionControlEnabled:aids,stabilityControlEnabled:false}},{returnSnapshot:false});
  runner.advance(dt);const next=runner.state;
  const travel=Math.hypot(next.position.x-previousPosition.x,next.position.y-previousPosition.y,next.position.z-previousPosition.z);distance+=travel;if(brakeAt!==null)brakeDistance+=travel;previousPosition={...next.position};
  if(!Number.isFinite(distance)||!Number.isFinite(next.engineRpm))throw Error('Nonfinite dynamics');
  const feedback=digitalPedalFeedback(next,tuning);
  if(feedback.spin>.5)spinSeconds+=dt;if(feedback.brakeLock>.5&&rawBrake)lockSeconds+=dt;
  if(next.groundSpeedMps>3)maxBeta=Math.max(maxBeta,Math.abs(Math.atan2(next.bodyLateralSpeedMps,Math.max(.1,Math.abs(next.bodyLongitudinalSpeedMps))))*180/Math.PI);
  const err=kind!=='slalom'?Math.abs(next.position.x):Math.abs(next.position.x-path(next.position.z));errorSquared+=err*err;maxError=Math.max(maxError,err);count++;
  if(step%controlHz===0)samples.push({time,engineRpm:next.engineRpm,rpmTarget:editor.playtestSession.digitalThrottle?.rpmTarget,rpmRecovery:editor.playtestSession.digitalThrottle?.rpmRecovery,z:next.position.z,x:next.position.x,speed:next.groundSpeedMps,throttle:editor.raceInput.throttleAxis,brake:editor.raceInput.brakeAxis,spin:feedback.spin,lock:feedback.brakeLock,peakSlip:next.contactPatches?.fl?.peakLongitudinalSlipRatio,mu:next.contactPatches?.fl?.gripCoefficient});
  if(kind!=='slalom'&&brakeAt!==null&&next.groundSpeedMps<.5){stopped=true;completed=true;break;}
  if(kind==='slalom'&&next.position.z>=220){completed=true;break;}
  if(Math.abs(next.rollRad)>1||maxError>25)break;
 }
 return {car:vehicle.name,throttleStyle,drivetrain:tuning.drivetrain,surface,aids,grade,kind,completed,stopped,quarterSeconds,brakeStartSpeed,brakeDistanceM:brakeAt===null?null:brakeDistance,stopSeconds:brakeAt===null?null:time-brakeAt,seconds:time,distanceM:distance,spinSeconds,lockSeconds,maxBetaDeg:maxBeta,rmsErrorM:Math.sqrt(errorSquared/count),maxErrorM:maxError,samples};
}
export async function main(){
 if(process.argv.includes('--help')){console.log('Digital pedal matrix: --cars=RTG-001,CT-86,BUSE-019,PZ-24 --surfaces=asphalt,gravel,... --drivetrains=saved|awd,fwd,rwd --aids=on|off (omit for both) --styles=traction,aggressive --kind=straight|braking|slalom --grade=0.07 --output=artifacts/report.json --resume=artifacts/report.json. Omit kind for quarter-mile, fixed-speed stop, then level/up/down slaloms. Optional --throttle=file.mjs --brake=file.mjs --feedback=file.mjs compare candidate pedal transforms.');return;}

 const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
 const cars=(arg('cars')||CARS.join(',')).split(','),surfaces=(arg('surfaces')||RACE_SURFACES.map(s=>s.id).join(',')).split(',');
 const options={};if(arg('feedback'))options.feedbackFn=(await import(pathToFileURL(arg('feedback')).href)).digitalPedalFeedback;if(arg('throttle'))options.throttleFn=(await import(pathToFileURL(arg('throttle')).href)).advanceDigitalThrottle;if(arg('brake'))options.brakeFn=(await import(pathToFileURL(arg('brake')).href)).advanceDigitalBrake;
 const prior=arg('resume')?JSON.parse(readFileSync(arg('resume'))):null;
 const rows=prior?(prior.version===3?prior.rows:(()=>{throw Error('Cannot resume older car/mode calibration');})()):[],output=arg('output')||'artifacts/digital-pedals/report.json';mkdirSync(dirname(output),{recursive:true});
 for(const car of cars)for(const drivetrain of (arg('drivetrains')||'saved').split(',')){const vehicle=loadPedalVehicle(car,drivetrain==='saved'?undefined:drivetrain);for(const surface of surfaces)for(const aids of (arg('aids')==='off'?[false]:arg('aids')==='on'?[true]:[false,true]))for(const throttleStyle of (arg('styles')||'traction,aggressive').split(','))for(const [kind,grade] of arg('kind')?[[arg('kind'),Number(arg('grade')||0)]]:arg('straight')==='yes'?[['straight',0]]:[['straight',0],['braking',0],['slalom',0],['slalom',.07],['slalom',-.07]]){
  if(rows.some(r=>r.car===car&&r.drivetrain===vehicle.tuning.drivetrain&&r.surface===surface&&r.aids===aids&&r.kind===kind&&r.grade===grade&&r.throttleStyle===throttleStyle))continue;
  const row=runPedalCase({vehicle,surface,aids,kind,grade,throttleStyle,...options});rows.push(row);console.log(JSON.stringify({...row,samples:undefined}));writeFileSync(output+'.tmp',JSON.stringify({version:3,quarterMileM:QUARTER_MILE_M,rows},null,2));renameSync(output+'.tmp',output);
 }}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
