import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {applyTireDefinition} from '../../src/racing/raceTires.js';
export const AIRSLAYER_NAME='STI Airslayer';
export function createAirslayerDocument(){
 const editor=new RaceEditor({});
 const car=editor.normalizeLoadedCarDocument(JSON.parse(fs.readFileSync('data/server-storage/files/cars/RTG-001/document.json')));
 car.id='sti-airslayer';car.name=AIRSLAYER_NAME;car.class='road';
 car.description='2020 Subaru WRX STI Airslayer inspired hill-climb car. VSC published: 2.3L turbo boxer, 862 bhp, 664 lb-ft, 1190 kg without driver, Sadev six-speed sequential, 19-inch hill-climb wheels, 11:1 steering. Gearing, torque-curve shape, suspension, tire dimensions and aero coefficients are engineering estimates, not a factory setup. Fixed aero approximates the active wing. Shared RTG-001 artwork; saved Tarmac tires approximate the dry Yokohama A052 fitment.';
 car.dimensions={lengthM:4.67,widthM:2,wheelbaseM:2.65,trackFrontM:1.72,trackRearM:1.72};
 car.camera={trackingMode:'fixed-rear'};car.audio.engineProfile='wrx-flat-four-manual';
 car.mechanics={...car.mechanics,fuelMpg:8,fuelTankGallons:35/3.785411784};
 applyTireDefinition(car,JSON.parse(fs.readFileSync('data/server-storage/files/tires/Tarmac/document.json')),'Tarmac');
 car.setup.tireSize={widthMm:275,aspectRatio:35,wheelDiameterIn:19};
 const radius=(19*.0254+2*.275*.35)/2;
 const physical={...car.tuning.physicalVehicleProfile,id:'airslayer-estimated-chassis-v1',massKg:1190,cgLocationBodyM:{x:0,y:.48,z:0},frontWeightDistribution:.55,
 inertiaTensorBodyKgM2:{xx:1800,xy:0,xz:0,yy:2100,yz:0,zz:600},steeringWheelRatio:11,
 suspensionSpringRateFrontNpm:65000,suspensionSpringRateRearNpm:60000,
 suspensionBumpDamperFrontNsM:3800,suspensionReboundDamperFrontNsM:5200,suspensionBumpDamperRearNsM:3500,suspensionReboundDamperRearNsM:4800,
 suspensionTravelFrontM:.18,suspensionTravelRearM:.18,antiRollStiffnessFrontNpm:26000,antiRollStiffnessRearNpm:22000,
 unsprungMassByWheelKg:{fl:38,fr:38,rl:36,rr:36},dragCoefficient:.65,frontalAreaM2:2.25,
 frontDownforceCoefficient:.55,rearDownforceCoefficient:.85,frontRideHeightM:.12,rearRideHeightM:.135,groundEffectGain:.08};
 const ratios=[2.8,2.1,1.65,1.35,1.12,.95];
 Object.assign(car.tuning,{physicalVehicleProfile:physical,drivetrain:'awd',powerHp:862,torqueLbFt:664,weightKg:1190,frontWeightDistribution:.55,engineDisplacementL:2.3,aspiration:'Turbocharged',
  wheelRadiusM:radius,tireGrip:1,dragCoefficient:.65,topSpeedMph:175,zeroToSixtySec:2.5,accelerationCalibration:1,drivetrainEfficiency:.88,
  idleRpm:1100,redlineRpm:8000,revLimitRpm:8500,revLimiterDropRpm:300,torquePeakStartRpm:4500,torquePeakEndRpm:6000,torqueFalloffRpm:8500,
  gearRatios:ratios,gearFinalDrive:4,reverseRatio:2.8,shiftTimeMs:90,clutchDelayMs:0,launchRpm:4500,autoUpshiftRpm:8000,autoDownshiftRpm:3500,torqueConverterSlip:0,
  engineProfile:'wrx-flat-four-manual',chassisRigidityNmDeg:45000,suspensionImpactStrength:1.8,engineInertiaKgM2:.18,
  brakeBalance:.64,brakePressure:1,camberFront:-2,camberRear:-1.5,toeFront:0,toeRear:.1,
  frontDifferentialAccel:.4,frontDifferentialDecel:.15,rearDifferentialAccel:.6,rearDifferentialDecel:.22,centerDifferentialBalance:.55,centerDifferentialLock:.5,
  aeroFront:.55,aeroRear:.85,garageEngineCurve:true,engineCurve:{rpmMin:1100,rpmMax:8500,torquePoints:[{rpm:1100,torqueLbFt:100},{rpm:3000,torqueLbFt:300},{rpm:4500,torqueLbFt:600},{rpm:6000,torqueLbFt:664},{rpm:7495,torqueLbFt:604},{rpm:8500,torqueLbFt:500}]}});
 delete car.tuning.physics;
 car.transmissions=Object.fromEntries(['manual','automatic'].map(type=>[type,{type,label:type==='manual'?'Sadev 6-speed':'Sadev 6 auto-shift',shiftMode:type,gearRatios:ratios,gearFinalDrive:4,reverseRatio:2.8,shiftTimeMs:90,clutchDelayMs:0,launchRpm:4500,autoUpshiftRpm:8000,autoDownshiftRpm:3500,torqueConverterSlip:0,drivetrainEfficiency:.88,engineProfile:'wrx-flat-four-manual'}]));
 car.defaultTransmissionType='automatic';
 editor.project.cars=[car];editor.project.selectedCarId=car.id;
 return editor.serializeSelectedCarDocument();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const data=createAirslayerDocument();
 const response=await fetch('http://127.0.0.1:8000/__storage/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder:'cars',name:AIRSLAYER_NAME,data})});
 if(!response.ok)throw Error(`Save failed: ${response.status} ${await response.text()}`);
 console.log(JSON.stringify({saved:AIRSLAYER_NAME,response:await response.json()}));
}
