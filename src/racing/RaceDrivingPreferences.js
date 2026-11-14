import {DIGITAL_THROTTLE_MODES,DRIVING_INTENT_STYLES} from './DigitalThrottle.js';
// Driver choices are independent of the gearbox installed in the car.
const fields={
 transmissionMode:['raceTransmission','automatic',['automatic','manual']],
 absEnabled:['raceAbs',true],tractionControlEnabled:['raceTractionControl',true],
 launchControlEnabled:['raceLaunchControl',false],
 digitalThrottleMode:['raceDigitalThrottle','off',DIGITAL_THROTTLE_MODES],
 cameraView:['raceCameraView','third-person',['third-person','first-person']],
 telemetryVisible:['raceTelemetry',false],debugHudVisible:['raceDebugHud',false],
 physicsSurfaceVisible:['racePhysicsSurface',false],physicsVehicleRigVisible:['racePhysicsVehicleRig',false],
 physicsPerformanceVisible:['racePhysicsPerformance',false],drivingIntentVisible:['raceDrivingIntentVisible',false],
 drivingIntentStyle:['raceDrivingIntentStyle','rally',DRIVING_INTENT_STYLES]
};
export function restoreRaceDrivingPreferences(input,progress={}){
 for(const [field,[key,fallback,options]] of Object.entries(fields)){
  const value=progress[key];input[field]=options?options.includes(value)?value:fallback:typeof value==='boolean'?value:fallback;
 }
 input.autoShift=input.transmissionMode!=='manual';
}
export function captureRaceDrivingPreferences(input){
 return Object.fromEntries(Object.entries(fields).map(([field,[key,fallback]])=>[key,input[field]??fallback]));
}
