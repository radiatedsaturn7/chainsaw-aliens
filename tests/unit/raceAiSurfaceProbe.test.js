import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceAiSurfaceProbe} from '../../src/racing/RaceAiSurfaceProbe.js';

test('surface candidates share geometry while retaining exact positions for every lane',()=>{
 let poses=0,sections=0,width=5;
 const editor={getSelectedRaceRuntimeType:()=> 'circuit',
  getRaceWorldPoseAtDistance:(distance,{runtimeType})=>{assert.equal(runtimeType,'circuit');poses++;return {x:Math.sin(distance),z:Math.cos(distance),yaw:distance/123};},
  getRaceSurfaceSectionAtDistance:(distance,{routeLength})=>{assert.equal(routeLength,1000);sections++;return {metrics:{roadEnd:width}};},
  getRaceRightVector:yaw=>({x:Math.cos(yaw),z:-Math.sin(yaw)})};
 const probe=createRaceAiSurfaceProbe(editor,{},1000);
 for(const offset of [-.68,-.34,0,.34,.68])for(const distance of [10,22,38,56]){
  const point=probe(distance,offset);
  assert.deepEqual(point,{x:Math.sin(distance)+Math.cos(distance/123)*(offset*width),z:Math.cos(distance)-Math.sin(distance/123)*(offset*width)});
 }
 assert.equal(poses,4);assert.equal(sections,4);
 width=8;
 const next=createRaceAiSurfaceProbe(editor,{},1000);
 assert.deepEqual(next(10,.5),{x:Math.sin(10)+Math.cos(10/123)*4,z:Math.cos(10)-Math.sin(10/123)*4});
 assert.equal(poses,5);
});

test('surface probe retains fallback coordinates, road width and lateral clamping',()=>{
 const e={getSelectedRaceRuntimeType:()=> 'destination',getRaceWorldPoseAtDistance:()=>({x:3,y:4,yaw:0}),
 getRaceSurfaceSectionAtDistance:()=>({}),getRaceRoadHalfWidthWorld:()=>2,getRaceRightVector:()=>({x:1,z:0})};
 const probe=createRaceAiSurfaceProbe(e,{},100);
 assert.deepEqual(probe(10,2),{x:4.7,z:4});
 assert.deepEqual(probe(10,-2),{x:1.3,z:4});
 assert.deepEqual(probe(10,undefined),{x:3,z:4});
});

test('AI lane candidates use lightweight metrics without requesting terrain cross sections',()=>{
 const editor={getSelectedRaceRuntimeType:()=> 'destination',
  getRaceWorldPoseAtDistance:d=>({x:d,z:0,yaw:0}),
  getRaceSurfaceMetricsAtDistance:()=>({roadEnd:6}),
  getRaceSurfaceSectionAtDistance:()=>{throw Error('unnecessary terrain query');},
  getRaceRightVector:()=>({x:1,z:0})};
 const probe=createRaceAiSurfaceProbe(editor,{},100);
 assert.deepEqual(probe(20,.5),{x:23,z:0});
});
