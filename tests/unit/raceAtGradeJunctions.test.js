import test from 'node:test';
import assert from 'node:assert/strict';
import {joinRaceAtGradeCrossings} from '../../src/racing/RaceAtGradeJunctions.js';
import {buildRaceCanonicalSurfaceMesh} from '../../src/racing/RaceCanonicalSurfaceMesh.js';
import {getRaceTerrainTriangleArea} from '../../src/racing/RaceTerrainClipping.js';
const section=(x,z,yaw=0,height=0,structure='road')=>{
 const point=(offset)=>({x:x+Math.cos(yaw)*offset,z:z-Math.sin(yaw)*offset,elevation:height/12});
 return {center:{...point(0),segment:{surface:'asphalt',structure}},left:point(-4),right:point(4),marginLeft:point(-5),marginRight:point(5),shoulderLeft:point(-7),shoulderRight:point(7)};
};
function crossing(height=.5,structure='road'){
 const sections=[];
 for(let z=-40;z<=40;z+=2)sections.push(section(0,z));
 sections.push(section(-40,60),section(-40,0,Math.PI/2,height,structure));
 for(let x=-38;x<=40;x+=2)sections.push(section(x,0,Math.PI/2,height,structure));
 return sections;
}
function inside(p,t){
 const a=getRaceTerrainTriangleArea(t),sum=t.reduce((n,v,i)=>n+getRaceTerrainTriangleArea([p,v,t[(i+1)%3]]),0);
 return Math.abs(a-sum)<1e-7;
}
test('crossing has one continuous road surface and no shoulders through it',()=>{
 const sections=crossing(),junctions=joinRaceAtGradeCrossings(sections);
 assert.equal(junctions.length,1);
 const mesh=buildRaceCanonicalSurfaceMesh({surfaceBake:{sections,junctions}});
 for(const x of [-3.31,-1.31,.69,2.69])for(const z of [-3.17,-1.17,.83,2.83]){
  const triangles=mesh.triangles.filter(t=>inside({x,z},t.vertices));
  assert.equal(triangles.length,1,`single surface at ${x},${z}`);
  assert.equal(triangles[0].region,'road');
  for(const p of triangles[0].vertices)assert.ok(Math.abs(p.elevation*12-.25)<1e-6);
 }
 assert.equal(sections[0].center.elevation,0,'distant approach unchanged');
 assert.ok(mesh.triangles.every(t=>t.vertices.every(p=>Number.isFinite(p.elevation))));
});
test('bridges, tunnels, height separation and ordinary bends stay separate',()=>{
 for(const [height,structure] of [[0,'bridge'],[0,'tunnel'],[5,'road']]){
  const sections=crossing(height,structure),before=JSON.stringify(sections);
  assert.equal(joinRaceAtGradeCrossings(sections).length,0);
  assert.equal(JSON.stringify(sections),before);
 }
 assert.equal(joinRaceAtGradeCrossings(Array.from({length:40},(_,i)=>section(i*.2,i*2))).length,0);
});
test('crossing at exact sample vertices is detected once, without mutating source points',()=>{
 const sections=crossing(),original=sections[20].center;
 assert.equal(joinRaceAtGradeCrossings(sections).length,1);
 assert.equal(original.elevation,0);
 assert.notEqual(sections[20].center,original);
});
