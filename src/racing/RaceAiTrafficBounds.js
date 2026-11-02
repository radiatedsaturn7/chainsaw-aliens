// Conservative swept rectangles for deciding when an opponent needs the full
// collision solver. This is broadphase selection, not collision response.
function sweptBox(car, endX, endZ, endYaw, dt, clearance=.15) {
  const yaw=Number(car.carYaw || 0), config=car.vehicleDynamicsRunner?.config || {};
  const halfWidth=Number(config.bodyWidthM || 1.8)/2, halfLength=Number(config.bodyLengthM || 4.5)/2;
  const dx=endX-car.worldX,dz=endZ-car.worldZ;
  const right={x:Math.cos(yaw),z:-Math.sin(yaw)},forward={x:Math.sin(yaw),z:Math.cos(yaw)};
  const rotation=Math.abs(Math.atan2(Math.sin(endYaw-yaw),Math.cos(endYaw-yaw)));
  const padding=clearance+Math.hypot(halfWidth,halfLength)*rotation;
  return {x:(car.worldX+endX)/2,z:(car.worldZ+endZ)/2,right,forward,
    halfWidth:halfWidth+Math.abs(dx*right.x+dz*right.z)/2+padding,
    halfLength:halfLength+Math.abs(dx*forward.x+dz*forward.z)/2+padding};
}
function radius(box,axis){
 return box.halfWidth*Math.abs(box.right.x*axis.x+box.right.z*axis.z)
   +box.halfLength*Math.abs(box.forward.x*axis.x+box.forward.z*axis.z);
}
// An L1 upper bound for the swept rectangle's radius about its starting
// position. Includes translation and the rectangle's rotation padding.
function sweptRadiusBound(car, dx, dz, rotation) {
 const config=car.vehicleDynamicsRunner?.config || {};
 const width=Number(config.bodyWidthM || 1.8),length=Number(config.bodyLengthM || 4.5);
 if(!(width>0 && length>0))return Infinity;
 const radius=(width+length)/2;
 return radius+Math.SQRT2*(.15+radius*Math.abs(rotation))+Math.abs(dx)+Math.abs(dz);
}
export function createRaceAiTrafficProbe(ai,x,z,yaw,dt,{clearance=.15}={}){
 const bound=sweptRadiusBound(ai,x-ai.worldX,z-ai.worldZ,yaw-Number(ai.carYaw||0));
 let a=null;
 return other=>{
  if(other===ai || !Number.isFinite(other.worldX) || !Number.isFinite(other.worldZ))return false;
  const otherYaw=Number(other.carYaw || 0),otherState=other.vehicleDynamicsRunner?.state || {};
  const vx=Number(otherState.velocity?.x ?? Math.sin(otherYaw)*Number(other.speedMps||0));
  const vz=Number(otherState.velocity?.z ?? Math.cos(otherYaw)*Number(other.speedMps||0));
  const rotation=Number(otherState.angularVelocityWorld?.y || 0)*dt;
  const otherEndYaw=otherYaw+rotation;
  const reach=bound+sweptRadiusBound(other,vx*dt,vz*dt,rotation);
  if(Number.isFinite(reach) && (Math.abs(other.worldX-ai.worldX)>reach
    || Math.abs(other.worldZ-ai.worldZ)>reach))return false;
  a ||= sweptBox(ai,x,z,yaw,dt,clearance);
  const b=sweptBox(other,other.worldX+vx*dt,other.worldZ+vz*dt,otherEndYaw,dt,clearance);
  for(const axis of [a.right,a.forward,b.right,b.forward]){
    if(Math.abs((b.x-a.x)*axis.x+(b.z-a.z)*axis.z)>radius(a,axis)+radius(b,axis))return false;
  }
  return true;
 };
}
export function raceAiTrafficNeedsDetailedPhysics(ai,other,x,z,yaw,dt){
 return createRaceAiTrafficProbe(ai,x,z,yaw,dt)(other);
}
