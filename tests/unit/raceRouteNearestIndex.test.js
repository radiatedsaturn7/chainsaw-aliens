import test from 'node:test';import assert from 'node:assert/strict';
import {buildRaceRouteNearestIndex,nearestRaceRouteSegment} from '../../src/racing/RaceRouteNearestIndex.js';
test('spatial route fallback matches exhaustive search far from hairpins and behind the grid',()=>{
 const points=Array.from({length:3000},(_,i)=>({x:Math.sin(i*.015)*400,z:i*3+Math.cos(i*.12)*40}));
 const tree=buildRaceRouteNearestIndex(points);
 for(let q=0;q<500;q++){
  const x=Math.sin(q*1.13)*8000,z=Math.cos(q*.87)*12000;let best=Infinity,index=-1;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/Math.max(.0001,dx*dx+dz*dz))),ox=x-a.x-dx*t,oz=z-a.z-dz*t,d=ox*ox+oz*oz;if(d<best){best=d;index=i;}}
  assert.equal(nearestRaceRouteSegment(tree,x,z),index);
 }
});
test('nearest index retains first-segment tie behavior and handles empty routes',()=>{
 assert.equal(nearestRaceRouteSegment(buildRaceRouteNearestIndex([]),0,0),-1);
 assert.equal(nearestRaceRouteSegment(buildRaceRouteNearestIndex([{x:0,z:0},{x:0,z:0},{x:10,z:0}]),0,0),1);
});

import RaceEditor from '../../src/ui/RaceEditor.js';
import {referenceProjection} from './fixtures/routeProjectionReference.js';
test('allocation-reduced route projection matches the frozen reference exactly',()=>{
 const samples=Array.from({length:500},(_,i)=>({x:Math.sin(i*.04)*200,z:i*2+Math.cos(i*.13)*30,distance:i*4,index:i,segment:{id:i}}));
 samples[200]={...samples[199]};
 const create=()=>{
  const e=Object.create(RaceEditor.prototype);
  Object.defineProperty(e,'selectedRace',{value:{road:{}}});
  e.getRacePathSamplesCached=()=>samples;
  return e;
 };
 const actual=create(),reference=create();
 for(let i=0;i<2000;i++){
  const point=i<500?samples[i]:{x:Math.sin(i*.87)*1500,z:Math.cos(i*1.13)*2000};
  assert.deepEqual(actual.getRaceRouteProjectionForWorldPoint(point),referenceProjection.call(reference,point),`point ${i}`);
 }
});


test('route projection keeps retained results independent and invalidates replaced samples',()=>{
 let samples=[{x:0,z:0,distance:0},{x:0,z:100,distance:100}];
 const e=Object.create(RaceEditor.prototype);
 Object.defineProperty(e,'selectedRace',{value:{road:{}}});
 e.getRacePathSamplesCached=()=>samples;
 const first=e.getRaceRouteProjectionForWorldPoint({x:2,z:25});
 const saved=structuredClone(first);
 const second=e.getRaceRouteProjectionForWorldPoint({x:-2,z:75});
 assert.notEqual(first,second);assert.deepEqual(first,saved);
 const previousIndex=e.raceRouteProjectionIndex;
 samples=[{x:100,z:0,distance:0},{x:100,z:100,distance:100}];
 assert.equal(e.getRaceRouteProjectionForWorldPoint({x:102,z:25}).x,100);
 assert.notEqual(e.raceRouteProjectionIndex,previousIndex);
 assert.deepEqual(first,saved);
});
