import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadVehicle,serializeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {generateVehicle,disposeDesign} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';
const load=id=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/'+id+'.json',import.meta.url),'utf8'));
test('twin mesh yields two recessed front vents separated by solid center skin',()=>{
 const g=load('mitsubishi-eclipse-gt-2006'),d=generateVehicle(g,{quality:'drive',compact:1});
 try{
  const holes=d.fascia.front.openings.filter(o=>o.id.startsWith('upper-grille'));
  assert.equal(holes.length,2);
  const [l,r]=holes.sort((a,b)=>Math.min(...a.outline.map(p=>p[0]))-Math.min(...b.outline.map(p=>p[0])));
  assert(Math.min(...r.outline.map(p=>p[0]))-Math.max(...l.outline.map(p=>p[0]))>.025);
  assert.equal(d.fascia.front.trimArea.unmatched,0);
  assert(d.fascia.front.openings.some(o=>o.id.startsWith('lower-duct')));
  assert(d.parts.some(p=>p.component==='grille'&&p.material==='trim'));
  assert.deepEqual(d.diagnostics.issues,[]);
 }finally{disposeDesign(d);}
 const exp=exportVehicle(g,{quality:'drive'});
 assert(exp.metrics.carTriangles<=15000);
 assert.deepEqual(exportVehicle(loadVehicle(serializeVehicle(g)),{quality:'drive'}),exp);
});
test('stock trim choices separate the naturally aspirated base and turbo AWD coupe',()=>{
 const rs=load('mitsubishi-eclipse-rs-1995'),gsx=load('mitsubishi-eclipse-gsx-1995');
 assert.equal(rs.components.spoiler.type,'off');
 assert.notEqual(gsx.components.spoiler.type,'off');
 assert.equal(rs.components.wheels.type,'stamped steel');assert.equal(gsx.components.wheels.type,'5-spoke');
 assert(gsx.dimensions.stance<rs.dimensions.stance);
 assert(rs.construction.exhaust[0].count<gsx.construction.exhaust[0].count);
});
