import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
import {triangulateRaceSurfaceQuad} from '../../src/racing/RaceTerrainClipping.js';
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const separated=s=>s?.bridge||s?.tunnel||['bridge','tunnel'].includes(s?.structure);
const edgeDistance=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
// Use actual ribbon triangles, including folds, rather than only the nearest
// route projection: another leg of the hairpin may be closer than that leg.
export function roadClearanceChecker(sections,clearanceM=1){
 const cells=new Map(),size=32;
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i];
  for(const t of triangulateRaceSurfaceQuad([a.left,b.left,b.right,a.right])){
   const minX=Math.floor((Math.min(...t.map(p=>p.x))-clearanceM)/size),maxX=Math.floor((Math.max(...t.map(p=>p.x))+clearanceM)/size);
   const minZ=Math.floor((Math.min(...t.map(p=>p.z))-clearanceM)/size),maxZ=Math.floor((Math.max(...t.map(p=>p.z))+clearanceM)/size);
   for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const k=`${x},${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t);}
  }
 }
 return p=>{
  for(const t of cells.get(`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`)||[]){
   const signs=t.map((a,i)=>cross(a,t[(i+1)%3],p));
   if(signs.every(v=>v>=0)||signs.every(v=>v<=0))return false;
   if(t.some((a,i)=>edgeDistance(p,a,t[(i+1)%3])<clearanceM))return false;
  }
  return true;
 };
}

// Conservative authoring pass, not runtime collision magic. Repeating this
// replaces only our own fences; road geometry and existing scenery stay intact.
export function addTightTurnBarriers(race,sections,definition,{ref='roadside-metal-guardrail-intact',roadside=null}={}){
 const prefix='tight-turn-v1-';
 const kept=(race.scenery||[]).filter(p=>!p.fenceId?.startsWith(prefix));
 const safe=roadClearanceChecker(sections,1),candidates=[];
 for(let i=5;i<sections.length-5;i++){
  const a=sections[i-4].center,b=sections[i+4].center;
  const turn=angle(b.yaw-a.yaw);
  if(Math.abs(turn)<2.1||sections.slice(i-5,i+6).some(s=>separated(s.center.segment)))continue;
  candidates.push({i,turn,distance:sections[i].center.distance});
 }
 candidates.sort((a,b)=>Math.abs(b.turn)-Math.abs(a.turn));
 const selected=[];
 for(const c of candidates)if(!selected.some(p=>Math.abs(p.distance-c.distance)<90))selected.push(c);
 const additions=[],report=[];
 for(const {i,turn,distance} of selected){
  const side=turn>0?'left':'right',sign=Math.sign(turn),runs=[];let run=[];
  const flush=()=>{if(run.length>1)runs.push(run);run=[];};
  for(let j=Math.max(0,i-16);j<=Math.min(sections.length-1,i+16);j++){
   const s=sections[j],edge=s[side],p={x:edge.x+Math.cos(s.center.yaw)*sign*2,z:edge.z-Math.sin(s.center.yaw)*sign*2};
   // Keep clear of existing barriers and junction mouths, including between
   // samples (checking endpoints alone lets a fence cut across the road).
   let valid=!separated(s.center.segment)&&safe(p)&&!kept.some(q=>q.fenceId&&Math.hypot(q.x-p.x,q.z-p.z)<3);
   if(valid&&run.length){const a=run.at(-1),n=Math.ceil(Math.hypot(p.x-a.x,p.z-a.z)*2);for(let k=1;k<n&&valid;k++)valid=safe({x:a.x+(p.x-a.x)*k/n,z:a.z+(p.z-a.z)*k/n});}
   if(!valid){flush();continue;}run.push(p);
  }
  flush();
  for(const [index,points] of runs.entries()){
   const length=points.slice(1).reduce((sum,p,j)=>sum+Math.hypot(p.x-points[j].x,p.z-points[j].z),0);
   if(length<6)continue;
   const panels=buildRaceFencePlacements(points,{...definition,isFence:true},{id:`${prefix}${Math.round(distance)}-${index}`,ref,roadside:roadside?{...roadside,validPoint:safe}:null});
   additions.push(...panels);report.push({distanceM:Math.round(distance),lengthM:Math.round(length*10)/10,panels:panels.length});
  }
 }
 race.scenery=[...kept,...additions];return report;
}
