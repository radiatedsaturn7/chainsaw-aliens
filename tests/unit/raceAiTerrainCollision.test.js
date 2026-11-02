import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRaceAiTerrainCollision } from '../../src/racing/RaceAiTerrainCollision.js';
const state = {position:{x:0,y:0.55,z:0},velocity:{x:0,y:0,z:10}};
const positions = {fl:{y:0.34},fr:{y:0.34},rl:{y:0.34},rr:{y:0.34}};
function frame(overrides={}) {
  return {
    classifyCollisionFeaturesInBounds:()=>({classification:'smooth-connected-surface',discontinuity:false}),
    samplePoint:()=>({valid:true,heightM:0}), maximumHeightInBounds:()=>0, ...overrides
  };
}
test('smooth supported AI road exposes the existing collision fast path',()=>{
  const r=classifyRaceAiTerrainCollision(frame(),state,{},positions);
  assert.equal(r.bodyCollisionPredicted,false);
  assert.equal(r.terrainCollisionClassification,'smooth-connected-surface');
});
test('AI terrain optimization retains collision checks for steps, unsupported ground, roll and bottoming',()=>{
  for(const [f,s] of [
    [frame({classifyCollisionFeaturesInBounds:()=>({classification:'height-discontinuity',discontinuity:true})}),state],
    [frame({samplePoint:()=>({valid:false,heightM:null})}),state],
    [frame(),{...state,rollRad:0.5}],
    [frame(),{...state,position:{...state.position,y:0.45}}],
    [frame(),{...state,velocity:{x:0,y:-10,z:10}}]
  ]) assert.equal(classifyRaceAiTerrainCollision(f,s,{},positions).bodyCollisionPredicted,true);
  assert.deepEqual(classifyRaceAiTerrainCollision(null,state,{},positions),{});
});
test('AI swept collision bounds include next position and wheel vertical extent',()=>{
  const queries=[];
  classifyRaceAiTerrainCollision(frame({classifyCollisionFeaturesInBounds:b=>{
    queries.push({...b});return {classification:'smooth-connected-surface',discontinuity:false};
  }}),state,{},positions,0.1);
  assert.equal(queries.length,2);
  assert.ok(queries[0].maxZ > -queries[0].minZ+0.99);
  assert.ok(queries[1].minY<=-0.08 && queries[1].maxY>=0.76);
});
