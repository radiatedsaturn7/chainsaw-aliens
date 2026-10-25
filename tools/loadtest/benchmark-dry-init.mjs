import {TrackState} from '../../src/racing/trackState/TrackState.js';
const results=[];
for(const cached of [false,true]){
 const state=new TrackState({eventHistoryLimit:Infinity,sampleBaseSurface:()=>({baseSurfaceId:'asphalt',surfaceTemperatureC:20,sunExposure:.8,windExposure:.5})});
 if(!cached){state.catchUpNewDryCellWeather=()=>false;state.catchUpConstantDryCellWeather=()=>false;}
 for(let i=0;i<1200;i++)state.advance(.05,{type:'clear',sunIntensity:.8,windIntensity:.2});
 const start=performance.now();
 for(let i=0;i<1000;i++)state.sample({x:i,z:0});
 results.push({cached,elapsedMs:performance.now()-start,cells:state.cells.size,checksum:state.getChecksum()});
}
console.log(JSON.stringify(results));
if(results[0].checksum!==results[1].checksum)throw Error('Optimization changed simulation state');
