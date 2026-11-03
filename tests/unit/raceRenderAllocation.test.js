import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../../src/racing/RaceProjectedPolygon.js';
import * as legacy from '../fixtures/raceProjectedPolygonLegacy.js';
import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
function context(){
 const calls=[];
 return {calls,set fillStyle(value){calls.push(['fillStyle',value]);},beginPath(){calls.push(['begin']);},moveTo(x,y){calls.push(['move',x,y]);},lineTo(x,y){calls.push(['line',x,y]);},closePath(){calls.push(['close']);},fill(){calls.push(['fill']);}};
}
function compare(bounds,points){
 const before=structuredClone(points);
 for(const name of ['appendRaceProjectedQuadPath','drawRaceProjectedVehicleQuad']){
  const a=context(),b=context();
  assert.equal(current[name](a,bounds,points,'#abc'),legacy[name](b,bounds,points,'#abc'),name);
  assert.deepEqual(a.calls,b.calls,name);
 }
 assert.deepEqual(points,before,'rendering must not mutate projected vertices');
}
test('scalar polygon painters preserve exact commands, clipping and culling across seeded polygons',()=>{
 let seed=42;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let n=0;n<2400;n++){
  const bounds=n%2?{x:0,y:20,w:390,h:700}:{x:30,y:0,w:900,h:400};
  const points=Array.from({length:3+n%6},()=>({screenX:(random()*4-1)*bounds.w,screenY:(random()*4-1)*bounds.h,visible:random()>.5,clippedToNearPlane:random()>.7}));
  compare(bounds,points);
 }
});
test('scalar polygon painters preserve degenerate, invalid, near-plane and numeric-string behavior',()=>{
 const bounds={x:0,y:0,w:300,h:200};
 compare(bounds,[]);compare(bounds,null);
 const quad=[{screenX:10,screenY:10,visible:true},{screenX:40,screenY:10},{screenX:40,screenY:40},{screenX:10,screenY:40}];
 compare(bounds,quad);
 for(const value of [undefined,null,NaN,Infinity,-Infinity,'25',0])for(const field of ['screenX','screenY']){
  const points=structuredClone(quad);points[1][field]=value;compare(bounds,points);
 }
 compare(bounds,quad.map(p=>({...p,screenY:10})));
 compare(bounds,quad.map(p=>({...p,visible:false})));
 compare(bounds,quad.map(p=>({...p,screenX:p.screenX*100,clippedToNearPlane:true})));
});
test('render snapshots select the latest four terrain impacts in chronological order without sharing mutable events',()=>{
 const history=Array.from({length:100},(_,i)=>({sequence:i,terrainImpact:i%3===0,bodyNormalImpulseNs:i*2,impactPointWorld:{x:i,y:2,z:3}}));
 const runner={state:{},config:{massKg:1400},impactHistory:history};
 const snapshot=createVehicleRenderStateFromRunner(runner);
 assert.deepEqual(snapshot.impactEvents.map(e=>e.sequence),[90,93,96,99]);
 history[99].impactPointWorld.x=-10;
 const next=createVehicleRenderStateFromRunner(runner);
 assert.equal(snapshot.impactEvents[3].pointWorld.x,99);
 assert.equal(next.impactEvents[3].pointWorld.x,-10);
 runner.terrainImpactHistory=[];
 assert.deepEqual(createVehicleRenderStateFromRunner(runner).impactEvents,[],'explicit empty terrain history takes precedence');
 for(let n=0;n<8;n++){
  runner.terrainImpactHistory=history.slice(0,n);
  assert.deepEqual(createVehicleRenderStateFromRunner(runner).impactEvents.map(e=>e.sequence),history.slice(0,n).filter(e=>e.terrainImpact).slice(-4).map(e=>e.sequence));
 }
});
