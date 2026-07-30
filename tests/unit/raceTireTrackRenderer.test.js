import test from 'node:test';
import assert from 'node:assert/strict';

import RaceEditor from '../../src/ui/RaceEditor.js';
import * as THREE from '../../src/vendorBridge/three.js';

function makeEditor() {
  const editor = Object.create(RaceEditor.prototype);
  editor.playtestSession = {
    routeLength: 100,
    routeRuntimeType: 'destination',
    startedAt: 1,
    tireTrackSegments: [],
    tireTrackGrid: {},
    tireTrackMinId: 1,
    tireTrackNextId: 1
  };
  editor.getRaceCompositedSurfaceAtWorldPoint = ({ x, z }) => ({
    elevation: Number(x || 0) * 0.01 + Number(z || 0) * 0.02
  });
  editor.getActiveRaceRuntimeType = () => 'destination';
  editor.getRaceRouteLength = () => 100;
  return editor;
}

function triangleNormalY(points, a, b, c) {
  const first = points[a];
  const second = points[b];
  const third = points[c];
  const abX = Number(second.x) - Number(first.x);
  const abZ = Number(second.z) - Number(first.z);
  const acX = Number(third.x) - Number(first.x);
  const acZ = Number(third.z) - Number(first.z);
  return abZ * acX - abX * acZ;
}

test('Race tire-track quads keep both triangles upward-wound on sloped terrain', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({
    from: { x: 0, z: 0, elevation: 0 },
    to: { x: 0.4, z: 1.2, elevation: 0.03 },
    widthM: 0.25
  });
  assert.equal(quad.length, 4);
  assert.equal(triangleNormalY(quad, 0, 1, 2) > 0, true);
  assert.equal(triangleNormalY(quad, 0, 2, 3) > 0, true);
});

test('Race Three tire-track chunks contain upward-facing nondegenerate triangles', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({
    from: { x: 0, z: 0, elevation: 0 },
    to: { x: 0.4, z: 1.2, elevation: 0.03 },
    widthM: 0.25
  });
  const downwardLegacyQuad = [quad[1], quad[0], quad[3], quad[2]];
  const renderer = {
    scene: new THREE.Scene(),
    tireTrackGroup: new THREE.Group(),
    tireTrackChunks: new Map()
  };
  renderer.scene.add(renderer.tireTrackGroup);

  const chunk = editor.buildRaceThreeTireTrackChunk(renderer, 0, [{
    id: 1,
    kind: 'dirt',
    intensity: 0.7,
    centerQuad: downwardLegacyQuad,
    outerQuad: []
  }]);
  const positions = chunk.mesh.geometry.getAttribute('position').array;

  assert.equal(positions.length, 18);
  for (let offset = 0; offset < positions.length; offset += 9) {
    const abX = positions[offset + 3] - positions[offset];
    const abZ = positions[offset + 5] - positions[offset + 2];
    const acX = positions[offset + 6] - positions[offset];
    const acZ = positions[offset + 8] - positions[offset + 2];
    assert.equal(abZ * acX - abX * acZ > 0, true);
  }
  assert.equal(renderer.tireTrackMaterial.side, THREE.FrontSide);
});

test('Race Three tire-track sync leaves software fallback available without valid chunks', () => {
  const editor = makeEditor();
  editor.playtestSession.tireTrackSegments = [{
    id: 1,
    kind: 'asphalt',
    intensity: 1,
    from: { x: 0, z: 0, elevation: 0 },
    to: { x: 0, z: 0, elevation: 0 },
    widthM: 0.25
  }];
  const renderer = {
    scene: new THREE.Scene(),
    tireTrackChunks: new Map()
  };
  const stats = {};

  assert.equal(editor.syncRaceThreeTireTracks(renderer, {
    session: editor.playtestSession,
    stats
  }), false);
  assert.equal(stats.threeTireTrackRenderer, 0);
  assert.equal(stats.tireTrackGpuChunks, 0);
});
