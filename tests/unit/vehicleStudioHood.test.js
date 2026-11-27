import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

const widths=(parts,k)=>Math.max(...parts.filter(p=>p.component===k).map(p=>{
 p.geometry.computeBoundingBox();const b=p.geometry.boundingBox;return b.max.x-b.min.x;
}));
const pick=(a,k)=>a.parts.find(p=>p.component===k).geometry.getAttribute('position').array;
test('formed shoulders and independent scoop dimensions preserve shared hood edges and attachment points',()=>{
 const old=createFasciaDemo('rally');
 const g=updateDesign(old,'construction','hood',{...old.construction.hood,shoulderRise:.034,shoulderAt:.70,shoulderSweep:.12,scoopWidth:.615,scoopHeight:.105,scoopCorner:.77});
 assert.deepEqual(g,loadVehicle(serializeVehicle(g)));
 const a=generateVehicle(old,{quality:'drive'}),b=generateVehicle(g,{quality:'drive'});
 try {
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.deepEqual(a.metadata,b.metadata);
  assert.ok(widths(b.parts,'scoop')>widths(a.parts,'scoop')+.04);
  const A=pick(a,'hood'),B=pick(b,'hood'),stride=(22+1)*3;
  assert.equal(A.length,B.length);assert.notDeepEqual(A,B);
  assert.deepEqual(A.slice(0,stride),B.slice(0,stride));
  assert.deepEqual(A.slice(-stride),B.slice(-stride));
  const exp=exportVehicle(g,{quality:'drive'});
  assert.deepEqual(exp,exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}));
 }finally{disposeDesign(a);disposeDesign(b);}
});
test('older design records preserve neutral hood controls, invalid dimensions are rejected',()=>{
 const old=createFasciaDemo('rally');delete old.construction.hood;
 const current=loadVehicle(JSON.stringify(old));assert.equal(current.construction.hood.scoopWidth,0);assert.equal(current.construction.hood.shoulderRise,0);
 assert.throws(()=>updateDesign(current,'construction','hood',{...current.construction.hood,scoopWidth:.92}),/Out of range/);
});

test('longitudinal hood fairing removes the center hump while keeping the stock fender edges',async()=>{
 const {readFileSync}=await import('node:fs');
 const g=loadVehicle(readFileSync(new URL('../../tools/vehicle-validation/wrx-fit12-genome.json',import.meta.url),'utf8'));
 const old=structuredClone(g);old.construction.hood.noseFairing=0;
 const a=generateVehicle(old,{quality:'preview'}),b=generateVehicle(g,{quality:'preview'});
 try{
  assert.deepEqual(b.diagnostics.issues,[]);
  assert.deepEqual(a.wheels,b.wheels);
  assert.deepEqual(a.lampMounts,b.lampMounts);
  const points=d=>d.parts.find(x=>x.component==='hood').geometry.attributes.position;
  const center=d=>{
   const p=points(d),out=[];
   for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<1e-5)out.push([p.getZ(i),p.getY(i)]);
   return out.sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  };
  const A=center(a),B=center(b);
  assert.ok(A[2]>A[0]+.035,'legacy profile bulges upward after the windshield');
  assert.ok(B.every((y,i)=>!i||y<B[i-1]),'forward hood profile always slopes downward');
  const drop=B.slice(1).map((y,i)=>B[i]-y);
  assert.ok(drop.every((v,i)=>!i||v>drop[i-1]),'nose sweep bends one way rather than reversing curvature');
  assert.ok(Math.abs(A[0]-B[0])<.003&&Math.abs(A.at(-1)-B.at(-1))<.004,'closed panel keeps its endpoint heights');
  for(let i=0;i<points(a).count;i++){
   for(const fn of ['getX','getZ'])assert.equal(points(a)[fn](i),points(b)[fn](i));
   if(i%33===0||i%33===32)assert.equal(points(a).getY(i),points(b).getY(i),'outer fender rails are unchanged');
  }
 }finally{disposeDesign(a);disposeDesign(b);}
});
