const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Presentation only. No input, tire, suspension or vehicle state is changed.
export function roadCameraCue(session) {
 const now=Number(session.elapsedMs)||0, previous=session.roadCameraCue;
 const v=Number(session.verticalVelocityMps)||0;
 if(!previous || now<=previous.time || now-previous.time>200 || !session.running || session.airborne || session.edgeResetFadeMs>0){
  if(!previous || now!==previous.time || !session.running)session.roadCameraCue={time:now,velocity:v,value:0};
  return session.running&&!session.airborne&&!session.edgeResetFadeMs&&previous&&now===previous.time?previous.value:0;
 }
 const dt=(now-previous.time)/1000;
 const acceleration=clamp((v-previous.velocity)/dt,-8,8);
 const speed=clamp(Math.abs(session.speedMps||0)/12,0,1);
 const target=clamp((clamp(session.pitchRate||0,-.5,.5)*.008+acceleration*.0003)*speed,-.005,.005);
 previous.value+=(target-previous.value)*(1-Math.exp(-dt*12));
 previous.time=now;previous.velocity=v;
 return previous.value;
}

// Use the existing managed spatial chunks. Never scan the whole race per frame.
export function roadsidePassMix(managed,session,out={left:0,right:0}) {
 const now=Number(session.elapsedMs)||0;
 if(session.running && out.sampleTime!==undefined && now>=out.sampleTime && now-out.sampleTime<40)return out;
 out.sampleTime=now;out.left=out.right=0;
 const speed=Math.abs(session.groundSpeedMps??session.speedMps??0);
 if(!managed||!session.running||speed<7||session.airborne)return out;
 const x=Number(session.worldX)||0,z=Number(session.worldZ)||0,yaw=Number(session.carYaw)||0;
 const c=Math.cos(yaw),s=Math.sin(yaw),cx=Math.floor(x/128),cz=Math.floor(z/128);
 for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++){
  for(const p of managed.chunks.get(`${ix},${iz}`)?.visible||[]){
   if(p.state==='removed'||p.state==='flattened')continue;
   const dx=p.x-x,dz=p.z-z;
   if(Math.abs(dx)>24||Math.abs(dz)>24)continue;
   const ref=p.doodadRef||p.artRef||'';
   if(!/tree|pine|spruce|oak|birch|fence|barrier|guardrail|sign|marker|wall/i.test(ref))continue;
   const along=dx*s+dz*c,lateral=dx*c-dz*s;
   const gap=Math.max(.8,Math.abs(lateral)-Math.min(3,(p.widthM||1)/2));
   if(gap>10||Math.abs(along)>14)continue;
   const gain=.025*clamp((speed-7)/35,0,1)*Math.exp(-along*along/32)*Math.pow(1-gap/11,2);
   const side=lateral<0?'left':'right';out[side]=Math.max(out[side],gain);
  }
 }
 return out;
}
