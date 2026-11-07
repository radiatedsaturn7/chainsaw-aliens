import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {normalizeItemDocument} from '../../src/items/ItemDocument.js';
import {buildGarageCar} from '../../src/garage/CarPart.js';
import {createBuiltInRaceCars} from '../../src/racing/raceData.js';
import {createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {resolveChassisMass,chassisComplianceScale} from '../../src/racing/simulation/ChassisUpgrades.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const editor=new RaceEditor({}),part=id=>normalizeItemDocument(catalog.items.find(i=>i.id===id));
const config=car=>createVehicleDynamicsConfigFromTuning(editor.getRaceCarTuning(car));
test('braces and cages increase effective spring response, carry mass and preserve original authored profiles',()=>{
 for(const stock of createBuiltInRaceCars()){
  const original=structuredClone(stock),base=config(stock);let stiffness=base.suspensionSpringRateFrontNpm;
  const rigidReference=createVehicleDynamicsConfigFromTuning({...editor.getRaceCarTuning(stock),chassisRigidityNmDeg:0});
  for(const axle of ['Front','Rear'])for(const [prefix,unit] of [['suspensionSpringRate','Npm'],['suspensionBumpDamper','NsM'],['suspensionReboundDamper','NsM']])assert.equal(base[prefix+axle+unit],rigidReference[prefix+axle+unit]);
  for(const tier of ['street','sport','race']){
   const built=buildGarageCar(stock,{parts:[part(tier+'-rigidity')]}),next=config(built);
   assert.ok(next.suspensionSpringRateFrontNpm>stiffness);stiffness=next.suspensionSpringRateFrontNpm;
   assert.ok(next.massKg>base.massKg);
   for(const key of ['xx','yy','zz'])assert.ok(next.inertiaTensorBodyKgM2[key]>base.inertiaTensorBodyKgM2[key]);
  }
  assert.deepEqual(stock,original);
 }
 assert.equal(chassisComplianceScale(0,30000,1.6),1);
 assert.equal(chassisComplianceScale(20000,30000,1.6),1);
 assert.ok(chassisComplianceScale(1000,30000,1.6)<chassisComplianceScale(100000,30000,1.6));
});
test('ballast shifts axle loads and CG, adds rotational inertia, and zero ballast restores baseline',()=>{
 const stock=createBuiltInRaceCars()[0],base=config(stock),parts=[part('race-ballast')];
 const at=position=>config(buildGarageCar(stock,{parts,tune:{ballastKg:200,ballastPosition:position}}));
 const rear=at(-1),front=at(1);
 assert.equal(front.massKg,base.massKg+200);assert.equal(rear.massKg,front.massKg);
 assert.ok(front.frontWeightDistribution>base.frontWeightDistribution);
 assert.ok(rear.frontWeightDistribution<base.frontWeightDistribution);
 assert.ok(front.cgHeightM<base.cgHeightM);assert.ok(rear.cgHeightM<base.cgHeightM);
 assert.ok(front.cgLocationBodyM.z>base.cgLocationBodyM.z);
 assert.ok(front.inertiaTensorBodyKgM2.yy>base.inertiaTensorBodyKgM2.yy);
 const zero=config(buildGarageCar(stock,{parts,tune:{ballastKg:0,ballastPosition:1}}));
 assert.equal(zero.massKg,base.massKg);assert.deepEqual(zero.inertiaTensorBodyKgM2,base.inertiaTensorBodyKgM2);
 const input={weightKg:1500,ballastKg:200,ballastPosition:1},copy=structuredClone(input);
 assert.deepEqual(resolveChassisMass(input).tuning,resolveChassisMass(input).tuning);assert.deepEqual(input,copy);
});
test('car editor writes rigidity, ballast and inertia settings consumed by the simulator',()=>{
 editor.project.cars=[structuredClone(createBuiltInRaceCars()[0])];editor.project.selectedCarId=editor.project.cars[0].id;
 for(const [field,value] of Object.entries({chassisRigidityNmDeg:45000,ballastKg:80,ballastPosition:-.5,engineInertiaKgM2:.2})){
  assert.equal(editor.setCarTuneNumericValue(field,value),true);
  assert.equal(editor.selectedCar.tuning[field],value);
 }
 const tuning=editor.getRaceCarTuning();assert.equal(tuning.chassisRigidityNmDeg,45000);assert.equal(tuning.engineInertiaKgM2,.2);
 const baseline=structuredClone(editor.selectedCar);baseline.tuning.ballastKg=0;
 assert.equal(config(editor.selectedCar).massKg,config(baseline).massKg+80);
});

test('short chassis panels scroll to every setting and suspension panels show at most eight controls',()=>{
 const e=new RaceEditor({});
 const ctx=new Proxy({measureText:()=>({width:40})},{get:(o,k)=>k in o?o[k]:()=>{}});
 for(const [tab,bounds,total] of [['weight',{x:0,y:0,w:360,h:150},7],['suspension',{x:0,y:0,w:900,h:600},12]]){
  e.carTuneTab=tab;e.drawCarTunePanel(ctx,bounds);
  assert.ok(e.carDriveSliderRegions.length<=8);
  const region=e.carTuneScrollRegion;assert.ok(region);
  const seen=new Set(e.carDriveSliderRegions.map(r=>r.key));
  for(let i=1;i<=region.maxScroll;i++){
   e.menuScrollState[region.scrollKey]=i;e.drawCarTunePanel(ctx,bounds);
   for(const r of e.carDriveSliderRegions)seen.add(r.key);
   assert.ok(e.carDriveSliderRegions.length<=8);
  }
  assert.equal(seen.size,total);
 }
});
