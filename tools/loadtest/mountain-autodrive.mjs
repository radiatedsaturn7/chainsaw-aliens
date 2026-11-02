import {planRaceAiDriving} from '../../src/racing/RaceAiDriving.js';

// Drives through ordinary steering/pedal input; never changes the player's pose.
export function driveMountainBenchmark(editor, car, maximumSpeedMps=14) {
  const session=editor.playtestSession;
  const tuning=editor.getRaceCarTuning(car);
  const projection=editor.getRaceRouteProjectionForWorldPoint({x:session.worldX,z:session.worldZ,
    heightM:session.vehicleDynamicsRunner?.state?.position?.y});
  const driver={...session,projectedDistance:projection.distance,lineOffset:0};
  const plan=planRaceAiDriving(editor,driver,tuning,{grip:.5,profile:{corner:.7,brake:.8},topSpeedMps:maximumSpeedMps});
  const input=editor.raceInput;
  Object.assign(input,{syntheticAnalogSteering:true,analogSteeringActive:true,
    analogThrottleActive:true,analogBrakeActive:true,keyboardThrottle:false,keyboardBrake:false,
    wheelSteeringActive:false,binarySteer:0,autoShift:true});
  let lo=-1,hi=1;
  for(let i=0;i<16;i++){
    const mid=(lo+hi)/2;
    const angle=editor.getRaceResolvedCenterSteeringAngle(mid,Math.abs(session.speedMps||0),{
      wheelbaseM:tuning.wheelbaseM,availableLateralG:.95,handlingPreset:tuning.handlingPreset||'sport',maxPhysicalAngleRad:.52});
    if(angle < -plan.steeringAngleRad)lo=mid;else hi=mid;
  }
  input.analogSteeringIntent=(lo+hi)/2;
  const error=plan.targetSpeedMps-Math.max(0,session.speedMps||0);
  input.rawThrottleAxis=Math.max(0,Math.min(1,error/4));
  input.rawBrakeAxis=error<-.5?Math.min(.8,-error/5):0;
  return {distance:projection.distance,lateral:projection.lateral,targetSpeedMps:plan.targetSpeedMps};
}
