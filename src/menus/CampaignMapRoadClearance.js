import {mapRoadPoint,mapRoadPixels} from './MenuMapRoads.js';

// Road half widths (including the silhouette stroke) are used for placement,
// not navigation; the drawn and traversed path still share mapRoadPoint.
export function regionalRoadWidth(bounds,width,pattern){
 const paved=pattern!=='dashed'&&pattern!=='dotted';
 return Math.max(4,Math.min(18,Math.min(bounds.w,bounds.h)*(paved?.033:.022)*width/(paved?5:3)));
}

export function regionalRoadCorridors(bounds,nodes,links,style){
 const points=[],byId=new Map(nodes.map(n=>[n.id,n]));
 for(const link of links){
  const a=byId.get(link.from),c=byId.get(link.to),width=link.width??style.lineWidth;
  if(!a||!c||!width)continue;
  const radius=(regionalRoadWidth(bounds,width,link.pattern||style.linePattern)+4)/2+1;
  const steps=Math.max(16,Math.ceil(Math.hypot((a.x-c.x)*bounds.w,(a.y-c.y)*(bounds.h-36))/4));
  for(let i=0;i<=steps;i++){
   const point=mapRoadPixels(mapRoadPoint(link,a,c,i/steps),bounds);
   const inside=point.x>=bounds.x-radius&&point.x<=bounds.x+bounds.w+radius&&
    point.y>=bounds.y-radius&&point.y<=bounds.y+bounds.h-36+radius;
   if(inside)points.push({...point,radius,linkId:link.id});
  }
 }
 return points;
}

function intersection(a,b){
 return Math.max(0,Math.min(a.r,b.r)-Math.max(a.l,b.l))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.t,b.t));
}
const footOffsets=[0,-.13,.13,-.25,.25,-.37,.37,-.47,.47,-.58,.58,-.69,.69];
const verticalOffsets=[0,-.13,.13,-.23,.23,-.34,.34,-.44,.44,-.56,.56];
const area=a=>Math.max(1,(a.r-a.l)*(a.b-a.t));
const translated=(bounds,x,y,w)=>({l:x+bounds[0]*w,t:y+bounds[1]*w,r:x+bounds[2]*w,b:y+bounds[3]*w});

// The apron may be snow, water or shadow, not a solid obstacle. Treat the
// base of built objects and cliffs as occupied; a tall facade can project
// over a road farther north without forcing the car off that road.
export function regionalLandmarkFootprint(p){
 const [l,t,r,b]=p.ink,scale=p.width/192,span=r-l;
 const inset=p.depth==='raised'?.18:.25;
 return translated([l+span*inset,Math.max(t,98),
  r-span*inset,Math.max(104,Math.min(115,b))],p.x,p.y,scale);
}

function roadIntrusion(foot,road){
 const dx=Math.max(foot.l-road.x,0,road.x-foot.r),dy=Math.max(foot.t-road.y,0,road.y-foot.b);
 return Math.max(0,road.radius-Math.hypot(dx,dy));
}

function positionPenalty(current,target,pin,roads,pins,occupied){
 let roadPenalty=0,pinPenalty=0,overlap=0;
 const foot=regionalLandmarkFootprint(current);
 for(const road of roads){
  const d=roadIntrusion(foot,road);
  roadPenalty+=d*d;
  if(d>=road.radius-1)roadPenalty+=330;
 }
 for(const n of pins){
  if(n===pin)continue;
  const pad=12;
  pinPenalty+=intersection(target,{l:n.x-pad,t:n.y-pad,r:n.x+pad,b:n.y+pad});
 }
 for(const o of occupied)overlap+=intersection(target,o);
 return 31*roadPenalty+4.2*pinPenalty+1.7*overlap;
}

export function placeLandmarksByRoad(placements,bounds,roads,pins){
 if(!roads?.length)return placements;
 // Resolve signature silhouettes first, then fill gaps with smaller detours.
 const ordered=[...placements].sort((a,b)=>b.priority-a.priority||a.pinY-b.pinY||a.index-b.index);
 const occupied=[];
 const placed=[];
 const edge={l:bounds.x,t:bounds.y,r:bounds.x+bounds.w,b:bounds.y+bounds.h-36};
 for(const p of ordered){
  const pin=pins.get(p.nodeId),w=p.width/192;
  const [l,t,r,b]=p.ink;
  const fitX=x=>Math.max(edge.l-l*w,Math.min(edge.r-r*w,x));
  const fitY=y=>Math.max(edge.t-t*w,Math.min(edge.b-b*w,y));
  const seen=new Set();
  let chosen,best=Infinity,ink;
  const evaluate=(rawX,rawY)=>{
   const x=fitX(rawX),y=fitY(rawY);
   const key=Math.round(x*4)+':'+Math.round(y*4);
   if(seen.has(key))return;
   seen.add(key);
   const q={...p,x,y},box=translated(p.ink,x,y,w);
   // Keep each miniature's turnout recognizable, especially across a region
   // boundary. Distance is weaker than footprint clearance but breaks ties.
   const shift=Math.hypot(x-p.x,(y-p.y)*1.34);
   const score=positionPenalty(q,box,pin,roads,pins.values(),occupied)+shift*shift*.42;
   if(score<best){best=score;chosen=q;ink=box;}
  }
  for(const v of verticalOffsets)for(const h of footOffsets)evaluate(p.x+h*p.width,p.y+v*p.height);
  for(const step of [8,4,2]){
   const origin=chosen;
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)evaluate(origin.x+i*step,origin.y+j*step);
  }
  occupied.push(ink);
  placed.push({...chosen,groundY:chosen.y+112*w,groundX:chosen.x+96*w});
 }
 return placed.sort((a,b)=>a.groundY-b.groundY||a.groundX-b.groundX||a.index-b.index);
}

export function measureRoadIntrusion(placements,corridors){
 return placements.flatMap(p=>{
  const floor=regionalLandmarkFootprint(p),links=new Map();
  for(const road of corridors){
   const d=roadIntrusion(floor,road);
   if(d>0)links.set(road.linkId,Math.max(d,links.get(road.linkId)||0));
  }
  return [...links].map(([linkId,intrusion])=>({nodeId:p.nodeId,linkId,intrusion}));
 });
}
