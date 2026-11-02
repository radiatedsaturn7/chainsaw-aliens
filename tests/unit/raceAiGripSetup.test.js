import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('one normalized tire setup preserves each wheel grip across weather, terrain and damage',()=>{
 const e=new RaceEditor({}),car=e.selectedCar;
 car.setup.tirePressurePsi={fl:21,fr:32,rl:40,rr:28};
 const setup=e.getRaceCarSetup(car);
 const normalizedSetup={...setup,tireSize:e.normalizeCarTireSize(setup.tireSize||{})};
 const before=structuredClone(normalizedSetup);
 for(const wheelId of ['fl','fr','rl','rr'])for(const surfaceId of ['asphalt','dirt','snow'])for(const weather of ['clear','storm','snow'])for(const temperatureF of [20,70,150]){
  const options={car,wheelId,surfaceId,weather,temperatureF,damage:{tires:{fl:20,fr:30,rl:40,rr:0}}};
  assert.equal(e.getRaceWheelGripForSurface({...options,normalizedSetup}),e.getRaceWheelGripForSurface(options));
 }
 assert.deepEqual(normalizedSetup,before,'grip calculations must not mutate shared setup');
 let normalizations=0;
 e.normalizeCarTireSize=()=>{normalizations++;throw Error('unexpected repeated normalization');};
 for(const wheelId of ['fl','fr','rl','rr'])e.getRaceWheelGripForSurface({car,wheelId,normalizedSetup});
 assert.equal(normalizations,0);
});
