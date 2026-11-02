import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRaceBakedSurfaceSampler,
  getRaceBakedSurfaceMaximumElevationInBounds,
  packRaceCanonicalSurfaceMesh,
  packRaceBakedSurfaceSampler,
  sampleRaceBakedSurface
} from '../../src/racing/RaceBakedSurfaceSampler.js';

test('packed race surface sampler preserves object sampler results', () => {
  const terrainCells = [{
    key: 'terrain:0',
    points: [
      { x: 0, z: 0, elevation: 0, terrainRegion: 'terrain' },
      { x: 5, z: 0, elevation: 0.1, terrainRegion: 'terrain' },
      { x: 5, z: 5, elevation: 0.2, terrainRegion: 'terrain' },
      { x: 0, z: 5, elevation: 0.1, terrainRegion: 'terrain' }
    ]
  }];
  const objectSampler = buildRaceBakedSurfaceSampler({
    terrainCells,
    elevationScaleM: 12,
    bucketSizeM: 5
  });
  const packedSampler = packRaceBakedSurfaceSampler(objectSampler);
  const objectSample = sampleRaceBakedSurface(
    objectSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  const packedSample = sampleRaceBakedSurface(
    packedSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );

  assert.equal(packedSampler.packed, true);
  assert.equal(packedSampler.version, 2);
  assert.equal(packedSampler.positions instanceof Float64Array, true);
  assert.equal(packedSampler.normals instanceof Float64Array, true);
  assert.equal(packedSampler.bounds instanceof Float64Array, true);
  assert.equal(packedSampler.supportFamilyIds instanceof Uint32Array, true);
  assert.equal(packedSampler.supportFamilyDriveable instanceof Uint8Array, true);
  assert.equal(packedSampler.supportEdgeFlags instanceof Uint8Array, true);
  assert.equal(packedSampler.triangleCount, objectSampler.triangleCount);
  assert.ok(packedSample);
  assert.equal(packedSample.elevation, objectSample.elevation);
  assert.equal(packedSample.region, objectSample.region);
  assert.deepEqual(packedSample.normal, objectSample.normal);
});

test('canonical mesh packing matches the object sampler without allocating an intermediate sampler', () => {
  const vertices = [
    { x: 0, z: 0, elevation: 0 },
    { x: 5, z: 0, elevation: 0.1 },
    { x: 5, z: 5, elevation: 0.2 },
    { x: 0, z: 5, elevation: 0.1 }
  ];
  const mesh = {
    vertices,
    triangles: [
      {
        indices: [0, 1, 2],
        vertices: [vertices[0], vertices[1], vertices[2]],
        region: 'terrain',
        source: 'terrain:0',
        faceNormal: { x: -0.19245008972987523, y: 0.9622504486493761, z: -0.19245008972987523 }
      },
      {
        indices: [0, 2, 3],
        vertices: [vertices[0], vertices[2], vertices[3]],
        region: 'terrain',
        source: 'terrain:1',
        faceNormal: { x: -0.19245008972987523, y: 0.9622504486493761, z: -0.19245008972987523 }
      }
    ]
  };
  const objectSampler = buildRaceBakedSurfaceSampler({
    mesh,
    elevationScaleM: 12,
    bucketSizeM: 5
  });
  const packedObjectSampler = packRaceBakedSurfaceSampler(objectSampler);
  const packedMeshSampler = packRaceCanonicalSurfaceMesh(mesh, {
    elevationScaleM: 12,
    bucketSizeM: 5
  });

  assert.deepEqual(Array.from(packedMeshSampler.positions), Array.from(packedObjectSampler.positions));
  assert.deepEqual(Array.from(packedMeshSampler.normals), Array.from(packedObjectSampler.normals));
  assert.deepEqual(Array.from(packedMeshSampler.bounds), Array.from(packedObjectSampler.bounds));
  assert.deepEqual(Array.from(packedMeshSampler.regions), Array.from(packedObjectSampler.regions));
  assert.deepEqual(Array.from(packedMeshSampler.sources), Array.from(packedObjectSampler.sources));
  assert.deepEqual(Array.from(packedMeshSampler.priorities), Array.from(packedObjectSampler.priorities));
  assert.deepEqual(Array.from(packedMeshSampler.supportFamilyIds),
    Array.from(packedObjectSampler.supportFamilyIds));
  assert.deepEqual(Array.from(packedMeshSampler.supportFamilyDriveable),
    Array.from(packedObjectSampler.supportFamilyDriveable));
  assert.deepEqual(Array.from(packedMeshSampler.supportEdgeFlags),
    Array.from(packedObjectSampler.supportEdgeFlags));
  assert.deepEqual(Array.from(packedMeshSampler.bucketCoords), Array.from(packedObjectSampler.bucketCoords));
  assert.deepEqual(Array.from(packedMeshSampler.bucketOffsets), Array.from(packedObjectSampler.bucketOffsets));
  assert.deepEqual(Array.from(packedMeshSampler.bucketTriangles), Array.from(packedObjectSampler.bucketTriangles));

  const objectSample = sampleRaceBakedSurface(
    packedObjectSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  const meshSample = sampleRaceBakedSurface(
    packedMeshSampler,
    { x: 2.5, z: 2.5 },
    { preferredRegion: 'terrain' }
  );
  assert.deepEqual(meshSample, objectSample);
});

test('packed and object samplers expose the same conservative body broadphase height', () => {
  const terrainCells = [{
    key: 'terrain:bounds',
    points: [
      { x: 0, z: 0, elevation: 0.1, terrainRegion: 'terrain' },
      { x: 5, z: 0, elevation: 0.4, terrainRegion: 'terrain' },
      { x: 5, z: 5, elevation: 0.3, terrainRegion: 'terrain' },
      { x: 0, z: 5, elevation: 0.2, terrainRegion: 'terrain' }
    ]
  }];
  const objectSampler = buildRaceBakedSurfaceSampler({ terrainCells, bucketSizeM: 5 });
  const packedSampler = packRaceBakedSurfaceSampler(objectSampler);
  const bounds = { minX: 1, maxX: 4, minZ: 1, maxZ: 4 };
  assert.equal(getRaceBakedSurfaceMaximumElevationInBounds(objectSampler, bounds), 0.4);
  assert.equal(getRaceBakedSurfaceMaximumElevationInBounds(packedSampler, bounds), 0.4);
  assert.equal(getRaceBakedSurfaceMaximumElevationInBounds(packedSampler, {
    minX: 20,
    maxX: 24,
    minZ: 20,
    maxZ: 24
  }), null);
});

test('kilometre-scale terrain keeps a bounded index without losing exact surface queries',()=>{
  const a={x:0,z:0,elevation:0},b={x:20000,z:0,elevation:20},c={x:0,z:20000,elevation:0};
  const packed=packRaceCanonicalSurfaceMesh({triangles:[{vertices:[a,b,c],region:'terrain',source:'mountain'}]},{bucketSizeM:20});
  assert.ok(packed.bucketSizeM>20);
  assert.ok(packed.bucketTriangles.length<=1000000);
  for(const x of [10,1000,15000]){
    const sample=sampleRaceBakedSurface(packed,{x,z:10},{preferredRegion:'terrain'});
    assert.ok(sample);assert.ok(Math.abs(sample.elevation-x/1000)<1e-8);
  }
  assert.equal(sampleRaceBakedSurface(packed,{x:19000,z:19000},{preferredRegion:'terrain'}),null);
});

test('local packed candidates preserve overlapping decks, materials, boundaries and invalidation',()=>{
 const triangles=[];
 for(let i=-10;i<10;i++)for(const h of [0,2])triangles.push({region:h?'road':'terrain',materialId:h?'asphalt':'dirt',vertices:[
  {x:i,z:0,elevation:h},{x:i+1,z:0,elevation:h},{x:i,z:20,elevation:h}]});
 const sampler=packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({mesh:{layered:true,triangles},bucketSizeM:20}));
 let directVisits=0,cachedVisits=0;
 for(let repeat=0;repeat<3;repeat++) for(let i=0;i<200;i++) {
  const point={x:-9.999+i*.099,z:(i%10)*.4,supportHeightM:i%2?30:.1};
  const expected=sampleRaceBakedSurface(sampler,point,{preferredRegion:'road',physicsCostAccounting:{count:k=>{if(k==='preparedTrianglesVisited')directVisits++;}}});
  const actual=sampleRaceBakedSurface(sampler,point,{preferredRegion:'road',localCandidateRevision:repeat<2?0:1,
    physicsCostAccounting:{count:k=>{if(k==='preparedTrianglesVisited')cachedVisits++;}}});
  assert.deepEqual(actual,expected);
 }
 assert.ok(cachedVisits<directVisits/2);
 // A packed replacement under the same revision must never inherit candidates.
 const replacement=packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({mesh:{layered:true,triangles:triangles.slice(-2)}}));
 const p={x:-9,z:0};
 assert.deepEqual(sampleRaceBakedSurface(replacement,p,{localCandidateRevision:0}),sampleRaceBakedSurface(replacement,p));
});
