// Bounded geometric curvature optimization, inspired by TORCS/K1999 and the
// minimum-curvature + speed-profile approach of Heilmeier et al. (2019).
// This is our finite-difference coordinate solver, not copied solver code.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function signedPathCurvature(a,b,c) {
  const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-b.x,vz=c.z-b.z;
  const denominator=Math.hypot(ux,uz)*Math.hypot(vx,vz)*Math.hypot(c.x-a.x,c.z-a.z);
  return denominator>1e-8?2*(uz*vx-ux*vz)/denominator:0;
}

export function buildRaceRacingLine(poses,halfWidths,{circuit=false,step=4,vehicleWidth=2.2,margin=1.1,obstacles=[]}={}) {
  if(poses.length<4||poses.length>20001)return null;
  const count=poses.length,n=circuit?count-1:count;
  const centers=poses.map(p=>({x:Number(p.x)||0,z:Number(p.z??p.y)||0,yaw:Number(p.yaw)||0,elevation:Number(p.elevation)||0,segment:p.segment}));
  // An unclosed circuit / inconsistent injected heading cannot define a safe
  // swept corridor. Keep the existing center-line planner for those cases.
  if(circuit&&Math.hypot(centers[0].x-centers.at(-1).x,centers[0].z-centers.at(-1).z)>step*2)return null;
  let mismatch=0;
  for(let i=0;i<n-1;i++){
    const a=centers[i],b=centers[i+1];
    if(Math.hypot(b.x-a.x,b.z-a.z)<.05||Math.abs(delta(Math.atan2(b.x-a.x,b.z-a.z),a.yaw))>.8)mismatch++;
  }
  if(mismatch>n*.1)return null;
  const offsets=new Float64Array(count),lower=new Float64Array(count),upper=new Float64Array(count);
  const normals=centers.map(p=>({x:Math.cos(p.yaw),z:-Math.sin(p.yaw)}));
  for(let i=0;i<count;i++){
    const room=Math.max(0,halfWidths[i]-vehicleWidth/2-margin);
    lower[i]=-room;upper[i]=room;
  }
  // Constrain the cutting corridor around static roadside obstacles. The full
  // traffic/collision planner remains responsible for moving or blocked lanes.
  for(const obstacle of obstacles){
    for(let i=0;i<n;i++){
      const p=centers[i],dx=obstacle.x-p.x,dz=obstacle.z-p.z;
      if(Math.abs(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))>obstacle.radius+3)continue;
      const lateral=dx*normals[i].x+dz*normals[i].z;
      const clearance=obstacle.radius+vehicleWidth/2+margin;
      if(lateral>=0)upper[i]=Math.max(lower[i],Math.min(upper[i],lateral-clearance));
      else lower[i]=Math.min(upper[i],Math.max(lower[i],lateral+clearance));
    }
  }
  if(!circuit){lower[0]=upper[0]=0;lower[n-1]=upper[n-1]=0;}
  for(let i=0;i<n;i++)offsets[i]=clamp(0,lower[i],upper[i]);
  const point=i=>({x:centers[i].x+normals[i].x*offsets[i],z:centers[i].z+normals[i].z*offsets[i]});
  const strides=[8,4,2,1].filter(s=>n>2*s+1);
  for(const stride of strides){
    const indices=[];for(let i=0;i<n;i+=stride)indices.push(i);
    if(!circuit&&indices.at(-1)!==n-1)indices.push(n-1);
    const m=indices.length;
    const at=j=>indices[circuit?(j%m+m)%m:clamp(j,0,m-1)];
    const cost=j=>{
      let cost=0;
      for(let k=j-1;k<=j+1;k++){
        if(!circuit&&(k<=0||k>=m-1))continue;
        const a=point(at(k-1)),b=point(at(k)),c=point(at(k+1));
        const ds=(Math.hypot(b.x-a.x,b.z-a.z)+Math.hypot(c.x-b.x,c.z-b.z))*.5;
        const curvature=signedPathCurvature(a,b,c);
        cost+=curvature*curvature*ds;
      }
      // Very small distance term resolves equivalent-curvature choices.
      if(circuit||j>0){const a=point(at(j-1)),b=point(at(j));cost+=.000002*Math.hypot(b.x-a.x,b.z-a.z);}
      if(circuit||j<m-1){const a=point(at(j)),b=point(at(j+1));cost+=.000002*Math.hypot(b.x-a.x,b.z-a.z);}
      return cost;
    };
    const iterations=n>8192?30:80;
    for(let pass=0;pass<iterations;pass++){
      let maxChange=0;
      for(let q=0;q<m;q++){
        const j=pass%2?m-1-q:q,i=at(j);
        if(upper[i]-lower[i]<.001)continue;
        const old=offsets[i],eps=.2,base=cost(j);
        offsets[i]=old+eps;const plus=cost(j);
        offsets[i]=old-eps;const minus=cost(j);offsets[i]=old;
        const gradient=(plus-minus)/(2*eps),hessian=(plus+minus-2*base)/(eps*eps);
        const move=hessian>1e-10?clamp(-gradient/hessian,-1.5,1.5):-Math.sign(gradient)*.5;
        for(let backtrack=0;backtrack<5;backtrack++){
          offsets[i]=clamp(old+move/2**backtrack,lower[i],upper[i]);
          if(cost(j)<=base+1e-13)break;
          offsets[i]=old;
        }
        maxChange=Math.max(maxChange,Math.abs(offsets[i]-old));
      }
      if(maxChange<.001)break;
    }
    // Refine the coarse solution along the road normals, never along a chord
    // across the infield. Every finer station retains its own width constraint.
    for(let j=0;j<(circuit?m:m-1);j++){
      const a=indices[j],b=j+1<m?indices[j+1]:indices[0]+n;
      for(let raw=a+1;raw<b;raw++){
        const i=raw%n,t=(raw-a)/(b-a);
        offsets[i]=clamp(offsets[a]*(1-t)+offsets[b%n]*t,lower[i],upper[i]);
      }
    }
  }
  if(circuit){offsets[count-1]=offsets[0];lower[count-1]=lower[0];upper[count-1]=upper[0];}
  const points=centers.map((p,i)=>({...p,...point(i),offset:offsets[i]}));
  const index=i=>circuit?(i%n+n)%n:clamp(i,0,n-1);
  const curvature=new Float64Array(count),segmentLength=new Float64Array(count);
  for(let i=0;i<n;i++){
    const previous=points[index(i-1)],next=points[index(i+1)];
    points[i].yaw=Math.atan2(next.x-previous.x,next.z-previous.z);
    curvature[i]=Math.abs(signedPathCurvature(previous,points[i],next));
    segmentLength[i]=Math.max(.05,Math.hypot(next.x-points[i].x,next.z-points[i].z));
  }
  if(circuit){points[count-1]={...points[0]};curvature[count-1]=curvature[0];segmentLength[count-1]=segmentLength[0];}
  else {curvature[0]=curvature[1];curvature[n-1]=curvature[n-2];segmentLength[n-1]=segmentLength[n-2];}
  return {points,centers,offsets,lower,upper,curvature,segmentLength,vehicleWidth,margin};
}

export function sampleRaceRacingLine(plan,distance) {
  if(!plan?.racingLine)return null;
  const d=plan.circuit?(distance%plan.length+plan.length)%plan.length:clamp(distance,0,plan.length);
  const i=Math.min(plan.count-2,Math.floor(d/plan.step)),t=clamp((d-i*plan.step)/plan.step,0,1);
  const line=plan.racingLine,a=line.points[i],b=line.points[i+1],ca=line.centers[i],cb=line.centers[i+1];
  const mix=(a,b)=>a+(b-a)*t;
  return {x:mix(a.x,b.x),z:mix(a.z,b.z),elevation:mix(a.elevation,b.elevation),yaw:a.yaw+delta(b.yaw,a.yaw)*t,
    offset:mix(a.offset,b.offset),centerX:mix(ca.x,cb.x),centerZ:mix(ca.z,cb.z),roadYaw:ca.yaw+delta(cb.yaw,ca.yaw)*t,
    halfWidth:mix(plan.halfWidth[i],plan.halfWidth[i+1]),segment:a.segment};
}
