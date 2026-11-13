import test from 'node:test';
import assert from 'node:assert/strict';
import {axleTireGeometry,tireSizeForWheel,tireRadiusM} from '../../src/racing/TireSizes.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {calculateWheelContactKinematics} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
import {TireModel} from '../../src/racing/simulation/TireModel.js';
import {applyDebugTirePhysics} from '../../src/racing/simulation/DebugTireSwap.js';
const front={widthMm:235,aspectRatio:45,wheelDiameterIn:17},rear={widthMm:255,aspectRatio:40,wheelDiameterIn:17};
const setup={tireSize:front,tireSizeByAxle:{front,rear}};
test('legacy authored rolling radius is untouched; opt in resolves nominal per axle dimensions',()=>{
 assert.deepEqual(axleTireGeometry({tireSize:front},{wheelRadiusM:.4}),{});
 const geometry=axleTireGeometry(setup,{drivetrain:'rwd'});
 assert.ok(Math.abs(geometry.wheelRadiusByWheelM.fl-.32165)<1e-10);
 assert.ok(Math.abs(geometry.wheelRadiusByWheelM.rl-.3179)<1e-10);
 assert.equal(geometry.wheelRadiusM,geometry.wheelRadiusByWheelM.rl);
 assert.equal(geometry.wheelWidthByWheelM.rl,.255);
 assert.equal(tireRadiusM({widthMm:-1},.3),.3);
 assert.deepEqual(tireSizeForWheel({tireSize:front,tireSizeByAxle:{rear:{widthMm:255}}},'rr'),{...front,widthMm:255});
});
test('editor axle fields round trip, preserve opposite axle and global replacement resets both',()=>{
 const e=new RaceEditor({});e.selectedCar.setup.tireSize=front;
 assert.equal(e.setCarTireSize(rear,'rear'),true);
 assert.equal(e.setCarTireSizeComponent('aspectRatio',50,'front'),true);
 const restored=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.selectedCar)));
 assert.deepEqual(restored.setup.tireSizeByAxle,{front:{...front,aspectRatio:50},rear});
 const t=e.getRaceCarTuning(restored);assert.ok(t.wheelRadiusByWheelM.fl>t.wheelRadiusByWheelM.rl);
 assert.equal(e.setCarTireSize(front),true);assert.equal(e.selectedCar.setup.tireSizeByAxle,undefined);
 assert.equal(e.getRaceCarTuning().wheelRadiusByWheelM,undefined);
});
test('runner reset, contact geometry, grip and render state agree on independent axle geometry',()=>{
 const tuning={wheelRadiusM:.33,drivetrain:'rwd',...axleTireGeometry(setup,{drivetrain:'rwd'})};
 const runner=new VehicleDynamicsRunner({config:createVehicleDynamicsConfigFromTuning(tuning),initialState:{speedMps:15,velocity:{x:0,y:0,z:15}}});
 for(const id of ['fl','fr','rl','rr']) {
  const radius=tuning.wheelRadiusByWheelM[id];
  assert.ok(Math.abs(runner.state.wheelAngularVelocityRadps[id]-15/radius)<1e-5);
  const patch=calculateWheelContactKinematics({state:runner.state,config:runner.config,controls:{steering:0},environment:{},wheelId:id});
  assert.ok(Math.abs(patch.effectiveRollingRadiusM-radius)<1e-6);
  assert.ok(Math.abs(patch.slipRatio)<1e-5);
 }
 const render=createVehicleRenderStateFromRunner(runner);
 assert.ok(Math.abs(render.wheels.fl.hubPositionBody.y-render.wheels.rl.hubPositionBody.y-(.32165-.3179))<1e-5);
 assert.equal(render.wheels.rl.radiusM,tuning.wheelRadiusByWheelM.rl);
 runner.replaceAuthoritativeState({speedMps:10});assert.ok(Math.abs(runner.state.wheelAngularVelocityRadps.rl-10/.3179)<1e-5);
 const tires=new TireModel();
 assert.notEqual(tires.getWheelGripForSurface({setup,wheelId:'fl'}),tires.getWheelGripForSurface({setup,wheelId:'rl'}));
 applyDebugTirePhysics(runner,{wheelRadiusM:.35});assert.equal(runner.config.wheelRadiusByWheelM,undefined);
});

test('staggered cars never select scalar remote AI shortcut',async()=>{
 const {useRaceAiRemotePowertrain}=await import('../../src/racing/RaceAiRemotePowertrain.js');
 const ai={physicsBudgetDetail:'cheap',worldX:500,worldZ:0},session={worldX:0,worldZ:0};
 assert.equal(useRaceAiRemotePowertrain(ai,session,{}),true);
 assert.equal(useRaceAiRemotePowertrain(ai,session,axleTireGeometry(setup)),false);
});

test('installing a square tire set clears axle overrides; stock garage retains factory axle sizes',async()=>{
 const {applyTireDefinition,createTireDefinition}=await import('../../src/racing/raceTires.js');
 const {GarageSystem}=await import('../../src/garage/GarageSystem.js');
 const car={setup:structuredClone(setup)},garage=new GarageSystem({});
 garage.loadTire=async()=>createTireDefinition('tarmac');
 const stock=await garage.stockBaseline(car);assert.deepEqual(stock.setup.tireSizeByAxle,setup.tireSizeByAxle);
 applyTireDefinition(car,createTireDefinition('tarmac'));assert.equal(car.setup.tireSizeByAxle,undefined);
});

test('RWD/FWD/AWD compatibility radius equals driven shaft rolling speed, not undriven axle',()=>{
 const speed=20;
 for(const drive of ['rwd','fwd','awd']) {
  const t=axleTireGeometry(setup,{drivetrain:drive});
  const ids=drive==='rwd'?['rl','rr']:drive==='fwd'?['fl','fr']:['fl','fr','rl','rr'];
  const averageOmega=ids.reduce((sum,id)=>sum+speed/t.wheelRadiusByWheelM[id],0)/ids.length;
  assert.ok(Math.abs(averageOmega-speed/t.wheelRadiusM)<1e-9);
  const gear=2.36,final=3.133;
  assert.ok(Math.abs(averageOmega*gear*final*60/(Math.PI*2)-speed/t.wheelRadiusM*gear*final*60/(Math.PI*2))<1e-8);
 }
});
