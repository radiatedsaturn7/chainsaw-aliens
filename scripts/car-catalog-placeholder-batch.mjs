// Phase-2 pilot: share existing graphics only; author each powertrain/geometry separately.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../src/ui/RaceEditor.js';
import {validatePlaceholderBatch} from '../tools/vehicle-catalog/placeholder-intake.mjs';
const root='data/server-storage/files',read=p=>JSON.parse(fs.readFileSync(p));
const decode=d=>d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;
const manifest=read(root+'/manifest.json');
const starter=decode(read(root+'/'+manifest.folders.cars['RTG-001'])).car;
const intakePath=process.argv[2];if(!intakePath)throw Error('Usage: node scripts/car-catalog-placeholder-batch.mjs <intake.json> [--dry-run]');
const records=read(intakePath).vehicles;
const existing=Object.entries(manifest.folders.cars).map(([name,p])=>{const c=decode(read(root+'/'+p)).car;return {name,id:c?.id,candidateId:c?.catalogProvenance?.candidateId};});
const normalized=validatePlaceholderBatch(records,read('data/vehicle-catalog/full-candidate-backlog.json').candidates,existing);
const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
const plans=[];
for(const [index,r] of records.entries()){
 const f=normalized[index],s=f,inch=.0254,mass=f.curbLb*.45359237;
 const kind=f.transmission;
 const radius=(s.tireSize[0]*s.tireSize[1]/100/1000)+s.tireSize[2]*inch/2;
 const dimensions={lengthM:f.lengthIn*inch,widthM:f.widthIn*inch,wheelbaseM:f.wheelbaseIn*inch,trackFrontM:f.trackFrontIn*inch,trackRearM:f.trackRearIn*inch};
 const tuning={drivetrain:f.drivetrain,powerHp:f.powerHp,torqueLbFt:f.torqueLbFt,weightKg:mass,engineDisplacementL:f.engineDisplacementL,aspiration:f.aspiration,frontWeightDistribution:s.frontWeightDistribution,cgHeightM:s.cgHeightM,wheelbaseM:dimensions.wheelbaseM,wheelRadiusM:radius,dragCoefficient:s.dragCoefficient,tireGrip:s.tireGrip,redlineRpm:s.redlineRpm,revLimitRpm:s.revLimitRpm,idleRpm:750,torquePeakStartRpm:f.torqueRpm,torquePeakEndRpm:f.torqueRpm,torqueFalloffRpm:f.powerRpm,gearRatios:s.gearRatios,gearFinalDrive:f.finalDrive,reverseRatio:s.reverseRatio,drivetrainEfficiency:.84,accelerationCalibration:1,brakeBalance:.65,brakePressure:1,frontDifferentialAccel:0,frontDifferentialDecel:0,rearDifferentialAccel:f.rearDifferentialAccel,rearDifferentialDecel:0,centerDifferentialBalance:.5,differentialAccel:0,differentialDecel:0,aeroFront:f.aeroFront,aeroRear:f.aeroRear,steeringRatio:f.steeringRatio||15,springFront:s.spring,springRear:s.spring-.02,dampingFront:.44,dampingRear:.42,antiRollFront:.25,antiRollRear:s.antiRollRear,suspensionTravelFront:s.suspensionTravelM,suspensionTravelRear:s.suspensionTravelM,rideHeightFront:.45,rideHeightRear:.45,absEnabled:f.absEnabled??true,tractionControlEnabled:f.tractionControlEnabled??true,topSpeedMph:s.topSpeedMph,zeroToSixtySec:s.zeroToSixtySec,engineCurve:{rpmMin:750,rpmMax:s.revLimitRpm,torquePoints:[{rpm:750,torqueLbFt:f.torqueLbFt*.4},{rpm:1800,torqueLbFt:f.torqueLbFt*.75},{rpm:f.torqueRpm,torqueLbFt:f.torqueLbFt},{rpm:f.powerRpm,torqueLbFt:f.powerHp*5252/f.powerRpm},{rpm:s.revLimitRpm,torqueLbFt:f.torqueLbFt*.6}]},physics:{bodyShapePreset:'car',bodyProfile:{preset:'car',overallLengthM:dimensions.lengthM,overallWidthM:dimensions.widthM,overallHeightM:f.heightIn*inch,groundClearanceM:s.groundClearanceM,frontOverhangM:f.frontOverhangM,rearOverhangM:dimensions.lengthM-dimensions.wheelbaseM-f.frontOverhangM,lowerBodyHeightM:.45,hood:{lengthM:1.1,widthM:1.65,heightM:.3},cabin:{centerZM:-.12,lengthM:2.35,widthM:1.6,heightM:.75},bed:{centerZM:-1.2,lengthM:0,widthM:0,heightM:0},cgPositionM:{x:0,y:s.cgHeightM,z:0},wheelRadiusM:radius,trackWidthM:(dimensions.trackFrontM+dimensions.trackRearM)/2,frontAxleDistanceFromCgM:dimensions.wheelbaseM*(1-s.frontWeightDistribution),rearAxleDistanceFromCgM:dimensions.wheelbaseM*s.frontWeightDistribution,customColliders:[]}}};
 // Source power/torque tables can be rounded inconsistently. Cap the estimated curve to the chosen power anchor.
 for(const point of tuning.engineCurve.torquePoints)point.torqueLbFt=Math.min(point.torqueLbFt,f.powerHp*5252/point.rpm);
 let transmission={type:'automatic',label:'Continuous CVT (estimated calibration)',shiftMode:'automatic',gearRatios:s.gearRatios,gearFinalDrive:f.finalDrive,reverseRatio:s.reverseRatio,drivetrainEfficiency:.84,shiftTimeMs:180,clutchDelayMs:0,launchRpm:2000,autoUpshiftRpm:f.powerRpm,autoDownshiftRpm:1800,torqueConverterSlip:.10,torqueConverterMultiplication:1.6,engineProfile:null};
 transmission={...transmission,type:kind,label:kind==='manual'?`${f.gearCount}-speed manual (estimated individual ratios)`:(f.transmissionLabel||`${f.gearCount}-speed DCT approximation`),shiftMode:kind,shiftTimeMs:f.shiftTimeMs,clutchDelayMs:kind==='manual'?100:0,launchRpm:f.launchRpm??2200,autoDownshiftRpm:f.autoDownshiftRpm??1800,torqueConverterSlip:f.torqueConverterSlip??0,torqueConverterMultiplication:f.torqueConverterMultiplication??1};
 if(f.frontTire&&f.rearTire){const radius=t=>t[0]*t[1]/100000+t[2]*inch/2;tuning.wheelRadiusByWheelM={fl:radius(f.frontTire),fr:radius(f.frontTire),rl:radius(f.rearTire),rr:radius(f.rearTire)};}
 const car={id:r.id,name:r.name,class:'road',description:'Phase2 shared RTG-001 placeholder art; unique sourced vehicle specification. Original graphics and driving acceptance pending.',art:structuredClone(starter.art),camera:{trackingMode:'fixed-rear'},dimensions,defaultTransmissionType:kind,transmissions:{[kind]:transmission},tuning,setup:{defaultTireCompound:'street',tireSize:{widthMm:s.tireSize[0],aspectRatio:s.tireSize[1],wheelDiameterIn:s.tireSize[2]},tirePressurePsi:{fl:33,fr:33,rl:32,rr:32}},mechanics:{fuelTankGallons:f.fuelTankUSgal},catalogProvenance:{referenceVehicle:r.referenceVehicle,candidateId:r.candidateId,identity:r.identity,sources:r.sources,verifiedFacts:r.facts,estimates:{parameters:r.simulationEstimates,limitations:r.limits},phaseStatus:{research:'primary-anchors-reviewed',implementation:'shared-placeholder',art:'shared-RTG-001-placeholder',independentDriveVerified:false,originalArtFinished:false},placeholder:{sourceCar:'RTG-001',sourceCarId:starter.id,sharedArtOnly:true,noPhysicsCopied:true}}};
 // No starter tuning, physicalVehicleProfile, transmission, collision geometry or engine profile is copied.
 e.applyLoadedCarDocument({kind:'race-car',car},{name:r.name});const doc=e.serializeSelectedCarDocument();
 if(doc.car.tuning.physicalVehicleProfile)throw Error('Unexpected physical profile inheritance');
 if(fs.existsSync(path.join(root,'cars',r.name))||manifest.folders.cars[r.name])throw Error('Refusing existing car overwrite');
 for(const [name,p]of Object.entries(manifest.folders.cars))if(decode(read(root+'/'+p)).car?.id===r.id)throw Error('Duplicate runtime ID');
 plans.push({r,doc});
}
if(process.argv.includes('--dry-run')){console.log('Validated '+plans.length+' new records; no files written.');process.exit(0);}
for(const {r,doc}of plans){const dir=path.join(root,'cars',r.name);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'document.json'),JSON.stringify(doc)+'\n',{flag:'wx'});fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify({name:r.name,folder:'cars',version:1,savedAt:Date.parse('2026-11-17T00:00:00Z')})+'\n',{flag:'wx'});manifest.folders.cars[r.name]=`cars/${r.name}/document.json`;}
fs.writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Added '+plans.length+' shared-art candidates; no new art assets, no driving acceptance claimed.');
