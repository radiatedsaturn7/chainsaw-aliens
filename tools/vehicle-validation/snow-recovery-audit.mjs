// Diagnostic only: no changes to tire coefficients, controller, or road data.
import fs from 'node:fs';
import {runClimb} from './low-speed-traction-audit.mjs';
import {calculateBrushTireForce} from '../../src/racing/simulation/ContactPatchTireModel.js';
const results=[];
for(const tireName of ['Stock','Snow','Offroad'])for(const tc of [true,false]){
 for(const scenario of ['steady','spin-recover']){
  const result=runClimb({carName:'RTG-001',tireName,surfaceGrip:.4,snowMm:25.4,temperatureC:-12,slope:.18,tc,seconds:10,initialSpeedMps:3.13,throttle:.35,sampleEverySeconds:.5,
   controlAt:t=>({throttle:scenario==='steady'?.35:t<2?1:t<3?0:.35,assists:{autoShift:true,absEnabled:tc,tractionControlEnabled:scenario==='spin-recover'&&t<2?false:tc}})});
  results.push({scenario,...result});console.log(JSON.stringify({tireName,tc,scenario,mph:result.mph,maxSlip:result.maxSlip}));
 }
}
const curves={};for(const name of ['Stock','Snow','Offroad']){
 const {compound}=JSON.parse(fs.readFileSync(`data/server-storage/files/tires/${name}/document.json`));
 curves[name]=[0,.01,.03,.05,.08,.1,.15,.2,.3,.5,1].map(slip=>{
 const force=calculateBrushTireForce({normalLoadN:3500,tire:{compound,widthMm:245,referenceLoadN:3500,treadTemperatureC:-12},material:{baseSurfaceId:'snow',surfaceId:'snow',surfaceGripScale:.4,snowDepthMm:25.4},kinematics:{slipRatio:slip,slipAngleRad:0,longitudinalVelocityMps:3}});
 return {slip,mu:force.gripCoefficient,peakSlip:force.peakLongitudinalSlipRatio,forceN:force.longitudinalForceN,peakForceN:force.combinedSlipLimitN};
 });
}
fs.mkdirSync('artifacts/traction-audit',{recursive:true});
fs.writeFileSync('artifacts/traction-audit/snow-recovery.json',JSON.stringify({limitations:['Uniform straight 18% slope, no road mesh, weather evolution, cornering, or traffic.','Induced spin deliberately disables TC for first two seconds; not a replay of the player recording.'],curves,results},null,2));
