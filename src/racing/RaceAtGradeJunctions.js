import {subtractRaceTerrainPolygonByConvexPolygon,triangulateRaceSurfaceQuad} from './RaceTerrainClipping.js';

const cross=(a,b)=>a.x*b.z-a.z*b.x;
const delta=(a,b)=>({x:b.x-a.x,z:b.z-a.z});
const separated=s=>s?.structure==='bridge'||s?.structure==='tunnel'||s?.bridge===true||s?.tunnel===true;
const width=s=>Math.hypot(s.left.x-s.right.x,s.left.z-s.right.z);
const smooth=t=>t*t*(3-2*t);

const clamp01=t=>Math.max(0,Math.min(1,t));
function closestApproach(a,b,c,d){
 const u=delta(a,b),v=delta(c,d),w=delta(a,c),den=cross(u,v);
 const lengthU=Math.hypot(u.x,u.z),lengthV=Math.hypot(v.x,v.z);
 const sin=Math.abs(den)/Math.max(1e-9,lengthU*lengthV);
 if(sin<.15)return null; // Separate parallel streets/retraced lanes are not junctions.
 const t=cross(w,v)/den,q=cross(w,u)/den;
 if(t>=0&&t<=1&&q>=0&&q<=1)return {t,q,gap:0,sin,crossing:true};
 const project=(p,a,u,length)=>clamp01(((p.x-a.x)*u.x+(p.z-a.z)*u.z)/(length*length||1));
 const candidates=[{t:0,q:project(a,c,v,lengthV)},{t:1,q:project(b,c,v,lengthV)},
  {t:project(c,a,u,lengthU),q:0},{t:project(d,a,u,lengthU),q:1}];
 for(const p of candidates)p.gap=Math.hypot(a.x+u.x*p.t-c.x-v.x*p.q,a.z+u.z*p.t-c.z-v.z*p.q);
 candidates.sort((a,b)=>a.gap-b.gap);
 return {...candidates[0],sin,crossing:false};
}

function roadFootprintsOverlap(a,b,c,d){
 const triangles=(a,b)=>triangulateRaceSurfaceQuad([a.left,b.left,b.right,a.right]);
 for(const first of triangles(a,b))for(const second of triangles(c,d)){
  let overlap=true;
  for(const polygon of [first,second])for(let i=0;i<3;i++){
   const edge=delta(polygon[i],polygon[(i+1)%3]),length=Math.hypot(edge.x,edge.z);
   if(length<1e-6)continue;
   const project=p=>(p.x*edge.z-p.z*edge.x)/length;
   const p=first.map(project),q=second.map(project);
   if(Math.min(Math.max(...p),Math.max(...q))-Math.max(Math.min(...p),Math.min(...q))<=1e-5)overlap=false;
  }
  if(overlap)return true;
 }
 return false;
}

