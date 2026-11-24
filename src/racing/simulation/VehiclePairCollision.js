// Swept oriented chassis rectangles, with vertical separation for bridges.
// Queues equal/opposite impulses into the existing rigid-body integrator.
// Both the local race and worker authority use this same pair response.
const dot=(a,b)=>a.x*b.x+a.z*b.z;
function body(runner){
 const s=runner.state,c=runner.config,p=s?.position;
 if(!p || ![p.x,p.y,p.z].every(Number.isFinite))return null;
 const yaw=Number(s.yawRad)||0;
 return {runner,p,v:s.velocity||{x:0,y:0,z:0},omega:Number(s.angularVelocityWorld?.y)||0,
  r:{x:Math.cos(yaw),z:-Math.sin(yaw)},f:{x:Math.sin(yaw),z:Math.cos(yaw)},
  w:(Number(c.bodyWidthM)||1.8)/2,l:(Number(c.bodyLengthM)||4.5)/2,
  h:(Number(c.bodyHeightM)||1.5)/2,m:Math.max(1,Number(c.massKg)||1400),
  inertia:Math.max(1,Number(c.yawInertiaKgM2)||2000)};
}
const radius=(b,n)=>b.w*Math.abs(dot(b.r,n))+b.l*Math.abs(dot(b.f,n));
export function queueVehiclePairCollision(left,right,seconds=1/60){
 if(!left?.queueCollisionImpulse || !right?.queueCollisionImpulse || left===right)return false;
 const a=body(left),b=body(right);if(!a||!b)return false;
 return queueBodyPairCollision(a,b,seconds);
}
function queueBodyPairCollision(a,b,seconds){
 const left=a.runner,right=b.runner;
 const dt=Math.min(.1,Math.max(0,Number(seconds)||0));
 const dx=b.p.x-a.p.x,dz=b.p.z-a.p.z,vx=b.v.x-a.v.x,vz=b.v.z-a.v.z;
 if(Math.hypot(dx,dz)>Math.hypot(a.w,a.l)+Math.hypot(b.w,b.l)+Math.hypot(vx,vz)*dt+.05)return false;
 const d={x:dx,z:dz},v={x:vx,z:vz};
 let enter=0,leave=dt,normal=null,minDepth=Infinity,overlapNormal=null;
 const axes=[a.r,a.f,b.r,b.f,{x:0,z:0,y:1}];
 for(const axis of axes){
  const vertical=axis.y===1;
  const distance=vertical?b.p.y-a.p.y:dot(d,axis);
  const velocity=vertical?(b.v.y||0)-(a.v.y||0):dot(v,axis);
  const extent=vertical?a.h+b.h:radius(a,axis)+radius(b,axis);
  const depth=extent-Math.abs(distance);
  if(!vertical && depth<minDepth){minDepth=depth;overlapNormal={x:axis.x*(distance<0?-1:1),z:axis.z*(distance<0?-1:1)};}
  if(Math.abs(velocity)<1e-8){if(depth<0)return false;continue;}
  const t0=(-extent-distance)/velocity,t1=(extent-distance)/velocity;
  const first=Math.min(t0,t1),last=Math.max(t0,t1);
  if(first>enter){enter=first;normal=vertical?null:{x:axis.x*(distance+velocity*first<0?-1:1),z:axis.z*(distance+velocity*first<0?-1:1)};}
  leave=Math.min(leave,last);
  if(enter>leave || leave<0)return false;
 }
 if(enter>dt)return false;
 const n=enter>0?normal:overlapNormal;if(!n)return false;
 const t={x:-n.z,z:n.x};
 const ca={x:a.p.x+a.v.x*enter,z:a.p.z+a.v.z*enter},cb={x:b.p.x+b.v.x*enter,z:b.p.z+b.v.z*enter};
 const plane=(dot(ca,n)+radius(a,n)+dot(cb,n)-radius(b,n))/2;
 const low=Math.max(dot(ca,t)-radius(a,t),dot(cb,t)-radius(b,t));
 const high=Math.min(dot(ca,t)+radius(a,t),dot(cb,t)+radius(b,t));
 const along=(low+high)/2;
 const point={x:n.x*plane+t.x*along,y:(a.p.y+b.p.y)/2,z:n.z*plane+t.z*along};
 const ra={x:point.x-a.p.x,z:point.z-a.p.z},rb={x:point.x-b.p.x,z:point.z-b.p.z};
 const relative={x:v.x+b.omega*rb.z-a.omega*ra.z,z:v.z-b.omega*rb.x+a.omega*ra.x};
 const effective=axis=>1/a.m+1/b.m+(ra.z*axis.x-ra.x*axis.z)**2/a.inertia+(rb.z*axis.x-rb.x*axis.z)**2/b.inertia;
 const closing=dot(relative,n);
 // Small overlap stabilization; never add a large bounce to an existing overlap.
 const bias=enter===0?Math.min(1,Math.max(0,minDepth-.01)*.2/Math.max(dt,1/120)):0;
 const impulse=Math.max(0,(-Math.min(0,closing)*1.08+bias)/effective(n));
 if(impulse<1e-6)return false;
 const friction=Math.max(-impulse*.25,Math.min(impulse*.25,-dot(relative,t)/effective(t)));
 const j={x:n.x*impulse+t.x*friction,y:0,z:n.z*impulse+t.z*friction};
 left.queueCollisionImpulse({impulseWorldNs:{x:-j.x,y:0,z:-j.z},pointWorld:point,source:'vehicle-pair'});
 right.queueCollisionImpulse({impulseWorldNs:j,pointWorld:point,source:'vehicle-pair'});
 return true;
}
export function queueVehicleFleetCollisions(runners,seconds){
 let contacts=0;
 const bodies=runners.filter(r=>r?.queueCollisionImpulse).map(body).filter(Boolean);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)
  if(bodies[i].runner!==bodies[j].runner && queueBodyPairCollision(bodies[i],bodies[j],seconds))contacts++;
 return contacts;
}
