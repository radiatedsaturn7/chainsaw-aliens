import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const root='data/server-storage/files',path=`${root}/races/p2loadtest/document.json`,doc=read(path),race=doc.race;
const tree=read(`${root}/doodads/tree/document.json`).doodad,factory=read(`${root}/doodads/Factory/document.json`).doodad;
const nodes=race.road.network.nodes,edges=race.road.network.edges;
const points=[...nodes,...edges.flatMap(e=>e.points||[])];
const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,radius=Math.max(...points.map(p=>Math.hypot(p.x-cx,p.z-cz)))+220;
race.scenery=(race.scenery||[]).filter(s=>!s.id?.startsWith('p2-stress-'));
const byId=new Map(nodes.map(n=>[n.id,n]));
const segments=edges.flatMap(e=>{const p=[byId.get(e.from),...(e.points||[]),byId.get(e.to)];return p.slice(1).map((b,i)=>({a:p[i],b,width:e.widthM||4}));});
const clear=(x,z,radius)=>segments.every(({a,b,width})=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)>radius+width/2+8;});
let added=0;
for(let i=0;i<points.length;i++){
 const p=points[i],next=points[(i+1)%points.length],angle=Math.atan2(next.z-p.z,next.x-p.x)+Math.PI/2;
 for(const side of [-1,1]){
 const isFactory=i%18===0,def=isFactory?factory:tree,offset=isFactory?125:35+(i%5)*9;
 let x,z;for(let attempt=0;attempt<40;attempt++){x=p.x+Math.cos(angle)*(offset+attempt*25)*side;z=p.z+Math.sin(angle)*(offset+attempt*25)*side;if(clear(x,z,def.hitboxWidthM/2))break;}
 if(!clear(x,z,def.hitboxWidthM/2))continue;
 race.scenery.push({id:`p2-stress-scenery-${added++}`,presetId:'doodad',doodadRef:isFactory?'Factory':'tree',previewDoodad:structuredClone(def),artRef:def.artRef,x,z,yaw:angle,widthM:def.widthM,heightM:def.heightM,state:'standing'});
 }
}
for(let section=0;section<6;section++){
 const path=Array.from({length:17},(_,i)=>{const angle=(section+i/16)*Math.PI/3;return{x:cx+Math.cos(angle)*radius,z:cz+Math.sin(angle)*radius};});
 race.scenery.push(...buildRaceFencePlacements(path,{...tree,name:'P2 perimeter tree fence',isFence:true,widthM:15.3,groundOffsetM:0},{id:`p2-stress-fence-${section}`,ref:'tree'}));
}
doc.savedAt=Date.now();
fs.writeFileSync(path,JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(doc)).toString('base64')},null,2)+'\n');
const metaPath=`${root}/races/p2loadtest/metadata.json`,meta=read(metaPath);meta.savedAt=doc.savedAt;fs.writeFileSync(metaPath,JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({addedDoodads:added,fences:6,fencePanels:race.scenery.filter(s=>s.fenceId?.startsWith('p2-stress-')).length,totalScenery:race.scenery.length,radius}));