// Keep route order/progression intact. The physical road footprint can meet at
// a junction even when smoothing rounded two visits into non-crossing turns.
export function joinRaceAtGradeCrossings(sections,{elevationScaleM=12,runtimeType='destination',adjustHeights=true}={}){
 const count=sections.length,junctions=[],buckets=new Map(),cell=32,pairs=[],candidates=[];
 const distances=[0];
 for(let i=1;i<count;i++)distances[i]=distances[i-1]+Math.hypot(sections[i].center.x-sections[i-1].center.x,sections[i].center.z-sections[i-1].center.z);
 for(let i=0;i<count-1;i++){
  const a=sections[i].center,b=sections[i+1].center;
  pairs.push({a,b});
  if(separated(a.segment)||separated(b.segment))continue;
  const halfWidth=Math.max(width(sections[i]),width(sections[i+1]))/2;
  const keys=[],nearby=new Set();
  // Index road extents, not just their centerlines.
  for(let x=Math.floor((Math.min(a.x,b.x)-halfWidth)/cell);x<=Math.floor((Math.max(a.x,b.x)+halfWidth)/cell);x++)
   for(let z=Math.floor((Math.min(a.z,b.z)-halfWidth)/cell);z<=Math.floor((Math.max(a.z,b.z)+halfWidth)/cell);z++){
    const key=`${x},${z}`;keys.push(key);for(const j of buckets.get(key)||[])nearby.add(j);
   }
  for(const j of nearby){
   if(i-j<=2||(runtimeType==='circuit'&&j===0&&i>=count-3))continue;
   const {a:c,b:d}=pairs[j],hit=closestApproach(a,b,c,d);
   if(!hit)continue;
   const otherHalfWidth=Math.max(width(sections[j]),width(sections[j+1]))/2;
   const roadWidth=2*Math.max(halfWidth,otherHalfWidth);
   if(!hit.crossing){
    let routeGap=distances[i]+hit.t*(distances[i+1]-distances[i])
      -distances[j]-hit.q*(distances[j+1]-distances[j]);
    if(runtimeType==='circuit')routeGap=Math.min(routeGap,distances.at(-1)-routeGap);
    // Nearby samples around an ordinary bend belong to the same road arm.
    if(routeGap<Math.max(40,roadWidth*3)||hit.gap>=halfWidth+otherHalfWidth-.1)continue;
    if(!roadFootprintsOverlap(sections[i],sections[i+1],sections[j],sections[j+1]))continue;
   }
   const {t,q}=hit,h=a.elevation+(b.elevation-a.elevation)*t,k=c.elevation+(d.elevation-c.elevation)*q;
   if(Math.abs(h-k)*elevationScaleM>1)continue;
   const x=(a.x+(b.x-a.x)*t+c.x+(d.x-c.x)*q)/2;
   const z=(a.z+(b.z-a.z)*t+c.z+(d.z-c.z)*q)/2;
   candidates.push({x,z,elevation:(h+k)/2,arms:[j,i],roadWidth,
    kind:hit.crossing?'crossing':'shared-turn',gap:hit.gap,
    radius:hit.crossing?roadWidth/hit.sin+2:roadWidth+2});
  }
  for(const key of keys){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
 }
 // Prefer a literal crossing, otherwise the closest approach. One shared
 // height per intersection avoids conflicting, overlapping flattening passes.
 candidates.sort((a,b)=>(a.kind==='crossing'?0:1)-(b.kind==='crossing'?0:1)||a.gap-b.gap);
 for(const candidate of candidates){
  const existing=junctions.find(n=>Math.hypot(n.x-candidate.x,n.z-candidate.z)<Math.max(n.roadWidth,candidate.roadWidth)*1.5);
  if(existing){
   existing.radius=Math.max(existing.radius,Math.hypot(existing.x-candidate.x,existing.z-candidate.z)+candidate.roadWidth/2+2);
   for(const index of candidate.arms)if(!existing.arms.includes(index))existing.arms.push(index);
  }else junctions.push(candidate);
 }
 for(const n of [...junctions]){
  const ranges=n.arms.map(index=>{
   let first=index,last=index+1;
   const near=s=>Math.hypot(s.center.x-n.x,s.center.z-n.z)<n.radius+20&&!separated(s.center.segment);
   while(first>0&&near(sections[first-1]))first--;
   while(last<count-1&&near(sections[last+1]))last++;
   return {first,last};
  }).sort((a,b)=>a.first-b.first);
  n.branches=[];
  for(const range of ranges){
   const last=n.branches.at(-1);
   if(last&&range.first<=last.last)last.last=Math.max(last.last,range.last);
   else n.branches.push(range);
  }
  if(n.branches.length<2){junctions.splice(junctions.indexOf(n),1);continue;}
  // Keep representative indices only; the branch intervals carry all visits.
  n.arms=n.branches.map(branch=>branch.first);
 }
 if(adjustHeights){
  const influences=new Map();
  for(const n of junctions)for(const {first,last} of n.branches)for(let i=first;i<=last;i++){
   if(!influences.has(i))influences.set(i,[]);
   influences.get(i).push(n);
  }
  for(const [index,nearby] of influences){
   const section=sections[index];
   for(const key of ['center','left','right','marginLeft','marginRight','shoulderLeft','shoulderRight']){
    const p=section[key];if(!p)continue;
    let weight=0,height=0,blend=0,core=null,coreDistance=Infinity;
    for(const n of nearby){
     const r=Math.hypot(p.x-n.x,p.z-n.z),w=1-smooth(clamp01((r-n.radius)/20));
     if(r<=n.radius&&r<coreDistance){core=n;coreDistance=r;}
     height+=n.elevation*w;weight+=w;blend=Math.max(blend,w);
    }
    // A nearby intersection's approach must not tilt this intersection's
    // already-flat core. Blend from original points once, not successively.
    if(core)section[key]={...p,elevation:core.elevation};
    else if(weight)section[key]={...p,elevation:p.elevation+(height/weight-p.elevation)*blend};
   }
  }
 }
 return junctions;
}

// Road wins over shoulders. Retain the earliest road face in an overlap,
// including folds within one tight turn, so render and physics see one deck.
export function createRaceJunctionClipper(sections,junctions=[]){
 const clips=new Map();
 for(const junction of junctions)for(const own of junction.branches)for(const other of junction.branches){
  for(let i=own.first;i<own.last;i++){
   if(!clips.has(i))clips.set(i,[]);
   for(let j=other.first;j<other.last;j++){
    const a=sections[j],b=sections[j+1];
    // Split road quads, since tight curves need not form convex quads.
    for(const [triangleIndex,points] of triangulateRaceSurfaceQuad([a.left,b.left,b.right,a.right]).entries()){
     clips.get(i).push({j,triangleIndex,points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
    }
   }
  }
 }
 return (polygon,index,region,triangleIndex=0)=>{
  if(!clips.has(index))return [polygon];
  let pieces=[polygon];
  const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  for(const clip of clips.get(index)||[]){
   if(region==='road'&&(clip.j>index||(clip.j===index&&clip.triangleIndex>=triangleIndex)))continue;
   if(clip.minX>=maxX||clip.maxX<=minX||clip.minZ>=maxZ||clip.maxZ<=minZ)continue;
   pieces=pieces.flatMap(p=>subtractRaceTerrainPolygonByConvexPolygon(p,clip.points,{markSeam:false}));
  }
  return pieces;
 };
}
