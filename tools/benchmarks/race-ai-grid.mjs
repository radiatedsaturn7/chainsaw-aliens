// Headless AI-update CPU measurement; excludes rendering and player physics.
// Run with node tools/benchmarks/race-ai-grid.mjs. Timings are machine-dependent.
import RaceEditor from '../../src/ui/RaceEditor.js';
import {performance} from 'node:perf_hooks';
for(const count of [0,2,11]){
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}});
 e.selectedRace.road.segments=[{length:1200,curve:0,elevation:0,surface:'asphalt',roadWidthM:10,hazardIds:[]}];e.selectedRace.road.nodes=[];e.selectedRace.hazards=[];e.selectedRace.scenery=[];
 e.setRaceAiCount(count);e.startPlaytest(e.selectedCar.id,{hydrateCars:false});e.playtestSession.countdownRemainingMs=0;
 let tuningCalls=0;const getTuning=e.getRaceCarTuning.bind(e);e.getRaceCarTuning=(...args)=>{tuningCalls++;return getTuning(...args)};
 for(let frame=0;frame<20;frame++)e.updateRaceAiDrivers(1/60);
 tuningCalls=0;const times=[];
 for(let frame=0;frame<60;frame++){const t=performance.now();e.updateRaceAiDrivers(1/60);times.push(performance.now()-t)}
 times.sort((a,b)=>a-b);console.log(JSON.stringify({count,medianMs:times[30],p95Ms:times[57],tuningCalls}));
}
