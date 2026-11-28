import test from 'node:test';
import assert from 'node:assert/strict';
import {createFasciaDemo,serializeVehicle,loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';
import {makeOpenings} from '../../src/ui/vehicleStudio/optics.mjs';

test('Paired optical controls persist and retain independent four-housing construction',()=>{
 const make=(housing,pairedOvalAspect)=>{
  const genome=createFasciaDemo('compound');
  Object.assign(genome.optics.front,{housing,pairedOvalAspect,physicalDiameter:.16,innerRoundRatio:.78,circleLift:0,outboard:.62});
  const valid=loadVehicle(serializeVehicle(genome));
  return makeOpenings({end:'front',g:valid,face:(u,v)=>[u*2-1,1-v*.62,1]}).filter(p=>p.component==='headlights');
 };
 const circle=make('dual-round',1),oval=make('dual-round',.77),angular=make('dual-trapezoid',1);
 for(const match of [circle,oval,angular])assert.equal(match.length,4);
 const aspect=p=>{
  const x=p.outline.map(q=>2*q[0]),y=p.outline.map(q=>.62*q[1]);
  return (Math.max(...y)-Math.min(...y))/(Math.max(...x)-Math.min(...x));
 };
 assert.ok(Math.abs(aspect(circle[0])-1)<.01);
 assert.ok(Math.abs(aspect(oval[0])-.77)<.01);
 assert.notDeepEqual(angular[0].outline,circle[0].outline); assert.deepEqual(angular.map(o=>o.id),circle.map(o=>o.id));
});
