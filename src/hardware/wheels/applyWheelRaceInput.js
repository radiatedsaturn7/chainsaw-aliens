// Wheel-specific bindings never rewrite keyboard/controller/touch preferences.
export function applyWheelRaceInput(editor) {
 const input=editor.raceInput,frame=editor.game?.wheelService?.frame;
 input.wheelSteeringActive=false;
 if(!frame){if(input.wheelHandbrakeActive){input.handbrake=false;input.wheelHandbrakeActive=false;}if(input.wheelClutchActive)input.clutchAxis=0;input.wheelClutchActive=false;return;}
 if(input.activeDpadPointerId==null&&!input.keyboardSteer){
  input.analogSteeringActive=true;input.analogSteeringIntent=frame.steer;
  input.analogSteeringCenteredMs=0;input.wheelSteeringActive=true;
 }
 input.rawThrottleAxis=Math.max(input.rawThrottleAxis||0,frame.throttle);
 input.rawBrakeAxis=Math.max(input.rawBrakeAxis||0,frame.brake);
 input.analogThrottleActive=true;input.analogBrakeActive=true;
 input.clutchAxis=frame.clutch;input.wheelClutchActive=true;
 if(frame.held.handbrake){input.handbrake=true;input.wheelHandbrakeActive=true;}
 else if(input.wheelHandbrakeActive){input.handbrake=false;input.wheelHandbrakeActive=false;}
 if(frame.pressed.upshift)editor.shiftRaceGear(1);
 if(frame.pressed.downshift)editor.shiftRaceGear(-1);
 if(frame.pressed.camera)editor.toggleRaceCameraView();
 if(frame.pressed.pause)editor.toggleRacePause();
 frame.pressed={};
}
