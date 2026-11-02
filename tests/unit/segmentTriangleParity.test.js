import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentTriangle} from '../../src/racing/simulation/StaticRaceColliderWorld.js';
import {addVector3,crossVector3,scaleVector3} from '../../src/racing/simulation/RigidBodyMath.js';
const EPSILON=1e-9;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// Frozen reference from the original allocation-heavy intersection algorithm.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const dot = (left = {}, right = {}) => finite(left.x) * finite(right.x)
  + finite(left.y) * finite(right.y)
  + finite(left.z) * finite(right.z);
const length = (value = {}) => Math.hypot(finite(value.x), finite(value.y), finite(value.z));
const normalize = (value = {}, fallback = { x: 0, y: 1, z: 0 }) => {
  const magnitude = length(value);
  return magnitude > EPSILON ? scaleVector3(value, 1 / magnitude) : { ...fallback };
};
const subtract = (left = {}, right = {}) => addVector3(left, scaleVector3(right, -1));
const mixVector = (left = {}, right = {}, fraction = 0) => ({
  x: finite(left.x) + (finite(right.x) - finite(left.x)) * fraction,
  y: finite(left.y) + (finite(right.y) - finite(left.y)) * fraction,
  z: finite(left.z) + (finite(right.z) - finite(left.z)) * fraction
});
function reference(start, end, triangle) {
  const direction = subtract(end, start);
  const edge1 = subtract(triangle.b, triangle.a);
  const edge2 = subtract(triangle.c, triangle.a);
  const p = crossVector3(direction, edge2);
  const determinant = dot(edge1, p);
  // With this Moller-Trumbore ordering, an outward-facing triangle produces a
  // positive determinant when the segment approaches from the solid's
  // exterior (direction dot normal < 0).
  if (!triangle.twoSided && determinant <= EPSILON) return null;
  if (Math.abs(determinant) <= EPSILON) return null;
  const inverse = 1 / determinant;
  const translated = subtract(start, triangle.a);
  const u = dot(translated, p) * inverse;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = crossVector3(translated, edge1);
  const v = dot(direction, q) * inverse;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const fraction = dot(edge2, q) * inverse;
  if (fraction < -1e-8 || fraction > 1 + 1e-8) return null;
  let normal = triangle.normal;
  if (triangle.twoSided && dot(direction, normal) > 0) normal = scaleVector3(normal, -1);
  if (dot(direction, normal) >= -EPSILON) return null;
  return {
    fraction: clamp(fraction, 0, 1),
    point: mixVector(start, end, clamp(fraction, 0, 1)),
    normal
  };
}

test('scalar intersections preserve original hits, normals and fractions', () => {
  let seed=42071;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const vector=()=>({x:(random()-.5)*100,y:(random()-.5)*100,z:(random()-.5)*100});
  let hits=0;
  for(let i=0;i<20000;i++) {
    const a=vector(), b=vector(), c=vector();
    const edge1=subtract(b,a),edge2=subtract(c,a);
    const triangle={a,b,c,normal:normalize(crossVector3(edge1,edge2)),twoSided:i%2===0};
    if(i%3) Object.assign(triangle,{edge1x:edge1.x,edge1y:edge1.y,edge1z:edge1.z,edge2x:edge2.x,edge2y:edge2.y,edge2z:edge2.z});
    const start=vector(),end=vector();
    const expected=reference(start,end,triangle);
    const actual=segmentTriangle(start,end,triangle);
    assert.deepEqual(actual,expected,`intersection ${i}`);
    if(actual) hits++;
    // Vertex, coplanar and zero-length segment cases.
    assert.deepEqual(segmentTriangle(a,a,triangle),reference(a,a,triangle));
    assert.deepEqual(segmentTriangle(a,b,triangle),reference(a,b,triangle));
  }
  assert.ok(hits>500);
});
