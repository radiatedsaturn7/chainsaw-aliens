// Phase-2 pilot: share existing graphics only; author each powertrain/geometry separately.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../src/ui/RaceEditor.js';
const root='data/server-storage/files',read=p=>JSON.parse(fs.readFileSync(p));
const decode=d=>d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;
const manifest=read(root+'/manifest.json');
const starter=decode(read(root+'/'+manifest.folders.cars['RTG-001'])).car;
const records=read('data/vehicle-catalog/phases/wave-03-research.json').vehicles;
const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
const plans=[];
for(const r of records){
 const s=r.simulationEstimates,f={...s,...r.facts},ev=f.transmission==='electric',inch=.0254,mass=f.curbLb*.45359237;
 const kind=ev?'automatic':'manual';
 const cvt={minRatio:s.cvtMinRatio,maxRatio:s.cvtMaxRatio,cruiseRpm:s.cruiseRpm,powerRpm:f.powerRpm,ratioRatePerSecond:s.ratioRatePerSecond};
 const radius=(s.tireSize[0]*s.tireSize[1]/100/1000)+s.tireSize[2]*inch/2;
 const dimensions={lengthM:f.lengthIn*inch,widthM:f.widthIn*inch,wheelbaseM:f.wheelbaseIn*inch,trackFrontM:f.trackFrontIn*inch,trackRearM:f.trackRearIn*inch};
 const tuning={drivetrain:f.drivetrain,powerHp:f.powerHp,torqueLbFt:f.torqueLbFt,weightKg:mass,engineDisplacementL:f.engineDisplacementL,aspiration:'Naturally Aspirated',frontWeightDistribution:s.frontWeightDistribution,cgHeightM:s.cgHeightM,wheelbaseM:dimensions.wheelbaseM,wheelRadiusM:radius,dragCoefficient:s.dragCoefficient,tireGrip:s.tireGrip,redlineRpm:s.redlineRpm,revLimitRpm:s.revLimitRpm,idleRpm:750,torquePeakStartRpm:f.torqueRpm,torquePeakEndRpm:f.torqueRpm,torqueFalloffRpm:f.powerRpm,gearRatios:ev?[1]:s.gearRatios,gearFinalDrive:f.finalDrive,reverseRatio:ev?1:s.reverseRatio,drivetrainEfficiency:.84,accelerationCalibration:1,brakeBalance:.65,brakePressure:1,frontDifferentialAccel:0,frontDifferentialDecel:0,rearDifferentialAccel:0,rearDifferentialDecel:0,centerDifferentialBalance:.5,differentialAccel:0,differentialDecel:0,aeroFront:0,aeroRear:0,steeringRatio:f.steeringRatio||15,springFront:s.spring,springRear:s.spring-.02,dampingFront:.44,dampingRear:.42,antiRollFront:.25,antiRollRear:s.antiRollRear,suspensionTravelFront:s.suspensionTravelM,suspensionTravelRear:s.suspensionTravelM,rideHeightFront:.45,rideHeightRear:.45,absEnabled:true,tractionControlEnabled:true,topSpeedMph:s.topSpeedMph,zeroToSixtySec:s.zeroToSixtySec,engineCurve:{rpmMin:750,rpmMax:s.revLimitRpm,torquePoints:[{rpm:750,torqueLbFt:f.torqueLbFt*.4},{rpm:1800,torqueLbFt:f.torqueLbFt*.75},{rpm:f.torqueRpm,torqueLbFt:f.torqueLbFt},{rpm:f.powerRpm,torqueLbFt:f.powerHp*5252/f.powerRpm},{rpm:s.revLimitRpm,torqueLbFt:f.torqueLbFt*.6}]},physics:{bodyShapePreset:'car',bodyProfile:{preset:'car',overallLengthM:dimensions.lengthM,overallWidthM:dimensions.widthM,overallHeightM:f.heightIn*inch,groundClearanceM:s.groundClearanceM,frontOverhangM:.9,rearOverhangM:dimensions.lengthM-dimensions.wheelbaseM-.9,lowerBodyHeightM:.45,hood:{lengthM:1.1,widthM:1.65,heightM:.3},cabin:{centerZM:-.12,lengthM:2.35,widthM:1.6,heightM:.75},bed:{centerZM:-1.2,lengthM:0,widthM:0,heightM:0},cgPositionM:{x:0,y:s.cgHeightM,z:0},wheelRadiusM:radius,trackWidthM:(dimensions.trackFrontM+dimensions.trackRearM)/2,frontAxleDistanceFromCgM:dimensions.wheelbaseM*(1-s.frontWeightDistribution),rearAxleDistanceFromCgM:dimensions.wheelbaseM*s.frontWeightDistribution,customColliders:[]}}};
 let transmission={type:'automatic',label:'Continuous CVT (estimated calibration)',shiftMode:'automatic',gearRatios:ev?[1]:s.gearRatios,gearFinalDrive:f.finalDrive,reverseRatio:ev?1:s.reverseRatio,drivetrainEfficiency:.84,shiftTimeMs:180,clutchDelayMs:0,launchRpm:2000,autoUpshiftRpm:f.powerRpm,autoDownshiftRpm:1800,torqueConverterSlip:.10,torqueConverterMultiplication:1.6,engineProfile:null};
 if(ev){
  tuning.powertrainType='electric';tuning.aspiration='Electric';tuning.engineDisplacementL=0;
  tuning.electricPowertrain={peakTorqueNm:f.torqueLbFt*1.3558179483314,peakPowerKw:f.peakPowerKw,maxMotorRpm:s.maxMotorRpm,reductionRatio:f.finalDrive,usableBatteryKwh:s.usableBatteryKwh,driveEfficiency:s.driveEfficiency,regenEfficiency:s.regenEfficiency,maxRegenTorqueNm:s.maxRegenTorqueNm,maxRegenPowerKw:s.maxRegenPowerKw,standstillLossKw:s.standstillLossKw,regenFullSpeedRadps:s.regenFullSpeedRadps,liftOffRegen:s.liftOffRegen};
  tuning.idleRpm=0;tuning.torquePeakStartRpm=0;tuning.torquePeakEndRpm=f.peakPowerKw*1000/(tuning.electricPowertrain.peakTorqueNm)*60/(2*Math.PI);tuning.torqueFalloffRpm=s.maxMotorRpm;tuning.redlineRpm=s.maxMotorRpm;tuning.revLimitRpm=s.maxMotorRpm;delete tuning.engineCurve;
  tuning.topSpeedMph=f.topSpeedMph;tuning.zeroToSixtySec=f.zeroToSixtySec;tuning.drivetrainEfficiency=s.driveEfficiency;
  transmission={type:'automatic',label:'Single reduction EV (estimated controls)',shiftMode:'automatic',gearRatios:[1],gearFinalDrive:f.finalDrive,reverseRatio:1,drivetrainEfficiency:s.driveEfficiency,shiftTimeMs:0,clutchDelayMs:0,launchRpm:0,autoUpshiftRpm:s.maxMotorRpm,autoDownshiftRpm:0,torqueConverterSlip:0,torqueConverterMultiplication:1,engineProfile:null};
 }else{
  transmission={...transmission,type:'manual',label:'Six-speed manual (estimated ratios)',shiftMode:'manual',shiftTimeMs:240,clutchDelayMs:100,launchRpm:2200,torqueConverterSlip:0,torqueConverterMultiplication:1};
 }
 const car={id:r.id,name:r.name,class:'road',description:'Phase2 shared RTG-001 placeholder art; unique sourced vehicle specification. Original graphics and driving acceptance pending.',art:structuredClone(starter.art),camera:{trackingMode:'fixed-rear'},dimensions,defaultTransmissionType:kind,transmissions:{[kind]:transmission},tuning,setup:{defaultTireCompound:'street',tireSize:{widthMm:s.tireSize[0],aspectRatio:s.tireSize[1],wheelDiameterIn:s.tireSize[2]},tirePressurePsi:{fl:33,fr:33,rl:32,rr:32}},mechanics:{fuelTankGallons:f.fuelTankUSgal},catalogProvenance:{referenceVehicle:r.referenceVehicle,candidateId:r.candidateId,identity:r.identity,sources:[r.source],verifiedFacts:r.facts,estimates:{parameters:s,limitations:r.limits},phaseStatus:{research:'primary-anchors-reviewed',implementation:'shared-placeholder',art:'shared-RTG-001-placeholder',independentDriveVerified:false,originalArtFinished:false},placeholder:{sourceCar:'RTG-001',sourceCarId:starter.id,sharedArtOnly:true,noPhysicsCopied:true}}};
 if(ev){car.mechanics=null;const adapt=o=>{if(!o||typeof o!=='object')return;if((o.source==='fuel.percent'||o.source==='fuel')){o.source='tractionBattery.percent';o.name='Traction battery';}for(const v of Object.values(o))adapt(v);};adapt(car.art.gauges);}
 // No starter tuning, physicalVehicleProfile, transmission, collision geometry or engine profile is copied.
 e.applyLoadedCarDocument({kind:'race-car',car},{name:r.name});const doc=e.serializeSelectedCarDocument();
 if(doc.car.tuning.physicalVehicleProfile)throw Error('Unexpected physical profile inheritance');
 if(fs.existsSync(path.join(root,'cars',r.name))||manifest.folders.cars[r.name])throw Error('Refusing existing car overwrite');
 for(const [name,p]of Object.entries(manifest.folders.cars))if(decode(read(root+'/'+p)).car?.id===r.id)throw Error('Duplicate runtime ID');
 plans.push({r,doc});
}
for(const {r,doc}of plans){const dir=path.join(root,'cars',r.name);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'document.json'),JSON.stringify(doc)+'\n',{flag:'wx'});fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify({name:r.name,folder:'cars',version:1,savedAt:Date.now()})+'\n',{flag:'wx'});manifest.folders.cars[r.name]=`cars/${r.name}/document.json`;}
fs.writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Added '+plans.length+' shared-art candidates; no new art assets, no driving acceptance claimed.');
