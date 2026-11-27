import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';

const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
const edges=part=>{
 const {position:p}=part.geometry.attributes,length=p.count;
 return Array.from({length},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);
};
const squaredDistanceToSegment=(p,a,b)=>{
 const delta=b.map((x,i)=>x-a[i]), length=delta.reduce((s,x)=>s+x*x,0);
 const t=length?Math.max(0,Math.min(1,delta.reduce((s,x,i)=>s+x*(p[i]-a[i]),0)/length)):0;
 return delta.reduce((s,x,i)=>s+(p[i]-a[i]-t*x)**2,0);
};
for(const id of ['honda-s660','kia-carnival','rally-fighter'])test(id+' arch hems follow actual panel rails with outward normals on both sides',()=>{
 const d=generateVehicle(load(id),{quality:'drive',compact:1});
 try{
  const hems=d.parts.filter(p=>p.geometry.userData.constructionRole==='wheel arches / folded hem');
  const segments=[];
  for(const p of d.parts){
   if(p.material!=='paint'||p.geometry.userData.constructionRole||
     !['frontFenders','rearFenders','frontBumper','rearBumper','doors'].includes(p.component))continue;
   const v=edges(p),uv=p.geometry.attributes.uv;
   const points=v.filter((_,i)=>uv.getY(i)===1);
   for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);
  }
  const crowns=new Set();
  for(const p of hems){
   const geo=p.geometry,n=geo.attributes.normal,uv=geo.attributes.uv;
   const a=edges(p),side=Math.sign(a[0][0]);
   for(let i=0;i<a.length;i++)if(uv.getY(i)===0){
    assert.ok(segments.some(([x,y])=>squaredDistanceToSegment(a[i],x,y)<1e-12));
    if(Math.abs(a[i][2])>1&&a[i][1]>.45){
     assert.ok(n.getX(i)*side>0);
     crowns.add(p.component+':'+side);
    }
   }
  }
  assert.equal(crowns.size,4);
  const skirts=d.parts.filter(p=>p.component==='rockers');
  assert.equal(skirts.length,2);
  for(const {geometry:g} of skirts){
   const p=g.attributes.position,n=g.attributes.normal;
   assert.ok(p.getX(0)*n.getX(0)>0);
  }
 }finally{disposeDesign(d);}
});
