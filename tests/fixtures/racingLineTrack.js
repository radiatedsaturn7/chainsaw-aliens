export function racingLineTrack({radius=30,angle=Math.PI/2,width=12,entry=100,exit=100}={}) {
 const arcLength=radius*Math.abs(angle),end=entry+arcLength,length=end+exit,sign=Math.sign(angle)||1;
 const segment={surface:'asphalt',roadWidthM:width};
 const pose=d=>{
  if(d<entry)return {x:0,z:d,yaw:0,elevation:0,segment};
  if(d<end){const yaw=(d-entry)/radius*sign;return {x:sign*radius*(1-Math.cos(yaw)),z:entry+sign*radius*Math.sin(yaw),yaw,elevation:0,segment};}
  return {x:sign*radius*(1-Math.cos(angle))+Math.sin(angle)*(d-end),z:entry+sign*radius*Math.sin(angle)+Math.cos(angle)*(d-end),yaw:angle,elevation:0,segment};
 };
 return {length,entry,end,radius,angle,width,pose,
  editor:{selectedRace:{},playtestSession:{routeLength:length,routeRuntimeType:'destination',aiRuntime:[]},
   getSelectedRaceRuntimeType:()=> 'destination',getRaceRouteLength:()=>length,getRaceWorldPoseAtDistance:pose,
   getRaceRoadSurfaceProfileAtDistance:()=>({elevation:0,grade:0}),getRaceRoadHalfWidthWorld:()=>width/2,getRaceSurfaceMetricsAtDistance:()=>({roadEnd:width/2}),
   getRaceRightVector:y=>({x:-Math.cos(y),z:Math.sin(y)})}};
}
