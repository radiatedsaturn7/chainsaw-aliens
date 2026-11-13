// Conservative 2D clearance for billboard landmarks with square solid colliders.
// Evaluate every segment, not only the nearest timed-route projection: crossings
// and folded routes must be kept clear too. Heights never waive road clearance.
export function pointSegmentDistance(point,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
 const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/den)):0;
 return Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz);
}
export function landmarkRadius(def){
 // Runtime solid scenery uses width x width boxes, not width/2 cylinders.
 return Math.max(def.widthM/2,Math.SQRT2*def.hitboxWidthM/2);
}
export function roadClearance(point,def,segments){
 if(!segments.length)throw Error('No road segments supplied');
 const radius=landmarkRadius(def);
 return Math.min(...segments.map(s=>pointSegmentDistance(point,s.a,s.b)-s.halfWidth-radius-(s.samplingPaddingM??0)));
}
export function chooseLandmarkPosition(mark,def,{poseAt,segments,scenery=[]},options={}){
 const clearanceM=options.clearanceM??5;
 const offsets=options.distanceOffsets??[0,-15,15,-30,30,-50,50];
 const lateralStart=Math.max(20,Math.min(100,Number(mark.offsetFromRoadM)||0));
 const side=mark.side==='left'?-1:1;
 for(const shift of offsets){
  const distance=Math.max(0,mark.routeDistanceM+shift),pose=poseAt(distance);
  for(let lateral=lateralStart;lateral<=150;lateral+=5){
   const p={x:pose.x-Math.cos(pose.yaw)*lateral*side,z:pose.z+Math.sin(pose.yaw)*lateral*side,yaw:pose.yaw};
   const roadGap=roadClearance(p,def,segments);
   if(roadGap<clearanceM)continue;
   if(scenery.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<landmarkRadius(def)+Math.max(.5,Number(s.widthM)||1)/Math.SQRT2+2))continue;
   return {...p,routeDistanceM:distance,lateralM:lateral*side,roadClearanceM:roadGap};
  }
 }
 throw Error(`No safe position for ${mark.suggestedArtRef}; manual placement required`);
}
export function assertAdditiveRace(before,after,newIds){
 const clean=d=>{const copy=structuredClone(d);copy.scenery=(copy.scenery||[]).filter(s=>!newIds.has(s.id));return copy;};
 if(JSON.stringify(clean(before))!==JSON.stringify(clean(after)))throw Error('Landmark integration changed pre-existing race data');
 const ids=after.scenery.map(s=>s.id);
 if(new Set(ids).size!==ids.length)throw Error('Duplicate scenery IDs');
}

// Optional reviewed-batch search. This is a geometric shortlist, NEVER a visual
// QA pass: the real renderer must still verify vertical terrain and occlusion.
export function rankLandmarkPositions(mark,def,{poseAt,project,segments,scenery=[]},options={}){
 const offsets=options.distanceOffsets??[0,-30,30,-60,60,-90,90,-120,120];
 const sides=options.allowOppositeSide?[mark.side==='left'?-1:1,mark.side==='left'?1:-1]:[mark.side==='left'?-1:1];
 const candidates=[];
 for(const shift of offsets)for(const side of sides){
  const distance=Math.max(0,mark.routeDistanceM+shift),pose=poseAt(distance);
  for(let lateral=options.minimumSetbackM??20;lateral<=(options.maximumSetbackM??100);lateral+=5){
   const p={x:pose.x-Math.cos(pose.yaw)*lateral*side,z:pose.z+Math.sin(pose.yaw)*lateral*side,yaw:pose.yaw};
   const gap=roadClearance(p,def,segments);if(gap<(options.clearanceM??5))continue;
   if(scenery.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<landmarkRadius(def)+Math.max(.5,Number(s.widthM)||1)/Math.SQRT2+2))continue;
   const projected=project(p);if(Math.abs(projected.distance-distance)>35)continue; // another branch is not the requested approach
   const views=[];
   for(const back of options.approachOffsetsM??[75,105,150,205,260,325]){
    const camera=poseAt(Math.max(0,projected.distance-back));
    const dx=p.x-camera.x,dz=p.z-camera.z,range=Math.hypot(dx,dz);
    const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-camera.yaw),Math.cos(Math.atan2(dx,dz)-camera.yaw)))*180/Math.PI;
    const half=Math.atan(def.widthM/(2*range))*180/Math.PI;
    const obstacles=scenery.filter(s=>{
     const d=Math.hypot(s.x-camera.x,s.z-camera.z);
     return d>3 && d<range-landmarkRadius(def) && Number(s.heightM||0)>2.5 && pointSegmentDistance(s,camera,p)<Math.max(.5,Number(s.widthM)||1)*(options.occlusionWidthFactor??.35);
    });
    // Narrow cone favors the portrait view as well as landscape. Give readable
    // full silhouettes and clear base rays more weight than near edge glimpses.
    const fit=Math.max(0,1-angle/25),readability=Math.min(1,half/3);
    const score=angle+half<40?fit*readability*(obstacles.length?.12:1):0;
    views.push({beforeM:back,angleDegrees:angle,angularWidthDegrees:half*2,rangeM:range,occluderIds:obstacles.map(s=>s.id),score});
   }
   const score=views.reduce((s,v)=>s+v.score,0)-Math.abs(shift)*.0003-lateral*.0004-(side===(mark.side==='left'?-1:1)?0:.1);
   candidates.push({...p,routeDistanceM:projected.distance,lateralM:projected.lateral,roadClearanceM:gap,score,views,sourceDistanceShiftM:shift});
  }
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length)throw Error(`No safe ranked position for ${mark.suggestedArtRef}`);
 return candidates;
}

// Plane horizontal tangent is (cos(yaw), -sin(yaw)); choose its normal
// toward the reviewed approach, rather than the nearest bend tangent.
export function landmarkApproachYaw(prop,camera){
 return Math.atan2(prop.x-camera.x,prop.z-camera.z);
}
