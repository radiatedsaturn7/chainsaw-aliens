import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  const geometry = chunk.mesh.geometry;
  const positions = geometry.getAttribute('position').array.subarray(0, geometry.drawRange.count * 3);

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

test('asphalt skid chunk reuses authored quads without sampling an invisible outer layer', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 0, z: 0 }, to: { x: 0, z: 1 }, widthM: 0.25 });
  editor.getRaceTireTrackQuad = () => { throw new Error('cached asphalt marks must not resample terrain'); };
  const renderer = { scene: new THREE.Scene(), tireTrackGroup: new THREE.Group(), tireTrackChunks: new Map() };
  const chunk = editor.buildRaceThreeTireTrackChunk(renderer, 0, Array.from({ length: 128 }, (_, id) => ({
    id: id + 1, kind: 'asphalt', intensity: 0.8, centerQuad: quad, outerQuad: []
  })));
  assert.equal(chunk.vertexCount, 128 * 6);
});

test('new tire marks use the baked driving surface without rebuilding road profiles', () => {
  const editor = makeEditor();
  let samples = 0;
  editor.getRaceBakedSurfaceAtWorldPoint = ({ x, z }) => { samples++; return { elevation: x * 0.01 + z * 0.02 }; };
  editor.getRaceCompositedSurfaceAtWorldPoint = () => { throw new Error('baked surface available'); };
  const quad = editor.getRaceTireTrackQuad({ from: { x: 0, z: 0 }, to: { x: 0, z: 1 }, widthM: 0.25 });
  assert.equal(samples, 4);
  assert.equal(quad.length, 4);
  assert.ok(quad[2].elevation > quad[1].elevation);
});

test('512 skid appends retain geometry and process each new segment once', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 10, z: 20 }, to: { x: 11, z: 21 }, widthM: 0.25 });
  let styles = 0;
  const getStyle = editor.getRaceTireTrackStyle;
  editor.getRaceTireTrackStyle = function(...args) { styles++; return getStyle.apply(this, args); };
  const renderer = { scene: new THREE.Scene() };
  let geometry, position, color, created = 0, appended = 0;
  for (let id = 1; id <= 512; id++) {
    editor.playtestSession.tireTrackSegments.push({ id, kind: 'asphalt', intensity: 0.7, centerQuad: quad });
    const stats = {};
    assert.equal(editor.syncRaceThreeTireTracks(renderer, { stats }), true);
    const chunk = renderer.tireTrackChunks.get(0);
    geometry ||= chunk.mesh.geometry;
    position ||= geometry.attributes.position;
    color ||= geometry.attributes.color;
    assert.equal(chunk.mesh.geometry, geometry);
    assert.equal(geometry.attributes.position, position);
    assert.equal(geometry.attributes.color, color);
    assert.equal(geometry.drawRange.count, id * 6);
    assert.equal(stats.tireTrackChunkRebuilds, 0);
    created += stats.tireTrackChunkCreates;
    appended += stats.tireTrackSegmentsAppended;
  }
  assert.equal(styles, 512);
  assert.equal(created, 1);
  assert.equal(appended, 512);
  assert.equal(position.updateRanges.length, 1, 'pending contiguous uploads are merged');
  assert.deepEqual(position.updateRanges[0], { start: 0, count: 512 * 6 * 3 });
  assert.ok(geometry.boundingSphere.center.x > 10, 'unused capacity does not add the origin to bounds');
  const version = position.version;
  editor.syncRaceThreeTireTracks(renderer);
  assert.equal(styles, 512);
  assert.equal(position.version, version, 'unchanged frame uploads nothing');
});

test('skid retirement changes draw ranges and disposes only fully expired chunks', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 1, z: 1 }, to: { x: 2, z: 2 }, widthM: 0.25 });
  editor.playtestSession.tireTrackSegments = Array.from({ length: 600 }, (_, index) => ({
    id: index + 1, kind: 'asphalt', intensity: 0.8, centerQuad: quad
  }));
  const renderer = { scene: new THREE.Scene() };
  editor.syncRaceThreeTireTracks(renderer);
  const first = renderer.tireTrackChunks.get(0), second = renderer.tireTrackChunks.get(1);
  let disposed = 0;
  first.mesh.geometry.addEventListener('dispose', () => disposed++);
  const secondGeometry = second.mesh.geometry;
  editor.playtestSession.tireTrackSegments.splice(0, 100);
  editor.playtestSession.tireTrackMinId = 101;
  const stats = {};
  editor.syncRaceThreeTireTracks(renderer, { stats });
  assert.equal(renderer.tireTrackChunks.get(0), first);
  assert.equal(first.mesh.geometry.drawRange.start, 100 * 6);
  assert.equal(first.mesh.geometry.drawRange.count, 412 * 6);
  assert.equal(stats.tireTrackGpuVertices, 500 * 6);
  assert.equal(stats.tireTrackSegmentsAppended, 0);
  assert.equal(disposed, 0);
  editor.playtestSession.tireTrackSegments.splice(0, 412);
  editor.playtestSession.tireTrackMinId = 513;
  editor.syncRaceThreeTireTracks(renderer);
  assert.equal(disposed, 1);
  assert.equal(renderer.tireTrackChunks.has(0), false);
  assert.equal(renderer.tireTrackChunks.get(1).mesh.geometry, secondGeometry);
});

