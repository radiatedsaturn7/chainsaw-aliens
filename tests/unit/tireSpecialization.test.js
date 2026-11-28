import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTireDefinition,normalizeTireDefinition,TIRE_PROPERTY_FIELDS,applyTireDefinition} from '../../src/racing/raceTires.js';
import {calculateBrushTireForce,ContactPatchTireModel} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {createVehicleDynamicsConfig,createVehicleDynamicsState} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {contactTireWear} from '../../src/racing/simulation/SurfaceWearModel.js';
import TireEditor from '../../src/ui/TireEditor.js';

const saved=name=>JSON.parse(readFileSync(new URL('../../data/server-storage/files/tires/'+name+'/document.json',import.meta.url)));
const keys=['slidingFrictionRatio','postPeakFalloff','recoveryHysteresis','abrasionResistance','casingStrength','stoneResistance'];
const force=(compound,slipAngleRad,slipRatio=0)=>calculateBrushTireForce({
  normalLoadN:4000,tire:{compound,pressurePsi:32},material:{surfaceId:'asphalt',grip:1},
  kinematics:{slipRatio,slipAngleRad,longitudinalVelocityMps:20}
});
const wear=(compound,load=14000)=>contactTireWear({dt:1,thermal:{frictionHeatingWorkJ:10000,treadTemperatureC:80},
  patch:{normalLoadN:load,longitudinalVelocityMps:20,material:{surfaceId:'gravel',roughness:.6},
  tireParameters:{compound,pressurePsi:32}}});

test('old tire documents gain neutral behavior defaults and every new control is editable',()=>{
  const tire=normalizeTireDefinition({baseCompound:'stock',compound:{}});
  assert.deepEqual(keys.map(k=>tire.compound[k]),[.66,1.8,.04,1,1,1]);
  for(const key of keys)assert.ok(TIRE_PROPERTY_FIELDS.some(f=>f.path==='compound.'+key));
  const extreme=normalizeTireDefinition({compound:Object.fromEntries(keys.map(k=>[k,999]))});
  for(const key of keys)assert.equal(extreme.compound[key],TIRE_PROPERTY_FIELDS.find(f=>f.path==='compound.'+key).max);
});

test('saved Drift and Offroad match template behavior, and editor undo/redo and installation preserve controls',()=>{
  for(const name of ['Drift','Offroad']){
    const doc=saved(name),tire=normalizeTireDefinition(doc),base=createTireDefinition(doc.baseCompound);
    for(const key of keys)assert.equal(tire.compound[key],base.compound[key]);
    const editor=new TireEditor({deviceIsMobile:false,isMobile:false});
    editor.setTire(doc,name);
    const edited=editor.getTireDocument();
    for(const key of keys)edited.compound[key]=.5;
    editor.applyProperties(edited);
    editor.handleMenuAction('undo');
    assert.equal(editor.getTireDocument().compound.casingStrength,tire.compound.casingStrength);
    editor.handleMenuAction('redo');
    const car={};applyTireDefinition(car,editor.getTireDocument());
    assert.equal(car.setup.tireDefinition.tire.compound.casingStrength,.5);
    assert.deepEqual(editor.getTireDocument().graphics,tire.graphics);
  }
});

test('Drift broadens the slide transition without raising the peak or breaking the combined friction limit',()=>{
  const drift=normalizeTireDefinition(saved('Drift')).compound;
  const conventional={...drift,slidingFrictionRatio:.66,postPeakFalloff:1.8};
  assert.equal(force(drift,.02).lateralForceN,force(conventional,.02).lateralForceN);
  assert.ok(Math.abs(force(drift,.6).lateralForceN)>Math.abs(force(conventional,.6).lateralForceN)*1.15);
  for(let angle=0;angle<1;angle+=.01)for(const slip of [0,.1,.5,2]){
    const f=force(drift,angle,slip);
    assert.ok(Number.isFinite(f.lateralForceN));
    assert.ok(Math.hypot(f.lateralForceN,f.longitudinalForceN)<=f.combinedSlipLimitN+1e-6);
  }
});

test('Offroad trades dry and paved grip for mud, wet gravel, wear resistance and casing protection',()=>{
  const off=normalizeTireDefinition(saved('Offroad')).compound,rally=normalizeTireDefinition(saved('Rally')).compound;
  for(const surface of ['mud','wet-gravel'])assert.ok(off.surfaceGrip[surface]>rally.surfaceGrip[surface]);
  for(const surface of ['asphalt','gravel','dirt'])assert.ok(off.surfaceGrip[surface]<rally.surfaceGrip[surface]);
  assert.ok(wear(off).wear<wear(rally).wear);
  assert.equal(wear(off,11000).damage,0);
  assert.ok(wear(rally,11000).damage>0);
  assert.ok(wear(off,20000).damage>0);
  assert.ok(wear(off).damage<wear(rally).damage);
});

test('contact solver publishes installed compound to wear and reads its recovery margin',()=>{
  const model=new ContactPatchTireModel(),compound=normalizeTireDefinition(saved('Offroad')).compound;
  const wheels=['fl','fr','rl','rr'],config=createVehicleDynamicsConfig({massKg:1400});
  const step=c=>model.step({state:createVehicleDynamicsState({speedMps:20,velocity:{x:0,y:0,z:20}}),
    config,dt:1/360,controls:{throttle:0,brake:0,steering:0,handbrake:0,requestedGear:1},
    environment:{tireByWheel:Object.fromEntries(wheels.map(w=>[w,{compound:c}]))}});
  const patch=step(compound).contactPatches.fl;
  assert.equal(patch.tireParameters.compound,compound);
  const actual=contactTireWear({patch,thermal:{frictionHeatingWorkJ:10000},dt:1});
  const plain=contactTireWear({patch:{...patch,tireParameters:{...patch.tireParameters,compound:{...compound,abrasionResistance:1}}},thermal:{frictionHeatingWorkJ:10000},dt:1});
  assert.ok(Math.abs(actual.wear*1.25-plain.wear)<1e-12);
  assert.equal(step(normalizeTireDefinition(saved('Drift')).compound).contactPatches.fl.recoveryHysteresis,.02);
  assert.equal(step(undefined).contactPatches.fl.tireParameters.compound,undefined,'no stale compound after wheel configuration changes');
});
