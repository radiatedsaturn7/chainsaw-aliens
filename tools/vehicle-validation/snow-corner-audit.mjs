// Fixed steering demand, speed sweep, then release: measures the handling
// limit without an ideal-line driver or corrective steering hiding the result.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runClimb} from './low-speed-traction-audit.mjs';
const results=[];
const direct=process.argv.includes('--direct');
const recover=process.argv.includes('--recover');
for(const tireName of ['Stock','Snow']) for(const tc of (recover?[false]:[true,false])) for(const entryMph of (recover?[25,35,45]:[15,25,35])) for(const braking of [false,true]) {
 const r=runClimb({carName:'RTG-001',tireName,surfaceGrip:.4,snowMm:25.4,temperatureC:-12,slope:0,tc,seconds:7,initialGear:2,initialSpeedMps:entryMph/2.236936,sampleEverySeconds:.1,
  controlAt:(t,state)=>({...(direct?{steeringInputMode:'simulation-wheel',centerSteeringAngleRad:recover&&t>=3.5?Math.max(-.18,Math.min(.18,Math.atan2(state.bodyLateralSpeedMps,Math.max(.5,state.bodyLongitudinalSpeedMps))-state.yawRateRadps*.12)):t<.5?0:t<3.5?Math.PI/60:Math.max(0,Math.PI/60*(4-t)/.5)}:{}),steering:t<.5?0:t<3.5?.09:Math.max(0,.09*(4-t)/.5),throttle:t<3.5?.12:0,brake:braking&&t>=1.5&&t<2?.35:0,assists:{autoShift:false,tractionControlEnabled:tc,absEnabled:tc,stabilityControlEnabled:tc}})});
 const slip=s=>Math.atan2(Math.abs(s.bodyLateralSpeedMps),Math.max(.1,Math.abs(s.bodyLongitudinalSpeedMps)))*180/Math.PI;
 const turn=r.samples.filter(s=>s.time>=.5&&s.time<=3.5);
 const row={tireName,assists:tc,entryMph,braking,peakBodySlipDeg:Math.max(...r.samples.map(slip)),finalBodySlipDeg:slip(r.samples.at(-1)),peakRollDeg:Math.max(...r.samples.map(s=>Math.abs(s.rollRad)*180/Math.PI)),peakTurnUtilization:Math.max(...turn.flatMap(s=>Object.values(s.wheels).map(w=>Math.hypot(w.forceN,w.lateralForceN)/Math.max(1,w.limitN)))),finalYawRateRadps:r.samples.at(-1).yawRateRadps,finalMph:r.mph,samples:r.samples};
 results.push(row); console.log(JSON.stringify({...row,samples:undefined}));
 assert.ok(Number.isFinite(row.peakBodySlipDeg)&&Number.isFinite(row.peakRollDeg));
}
fs.mkdirSync('artifacts/traction-audit',{recursive:true});
fs.writeFileSync(`artifacts/traction-audit/snow-corner-${recover?'recovery':direct?'direct':'controls'}.json`,JSON.stringify({limitations:['Uniform level snow, no imported corners or road roughness.',direct?'Fixed three-degree road-wheel angle, bypassing the input envelope.':'Fixed normalized steering input through the speed envelope, not the mobile button filter.',recover?'Automated recovery driver aligns wheels with travel and damps yaw, capped at about 10 degrees; not the player input filter.':'Coast recovery is not a measured human countersteering maneuver.'],results},null,2));
