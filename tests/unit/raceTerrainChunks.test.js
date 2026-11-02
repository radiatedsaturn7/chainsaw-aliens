import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionRaceTerrainForRendering} from '../../src/racing/RaceTerrainRenderChunks.js';
import {triangulateSplitTerrainTriangle} from '../../src/racing/RaceTerrainTriangulation.js';

test('terrain triangulation retains elevated collinear edge vertices without holes', () => {
  const a={x:0,z:0,elevation:0}, b={x:10,z:0,elevation:0}, c={x:0,z:10,elevation:0};
  const mid={x:5,z:0,elevation:2};
  const boundary=[a,mid,b,c];
  const triangles=triangulateSplitTerrainTriangle(boundary,[a,b,c]);
  let area=0;
  for(let i=0;i<boundary.length;i++) {
    assert.ok(triangles.some(t=>t.includes(boundary[i])&&t.includes(boundary[(i+1)%boundary.length])));
  }
  for(const [p,q,r] of triangles) area+=Math.abs((q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x))/2;
  assert.equal(area,50);
  assert.equal(triangles.filter(t=>t.includes(mid)).length,2);
});

test('terrain chunking keeps each triangle, UVs, tint and artwork together exactly once', () => {
  const positions=new Float32Array([0,0,0,10,1,0,0,2,10, 1000,3,0,1010,4,0,1000,5,10, 5,6,5,15,7,5,5,8,15]);
  const colors=Float32Array.from(positions,(_,i)=>i/30),uvs=Float32Array.from({length:18},(_,i)=>i/18);
  const packed={packed:true,positions,colors,textureColors:colors,uvs,artGroups:[{start:0,count:6,artRef:'grass'},{start:6,count:3,artRef:'dirt'}]};
  const chunks=partitionRaceTerrainForRendering(packed,{minTriangles:0});
  assert.equal(chunks.length,2);
  assert.equal(chunks.reduce((n,c)=>n+c.triangleCount,0),3);
  const seen=new Set();
  for(const chunk of chunks)for(let t=0;t<chunk.triangleCount;t++){
    const source=positions.findIndex((v,i)=>i%9===0&&v===chunk.positions[t*9])/9;
    assert.ok(source>=0);assert.ok(!seen.has(source));seen.add(source);
    assert.deepEqual(chunk.positions.slice(t*9,t*9+9),positions.slice(source*9,source*9+9));
    assert.deepEqual(chunk.colors.slice(t*9,t*9+9),colors.slice(source*9,source*9+9));
    assert.deepEqual(chunk.uvs.slice(t*6,t*6+6),uvs.slice(source*6,source*6+6));
    assert.equal(chunk.artGroups.find(g=>t*3>=g.start&&t*3<g.start+g.count).artRef,source===2?'dirt':'grass');
  }
  assert.equal(partitionRaceTerrainForRendering(packed)[0],packed);
});
