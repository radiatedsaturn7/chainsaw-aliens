import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {makeOpenings,emitOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const bounds=o=>[Math.min(...o.outline.map(p=>p[0])),Math.max(...o.outline.map(p=>p[0])),Math.min(...o.outline.map(p=>p[1])),Math.max(...o.outline.map(p=>p[1]))];
test('lower intake grows upward without moving its chin edge or intersecting the upper grille/fog covers',()=>{
 const g=createFasciaDemo('rally');
 Object.assign(g.components.fogs,{type:'blank',size:1.28,depth:1.28});
 Object.assign(g.fascia.front,{intakeShape:'rectangle',intakes:'single',intakeWidth:1,intakeHeight:1,fogCoverHeight:1});
 const a=makeOpenings({end:'front',g});
 Object.assign(g.fascia.front,{lowerIntakeRise:.10,lowerIntakeDepth:.04,fogCoverStamp:.85});
 const b=makeOpenings({end:'front',g});
 const find=(o,k)=>o.find(x=>x.id===k);
 const u=find(b,'upper-grille'),d=find(b,'lower-duct'),f=b.filter(x=>x.kind==='blank');
 const val=bounds(d),old=bounds(find(a,'lower-duct'));
 assert.deepEqual(u,find(a,'upper-grille'));
 assert.ok(Math.abs(old[3]-val[3])<1e-10);
 assert.ok(old[2]-val[2]>.075);
 assert.ok(val[2]-bounds(u)[3]>.03);
 for(const x of f){const p=bounds(x);assert.ok(p[1]+.007<=val[0]||p[0]-.007>=val[1]);}
 assert.ok(val[1]-val[0]>.3,'widened fog covers must not squeeze the central duct to a slit');
 const mesh=generateVehicle(g,{quality:'drive'});
 try{assert.deepEqual(mesh.diagnostics.issues,[]);assert.equal(mesh.fascia.front.trimArea.unmatched,0);}finally{disposeDesign(mesh);}
 const e=exportVehicle(g);
 assert.deepEqual(e,exportVehicle(loadVehicle(serializeVehicle(g))));
 assert.ok(e.metrics.carTriangles<=15000);
});
test('duct depth and fog stamp change surfaces without adding faces or modifying the upper grille',()=>{
 const g=createFasciaDemo('rally');g.components.fogs.type='blank';
 const split=(id)=>{
  const openings=makeOpenings({end:'front',g}).filter(o=>o.id===id),bins=[];
  assert.equal(openings.length,1);
  emitOpenings({end:'front',openings,surface:(u,v)=>[u,1-v,0],put:(comp,mat,geo)=>{
   bins.push({mat,faces:geo.index.count/3,depth:Math.min(...Array.from(geo.attributes.position.array).filter((_,i)=>i%3===2))});geo.dispose();
  }});
  return bins;
 };
 const upper=split('upper-grille'),lower=split('lower-duct'),fog=split('fog-l');
 Object.assign(g.fascia.front,{lowerIntakeDepth:.040,fogCoverStamp:.90});
 const b=split('lower-duct'),c=split('fog-l');
 assert.deepEqual(upper,split('upper-grille'));
 assert.deepEqual(b.map(x=>x.faces),lower.map(x=>x.faces));
 assert.deepEqual(c.map(x=>x.faces),fog.map(x=>x.faces));
 assert.ok(Math.min(...b.map(x=>x.depth))<Math.min(...lower.map(x=>x.depth))-.039);
 assert.ok(Math.min(...c.map(x=>x.depth))<Math.min(...fog.map(x=>x.depth))-.006);
});
