import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {routeProjectionScore} from '../../src/racing/RaceRouteProgress.js';
function fixture(points){
 const e=Object.create(RaceEditor.prototype);let distance=0;
 const samples=points.map(([x,z],i)=>{if(i)distance+=Math.hypot(x-points[i-1][0],z-points[i-1][1]);return {x,z,distance,index:i,segment:{roadWidthM:7}};});
 Object.defineProperty(e,'selectedRace',{value:{road:{autoExtend:false}}});
 e.getRacePathSamplesCached=()=>samples;e.getSelectedRaceRuntimeType=()=> 'destination';
 e.getRaceRightVector=yaw=>({x:Math.cos(yaw),z:-Math.sin(yaw)});
 return {e,samples};
}
test('crossing progress stays on the current visit in both directions',()=>{
 const {e,samples}=fixture([[-100,-100],[100,100],[-100,100],[100,-100]]);
 const first=samples[1].distance/2,second=samples[2].distance+Math.sqrt(20000);
 for(const hint of [first,second])for(const delta of [-1,0,1]){
  const p=e.getRaceRouteProjectionForWorldPoint({x:0,z:0,routeDistanceHint:hint+delta});
  assert.ok(Math.abs(p.distance-hint)<.001);
 }
 assert.ok(Math.abs(e.getRaceRouteProjectionForWorldPoint({x:0,z:0}).distance-first)<.001);
});
test('finish overlapping the starting street resolves to finish after the whole route',()=>{
 const {e,samples}=fixture([[0,0],[0,100],[100,100],[100,0],[0,0]]),length=samples.at(-1).distance;
 assert.equal(e.getRaceRouteProjectionForWorldPoint({x:0,z:0,routeDistanceHint:0}).distance,0);
 assert.equal(e.getRaceRouteProjectionForWorldPoint({x:0,z:0,routeDistanceHint:length-1}).distance,length);
});
test('continuity wraps across circuit start and leaves unhinted spatial queries unchanged',()=>{
 assert.ok(routeProjectionScore(0,1,{hint:999,length:1000,circuit:true})<1);
 assert.equal(routeProjectionScore(12,999),12);
 assert.ok(routeProjectionScore(0,500,{hint:1})>10000);
});
test('saved Providence crossing resolves both visits to their own progress',async()=>{
 const fs=await import('node:fs'),zlib=await import('node:zlib');
 const root='data/server-storage/files/',manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));
 let doc=JSON.parse(fs.readFileSync(root+manifest.folders.races['Providence, RI — Landmark Run']));
 if(doc.__chainsawStorage)doc=JSON.parse(zlib.gunzipSync(Buffer.from(doc.data,'base64')));
 const e=new RaceEditor({});e.applyLoadedRaceDocument(doc);
 const samples=e.getRacePathSamplesCached({step:4});let crossing;
 for(let i=1;i<samples.length&&!crossing;i++)for(let j=i+30;j<samples.length;j++){
  const a=samples[i-1],b=samples[i],c=samples[j-1],d=samples[j];
  const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,det=rx*sz-rz*sx;if(Math.abs(det)<1e-8)continue;
  const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/det,u=((c.x-a.x)*rz-(c.z-a.z)*rx)/det;
  if(t>=0&&t<=1&&u>=0&&u<=1){crossing={x:a.x+t*rx,z:a.z+t*rz,hints:[a.distance+t*(b.distance-a.distance),c.distance+u*(d.distance-c.distance)]};break;}
 }
 assert.ok(crossing,'saved route contains a crossing');
 for(const hint of crossing.hints){const p=e.getRaceRouteProjectionForWorldPoint({...crossing,routeDistanceHint:hint});assert.ok(Math.abs(p.distance-hint)<1);}
});
