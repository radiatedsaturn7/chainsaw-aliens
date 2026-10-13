// Image analysis stays local. Work on a bounded raster supplied by the importer.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function pencilMask({ data, width, height }, sensitivity = 65) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8
    || width * height > 640 * 640 || data?.length !== width * height * 4) {
    throw new Error('Choose a larger crop of one track.');
  }
  const gray = new Float32Array(width * height);
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4, alpha = data[p + 3] / 255;
      gray[i] = (data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114) * alpha + 255 * (1 - alpha);
      row += gray[i];
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
    }
  }
  const mask = new Uint8Array(width * height);
  const difference = 3 + (100 - clamp(sensitivity, 0, 100)) * .35;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const x0 = Math.max(0, x - 12), x1 = Math.min(width, x + 13);
    const y0 = Math.max(0, y - 12), y1 = Math.min(height, y + 13);
    const mean = (sums[y1 * stride + x1] - sums[y0 * stride + x1] - sums[y1 * stride + x0] + sums[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
    const i = y * width + x;
    mask[i] = gray[i] < mean - difference ? 1 : 0;
  }
  return mask;
}

function closeGaps(mask, w, h) {
  const expanded = new Uint8Array(mask.length), result = new Uint8Array(mask.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (mask[i + dy * w + dx]) expanded[i] = 1;
    }
  }
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x;
    let all = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) all &= expanded[i + dy * w + dx];
    result[i] = all;
  }
  return result;
}

function thin(mask, w, h) {
  const out = mask.slice();
  // Two-pass thinning preserves both open paths and closed loops.
  for (let iteration = 0; iteration < 320; iteration++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!out[i]) continue;
        const p = [out[i-w], out[i-w+1], out[i+1], out[i+w+1], out[i+w], out[i+w-1], out[i-1], out[i-w-1]];
        const count = p.reduce((a, b) => a + b, 0);
        if (count < 2 || count > 6) continue;
        let transitions = 0;
        for (let j = 0; j < 8; j++) if (!p[j] && p[(j + 1) % 8]) transitions++;
        if (transitions !== 1) continue;
        if (pass === 0 ? (p[0]*p[2]*p[4] || p[2]*p[4]*p[6]) : (p[0]*p[2]*p[6] || p[0]*p[4]*p[6])) continue;
        remove.push(i);
      }
      for (const i of remove) out[i] = 0;
      changed ||= remove.length > 0;
    }
    if (!changed) break;
  }
  return out;
}

function neighbors(mask, i, w, h) {
  const x = i % w, y = Math.floor(i / w), result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
    const n = i + dy * w + dx;
    // A diagonal beside an orthogonal connection is redundant, not a junction.
    if (mask[n] && !(dx && dy && (mask[i + dx] || mask[i + dy * w]))) result.push(n);
  }
  return result;
}

function pruneSpurs(mask, w, h) {
  for (let pass = 0; pass < 3; pass++) {
    const remove = new Set();
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || neighbors(mask, i, w, h).length !== 1) continue;
      const branch = [i];
      let previous = -1, current = i;
      while (branch.length <= 9) {
        const next = neighbors(mask, current, w, h).filter((n) => n !== previous);
        if (next.length > 1) { for (const n of branch.slice(0, -1)) remove.add(n); break; }
        if (!next.length) break;
        previous = current; current = next[0]; branch.push(current);
      }
    }
    if (!remove.size) break;
    for (const i of remove) mask[i] = 0;
  }
}

function simplify(points, epsilon) {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(), start = points[a], end = points[b];
    const dx = end.x - start.x, dy = end.y - start.y, length2 = dx*dx + dy*dy;
    let max = epsilon * epsilon, at = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i], t = length2 ? clamp(((p.x-start.x)*dx + (p.y-start.y)*dy) / length2, 0, 1) : 0;
      const distance = (p.x-start.x-t*dx)**2 + (p.y-start.y-t*dy)**2;
      if (distance > max) { max = distance; at = i; }
    }
    if (at >= 0) { keep.add(at); stack.push([a, at], [at, b]); }
  }
  return [...keep].sort((a,b) => a-b).map((i) => points[i]);
}

