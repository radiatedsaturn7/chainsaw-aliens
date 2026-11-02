import {buildRaceRouteNearestIndex,nearestRaceRouteSegment} from '../../../src/racing/RaceRouteNearestIndex.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
// Frozen legacy projection before reducing candidate allocations.
export function referenceProjection(point={}) {
    const samples = this.getRacePathSamplesCached({ step: 4 });
    if (samples.length < 2) {
      return {
        distance: 0,
        x: 0,
        z: 0,
        yaw: 0,
        lateral: 0,
        distanceToRoute: Infinity,
        segment: null,
        index: 0,
        progress: 0
      };
    }
    const px = Number(point.x || 0);
    const pz = Number(point.z || 0);
    const projectionCellSizeM = 32;
    const projectionSearchRadiusM = 64;
    if (this.raceRouteProjectionIndex?.samples !== samples) {
      const buckets = new Map();
      for (let index = 1; index < samples.length; index += 1) {
        const previous = samples[index - 1];
        const next = samples[index];
        const minX = Math.floor((Math.min(Number(previous.x || 0), Number(next.x || 0)) - projectionSearchRadiusM) / projectionCellSizeM);
        const maxX = Math.floor((Math.max(Number(previous.x || 0), Number(next.x || 0)) + projectionSearchRadiusM) / projectionCellSizeM);
        const minZ = Math.floor((Math.min(Number(previous.z || 0), Number(next.z || 0)) - projectionSearchRadiusM) / projectionCellSizeM);
        const maxZ = Math.floor((Math.max(Number(previous.z || 0), Number(next.z || 0)) + projectionSearchRadiusM) / projectionCellSizeM);
        for (let z = minZ; z <= maxZ; z += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const key = `${x},${z}`;
            const entries = buckets.get(key) || [];
            entries.push(index);
            buckets.set(key, entries);
          }
        }
      }
      this.raceRouteProjectionIndex = { samples, buckets };
    }
    const projectionCandidates = this.raceRouteProjectionIndex.buckets.get(
      `${Math.floor(px / projectionCellSizeM)},${Math.floor(pz / projectionCellSizeM)}`
    ) || [];
    let best = null;
    const considerSegment = (index) => {
      const previous = samples[index - 1];
      const next = samples[index];
      const ax = Number(previous.x || 0);
      const az = Number(previous.z || 0);
      const bx = Number(next.x || 0);
      const bz = Number(next.z || 0);
      const dx = bx - ax;
      const dz = bz - az;
      const lengthSq = Math.max(0.0001, dx * dx + dz * dz);
      const t = clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
      const x = ax + dx * t;
      const z = az + dz * t;
      const offsetX = px - x;
      const offsetZ = pz - z;
      const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
      if (!best || distanceSq < best.distanceSq) {
        const yaw = Math.atan2(dx, dz);
        const right = this.getRaceRightVector(yaw);
        const span = Math.max(0.001, Number(next.distance || 0) - Number(previous.distance || 0));
        best = {
          distanceSq,
          distance: Number(previous.distance || 0) + span * t,
          x,
          z,
          yaw,
          lateral: offsetX * right.x + offsetZ * right.z,
          distanceToRoute: Math.sqrt(distanceSq),
          segment: next.segment || previous.segment || null,
          index: next.index ?? previous.index ?? 0,
          progress: t
        };
      }
    };
    projectionCandidates.forEach(considerSegment);
    if (!best || Math.sqrt(best.distanceSq) > projectionSearchRadiusM) {
      this.raceRouteProjectionIndex.nearestIndex ||= buildRaceRouteNearestIndex(samples);
      const index = nearestRaceRouteSegment(this.raceRouteProjectionIndex.nearestIndex, px, pz);
      best = null;
      if (index >= 1) considerSegment(index);
    }
    return best || {
      distance: 0,
      x: Number(samples[0].x || 0),
      z: Number(samples[0].z || 0),
      yaw: Number(samples[0].yaw || 0),
      lateral: 0,
      distanceToRoute: 0,
      segment: samples[0].segment || null,
      index: 0,
      progress: 0
    };
}
