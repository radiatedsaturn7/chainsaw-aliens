import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {applyTireDefinition} from '../../src/racing/raceTires.js';
import {createTrackStateCell,getTrackStateCellSample} from '../../src/racing/trackState/TrackStateCell.js';
import {getSurfaceById} from '../../src/racing/raceData.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const ids=['fl','fr','rl','rr'],each=v=>Object.fromEntries(ids.map(id=>[id,structuredClone(v)]));
export function runClimb({carName='RTG-S',tireName='Stock',surface='snow',snowMm=25.4,slope=.12,tc=true,throttle=.35,seconds=8,temperatureC=-5,initialSpeedMps=0,initialGear=1,drivetrain,surfaceGrip,materialOverride,tireOverride,controlAt,sampleEverySeconds=0}={}){
 const editor=new RaceEditor({});const car=editor.normalizeLoadedCarDocument(JSON.parse(fs.readFileSync(`data/server-storage/files/cars/${carName}/document.json`)));
 const size={...car.setup.tireSize};const tire=JSON.parse(fs.readFileSync(`data/server-storage/files/tires/${tireName}/document.json`));applyTireDefinition(car,tire,tireName);car.setup.tireSize=size;
 const tuning=editor.getRaceCarTuning(car,{transmissionType:'automatic'});if(drivetrain)tuning.drivetrain=drivetrain;
 const config={...createVehicleDynamicsConfigFromTuning(tuning)};
 config.tireByWheel=each({compound:tire.compound,...size,pressurePsi:32,coldPressurePsi:32,targetPressurePsi:32,...tireOverride});
 const cell=createTrackStateCell({base:{baseSurfaceId:surface,friction:surfaceGrip ?? getSurfaceById(surface).grip}});cell.snowDepthMm=snowMm;
 const sample=getTrackStateCellSample(cell);
 const material={...cell,baseSurfaceId:surface,surfaceId:sample.effectiveSurfaceId,surfaceGripScale:cell.baseGrip*sample.effectiveGripMultiplier,trackStateConditionApplied:true,surfaceTemperatureC:temperatureC,...materialOverride};
 const n=1/Math.hypot(1,slope),normal={x:0,y:n,z:-slope*n};
 const runner=new VehicleDynamicsRunner({config:{...config,telemetryRetention:'none'},initialState:{heightM:config.cgHeightM,pitchRad:-Math.atan(slope),gear:initialGear,velocity:{x:0,y:initialSpeedMps*slope,z:initialSpeedMps},wheelAngularVelocityRadps:each(initialSpeedMps/config.wheelRadiusM),tireState:each({treadTemperatureC:temperatureC,carcassTemperatureC:temperatureC,internalAirTemperatureC:temperatureC,coldPressurePsi:32,pressureReferenceTemperatureC:temperatureC})},inputTimeline:[{timeSeconds:0,input:{throttle,requestedGear:initialGear,assists:{autoShift:true,tractionControlEnabled:tc,absEnabled:tc}}}],environmentProvider:({state})=>({
 surfaceHeightByWheel:Object.fromEntries(ids.map(id=>[id,slope*(state.position.z+(id[0]==='f'?config.frontAxleDistanceFromCgM:-config.rearAxleDistanceFromCgM))])),surfaceNormalByWheel:each(normal),sampleTerrainAtWorldPoint:p=>({heightM:slope*p.z,normal,friction:material.surfaceGripScale}),materialByWheel:each(material),ambientTemperatureC:temperatureC})});
 let maxSlip=0,mu=0;const samples=[];
 for(let i=0;i<seconds*120;i++){
  if(controlAt)runner.addInputSample(i/120,{requestedGear:initialGear,assists:{autoShift:true,tractionControlEnabled:tc,absEnabled:tc},...controlAt(i/120,runner.state)});
  runner.advance(1/120);
  if(sampleEverySeconds>0&&(i+1)%Math.round(sampleEverySeconds*120)===0){
   const s=runner.state;
   samples.push({time:(i+1)/120,mph:s.velocity.z*2.236936,gear:s.gear,yawRad:s.yawRad,lateralM:s.position.x,lateralVelocityMps:s.velocity.x,yawRateRadps:s.yawRateRadps,rollRad:s.rollRad,bodyLateralSpeedMps:s.bodyLateralSpeedMps,bodyLongitudinalSpeedMps:s.bodyLongitudinalSpeedMps,rpm:s.powertrainState?.engineRpm,tractionTorqueScale:s.powertrainState?.tractionTorqueScale,
    wheels:Object.fromEntries(ids.map(id=>{const p=s.contactPatches[id];return [id,{slip:p.rawSlipRatio,mu:p.gripCoefficient,peakSlip:p.peakLongitudinalSlipRatio,forceN:p.longitudinalForceN,lateralForceN:p.lateralForceN,limitN:p.combinedSlipLimitN,steeringAngleRad:p.steeringAngleRad,loadN:p.normalLoadN,omega:s.wheelAngularVelocityRadps[id]}];}))});
  }
if(i>120)for(const p of Object.values(runner.state.contactPatches)){maxSlip=Math.max(maxSlip,Math.abs(p.rawSlipRatio||0));mu=p.gripCoefficient;}}
 const s=runner.state;
 return {carName,tireName,surface,snowMm,grade:slope*100,tc,throttle,temperatureC,drivetrain:tuning.drivetrain,mph:s.velocity.z*2.236936,travelM:s.position.z,lateralM:s.position.x,maxSlip,mu,gear:s.gear,tcScale:s.powertrainState?.tractionTorqueScale,...(sampleEverySeconds>0?{samples}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const rows=[];
 for(const surface of ['gravel','dirt','snow'])for(const tc of [true,false])for(const snowMm of surface==='snow'?[25.4,76.2]:[0]){
 const row=runClimb({surface,tc,snowMm});rows.push(row);console.log(JSON.stringify(row));
 }
 for(const tireName of ['Tarmac','Snow']){const row=runClimb({tireName,snowMm:76.2});rows.push(row);console.log(JSON.stringify(row));}
 fs.mkdirSync('artifacts/traction-audit',{recursive:true});fs.writeFileSync('artifacts/traction-audit/climbs.json',JSON.stringify(rows,null,2));
}
