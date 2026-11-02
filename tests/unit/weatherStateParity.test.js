import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {referenceWeather} from './fixtures/weatherStateReference.js';

test('weather overrides retain exact values without copying unrelated race data',()=>{
 const e=new RaceEditor({});
 const values=[undefined,null,0,.2,1,-1,2,NaN,'0.7'];
 for(const weather of ['clear','rain','storm','snow','invalid'])
 for(const weatherIntensity of values)
 for(const triggerWeather of [undefined,'snow','storm'])
 for(const debugEnvironment of [undefined,{}, {weather:'rain'}, {weather:'storm',weatherIntensity:1}, ...values.map(weatherIntensity=>({weatherIntensity})),{autoVisibility:true}])
 for(const elapsedMs of [0,1000,70000,300000]) {
  const race={weather,weatherIntensity,weatherVisibilityM:250};
  const session={triggerWeather,debugEnvironment,elapsedMs};
  assert.deepEqual(e.getRaceWeatherState(race,session),referenceWeather.getRaceWeatherState.call(e,race,session));
 }
 const race={weather:'rain',weatherIntensity:.5};
 Object.defineProperty(race,'scenery',{enumerable:true,get(){throw Error('Weather must not read scenery');}});
 assert.equal(e.getRaceWeatherState(race,{debugEnvironment:{weather:'storm',weatherIntensity:1}}).id,'storm');
 assert.equal(e.getRaceWeatherState(race,{triggerWeather:'snow'}).id,'snow');
});

test('scoped weather lookup shares calculations but never shares mutable results',()=>{
 const e=new RaceEditor({});
 const race={weather:'storm',weatherIntensity:.7,weatherVisibilityM:250};
 const session={elapsedMs:30000,debugEnvironment:{weather:'rain',weatherIntensity:.5}};
 let queries=0;const original=e.getRaceWeatherVisibilityProfile;
 e.getRaceWeatherVisibilityProfile=function(...args){queries++;return original.apply(this,args);};
 e.withRaceGeometryReadCache(()=>{
  const expected=referenceWeather.getRaceWeatherState.call(e,race,session);
  queries=0;
  for(let i=0;i<1000;i++){
   const result=e.getRaceWeatherState(race,session);
   assert.deepEqual(result,expected);result.effectiveIntensity=99;
  }
  assert.equal(queries,1);
  for(const edit of [()=>session.elapsedMs++,()=>race.weather='snow',()=>race.weatherIntensity=.1,
   ()=>race.weatherVisibilityM=50,()=>session.triggerWeather='snow',()=>session.debugEnvironment.weather='snow',
   ()=>session.debugEnvironment.weatherIntensity=.8,()=>session.debugEnvironment.autoVisibility=true,
   ()=>delete session.debugEnvironment]){
   edit();
   assert.deepEqual(e.getRaceWeatherState(race,session),referenceWeather.getRaceWeatherState.call(e,race,session));
  }
 });
 const before=queries;e.getRaceWeatherState(race,session);e.getRaceWeatherState(race,session);
 assert.equal(queries,before+2,'outside read scopes, calculate afresh');
});
