// Conservative swept rectangles for deciding when an opponent needs the full
// collision solver. This is broadphase selection, not collision response.
function sweptBox(car, endX, endZ, endYaw, dt) {
  const yaw=Number(car.carYaw || 0), config=car.vehicleDynamicsRunner?.config || {};
  const halfWidth=Number(config.bodyWidthM || 1.8)/2, halfLength=Number(config.bodyLengthM || 4.5)/2;
  const dx=endX-car.worldX,dz=endZ-car.worldZ;
  const right={x:Math.cos(yaw),z:-Math.sin(yaw)},forward={x:Math.sin(yaw),z:Math.cos(yaw)};
  const rotation=Math.abs(Math.atan2(Math.sin(endYaw-yaw),Math.cos(endYaw-yaw)));
  const padding=.15+Math.hypot(halfWidth,halfLength)*rotation;
  return {x:(car.worldX+endX)/2,z:(car.worldZ+endZ)/2,right,forward,
    halfWidth:halfWidth+Math.abs(dx*right.x+dz*right.z)/2+padding,
    halfLength:halfLength+Math.abs(dx*forward.x+dz*forward.z)/2+padding};
}
function radius(box,axis){
 return box.halfWidth*Math.abs(box.right.x*axis.x+box.right.z*axis.z)
   +box.halfLength*Math.abs(box.forward.x*axis.x+box.forward.z*axis.z);
}
export function raceAiTrafficNeedsDetailedPhysics(ai,other,x,z,yaw,dt){
 if(other===ai || !Number.isFinite(other.worldX) || !Number.isFinite(other.worldZ))return false;
 const otherYaw=Number(other.carYaw || 0),otherState=other.vehicleDynamicsRunner?.state || {};
 const vx=Number(otherState.velocity?.x ?? Math.sin(otherYaw)*Number(other.speedMps||0));
 const vz=Number(otherState.velocity?.z ?? Math.cos(otherYaw)*Number(other.speedMps||0));
 const otherEndYaw=otherYaw+Number(otherState.angularVelocityWorld?.y || 0)*dt;
 const a=sweptBox(ai,x,z,yaw,dt),b=sweptBox(other,other.worldX+vx*dt,other.worldZ+vz*dt,otherEndYaw,dt);
 for(const axis of [a.right,a.forward,b.right,b.forward]){
   if(Math.abs((b.x-a.x)*axis.x+(b.z-a.z)*axis.z)>radius(a,axis)+radius(b,axis))return false;
 }
 return true;
}
