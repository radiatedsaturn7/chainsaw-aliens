import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar,isGarageUpgrade} from '../../src/garage/CarPart.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {createTireDefinition,applyTireDefinition} from '../../src/racing/raceTires.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
import {normalizeMechanicalConfig} from '../../src/racing/simulation/MechanicalModel.js';
import {garageBrowserRows} from '../../src/menus/MenuGarageWidgets.js';
import {GARAGE_CATEGORIES} from '../../src/garage/GarageCategories.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const editor=new RaceEditor({}),engine=new PowertrainModel();
const parts=catalog.items.map(normalizeItemDocument).filter(isGarageUpgrade);
const tires=Object.fromEntries(parts.filter(i=>i.carPart.tireRef).map(i=>[i.carPart.tireRef,savedTireForRef(i.carPart.tireRef)]));
function fingerprint(car){
 const tuning=editor.getRaceCarTuning(car),setup=editor.getRaceCarSetup(car),config=createVehicleDynamicsConfigFromTuning(tuning);
 return JSON.stringify({config,mechanics:normalizeMechanicalConfig(car.mechanics),
  torque:[1000,2000,3500,5000,6500].map(rpm=>engine.getTorqueNmAtRpm(rpm,tuning)),
  inertia:tuning.engineInertiaKgM2,shift:tuning.shiftTimeMs,gears:tuning.gearRatios,final:tuning.finalDrive,
  alignment:[tuning.camberFront,tuning.camberRear,tuning.toeFront,tuning.toeRear,tuning.casterFront],
  differential:[tuning.frontDifferentialAccel,tuning.frontDifferentialDecel,tuning.rearDifferentialAccel,tuning.rearDifferentialDecel,tuning.centerDifferentialBalance,tuning.centerDifferentialLock],
  tires:setup.tireSize,compound:editor.getRaceTireCompound(setup.defaultTireCompound,car)});
}
test('every purchasable built-in part changes a simulator input on at least one car configuration',()=>{
 const cars=createBuiltInRaceCars(),alternate=structuredClone(cars[0]);
 applyTireDefinition(alternate,savedTireForRef('Stock'),'Stock');alternate.setup.tireSize={widthMm:225,aspectRatio:50,wheelDiameterIn:17};cars.push(alternate);
 for(const part of parts.filter(p=>p.carPart.forSale)){
  assert.ok(cars.some(stock=>{return fingerprint(buildGarageCar(stock,{parts:[part],tires}))!==fingerprint(stock);}),part.id);
 }
});
test('all eight one-word shop sections and their built-in subsections fit eight cards',()=>{
 const resources={garageCatalog:()=>parts.map(item=>({ref:item.id,item}))};
 const sections=garageBrowserRows(resources,{});
 assert.deepEqual(sections.map(r=>r.value),GARAGE_CATEGORIES);
 assert.equal(sections.length,8);
 for(const section of sections){
  assert.ok(!section.label.includes(' '));
  const slots=garageBrowserRows(resources,{},{section:section.value});
  assert.ok(slots.length<=8,section.value);assert.ok(slots.length>0);
 }
});

test('width and driveline upgrades change contact forces and delivered wheel torque',async()=>{
 const {calculateBrushTireForce}=await import('../../src/racing/simulation/ContactPatchTireModel.js');
 const stock=createBuiltInRaceCars()[0];
 const upgraded=buildGarageCar(stock,{parts:parts.filter(p=>['race-wheels','race-driveline'].includes(p.id))});
 const force=car=>calculateBrushTireForce({kinematics:{slipRatio:.01,slipAngleRad:.01,longitudinalVelocityMps:15},normalLoadN:3500,tire:{widthMm:editor.getRaceCarSetup(car).tireSize?.widthMm??245},material:{surfaceId:'asphalt'}});
 assert.ok(force(upgraded).longitudinalForceN>force(stock).longitudinalForceN);
 assert.ok(Math.abs(force(upgraded).lateralForceN)>Math.abs(force(stock).lateralForceN));
 const torque=car=>{const tuning=editor.getRaceCarTuning(car);return engine.stepAuthoritativeWheelTorques({tuning,config:createVehicleDynamicsConfigFromTuning(tuning),controls:{requestedGear:1,throttle:1,assists:{tractionControlEnabled:false}},previous:{gear:1,targetGear:1,engineRpm:3500},driveShareByWheel:{fl:.25,fr:.25,rl:.25,rr:.25},dt:0}).wheelDriveTorqueNm;};
 const before=Object.values(torque(stock)).reduce((a,b)=>a+b,0),after=Object.values(torque(upgraded)).reduce((a,b)=>a+b,0);
 assert.ok(after>before);
});
