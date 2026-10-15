import {rotateVectorByQuaternion} from '../racing/simulation/RigidBodyMath.js';
// External item force is evaluated by the authoritative runner, including workers.
// A multiplier above one adds thrust; below one adds drag without reversing a car.
export function addItemVehicleForce(force,state,controls,massKg){
  const multiplier=Math.max(0.1,Math.min(4,Number(controls.itemSpeedMultiplier)||1));
  if(multiplier===1)return force;
  if(multiplier>1){
    const forward=rotateVectorByQuaternion({x:0,y:0,z:1},state.orientation);
    const acceleration=(multiplier-1)*8;
    force.x+=forward.x*massKg*acceleration;force.z+=forward.z*massKg*acceleration;
  }else{
    force.x-=(Number(state.velocity?.x)||0)*massKg*(1-multiplier)*2;
    force.z-=(Number(state.velocity?.z)||0)*massKg*(1-multiplier)*2;
  }
  return force;
}
