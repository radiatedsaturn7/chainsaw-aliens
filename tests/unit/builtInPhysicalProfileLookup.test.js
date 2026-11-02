import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createBuiltInRaceCars,getBuiltInRacePhysicalProfile} from '../../src/racing/raceData.js';

test('direct profile lookup preserves canonical identity and original reference ownership',()=>{
 const cars=createBuiltInRaceCars();
 for(const id of [...cars.map(c=>c.id),'wrx-2022-automatic','unknown',null,undefined]){
  const expected=cars.find(c=>c.id===id)?.tuning?.physicalVehicleProfile||null;
  assert.equal(getBuiltInRacePhysicalProfile(id),expected);
 }
});

test('resolved tuning exactly matches previous document-building fallback after live edits',async()=>{
 const hook=registerHooks({load(url,context,next){
  const result=next(url,context);
  if(!url.endsWith('/RaceEditor.js?profileLookupBaseline'))return result;
  const source=String(result.source);
  const marker='getBuiltInRacePhysicalProfile(car?.id)';
  assert.equal(source.split(marker).length,2);
  return {...result,source:source.replace(marker,"createBuiltInRaceCars().find(candidate=>candidate.id===car?.id)?.tuning?.physicalVehicleProfile || null")};
 }});
 let Baseline;
 try{Baseline=(await import('../../src/ui/RaceEditor.js?profileLookupBaseline')).default;}finally{hook.deregister();}
 const actual=new RaceEditor({}),expected=new Baseline({});
 const cars=[...createBuiltInRaceCars(),{id:'custom',tuning:{powerHp:190},dimensions:{}}];
 for(const car of cars){
  for(const transmissionType of ['automatic','manual']){
   for(const change of [()=>{},()=>{delete car.tuning.physicalVehicleProfile;},()=>{car.physicalVehicleProfile={massKg:1337};},()=>{car.tuning.physicalVehicleProfile={massKg:1456};},()=>{car.tuning.powerHp=402;car.tuning.gearRatios=[3,2,1];}]){
    change();
    assert.deepEqual(actual.getRaceCarTuning(car,{transmissionType}),expected.getRaceCarTuning(car,{transmissionType}));
   }
  }
 }
});
