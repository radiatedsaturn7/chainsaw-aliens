import test from 'node:test';
import assert from 'node:assert/strict';
import {TIRE_GRIP_FIELDS,TIRE_PROPERTY_FIELDS,createTireDefinition,normalizeTireDefinition,applyTireDefinition} from '../../src/racing/raceTires.js';
import {RACE_TIRE_COMPOUNDS} from '../../src/racing/raceData.js';
import {resolveCompoundSurfaceGrip} from '../../src/racing/simulation/SurfaceConditionGrip.js';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {TireModel} from '../../src/racing/simulation/TireModel.js';

const conditions={
  asphalt:{baseSurfaceId:'asphalt'},
  'wet-asphalt':{baseSurfaceId:'asphalt',moistureDepthMm:1},
  dirt:{baseSurfaceId:'dirt'},
  gravel:{baseSurfaceId:'gravel'},
  mud:{baseSurfaceId:'dirt',moistureDepthMm:1},
  'wet-gravel':{baseSurfaceId:'gravel',moistureDepthMm:1},
  snow:{baseSurfaceId:'asphalt',snowDepthMm:35},
  slush:{baseSurfaceId:'asphalt',snowDepthMm:35,moistureDepthMm:1}
};
const tireModel=new TireModel();
for(const field of TIRE_GRIP_FIELDS)test(`${field.label} changes live contact force in its stated ground condition`,()=>{
  const key=field.path.split('.').at(-1),compound=createTireDefinition().compound;
  const material={surfaceId:key,saturationDepthMm:1,grip:1,surfaceGripScale:1,trackStateConditionApplied:true,...conditions[key]};
  const force=()=>calculateBrushTireForce({kinematics:{slipRatio:0.12,slipAngleRad:0.08,camberAngleRad:0},normalLoadN:4000,
    tire:{compound,pressurePsi:32,effectivePressurePsi:32,targetPressurePsi:32,treadTemperatureC:75,referenceLoadN:4000,widthMm:245},material});
  compound.surfaceGrip[key]=0.4;
  assert.ok(Math.abs(resolveCompoundSurfaceGrip(compound,material)-0.4)<1e-9);
  const low=force();const auxiliaryLow=tireModel.getWheelGripForSurface({compound,surfaceId:key,material});
  compound.surfaceGrip[key]=1.2;
  assert.ok(Math.abs(resolveCompoundSurfaceGrip(compound,material)-1.2)<1e-9);
  assert.ok(force().gripCoefficient>low.gripCoefficient*2);
  assert.ok(tireModel.getWheelGripForSurface({compound,surfaceId:key,material})>auxiliaryLow*2);
});

test('editor exposes one grip per ground condition and explains each condition',()=>{
  assert.deepEqual(TIRE_GRIP_FIELDS.map(field=>field.path.split('.').at(-1)),Object.keys(conditions));
  assert.ok(TIRE_GRIP_FIELDS.every(field=>field.description && field.group==='Surface grip'));
  assert.ok(TIRE_PROPERTY_FIELDS.every(field=>!field.path.includes('weatherGrip')));
  for(const builtin of RACE_TIRE_COMPOUNDS)assert.equal('weatherGrip' in createTireDefinition(builtin.id).compound,false);
});

test('older tires retire weather modifiers while retaining all authored surface grip, graphics and size',()=>{
  const old=createTireDefinition('dirt');old.schemaVersion=1;
  old.compound.weatherGrip={clear:0.2,rain:0.3,storm:0.4,snow:0.5};
  old.compound.surfaceGrip.snow=0.75;old.compound.surfaceGrip.slush=0.6;
  old.graphics={tires:['custom-tire']};old.size.widthMm=285;
  const normalized=normalizeTireDefinition(JSON.parse(JSON.stringify(old)));
  assert.equal(normalized.schemaVersion,2);assert.equal('weatherGrip' in normalized.compound,false);
  assert.deepEqual(normalized.compound.surfaceGrip,old.compound.surfaceGrip);
  assert.equal(normalized.size.widthMm,285);assert.deepEqual(normalized.graphics.tires,['custom-tire']);
  const car={};applyTireDefinition(car,old,'Saved Tire');
  assert.equal('weatherGrip' in car.setup.tireDefinition.tire.compound,false);
});

test('old weather modifiers cannot silently change grip under any weather label',()=>{
  const compound=createTireDefinition('dirt').compound;
  compound.weatherGrip={clear:0.4,rain:0.6,storm:1.4,snow:0.2};
  const compoundByWheel=Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,compound]));
  for(const surfaceId of Object.keys(conditions)) {
    const expected=tireModel.getWheelGripForSurface({compound,surfaceId});
    const expectedSetup=tireModel.getSetupGripMultiplier({compoundByWheel,surfaceId});
    for(const weather of ['clear','rain','storm','snow']){
      assert.equal(tireModel.getWheelGripForSurface({compound,surfaceId,weather}),expected);
      assert.equal(tireModel.getSetupGripMultiplier({compoundByWheel,surfaceId,weather}),expectedSetup);
    }
  }
});

test('accumulated wet snow blends smoothly to slush on any underlying ground',()=>{
  const compound=createTireDefinition().compound;compound.surfaceGrip.snow=0.8;compound.surfaceGrip.slush=0.4;
  for(const baseSurfaceId of ['asphalt','dirt','gravel','snow']){
    const grip=moistureDepthMm=>resolveCompoundSurfaceGrip(compound,{baseSurfaceId,snowDepthMm:35,moistureDepthMm,saturationDepthMm:1});
    assert.ok(Math.abs(grip(0)-0.8)<1e-9);
    assert.ok(Math.abs(grip(0.5)-0.6)<1e-9);
    assert.ok(Math.abs(grip(1)-0.4)<1e-9);
  }
});

test('wheel surface sampling forwards local moisture and snow depths instead of only the weather label',async()=>{
  const {getRaceWheelSurfaceState}=await import('../../src/racing/RaceVehicleSurfaceContact.js');
  const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
  const editor=new RaceEditor({isMobile:false,deviceIsMobile:false},{mode:'car'});
  const tire=createTireDefinition();tire.compound.surfaceGrip.snow=0.8;tire.compound.surfaceGrip.slush=0.4;
  applyTireDefinition(editor.selectedCar,tire);
  const cell={baseSurfaceId:'asphalt',snowDepthMm:35,moistureDepthMm:1,saturationDepthMm:1};
  const sample=()=>getRaceWheelSurfaceState({car:editor.selectedCar,damage:{},positions:{fl:{x:0,z:0}},wheelIds:['fl'],
    trackState:{sample:()=>({cell,effectiveSurfaceId:'snow',effectiveGripMultiplier:1,effectiveGrip:1})},
    surfaceModel:{sampleWorld:()=>({region:'road',baseSurfaceId:'asphalt',surfaceId:'asphalt'})},
    adapter:{getWheelGripForSurface:options=>editor.getRaceWheelGripForSurface(options)}}).gripByWheel.fl;
  const wetSnow=sample();cell.moistureDepthMm=0;
  assert.ok(Math.abs(sample()-wetSnow*2)<1e-9,'dry snow and slush should use their separate saved tire values');
});
