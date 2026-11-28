import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';
import {generateVehicle} from '../../src/ui/vehicleStudio/geometry.mjs';
import {exportVehicle} from '../../src/ui/vehicleStudio/export.mjs';

test('direct corner-duct rise lifts the upper edge without lowering the chin or taking lamp space',()=>{
 const g=loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/lamborghini-huracan-lp6104-eu-2014.json',import.meta.url),'utf8'));
 const old=structuredClone(g);old.fascia.front.cornerIntakeRise=0;
 assert.equal(createVehicle().fascia.front.cornerIntakeRise,0);
 const openings=g=>makeOpenings({end:'front',g});
 const ducts=g=>openings(g).filter(o=>o.id==='lower-duct-r'||o.id==='lower-duct-l');
 const ymax=o=>Math.max(...o.outline.map(q=>q[1])),ymin=o=>Math.min(...o.outline.map(q=>q[1]));
 assert.equal(ducts(g).length,2);
 for(const [i,d] of ducts(g).entries()){
  const b=ducts(old)[i];
  assert.ok(ymin(b)-ymin(d)>.06);
  assert.ok(Math.abs(ymax(d)-ymax(b))<1e-8);
  const lamp=openings(g).find(o=>o.kind==='lamp'&&Math.sign(o.center[0]-.5)===Math.sign(d.center[0]-.5));
  assert.ok(ymin(d)>ymax(lamp)+.010);
 }
 const a=generateVehicle(g,{quality:'drive',compact:2});
 const b=generateVehicle(old,{quality:'drive',compact:2});
 assert.deepEqual(a.diagnostics.issues,[]);
 assert.deepEqual(a.lampMounts,b.lampMounts);
 const [body,wheel]=Object.values(exportVehicle(g,{quality:'drive'}).models);
 assert.ok(body.faces.length+2*(wheel.faces.length+(wheel.rearAxleModel?.faces.length??wheel.faces.length))<=15000);
});
