// Untimed, finite authored road sections. Offsets are metres from the relevant
// timing line; x/z/elevation use the same world coordinates as road samples.
export function roadContinuationExtent(road, side) {
  return Math.max(0, ...(road?.continuations?.[side] || []).map(p => Math.abs(Number(p.offset) || 0)));
}
export function roadContinuationSamples(road, samples, routeLength) {
  if (road?.autoExtend !== false || !samples?.length) return samples;
  const first = samples[0], last = samples.at(-1);
  const before = (road.continuations?.start || []).filter(p => p.offset < 0)
    .map(p => ({...first, ...p, distance: p.offset}));
  const after = (road.continuations?.finish || []).filter(p => p.offset > 0)
    .map(p => ({...last, ...p, distance: routeLength + p.offset}));
  return [...before, ...samples, ...after].sort((a,b) => a.distance-b.distance);
}
export function sampleRoadContinuation(road, distance, samples, routeLength) {
  const start = distance < 0, endpoint = start ? samples[0] : samples.at(-1);
  const points = (road?.continuations?.[start ? 'start' : 'finish'] || []);
  const offset = start ? distance : distance - routeLength;
  const ordered = [...points, {...endpoint, offset: 0}].sort((a,b) => a.offset-b.offset);
  const target = Math.max(ordered[0].offset, Math.min(ordered.at(-1).offset, offset));
  let a = ordered[0], b = a;
  for (let i=1; i<ordered.length; i++) { b=ordered[i]; if (b.offset>=target) break; a=b; }
  const t = b.offset>a.offset ? (target-a.offset)/(b.offset-a.offset) : 0;
  const lerp = k => Number(a[k] || 0)+(Number(b[k] || 0)-Number(a[k] || 0))*t;
  const yaw = Number(a.yaw ?? endpoint.yaw) + Math.atan2(Math.sin(Number(b.yaw ?? endpoint.yaw)-Number(a.yaw ?? endpoint.yaw)),Math.cos(Number(b.yaw ?? endpoint.yaw)-Number(a.yaw ?? endpoint.yaw)))*t;
  return {...endpoint, x:lerp('x'), z:lerp('z'), elevation:lerp('elevation'), yaw,
    distance: start ? target : routeLength+target, progress:start?0:1};
}
