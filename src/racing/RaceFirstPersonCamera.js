import {normalizeQuaternion,quaternionFromEuler,rotateVectorByQuaternion} from './simulation/RigidBodyMath.js';

// Use the same interpolated body pose as the vehicle renderer. Head look is
// relative to the cabin, so it continues to behave correctly during a rollover.
export function firstPersonCameraFrame(pose={}, {orientation=null,lookAngle=0,eyeOffset={x:0,y:.8,z:.2}}={}){
 const q=normalizeQuaternion(orientation||quaternionFromEuler({yaw:pose.yaw||0,pitch:pose.pitchRad||0,roll:pose.rollRad||0}));
 const offset=rotateVectorByQuaternion(eyeOffset,q);
 return {
  position:{x:Number(pose.x||0)+offset.x,y:Number(pose.y||0)+offset.y,z:Number(pose.z||0)+offset.z},
  forward:rotateVectorByQuaternion({x:Math.sin(lookAngle),y:0,z:Math.cos(lookAngle)},q),
  right:rotateVectorByQuaternion({x:-Math.cos(lookAngle),y:0,z:Math.sin(lookAngle)},q),
  up:rotateVectorByQuaternion({x:0,y:1,z:0},q)
 };
}
export function applyFirstPersonCameraFrame(camera,frame){
 const {position:p,forward:f,up:u}=frame;
 camera.position.set(p.x,p.y,p.z);camera.up.set(u.x,u.y,u.z);
 camera.lookAt(p.x+f.x,p.y+f.y,p.z+f.z);
}
export function firstPersonCameraSpace(point,frame){
 const p={x:point.x-frame.position.x,y:point.y-frame.position.y,z:point.z-frame.position.z};
 const dot=v=>p.x*v.x+p.y*v.y+p.z*v.z;
 return {x:dot(frame.right),y:dot(frame.up),z:dot(frame.forward)};
}
