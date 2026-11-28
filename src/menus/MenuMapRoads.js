// Control points use the map's normalized coordinate space, just like nodes.
export function mapRoadControls(link,a,b){
 return link.curve==='bezier'?[link.control1||{x:a.x,y:(a.y+b.y)/2},link.control2||{x:b.x,y:(a.y+b.y)/2}]:null;
}
const ROAD_PORTS={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
const offsetPort=(p,dir,length)=>({x:p.x+dir[0]*length,y:p.y+dir[1]*length});
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const cubic=(a,c,d,b,t)=>{const u=1-t;
 return {x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y};
};
function portRoad(link,a,b){
 const from=ROAD_PORTS[link.fromPort],to=ROAD_PORTS[link.toPort];
 if(!from||!to)return null;
 const length=Math.hypot(b.x-a.x,b.y-a.y);
 const lead=Math.min(.034,length*.27);
 const handle=Math.min(.13,Math.max(.013,length*.24))*(link.portBend??1);
 const start=offsetPort(a,from,lead),end=offsetPort(b,to,lead);
 return {start,end,c:offsetPort(start,from,handle),d:offsetPort(end,to,handle)};
}
export function mapRoadPoint(link,a,b,t){
 const p=portRoad(link,a,b);
 if(p){
  if(t<.14)return lerp(a,p.start,t/.14);
  if(t>.86)return lerp(p.end,b,(t-.86)/.14);
  return cubic(p.start,p.c,p.d,p.end,(t-.14)/.72);
 }
 const controls=mapRoadControls(link,a,b);
 return controls?cubic(a,...controls,b,t):lerp(a,b,t);
}
export function mapRoadPixels(point,b){return {x:b.x+point.x*b.w,y:b.y+point.y*Math.max(1,b.h-36)};}
export function drawMapRoad(ctx,link,a,b,bounds){
 const start=mapRoadPixels(a,bounds),end=mapRoadPixels(b,bounds),controls=mapRoadControls(link,a,b);
 ctx.beginPath();ctx.moveTo(start.x,start.y);
 const p=portRoad(link,a,b);
 if(p){
  const [straight,c,d,turn]=[p.start,p.c,p.d,p.end].map(v=>mapRoadPixels(v,bounds));
  ctx.lineTo(straight.x,straight.y);
  ctx.bezierCurveTo(c.x,c.y,d.x,d.y,turn.x,turn.y);
  ctx.lineTo(end.x,end.y);
 }else if(controls){const [c,d]=controls.map(p=>mapRoadPixels(p,bounds));ctx.bezierCurveTo(c.x,c.y,d.x,d.y,end.x,end.y);}else ctx.lineTo(end.x,end.y);
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
// A directional move may take intervening junctions, never another race stop.
export function campaignRoadNeighbors(nodes,links,from){
 const permitted=new Map(nodes.filter(n=>!n.disabled&&!n.locked).map(n=>[n.id,n]));
 const reaches=new Map();
 if(!permitted.has(from))return reaches;
 const queue=[from],paths=new Map([[from,[]]]);
 for(let i=0;i<queue.length;i++)for(const link of links){
  const previous=queue[i],next=link.from===previous?link.to:link.to===previous?link.from:null;
  const node=permitted.get(next);
  if(!node||paths.has(next))continue;
  const path=[...paths.get(previous),{previous,link,reverse:link.to===previous}];
  paths.set(next,path);
  if(node.kind==='junction')queue.push(next);
  else if(node.raceRef)reaches.set(next,path);
 }
 return reaches;
}

export function campaignRoadDirectionalNode(nodes,links,current,direction,pointFor){
 if(!current)return null;
 const axis={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[direction];
 if(!axis)return current;
 const neighbors=campaignRoadNeighbors(nodes,links,current.id);
 const departing=path=>path[0]?.link?.[path[0]?.reverse?'toPort':'fromPort'];
 // Port-map directions are authored, not guessed by a distant endpoint.
 // An absent/locked port cannot fall through to another route in the same direction.
 const usesPorts=links.some(l=>l.from===current.id&&l.fromPort||l.to===current.id&&l.toPort);
 if(usesPorts)return nodes.find(n=>departing(neighbors.get(n.id)||[])===direction)||current;
 const from=pointFor(current);
 let best=current,bestScore=Infinity;
 // Score in displayed pixels, not normalized map units; that also handles
 // portrait maps and endpoint positions clamped inside the viewport.
 for(const n of nodes){
  if(!neighbors.has(n.id))continue;
  const p=pointFor(n),dx=p.x-from.x,dy=p.y-from.y;
  const ahead=axis[0]*dx+axis[1]*dy,cross=Math.abs(axis[1]*dx-axis[0]*dy);
  if(ahead<=.01)continue;
  const score=Math.hypot(dx,dy)+cross*2;
  if(score<bestScore){best=n;bestScore=score;}
 }
 return best;
}

// Preserve each selected edge when input arrives faster than the marker can
// drive it. Ignore excessive held-input backlog instead of snapping the car.
export function queueCampaignRoadMove(state,from,to){
 if(!state||from===to)return false;
 const steps=state.campaignRoadMoves||=[];
 if(steps.length>=8)return false;
 if(steps.length&&steps.at(-1).to!==from)steps.length=0;
 delete state.campaignRoadBlocked;
 steps.push({from,to});
 state.moving=true;
 return true;
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
 if(state.node==null){
  // If input arrived before the first draw, seed from the route's origin
  // using the renderer's road nodes (not unprojected saved coordinates).
  const from=state.campaignRoadMoves?.[0]?.from;
  const origin=nodes.find(n=>n.id===from&&!n.locked&&!n.disabled)||destination;
  Object.assign(state,{node:origin.id,x:origin.x,y:origin.y,angle:135,time,moving:false});
 }
 const dt=Math.max(0,Math.min(.1,time-state.time));state.time=time;state.target=destination.id;
 if(state.campaignRoadBlocked===state.target)return state;
 if(!state.samples){
  const steps=state.campaignRoadMoves;
  if(steps?.length&&steps.at(-1).to!==state.target)steps.length=0;
  while(steps?.length&&state.node===steps[0].to)steps.shift();
  const step=steps?.[0];
  let end=step?.from||state.target,path=null;
  if(step&&state.node===step.from){
   end=step.to;
   path=campaignRoadNeighbors(nodes,links,step.from).get(step.to);
   steps.shift();
   // Topology/unlock changes invalidate this path. Do not use a shortcut
   // through another race in place of the requested junction chain.
   if(!path){steps.length=0;state.campaignRoadBlocked=state.target;state.moving=false;return state;}
  }else if(state.node!==end)path=mapRoadRoute(nodes,links,state.node,end);
  if(path?.length){state.samples=sampleRoute(nodes,path);state.segment=0;state.offset=0;state.end=end;}
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
 state.moving=!!state.samples||!!state.campaignRoadMoves?.length||state.node!==state.target;
 return state;
}
