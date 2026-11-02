import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
const rounds=[];
const forcing={type:'storm',precipitationRateMmPerS:.014,ambientTemperatureC:12,humidity:.9,windIntensity:.5};
function build(budget){
 const state=new TrackState({maxWeatherStepsPerStep:budget,eventHistoryLimit:Infinity});
 for(let i=0;i<8192;i++)state.getOrCreateCell({x:i,z:0},{coordinates:true});
 return state;
}
for(let round=0;round<6;round++){
 const entries=round%2?[['budget',2048],['unlimited',Infinity]]:[['unlimited',Infinity],['budget',2048]];
 const results={};const states={};
 for(const [name,budget]of entries){
  const state=build(budget);states[name]=state;
  const at=performance.now();
  for(let tick=0;tick<240;tick++)state.advance(.1,forcing);
  results[name]={ms:performance.now()-at,backgroundSteps:state.performanceCounters.backgroundWeatherSteps};
 }
 // Compare eventual cell state separately; foreground reads are intentionally
 // outside the background timing and must preserve the exact recurrence.
 for(let i=0;i<8192;i++)assert.deepEqual(states.budget.sample({x:i+.5,z:.5}),states.unlimited.sample({x:i+.5,z:.5}));
 rounds.push(results);
}
const median=name=>rounds.map(x=>x[name].ms).sort((a,b)=>a-b)[3];
const result={method:'Six alternating in-process rounds; 8,192 flat cells, 240 storm ticks. Background scheduling only; foreground catch-up excluded from timing and checked for exact per-cell parity. Not FPS.',rounds,unlimitedMedianMs:median('unlimited'),budgetMedianMs:median('budget')};
fs.writeFileSync('artifacts/mountain-stress/weather-budget-isolated.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
