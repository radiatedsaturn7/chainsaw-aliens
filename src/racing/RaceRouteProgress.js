// Progress queries follow the current occurrence of a road at self-crossings.
// Unhinted queries (terrain, scenery and collisions) remain purely geometric.
export function routeProjectionScore(distanceSq,distance,{hint,window=40,length=0,circuit=false}={}){
 if(!Number.isFinite(hint))return distanceSq;
 let delta=distance-hint;
 if(circuit&&length>0)delta=((delta+length/2)%length+length)%length-length/2;
 const outside=Math.max(0,Math.abs(delta)-window);
 return distanceSq+outside*outside*4+Math.min(Math.abs(delta),window)*.0001;
}
