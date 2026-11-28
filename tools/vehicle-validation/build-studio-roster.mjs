// Exports editable Studio designs on the stock roster's native wheel hardpoints.
// Asset bindings, suspension and car documents remain immutable.
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {exportVehicle,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';
import {encodeStudioRosterPair} from '../../src/model3d/StudioRosterPack.js';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';

const studioDir=new URL('../../src/ui/vehicleStudio/examples/',import.meta.url);
const outputDir=new URL('../../src/model3d/studio-roster/',import.meta.url);
const targets=()=>JSON.parse(readFileSync(new URL('./studio-roster-hardpoints.json',import.meta.url),'utf8'));
const get=(body,key)=>body.joints.find(j=>j.name==='WheelMount_'+key).position;
const mean=(a,b)=>a.map((n,i)=>(n+b[i])/2);
const unit=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};

// A few stock source models were authored looking down -Z despite an identity
// runtime binding. Record raw anchors before half-turning them; side is a
// physical signed chassis slot, never inferred from the legacy source suffix.
export function normalizeStockFrame(frame){
 if(frame===undefined)return null;
 assert.equal(frame.forward,'-z');
 assert.equal(frame.basis,'raw-stock-model');
 assert.equal(frame.joints.length,8);
 const destination=new Map();
 for(const {name,position,rotation} of frame.joints){
  const parts=name.match(/^(WheelMount_[FR]|HeadlightMount_|TaillightMount_)([LR])$/);
  assert.ok(parts&&position.length===3&&position.every(Number.isFinite)&&Math.abs(position[0])>.01,'Invalid raw anchor: '+name);
  assert.ok(rotation.length===4&&rotation.every(Number.isFinite)&&Math.abs(Math.hypot(...rotation)-1)<1e-6);
  const [x,y,z]=position,[qx,qy,qz,qw]=rotation;
  const front=parts[1]==='WheelMount_F'||parts[1]==='HeadlightMount_';
  assert.equal(Math.sign(z),front?-1:1,'Raw axle/light end disagrees with frame: '+name);
  const key=parts[1]+(-x<0?'L':'R');
  assert.ok(!destination.has(key),'Duplicate stock anchor destination: '+key);
  // Canonicalize signed zeros so a JSON round-trip preserves exact joints.
  destination.set(key,{source:name,position:[-x,y,-z],rotation:[qz,qw,-qx,-qy].map(v=>v===0?0:v)});
 }
 return destination;
}

export function buildStudioRoster(target){
 const genome=loadVehicle(readFileSync(new URL(target.id+'.json',studioDir),'utf8'));
 const bundle=exportVehicle(genome,{quality:'drive'});
 const [body,wheel]=Object.values(bundle.models);
 const [sF,sR]=['F','R'].map(a=>mean(get(body,a+'L'),get(body,a+'R')));
 const exactStock=normalizeStockFrame(target.stockFrame);
 const [tf,tr]=exactStock?['F','R'].map(a=>{
  const l=exactStock.get('WheelMount_'+a+'L').position,r=exactStock.get('WheelMount_'+a+'R').position;
  const c=mean(l,r);return {track:r[0]-l[0],y:c[1],z:c[2]};
 }):target.axles;
 if(exactStock)for(const [i,expected] of [tf,tr].entries())assert.deepEqual(expected,target.axles[i],'Authored and normalized axles disagree');
 const fScale=tf.track/Math.abs(get(body,'FR')[0]-get(body,'FL')[0]);
 const rScale=tr.track/Math.abs(get(body,'RR')[0]-get(body,'RL')[0]);
 const dz=sF[2]-sR[2],sz=(tf.z-tr.z)/dz;
 const y=(tf.y+tr.y-sF[1]-sR[1])/2;
 assert.ok(sz>.9&&sz<1.1&&fScale>.85&&rScale>.85&&fScale<1.15&&rScale<1.15,'Unreasonable stock wheel alignment');
 const at=z=>Math.max(0,Math.min(1,(z-sR[2])/dz));
 const sx=z=>rScale+(fScale-rScale)*at(z);
 const shift=([x,v,z])=>[x*sx(z),v+y,tr.z+(z-sR[2])*sz];
 const old=new Map(body.vertices.map(v=>[v.id,v.position]));
 for(const v of body.vertices)v.position=shift(v.position);
 for(const face of body.faces)face.cornerNormals=face.cornerNormals?.map(([x,y,z],i)=>{
  const [vx,,vz]=old.get(face.vertices[i]);
  const shear=vz>=sR[2]&&vz<=sF[2]?vx*(fScale-rScale)/dz:0,u=x/sx(vz);
  return unit(u,y,(z-shear*u)/sz);
 });
 for(const j of body.joints){
  j.position=shift(j.position);
  const key=j.name.match(/^WheelMount_([FR])([LR])$/);
  const exact=exactStock?.get(j.name);
  if(exact){j.position=exact.position;if(!key)j.rotation=exact.rotation;}
  else if(key){const a=key[1]==='F'?tf:tr;j.position=[(key[2]==='L'?-1:1)*a.track/2,a.y,a.z];}
 }
 // Align the replacement tire's visible radius to the physics wheel without
 // touching physics. The original visual's positive-X outboard uses the
 // same single wheel asset mirrored by the regular engine paths.
 const rad=target.radius/(genome.dimensions.diameter/2);
 assert.ok(rad>.84&&rad<1.17,'Tire radius differs too much from the existing car');
 for(const model of [wheel,wheel.rearAxleModel].filter(Boolean)){
  for(const v of model.vertices){v.position[1]*=rad;v.position[2]*=rad;}
  for(const f of model.faces)f.cornerNormals=f.cornerNormals?.map(n=>unit(n[0],n[1]/rad,n[2]/rad));
 }
 body.name=target.label+' · Studio body';wheel.name=target.label+' · Studio wheel';
 const triangles=body.faces.length+2*(wheel.faces.length+(wheel.rearAxleModel?.faces.length??wheel.faces.length));
 assert.ok(triangles<=GAMEPLAY_TRIANGLE_BUDGET);
 return {pair:{body,wheel},metrics:{triangles,rad}};
}
if(process.argv.includes('--write')){
 const selected=new Set(process.argv.slice(process.argv.indexOf('--write')+1).filter(arg=>arg!=='--compact'));
 const compact=process.argv.includes('--compact');
 const rows=targets();
 const known=new Set(rows.map(t=>t.id));
 for(const id of selected)assert.ok(known.has(id),'Unknown roster study: '+id);
 for(const t of rows.filter(t=>!selected.size||selected.has(t.id))){
  const {pair,metrics}=buildStudioRoster(t);
  writeFileSync(new URL(t.id+'.pack',outputDir),gzipSync(JSON.stringify(compact?encodeStudioRosterPair(pair):pair),{level:9}));
  console.log(t.label,JSON.stringify(metrics));
 }
 // The literal URLs are bundling/deployment friendly, and only enumerated
 // exact stock model references can route to the new assets. Use .js for
 // this eagerly imported runtime module so ordinary static hosts give it a
 // JavaScript MIME type, including in the race bake worker.
 const index='// Generated by tools/vehicle-validation/build-studio-roster.mjs.\nexport const studioRoster=[\n'+rows.map(({id,label,bodyRef,wheelRef,capability,reference})=>
  ' '+JSON.stringify({id,label,bodyRef,wheelRef,capability,reference}).slice(0,-1)+',pack:new URL(\'./'+id+'.pack\',import.meta.url)}'
 ).join(',\n')+'\n];\n';
 writeFileSync(new URL('index.js',outputDir),index);
}
