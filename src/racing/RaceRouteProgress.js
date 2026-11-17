// Progress queries follow the current occurrence of a road at self-crossings.
// Unhinted queries (terrain, scenery and collisions) remain purely geometric.
export function routeProjectionScore(distanceSq,distance,{hint,window=40,length=0,circuit=false}={}){
 if(!Number.isFinite(hint))return distanceSq;
 let delta=distance-hint;
 if(circuit&&length>0)delta=((delta+length/2)%length+length)%length-length/2;
 const outside=Math.max(0,Math.abs(delta)-window);
 return distanceSq+outside*outside*4+Math.min(Math.abs(delta),window)*.0001;
}

// Shared by runtime lap detection and campaign distance/target calculations.
export function isRaceRouteLoopClosed(points,{roadWidthM=11,carWidthM=1.8}={}){
 if(!Array.isArray(points)||points.length<2)return false;
 const first=points[0],last=points.at(-1);
 const width=Math.min(24,Math.max(2.2,carWidthM*1.25,Number(roadWidthM)||11));
 const snapRange=Math.max(1.8,Math.min(width*.5*.18,carWidthM*2.4));
 return Math.hypot(Number(last.x||0)-Number(first.x||0),Number(last.z??last.y??0)-Number(first.z??first.y??0))<=snapRange;
}
