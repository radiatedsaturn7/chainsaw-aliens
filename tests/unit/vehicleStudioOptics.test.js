import test from 'node:test';
import assert from 'node:assert/strict';
import {HOUSING_FAMILIES,makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
const seg=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const crosses=(a,b,c,d)=>seg(a,b,c)*seg(a,b,d)<-1e-16&&seg(c,d,a)*seg(c,d,b)<-1e-16;
const settings=(options)=>({components:{fogs:{size:2,depth:2},grille:{size:2,depth:2}},
 optics:{front:options,rear:options},fascia:{front:{intakes:'split'},rear:{intakes:'single'}}});
test('all optical footprints are simple, 32 points, and stay in disjoint tiles at slider extremes',()=>{
 for(const housing of HOUSING_FAMILIES)for(const x of [0,1])for(const angle of [-1,0,1])for(const end of ['front','rear']){
  const g=settings({housing,width:x,height:x,corner:x,sweep:x,angle,position:x,outline:[1,-1,1,-1,1,-1,1,-1]});
  const openings=makeOpenings({end,g});
  const bounds=openings.map(({outline:a})=>{
   assert.equal(a.length,32);
   for(let i=0;i<a.length;i++){
    assert.ok(a[i].every(v=>v>=.02&&v<=.98));
    for(let j=i+2;j<a.length;j++)assert.ok(!crosses(a[i],a[(i+1)%a.length],a[j],a[(j+1)%a.length]));
   }
   return [0,1].map(i=>[Math.min(...a.map(p=>p[i])),Math.max(...a.map(p=>p[i]))]);
  });
  for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
   const a=bounds[i],b=bounds[j];
   assert.ok(a.some(([lo,hi],k)=>hi<b[k][0]||b[k][1]<lo),[end,housing,i,j]);
  }
 }
});
test('each rim is emitted at exactly the cap boundary, gasket/cover are independent, both outward normals',()=>{
 for(const end of ['front','rear'])for(const layout of ['projector','twin','led','mixed']){
  const sign=end==='front'?1:-1,surface=(u,v)=>[(u-.5)*1.8,1-v*.63,sign*(2.25-(u-.5)**2*.32)];
  const openings=makeOpenings({end,g:settings({housing:'compound',layout,height:.66,width:.82,protrusion:0})});
  const parts=[];const {mounts,issues}=emitOpenings({end,openings,surface,put:(component,material,geometry)=>parts.push({component,material,geometry})});
  assert.equal(Object.keys(mounts).length,2);assert.equal(issues.length,0);
  assert.ok(parts.filter(p=>p.material==='opticCover').length>=2);
  if(end==='front')assert.equal(parts.filter(p=>p.material==='signalL'||p.material==='signalR').length,2);
  const painted=parts.filter(p=>p.material==='paint').flatMap(p=>{
   const a=p.geometry.attributes.position;
   return Array.from({length:a.count},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]);
  });
  for(const a of openings)for(const [u,v] of a.outline){
   const p=surface(u,v);assert.ok(painted.some(q=>q.every((x,i)=>Math.abs(x-p[i])<2e-7)));
  }
  for(const part of parts){
   const {position}=part.geometry.attributes,idx=part.geometry.index.array;
   for(let i=0;i<idx.length;i+=3){
    const xyz=[...idx.slice(i,i+3)].map(k=>[position.getX(k),position.getY(k),position.getZ(k)]);
    assert.ok(seg(...xyz)*sign>-4e-10,part.material);
   }
  }
 }
});

test('Forester receives one continuous upright corner aperture per side, with no extra lens cutouts',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {loadVehicle}=await import('../../src/ui/vehicleStudio/genome.mjs');
 const g=loadVehicle(await readFile(new URL('../../src/ui/vehicleStudio/examples/subaru-forester.json',import.meta.url),'utf8'));
 const lenses=()=>makeOpenings({end:'rear',g}).filter(o=>o.kind==='lamp');
 const apertureBounds=o=>{
  const ys=o.outline.map(p=>p[1]),xs=o.outline.map(p=>p[0]);
  return {span:Math.max(...ys)-Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),top:Math.min(...ys)};
 };
 const taller=lenses();
 g.optics.rear.tallHousing=.42;
 const standard=lenses();
 assert.equal(taller.length,2);
 assert.deepEqual(taller.map(x=>x.id),standard.map(x=>x.id));
 for(let i=0;i<2;i++){
  const a=apertureBounds(taller[i]),b=apertureBounds(standard[i]);
  assert.ok(a.span>b.span*1.25);
  assert.ok(Math.abs(a.width-b.width)<1e-9);
  assert.ok(Math.abs(a.top-b.top)<1e-9);
 }
});
