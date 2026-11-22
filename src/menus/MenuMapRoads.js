// Control points use the map's normalized coordinate space, just like nodes.
export function mapRoadControls(link,a,b){
 return link.curve==='bezier'?[link.control1||{x:a.x,y:(a.y+b.y)/2},link.control2||{x:b.x,y:(a.y+b.y)/2}]:null;
}
export function mapRoadPoint(link,a,b,t){
 const controls=mapRoadControls(link,a,b);if(!controls)return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
 const [c,d]=controls,u=1-t;
 return {x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};
}
export function mapRoadPixels(point,b){return {x:b.x+point.x*b.w,y:b.y+point.y*Math.max(1,b.h-36)};}
export function drawMapRoad(ctx,link,a,b,bounds){
 const start=mapRoadPixels(a,bounds),end=mapRoadPixels(b,bounds),controls=mapRoadControls(link,a,b);
 ctx.beginPath();ctx.moveTo(start.x,start.y);
 if(controls){const [c,d]=controls.map(p=>mapRoadPixels(p,bounds));ctx.bezierCurveTo(c.x,c.y,d.x,d.y,end.x,end.y);}else ctx.lineTo(end.x,end.y);
}
export function mapRoadHit(link,a,b,point,bounds,tolerance=10){
 let previous=mapRoadPixels(a,bounds);
 for(let i=1;i<=32;i++){
  const next=mapRoadPixels(mapRoadPoint(link,a,b,i/32),bounds),dx=next.x-previous.x,dy=next.y-previous.y;
  const t=Math.max(0,Math.min(1,((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(dx*dx+dy*dy||1)));
  if(Math.hypot(point.x-previous.x-t*dx,point.y-previous.y-t*dy)<=tolerance)return true;
  previous=next;
 }
 return false;
}
// Undirected roads support returning to earlier races and routing via junctions.
export function mapRoadRoute(nodes,links,from,to){
 if(from===to)return [];
 const permitted=new Map(nodes.filter(n=>!n.disabled&&!n.locked).map(n=>[n.id,n]));
 if(!permitted.has(from)||!permitted.has(to))return null;
 const queue=[from],seen=new Map([[from,null]]);
 for(let i=0;i<queue.length;i++){
  for(const link of links){
   const next=link.from===queue[i]?link.to:link.to===queue[i]?link.from:null;
   if(!permitted.has(next)||seen.has(next))continue;
   seen.set(next,{previous:queue[i],link,reverse:link.to===queue[i]});queue.push(next);
   if(next===to){const path=[];let n=to;while(n!==from){const step=seen.get(n);path.unshift(step);n=step.previous;}return path;}
  }
 }
 return null;
}
function sampleRoute(nodes,path){
 const byId=new Map(nodes.map(n=>[n.id,n])),samples=[];
 for(const {link,reverse} of path){
  const a=byId.get(link.from),b=byId.get(link.to);
  for(let i=0;i<=32;i++)samples.push(mapRoadPoint(link,a,b,reverse?1-i/32:i/32));
 }
 return samples;
}
// Retargeting finishes the road already being driven, then takes connected roads
// to the latest selection. It never teleports or cuts across a branch.
export function advanceMapCar(state,nodes,links,target,time){
 const destination=nodes.find(n=>n.raceRef===target&&!n.locked&&!n.disabled);if(!destination)return null;
 if(!state)return {node:destination.id,target:destination.id,x:destination.x,y:destination.y,angle:135,time,moving:false};
 const dt=Math.max(0,Math.min(.1,time-state.time));state.time=time;state.target=destination.id;
 if(!state.samples&&state.node!==state.target){
  const path=mapRoadRoute(nodes,links,state.node,state.target);
  if(path?.length){state.samples=sampleRoute(nodes,path);state.segment=0;state.offset=0;state.end=state.target;}
 }
 let distance=dt*.5;
 while(state.samples&&distance>0){
  const a=state.samples[state.segment],b=state.samples[state.segment+1];
  if(!b){state.node=state.end;state.samples=null;break;}
  const length=Math.hypot(b.x-a.x,b.y-a.y);
  const step=Math.min(distance,Math.max(0,length-state.offset));state.offset+=step;distance-=step;
  const t=length?state.offset/length:1;
  state.x=a.x+(b.x-a.x)*t;state.y=a.y+(b.y-a.y)*t;
  if(length>0)state.angle=(Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI+360)%360;
  if(t>=1-1e-9){state.segment++;state.offset=0;}else break;
 }
 state.moving=!!state.samples||state.node!==state.target;
 return state;
}
