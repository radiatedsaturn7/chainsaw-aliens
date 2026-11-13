// Inspect actual mesh edge heights, including subdivided (T-junction) edges.
// Input is an explicitly saved worker bake cache; unmatched edges include the world perimeter.
import fs from 'node:fs';import {deserialize} from 'node:v8';
import {pathToFileURL} from 'node:url';
export function auditTerrainEdges(p) {
const v=p.positions;
const edges=new Map(),buckets=new Map(),size=20,pairedCracks=[];
const key=i=>`${v[i].toFixed(6)},${v[i+2].toFixed(6)}`;
for(let i=0;i<v.length;i+=9)for(let j=0;j<3;j++){
 const a=i+j*3,b=i+(j+1)%3*3,ka=key(a),kb=key(b);if(ka===kb)continue;
 const k=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
 const old=edges.get(k);if(old){
 const sameDirection=Math.hypot(old.a[0]-v[a],old.a[2]-v[a+2])<1e-5;
 const error=Math.max(Math.abs(v[a+1]-(sameDirection?old.a[1]:old.b[1])),Math.abs(v[b+1]-(sameDirection?old.b[1]:old.a[1])))*p.elevationScaleM;
 if(error>.012)pairedCracks.push({error,e:old,f:{a:[...v.slice(a,a+3)],b:[...v.slice(b,b+3)],id:i/9,region:p.regionTable[p.regions[i/9]]}});
 old.count++;continue;
}
 const edge={a:[...v.slice(a,a+3)],b:[...v.slice(b,b+3)],count:1,region:p.regionTable[p.regions[i/9]],id:i/9};edges.set(k,edge);
 for(let z=Math.floor(Math.min(edge.a[2],edge.b[2])/size);z<=Math.floor(Math.max(edge.a[2],edge.b[2])/size);z++)for(let x=Math.floor(Math.min(edge.a[0],edge.b[0])/size);x<=Math.floor(Math.max(edge.a[0],edge.b[0])/size);x++){
 const k=`${x},${z}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(edge);
 }
}
const cracks=[...pairedCracks],unmatched=[];
for(const e of edges.values())if(e.count===1){
 const x=(e.a[0]+e.b[0])/2,z=(e.a[2]+e.b[2])/2,y=(e.a[1]+e.b[1])/2;let found=false;
 for(const f of buckets.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)||[]){
 if(f===e)continue;const dx=f.b[0]-f.a[0],dz=f.b[2]-f.a[2],l=dx*dx+dz*dz;
 const t=((x-f.a[0])*dx+(z-f.a[2])*dz)/l;
 if(t < -1e-8||t>1+1e-8||Math.hypot(x-f.a[0]-t*dx,z-f.a[2]-t*dz)>1e-5)continue;
 found=true;const error=Math.abs(y-(f.a[1]+t*(f.b[1]-f.a[1])))*p.elevationScaleM;if(error>.012)cracks.push({error,e,f});
 }
 if(!found)unmatched.push(e);
}
cracks.sort((a,b)=>b.error-a.error);
const steepMicroEdges=[...edges.values()].filter(e=>Math.hypot(e.a[0]-e.b[0],e.a[2]-e.b[2])<.002
 && Math.abs(e.a[1]-e.b[1])*p.elevationScaleM>.02);
return {cracks,unmatched,steepMicroEdges};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const p=deserialize(fs.readFileSync(process.argv[2])).packedSampler;
 const result=auditTerrainEdges(p);
 console.log(JSON.stringify({cracks:result.cracks.length,unmatched:result.unmatched.length,examples:result.cracks.slice(0,5)},null,2));
 fs.writeFileSync(process.argv[3] || 'artifacts/terrain-edge-audit.json',JSON.stringify(result,null,2));
}
