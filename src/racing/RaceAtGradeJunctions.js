import {subtractRaceTerrainPolygonByConvexPolygon} from './RaceTerrainClipping.js';

const cross=(a,b)=>a.x*b.z-a.z*b.x;
const delta=(a,b)=>({x:b.x-a.x,z:b.z-a.z});
const separated=s=>s?.structure==='bridge'||s?.structure==='tunnel'||s?.bridge===true||s?.tunnel===true;
const width=s=>Math.hypot(s.left.x-s.right.x,s.left.z-s.right.z);
const smooth=t=>t*t*(3-2*t);

// Keep the ordered route intact. Only its physical crossing is joined: converting
// it to a shortest-path network would let progression skip part of the course.
export function joinRaceAtGradeCrossings(sections,{elevationScaleM=12,runtimeType='destination',adjustHeights=true}={}){
 const count=sections.length, junctions=[],buckets=new Map(),cell=32;
 const pairs=[];
 for(let i=0;i<count-1;i++){
  const a=sections[i].center,b=sections[i+1].center;
  pairs.push({a,b});
  if(separated(a.segment)||separated(b.segment))continue;
  const keys=[];const candidates=new Set();
  for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++)
   for(let z=Math.floor(Math.min(a.z,b.z)/cell);z<=Math.floor(Math.max(a.z,b.z)/cell);z++){
    const key=`${x},${z}`;keys.push(key);for(const j of buckets.get(key)||[])candidates.add(j);
   }
  for(const j of candidates){
   if(i-j<=2||(runtimeType==='circuit'&&j===0&&i>=count-3))continue;
   const {a:c,b:d}=pairs[j],u=delta(a,b),v=delta(c,d),w=delta(a,c),den=cross(u,v);
   // Parallel/retraced lanes aren't four-way junctions.
   if(Math.abs(den)<Math.hypot(u.x,u.z)*Math.hypot(v.x,v.z)*.15)continue;
   const t=cross(w,v)/den,q=cross(w,u)/den;
   if(t< -1e-6||t>1+1e-6||q< -1e-6||q>1+1e-6)continue;
   const h=a.elevation+(b.elevation-a.elevation)*t,k=c.elevation+(d.elevation-c.elevation)*q;
   if(Math.abs(h-k)*elevationScaleM>1)continue;
   const x=a.x+u.x*t,z=a.z+u.z*t;
   if(junctions.some(n=>Math.hypot(n.x-x,n.z-z)<1))continue;
   const sin=Math.abs(den)/Math.max(1e-9,Math.hypot(u.x,u.z)*Math.hypot(v.x,v.z));
   junctions.push({x,z,elevation:(h+k)/2,arms:[j,i],radius:Math.max(width(sections[i]),width(sections[j]))/sin+2});
  }
  for(const key of keys){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
 }
 for(const n of junctions){
  n.branches=n.arms.map(index=>{
   let first=index,last=index+1;
   const near=s=>Math.hypot(s.center.x-n.x,s.center.z-n.z)<n.radius+20&&!separated(s.center.segment);
   while(first>0&&near(sections[first-1]))first--;
   while(last<count-1&&near(sections[last+1]))last++;
   return {first,last};
  });
  if(!adjustHeights)continue;
  for(const {first,last} of n.branches)for(let i=first;i<=last;i++){
   const section=sections[i];
   // Copy points: the cached roadbed profile must not be mutated.
   for(const key of ['center','left','right','marginLeft','marginRight','shoulderLeft','shoulderRight']){
    const p=section[key];if(!p)continue;
    const r=Math.hypot(p.x-n.x,p.z-n.z),blend=1-smooth(Math.max(0,Math.min(1,(r-n.radius)/20)));
    section[key]={...p,elevation:p.elevation+(n.elevation-p.elevation)*blend};
   }
  }
 }
 return junctions;
}

// Road wins over the other arm's shoulder. In the shared road footprint only
// the earlier arm supplies triangles, preventing duplicate surfaces/z-fighting.
export function createRaceJunctionClipper(sections,junctions=[]){
 const clips=new Map();
 for(const junction of junctions)for(let arm=0;arm<2;arm++){
  const own=junction.branches[arm],other=junction.branches[1-arm];
  for(let i=own.first;i<own.last;i++){
   if(!clips.has(i))clips.set(i,[]);
   for(let j=other.first;j<other.last;j++){
    if(Math.abs(i-j)<=2)continue;
    const a=sections[j],b=sections[j+1];
    // Split road quads, since tight curves need not form convex quads.
    for(const points of [[a.left,b.left,b.right],[a.left,b.right,a.right]]){
     clips.get(i).push({j,points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
    }
   }
  }
 }
 return (polygon,index,region)=>{
  if(!clips.has(index))return [polygon];
  let pieces=[polygon];
  const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  for(const clip of clips.get(index)||[]){
   if(region==='road'&&clip.j>=index)continue;
   if(clip.minX>=maxX||clip.maxX<=minX||clip.minZ>=maxZ||clip.maxZ<=minZ)continue;
   pieces=pieces.flatMap(p=>subtractRaceTerrainPolygonByConvexPolygon(p,clip.points,{markSeam:false}));
  }
  return pieces;
 };
}
