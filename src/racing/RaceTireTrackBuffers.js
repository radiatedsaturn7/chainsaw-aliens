import * as THREE from '../vendorBridge/three.js';

// At most two quads (outer and center) per mark. Buffers live for the chunk,
// rather than being repacked each time its next mark arrives.
const VERTICES_PER_SEGMENT = 12;
const TRIANGLES = [0, 1, 2, 0, 2, 3];
const sessionTokens = new WeakMap();

function clearUploadedRanges() { this.clearUpdateRanges(); }

export function raceTireTrackSessionToken(session) {
  if (!session) return null;
  let token = sessionTokens.get(session);
  if (!token) { token = {}; sessionTokens.set(session, token); }
  return token;
}

export function createRaceTireTrackBuffer(chunkId, capacity, material) {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(capacity * VERTICES_PER_SEGMENT * 3), 3);
  const colors = new THREE.BufferAttribute(new Float32Array(capacity * VERTICES_PER_SEGMENT * 4), 4);
  positions.setUsage(THREE.DynamicDrawUsage);
  colors.setUsage(THREE.DynamicDrawUsage);
  // Three r160 clears ranges after bufferSubData, but not the first bufferData.
  // Retiring them on either upload prevents the next append re-uploading the
  // complete prefix that was already included in the initial allocation.
  positions.onUpload(clearUploadedRanges);
  colors.onUpload(clearUploadedRanges);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  geometry.boundingBox = new THREE.Box3();
  geometry.boundingSphere = new THREE.Sphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 6;
  mesh.frustumCulled = true;
  mesh.visible = false;
  return {
    mesh, capacity, firstId: chunkId * capacity + 1, maxId: 0,
    count: 0, vertexCount: 0, visibleVertexCount: 0, nextSlot: 0,
    // A partial oldest chunk retires via drawRange, without moving vertices.
    vertexOffsets: new Uint16Array(capacity + 1),
    boundsPoint: new THREE.Vector3(), boundsSize: new THREE.Vector3()
  };
}

function markUpdated(attribute, offset, count) {
  if (!count) return;
  // Several appends can precede one render. Preserve pending writes and merge
  // adjacent ranges instead of creating an upload-range object per mark.
  const previous = attribute.updateRanges.at(-1);
  if (previous && previous.start + previous.count >= offset) {
    previous.count = Math.max(previous.start + previous.count, offset + count) - previous.start;
  } else {
    attribute.addUpdateRange(offset, count);
  }
  attribute.needsUpdate = true;
}

function appendQuad(chunk, quad, color, editor, elevationScale) {
  if (!color || !Array.isArray(quad) || quad.length !== 4) return;
  for (const point of quad) {
    if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.z))
      || !Number.isFinite(Number(point?.elevation) * elevationScale)) return;
  }
  const rgba = editor.parseRaceCssColor(color);
  const geometry = chunk.mesh.geometry;
  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;
  for (let triangle = 0; triangle < TRIANGLES.length; triangle += 3) {
    const a = quad[TRIANGLES[triangle]];
    let b = quad[TRIANGLES[triangle + 1]], c = quad[TRIANGLES[triangle + 2]];
    const normalY = (Number(b.z) - Number(a.z)) * (Number(c.x) - Number(a.x))
      - (Number(b.x) - Number(a.x)) * (Number(c.z) - Number(a.z));
    if (Math.abs(normalY) <= 0.0000001) continue;
    if (normalY < 0) { const swap = b; b = c; c = swap; }
    for (let index = 0; index < 3; index += 1) {
      const point = index === 0 ? a : index === 1 ? b : c;
      const positionOffset = chunk.vertexCount * 3;
      const colorOffset = chunk.vertexCount * 4;
      positions[positionOffset] = Number(point.x);
      positions[positionOffset + 1] = Number(point.elevation) * elevationScale;
      positions[positionOffset + 2] = Number(point.z);
      colors[colorOffset] = rgba[0]; colors[colorOffset + 1] = rgba[1];
      colors[colorOffset + 2] = rgba[2]; colors[colorOffset + 3] = rgba[3];
      chunk.boundsPoint.fromArray(positions, positionOffset);
      geometry.boundingBox.expandByPoint(chunk.boundsPoint);
      chunk.vertexCount += 1;
    }
  }
}

export function appendRaceTireTrackBuffer(chunk, segments, start, end, editor, elevationScale) {
  const previousVertices = chunk.vertexCount;
  let appended = 0;
  for (let index = start; index < end; index += 1) {
    const segment = segments[index];
    const id = Number(segment?.id || 0);
    const slot = id - chunk.firstId;
    if (id <= chunk.maxId || !Number.isInteger(slot) || slot < 0 || slot >= chunk.capacity) continue;
    // Also handles sparse retained IDs without exposing an older mark on trim.
    for (let gap = chunk.nextSlot; gap <= slot; gap += 1) chunk.vertexOffsets[gap] = chunk.vertexCount;
    const style = editor.getRaceTireTrackStyle(segment.kind, segment.intensity);
    if (style.outerColor) appendQuad(chunk,
      segment.outerQuad?.length ? segment.outerQuad : editor.getRaceTireTrackQuad(segment, style.outerScale),
      style.outerColor, editor, elevationScale);
    appendQuad(chunk,
      segment.centerQuad?.length ? segment.centerQuad : editor.getRaceTireTrackQuad(segment, 1),
      style.centerColor, editor, elevationScale);
    chunk.vertexOffsets[slot + 1] = chunk.vertexCount;
    chunk.nextSlot = slot + 1;
    chunk.maxId = id;
    chunk.count += 1;
    appended += 1;
  }
  const addedVertices = chunk.vertexCount - previousVertices;
  if (addedVertices) {
    const geometry = chunk.mesh.geometry;
    markUpdated(geometry.attributes.position, previousVertices * 3, addedVertices * 3);
    markUpdated(geometry.attributes.color, previousVertices * 4, addedVertices * 4);
    // Bounds expand only for new vertices. Keeping retired bounds is conservative
    // and bounded to one chunk; scanning the whole buffer would defeat appending.
    geometry.boundingBox.getCenter(geometry.boundingSphere.center);
    geometry.boundingBox.getSize(chunk.boundsSize);
    geometry.boundingSphere.radius = chunk.boundsSize.length() * 0.5 + 0.00001;
  }
  return appended;
}

export function trimRaceTireTrackBuffer(chunk, minId) {
  const slot = Math.max(0, Math.min(chunk.capacity, Math.ceil(minId - chunk.firstId)));
  const start = slot >= chunk.nextSlot ? chunk.vertexCount : chunk.vertexOffsets[slot];
  chunk.visibleVertexCount = chunk.vertexCount - start;
  chunk.mesh.geometry.setDrawRange(start, chunk.visibleVertexCount);
  chunk.mesh.visible = chunk.visibleVertexCount > 0;
  return chunk.mesh.visible;
}