export function traceRaceImage(image, { sensitivity = 65, bridgeGaps = true } = {}) {
  const { width: w, height: h } = image;
  let mask = pencilMask(image, sensitivity);
  if (bridgeGaps) mask = closeGaps(mask, w, h);
  mask = thin(mask, w, h);
  pruneSpurs(mask, w, h);
  const visited = new Uint8Array(mask.length), candidates = [];
  let rejected = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;
    const component = [i]; visited[i] = 1;
    for (let n = 0; n < component.length; n++) for (const next of neighbors(mask, component[n], w, h)) {
      if (!visited[next]) { visited[next] = 1; component.push(next); }
    }
    if (component.length < 30) continue;
    const ends = component.filter((p) => neighbors(mask, p, w, h).length === 1);
    if (component.some((p) => neighbors(mask, p, w, h).length > 2) || ![0, 2].includes(ends.length)) { rejected++; continue; }
    const closed = ends.length === 0;
    const start = ends[0] ?? component[0], ordered = [], seen = new Set();
    let previous = -1, current = start;
    while (!seen.has(current)) {
      seen.add(current); ordered.push({ x: current % w, y: Math.floor(current / w) });
      const next = neighbors(mask, current, w, h).find((p) => p !== previous);
      if (next === undefined) break;
      previous = current; current = next;
    }
    if (seen.size !== component.length) { rejected++; continue; }
    if (closed) ordered.push({ ...ordered[0] });
    const points = simplify(ordered, 1.6);
    if (points.length < (closed ? 4 : 2)) continue;
    const length = ordered.slice(1).reduce((sum, p, n) => sum + Math.hypot(p.x-ordered[n].x, p.y-ordered[n].y), 0);
    if (length < Math.max(w,h) * .08) continue;
    candidates.push({ points, closed, length });
  }
  candidates.sort((a,b) => b.length-a.length);
  return { candidates: candidates.slice(0, 30), rejected };
}

export function raceFromImageTrace(trace, { name = 'Drawing Race', lengthM = 1500, roadWidthM = 9, reverse = false, startIndex = 0, id } = {}) {
  if (!trace || !Array.isArray(trace.points) || trace.points.length < (trace.closed ? 4 : 2)
    || trace.points.length > 1000 || trace.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Select a complete highlighted track first.');
  }
  if (!Number.isFinite(lengthM) || lengthM < 200 || lengthM > 20000 || !Number.isFinite(roadWidthM) || roadWidthM < 3 || roadWidthM > 30) {
    throw new Error('Use a track length of 200–20,000 m and a road width of 3–30 m.');
  }
  let points = trace.points.map((p) => ({ ...p }));
  if (trace.closed) {
    points.pop();
    const first = clamp(Math.round(startIndex), 0, points.length - 1);
    points = [...points.slice(first), ...points.slice(0, first)];
    if (reverse) points = [points[0], ...points.slice(1).reverse()];
    points.push({ ...points[0] });
  } else if (reverse) points.reverse();
  const length = points.slice(1).reduce((sum, p, n) => sum + Math.hypot(p.x-points[n].x, p.y-points[n].y), 0);
  if (length < 1) throw new Error('The selected route is too short.');
  const scale = lengthM / length, origin = points[0];
  const nodes = points.map((p, i) => ({ x: (p.x-origin.x)*scale, y: (p.y-origin.y)*scale, elevation: 0,
    ...(i === 0 ? { role: 'start', locked: true } : i === points.length-1 ? { role: 'finish' } : {}) }));
  const segments = nodes.slice(1).map((node, i) => ({ length: Math.hypot(node.x-nodes[i].x, node.y-nodes[i].y), curve: 0,
    elevation: 0, surface: 'asphalt', roadWidthM, bumpiness: 0, hazardIds: [] }));
  return {
    id: id || `drawing-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    name: String(name).trim().slice(0, 100) || 'Drawing Race', type: trace.closed ? 'circuit' : 'destination', laps: 1,
    weather: 'clear', timeOfDay: 'day', finishBehavior: { type: 'return-to-origin' },
    road: { width: roadWidthM, nodes, segments, selectedGroundTileId: 'grass', groundTiles: [],
      tileMap: { cellSizeM: 5, defaultTileId: 'grass', minElevation: -.42, maxElevation: .42, cells: {} } },
    competition: { mode: 'solo', aiDrivers: [], trafficEnabled: false }, hazards: [], scenery: [], sceneryDefinitions: [],
    decals: [], triggers: [], codriver: { enabled: false, voice: 'default', calls: [] }
  };
}
