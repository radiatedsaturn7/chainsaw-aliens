import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
const ids=['fl','fr','rl','rr'],each=v=>Object.fromEntries(ids.map(id=>[id,structuredClone(v)]));
test('RTG-S saved editor document has RS power, AWD, factory size and shared body art',()=>{
 const doc=JSON.parse(fs.readFileSync('data/server-storage/files/cars/RTG-S/document.json'));
 const rtg=JSON.parse(fs.readFileSync('data/server-storage/files/cars/RTG-001/document.json')).car;
 const car=new RaceEditor({}).normalizeLoadedCarDocument(doc);
 assert.equal(car.id,'rtg-s');assert.equal(car.tuning.powerHp,182);assert.equal(car.tuning.torqueLbFt,178);
 assert.equal(car.tuning.drivetrain,'awd');assert.equal(car.setup.defaultTireCompound,'stock');assert.equal(car.setup.tireDefinition.ref,'Stock');
 assert.deepEqual(car.setup.tireSize,{widthMm:225,aspectRatio:40,wheelDiameterIn:18});
 assert.equal(car.transmissions.automatic.gearFinalDrive,3.7);assert.equal(car.transmissions.manual,undefined);
 for(const view of Object.keys(rtg.art.angleLayers))assert.deepEqual(car.art.angleLayers[view].body,rtg.art.angleLayers[view].body);
});
test('brush model exposes its physical peak, including explicit tire peak overrides',()=>{
 for(const grip of [.2,1]){
  const opts={normalLoadN:3500,tire:{compound:{grip:1},longitudinalStiffnessN:63000},material:{surfaceGripScale:grip},kinematics:{slipRatio:0,slipAngleRad:0,longitudinalVelocityMps:3}};
  const result=calculateBrushTireForce(opts);
  const peak=calculateBrushTireForce({...opts,kinematics:{...opts.kinematics,slipRatio:result.peakLongitudinalSlipRatio}});
  assert.ok(Math.abs(peak.longitudinalForceN-peak.combinedSlipLimitN)<.001);
  assert.equal(calculateBrushTireForce({...opts,tire:{...opts.tire,peakSlip:.15}}).peakLongitudinalSlipRatio,.15);
 }
});
test('traction control respects contact torque without increasing grip or applying when disabled',()=>{
 const model=new PowertrainModel();const config={idleRpm:850,maxRpm:6500,wheelRadiusM:.32,drivetrainEfficiency:.9};
 const tuning={drivetrain:'awd',gearRatios:[4],finalDrive:4,torqueLbFt:200,idleRpm:850,revLimitRpm:6500,torquePeakStartRpm:1500,torquePeakEndRpm:4500,torqueFalloffRpm:6500};
 const run=tc=>model.stepAuthoritativeWheelTorques({tuning,config,previous:{gear:1,targetGear:1,engineRpm:2500},controls:{throttle:.7,requestedGear:1,assists:{autoShift:false,tractionControlEnabled:tc}},kinematicsByWheel:each({wheelAngularVelocityRadps:10,longitudinalVelocityMps:3.2,slipRatio:0,effectiveRollingRadiusM:.32,peakLongitudinalSlipRatio:.03}),capacityByWheel:each(600),driveShareByWheel:each(.25),state:{groundSpeedMps:3.2},dt:1/360});
 const on=run(true),off=run(false);
 assert.ok(on.telemetry.contactTorqueScale<1);
 for(const id of ids){assert.ok(on.wheelDriveTorqueNm[id]<=600*.32*.9+1e-6);assert.ok(off.wheelDriveTorqueNm[id]>on.wheelDriveTorqueNm[id]);}
});
for(const carName of ['RTG-S','RTG-001'])test(`${carName}: Stock tires maintain walking pace uphill in three inches of cold snow`,()=>{
 const result=runClimb({carName,snowMm:76.2,slope:.12,throttle:.55,initialSpeedMps:3.13,seconds:8});
 assert.ok(result.mph>=5,JSON.stringify(result));assert.ok(result.travelM>15);assert.ok(Math.abs(result.lateralM)<.1);
 assert.ok(result.maxSlip<.15,JSON.stringify(result));
});
test('stock AWD climbs gravel and dirt with aids enabled and disabled; winter tires retain an advantage',()=>{
 for(const surface of ['gravel','dirt'])for(const tc of [true,false]){
  const result=runClimb({surface,snowMm:0,tc,throttle:.55,seconds:5});assert.ok(result.mph>5,JSON.stringify(result));
 }
 const snow=runClimb({tireName:'Snow',snowMm:76.2,throttle:.55,seconds:8});
 const stock=runClimb({snowMm:76.2,throttle:.55,seconds:8});
 assert.ok(snow.mph>stock.mph+3,JSON.stringify({snow,stock}));
});
test('snow coefficients use a freezing-temperature reference rather than double cold derating',()=>{
 const stock=JSON.parse(fs.readFileSync('data/server-storage/files/tires/Stock/document.json'));
 const force=(temperatureC,material)=>calculateBrushTireForce({normalLoadN:3500,tire:{compound:stock.compound,widthMm:245,referenceLoadN:3500,treadTemperatureC:temperatureC},material,kinematics:{slipRatio:.03,slipAngleRad:0,longitudinalVelocityMps:3}});
 const snow={baseSurfaceId:'snow',surfaceId:'snow',surfaceGripScale:.34,snowDepthMm:25.4};
 assert.ok(Math.abs(force(0,snow).gripCoefficient-.34*.7)<1e-6);
 assert.ok(force(-20,snow).gripCoefficient<force(0,snow).gripCoefficient);
 const road={baseSurfaceId:'asphalt',surfaceId:'asphalt',surfaceGripScale:1};
 assert.ok(force(0,road).gripCoefficient<force(21,road).gripCoefficient);
});
