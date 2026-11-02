import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
const rows=[];let expected;
for(let round=0;round<6;round++) for(const full of round%2?[false,true]:[true,false]) {
 const s=new TrackState();s.debugFullWeatherClamp=full;
 const cells=Array.from({length:100},(_,i)=>s.getOrCreateCell({x:i,z:0},{coordinates:true}));
 const f={type:'storm',precipitationRateMmPerS:.014,ambientTemperatureC:12,sunIntensity:.1,
  windIntensity:.8,humidity:.9};
 const start=performance.now();
 for(let step=1;step<=500;step++)for(const cell of cells)s.applyWeatherToCell(cell,f,.1,step);
 const ms=performance.now()-start;
 const result=JSON.stringify({cells,totals:s.totals});
 if(expected===undefined)expected=result;else assert.equal(result,expected);
 rows.push({round,full,ms,cellSteps:50000});
}
fs.writeFileSync('artifacts/mountain-stress/weather-normalization.json',JSON.stringify({identical:true,rows},null,2));
console.log(JSON.stringify(rows));
