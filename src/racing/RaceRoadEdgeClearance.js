// Automatically generated edge walls must never close another part of the
// drivable road (hairpins, intersections, or closely folded imported routes).
export function roadEdgeOverlapsRoad({ center, yaw, size }, corridors) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const halfX = size.x / 2;
  const halfZ = size.z / 2;
  for (const corridor of corridors) {
    const roadMinY = Math.min(corridor.from.y, corridor.to.y);
    const roadMaxY = Math.max(corridor.from.y, corridor.to.y);
    if (roadMaxY + 1 < center.y - size.y / 2 || roadMinY > center.y + size.y / 2) continue;
    // A conservative swept road rectangle also leaves room at the join between
    // adjacent samples. False positives open a small edge gap, never block road.
    // Touching the road boundary is intentional; only remove walls intruding
    // into its interior. Keep a small tolerance for floating-point joins.
    const roadInterior = Math.max(0, corridor.halfWidth - 0.02);
    const extentX = halfX + roadInterior;
    const extentZ = halfZ + roadInterior;
    const local = (point) => ({
      x: (point.x - center.x) * cosine - (point.z - center.z) * sine,
      z: (point.x - center.x) * sine + (point.z - center.z) * cosine
    });
    const a = local(corridor.from);
    const b = local(corridor.to);
    let enter = 0;
    let exit = 1;
    for (const [axis, extent] of [['x', extentX], ['z', extentZ]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) {
        if (Math.abs(a[axis]) > extent) { exit = -1; break; }
      } else {
        const t0 = (-extent - a[axis]) / delta;
        const t1 = (extent - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t0, t1));
        exit = Math.min(exit, Math.max(t0, t1));
      }
    }
    if (enter <= exit) return true;
  }
  return false;
}