test('clearing marks or replacing a same-timestamp session releases old geometry', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 0, z: 0 }, to: { x: 0, z: 1 }, widthM: 0.25 });
  const renderer = { scene: new THREE.Scene() };
  const mark = () => ({ id: 1, kind: 'asphalt', intensity: 1, centerQuad: quad });
  editor.playtestSession.tireTrackSegments.push(mark());
  editor.syncRaceThreeTireTracks(renderer);
  let disposed = 0;
  renderer.tireTrackChunks.get(0).mesh.geometry.addEventListener('dispose', () => disposed++);
  editor.playtestSession.tireTrackSegments = [];
  assert.equal(editor.syncRaceThreeTireTracks(renderer), false);
  assert.equal(disposed, 1);
  editor.playtestSession.tireTrackSegments.push(mark());
  editor.syncRaceThreeTireTracks(renderer);
  const geometry = renderer.tireTrackChunks.get(0).mesh.geometry;
  geometry.addEventListener('dispose', () => disposed++);
  editor.playtestSession = { ...editor.playtestSession, tireTrackSegments: [mark()] };
  editor.syncRaceThreeTireTracks(renderer);
  assert.equal(disposed, 2);
  assert.notEqual(renderer.tireTrackChunks.get(0).mesh.geometry, geometry);
});

test('sparse and degenerate marks retain correct retirement offsets', () => {
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 0, z: 0 }, to: { x: 0, z: 1 }, widthM: 0.25 });
  const degenerate = Array.from({ length: 4 }, () => ({ x: 0, z: 0, elevation: 0 }));
  editor.playtestSession.tireTrackSegments = [
    { id: 1, kind: 'asphalt', intensity: 1, centerQuad: quad },
    { id: 3, kind: 'asphalt', intensity: 1, centerQuad: degenerate },
    { id: 4, kind: 'asphalt', intensity: 1, centerQuad: quad }
  ];
  const renderer = { scene: new THREE.Scene() };
  editor.syncRaceThreeTireTracks(renderer);
  const chunk = renderer.tireTrackChunks.get(0);
  assert.equal(chunk.vertexCount, 12);
  editor.playtestSession.tireTrackMinId = 3;
  editor.syncRaceThreeTireTracks(renderer);
  assert.deepEqual(chunk.mesh.geometry.drawRange, { start: 6, count: 6 });
  editor.playtestSession.tireTrackMinId = 4;
  editor.syncRaceThreeTireTracks(renderer);
  assert.deepEqual(chunk.mesh.geometry.drawRange, { start: 6, count: 6 });
});

test('vendored Three upload lifecycle clears initial ranges before uploading only the next skid vertices', () => {
  // Exercise the shipped WebGLAttributes implementation, including its initial
  // bufferData path, without requiring a browser/WebGL context in this suite.
  const vendor = readFileSync(new URL('../../vendor/three.module.min.js', import.meta.url), 'utf8');
  const match = /function \w+\(\w+,\w+\)\{const \w+=\w+\.isWebGL2,\w+=new WeakMap;return\{get:/.exec(vendor);
  assert.ok(match, 'locate the vendored WebGLAttributes factory');
  const source = vendor.slice(match.index, vendor.indexOf('class ', match.index));
  assert.match(source, /THREE\.WebGLAttributes/);
  const createAttributes = Function(`return (${source})`)();
  const uploads = [];
  const gl = {
    FLOAT: 5126, ARRAY_BUFFER: 34962,
    createBuffer: () => ({}), bindBuffer() {}, deleteBuffer() {},
    bufferData(_target, array) { uploads.push({ kind: 'initial', floats: array.length }); },
    bufferSubData(_target, byteOffset, _array, offset, count) {
      uploads.push({ kind: 'update', byteOffset, offset, count });
    }
  };
  const attributes = createAttributes(gl, { isWebGL2: true });
  const editor = makeEditor();
  const quad = editor.getRaceTireTrackQuad({ from: { x: 0, z: 0 }, to: { x: 0, z: 1 }, widthM: 0.25 });
  const marks = editor.playtestSession.tireTrackSegments = Array.from({ length: 256 }, (_, index) => ({
    id: index + 1, kind: 'asphalt', intensity: 0.8, centerQuad: quad
  }));
  const renderer = { scene: new THREE.Scene() };
  editor.syncRaceThreeTireTracks(renderer);
  const { position, color } = renderer.tireTrackChunks.get(0).mesh.geometry.attributes;
  attributes.update(position, gl.ARRAY_BUFFER);
  attributes.update(color, gl.ARRAY_BUFFER);
  assert.equal(position.updateRanges.length, 0, 'initial bufferData retires the already-uploaded position prefix');
  assert.equal(color.updateRanges.length, 0, 'initial bufferData retires the already-uploaded color prefix');
  marks.push({ id: 257, kind: 'asphalt', intensity: 0.8, centerQuad: quad });
  editor.syncRaceThreeTireTracks(renderer);
  attributes.update(position, gl.ARRAY_BUFFER);
  attributes.update(color, gl.ARRAY_BUFFER);
  assert.deepEqual(uploads.slice(2), [
    { kind: 'update', byteOffset: 256 * 6 * 3 * 4, offset: 256 * 6 * 3, count: 6 * 3 },
    { kind: 'update', byteOffset: 256 * 6 * 4 * 4, offset: 256 * 6 * 4, count: 6 * 4 }
  ]);
  assert.equal(position.updateRanges.length, 0);
  assert.equal(color.updateRanges.length, 0);
});

