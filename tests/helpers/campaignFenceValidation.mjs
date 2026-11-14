import assert from 'node:assert/strict';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
import {roadContinuationSamples} from '../../src/racing/RaceRoadContinuations.js';

function pointSegment(p,a,b) {
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
}
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function segmentDistance(a,b,c,d) {
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&
 Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&
 Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z)))return 0;
 return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}

// Continuous segment/solid-footprint separation, not center or corner sampling.
// The road sweep uses each span's larger half-width, conservatively covering width transitions.
export function fenceRoadGap(box, yaw, samples, roadWidth) {
 assert.ok(box.size.x>0&&box.size.z>0&&samples.length>1,'Invalid fence/road geometry');
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const local=p=>({x:(p.x-box.center.x)*c-(p.z-box.center.z)*s,z:(p.x-box.center.x)*s+(p.z-box.center.z)*c});
 const inside=p=>{const q=local(p);return Math.abs(q.x)<=box.size.x/2&&Math.abs(q.z)<=box.size.z/2;};
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:box.center.x+c*box.size.x*x/2+s*box.size.z*z/2,z:box.center.z-s*box.size.x*x/2+c*box.size.z*z/2}));
 let gap=Infinity;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],half=Math.max(roadWidth(a.segment),roadWidth(b.segment))/2;
  assert.ok(Number.isFinite(half)&&half>0,'Invalid road width');
  const d=inside(a)||inside(b)?0:Math.min(...corners.map((p,j)=>segmentDistance(a,b,p,corners[(j+1)%4])));
  gap=Math.min(gap,d-half);
 }
 return gap;
}

export function assertFencePathGeometry(panels) {
 assert.ok(panels.length,'Missing fence panels');
 const first=panels.find(p=>p.fencePath),path=first?.fencePath;
 assert.ok(path?.points?.length>=2,'Missing full fence path');
 const rebuilt=buildRaceFencePlacements(path.points,path.definition,{id:first.fenceId,ref:path.ref,endFlared:path.endFlared});
 assert.equal(panels.length,rebuilt.length,'Broken fence continuity: panel count');
 const saved=new Map(panels.map(p=>[p.id,p]));assert.equal(saved.size,panels.length,'Duplicate fence panels');
 for(const p of rebuilt){
  const actual=saved.get(p.id);assert.ok(actual,'Broken fence continuity: missing panel');
  for(const key of ['x','z','yaw','widthM','heightM','artRef','doodadRef'])assert.equal(actual[key],p[key],`Fence path mismatch: ${p.id} ${key}`);
  for(const key of ['artRef','isFence','hitboxWidthM','hitboxHeightM','fenceThicknessM'])assert.equal(actual.previewDoodad?.[key],p.previewDoodad[key],`Fence collider mismatch: ${p.id} ${key}`);
 }
 return rebuilt;
}

export function assertFenceRoadClearance(editor, panels, colliders) {
 const ordered=assertFencePathGeometry(panels),race=editor.selectedRace;
 assert.ok(!race.road.network,'Network fences require a network-specific road proof');
 const route=editor.getRacePathSamplesCached({step:4});
 const samples=roadContinuationSamples(race.road,route,route.at(-1).distance);
 let minimum=Infinity;
 for(const p of ordered){
  const box=colliders.find(b=>b.source===`scenery:${p.id}`);assert.ok(box,`Missing solid fence collider: ${p.id}`);
  assert.equal(box.size.x,Math.max(.1,p.previewDoodad.hitboxWidthM)+.04,'Fence overlap padding changed');
  assert.equal(box.size.z,p.previewDoodad.fenceThicknessM,'Fence thickness changed');
  const gap=fenceRoadGap(box,p.yaw,samples,s=>editor.getRaceRoadWidthMForSegment(s));
  assert.ok(gap>0,`Fence intrudes on full road corridor: ${p.id} (${gap} m)`);
  minimum=Math.min(minimum,gap);
 }
 return minimum;
}
