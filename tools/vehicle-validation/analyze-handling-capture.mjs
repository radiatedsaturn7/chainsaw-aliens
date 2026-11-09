// Estimates planar tire yaw moments from exported wheel-local forces. This is
// not a full replay: road normals, exact force application points, aligning
// moments, body collisions and unsprung state are absent from these captures.
import fs from 'node:fs';
const path=process.argv[2];
if(!path)throw Error('Usage: node tools/vehicle-validation/analyze-handling-capture.mjs capture.json');
const capture=JSON.parse(fs.readFileSync(path));
const config=capture.metadata.handlingSetup.config;
const rows=capture.frames.filter(f=>f.handling?.state).map(f=>{
 const {state:s,inputs:i,distanceM}=f.handling;
 const wheels=Object.entries(s.wheels).map(([id,w])=>{
  const front=id[0]==='f',left=id[1]==='l';
  const x=(left?-1:1)*(front?config.frontTrackWidthM:config.rearTrackWidthM)/2;
  const z=front?config.frontAxleDistanceFromCgM:-config.rearAxleDistanceFromCgM;
  const angle=w.steeringAngleRad;
  const lateral=w.lateralForceN*Math.cos(angle)+w.longitudinalForceN*Math.sin(angle);
  const longitudinal=w.longitudinalForceN*Math.cos(angle)-w.lateralForceN*Math.sin(angle);
  return {id,loadN:w.normalLoadN,slipAngleDeg:w.rawSlipAngleRad*180/Math.PI,steeringDeg:angle*180/Math.PI,
   corneringMomentNm:(z*Math.cos(angle)+x*Math.sin(angle))*w.lateralForceN,
   longitudinalMomentNm:(z*Math.sin(angle)-x*Math.cos(angle))*w.longitudinalForceN,
   planarYawMomentNm:z*lateral-x*longitudinal};
 });
 const esc=s.stability||{};
 return {timeSeconds:f.atMs/1000,distanceM,speedMph:s.groundSpeedMps*2.236936,
  slipDeg:Math.atan2(s.bodyLateralSpeedMps,Math.max(.1,Math.abs(s.bodyLongitudinalSpeedMps)))*180/Math.PI,
  yawRate:s.yawRateRadps,intent:i.analogSteeringIntent,filteredSteer:i.steeringWheel,brake:i.brakeAxis,throttle:i.throttleAxis,
  wheels,estimatedTireYawMomentNm:wheels.reduce((sum,w)=>sum+w.planarYawMomentNm,0),
  corneringMomentNm:wheels.reduce((sum,w)=>sum+w.corneringMomentNm,0),
  longitudinalMomentNm:wheels.reduce((sum,w)=>sum+w.longitudinalMomentNm,0),
  escWheel:esc.stabilityBrakeWheelId,escTorqueNm:esc.stabilityBrakeTorqueNm,escYawError:esc.yawError};
});
console.log(JSON.stringify({source:path,approximation:'Planar tire-force moments only; excludes surface-normal, aligning, collision and other body moments. Longitudinal moment includes all tire forces, not isolated ESC intervention.',rows},null,2));
