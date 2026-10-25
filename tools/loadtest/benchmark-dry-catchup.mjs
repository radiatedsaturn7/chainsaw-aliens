import {TrackState} from '../../src/racing/trackState/TrackState.js';
const results=[];
for(const optimized of [false,true]){
 const state=new TrackState({eventHistoryLimit:Infinity,sampleBaseSurface:()=>({baseSurfaceId:'asphalt',surfaceTemperatureC:20,sunExposure:.8,windExposure:.5})});
 if(!optimized)state.catchUpConstantDryCellWeather=()=>false;
 for(let i=0;i<1200;i++)state.advance(.1,{type:'clear',sunIntensity:.8,windIntensity:.2});
 for(let i=0;i<1000;i++)state.getOrCreateCell({x:i,z:0},{throughStep:0});
 const start=performance.now();for(let i=0;i<1000;i++)state.sample({x:i,z:0});
 results.push({optimized,elapsedMs:performance.now()-start,checksum:state.getChecksum()});
}
console.log(JSON.stringify(results));
if(results[0].checksum!==results[1].checksum)throw Error('Dry catch-up changed simulation state');
