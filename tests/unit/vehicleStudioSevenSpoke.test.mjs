import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVehicle,normalizeVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {buildWheels} from '../../src/ui/vehicleStudio/wheels9.mjs';

test('7-spoke alloy is an opt-in native style for front and rear wheels',()=>{
 const g=createVehicle('fastback'), original=g.components.wheels.type;
 const wheels=(kind,rear,compact=2)=>{
  const next=structuredClone(g);next.components.wheels.type=kind;
  const n=normalizeVehicle(JSON.parse(JSON.stringify(next)));
  assert.equal(n.components.wheels.type,kind);
  return buildWheels(n,{quality:'drive',compact,rear}).filter(x=>x.material==='wheel');
 };
 for(const rear of [false,true]){
  assert.equal(wheels('7-spoke',rear).length,9); // lathed lip/hub plus seven independent spokes
  assert.equal(wheels('8-spoke',rear).length,10);
  assert.equal(wheels('5-spoke',rear).length,7);
 }
 assert.equal(g.components.wheels.type,original);
});
