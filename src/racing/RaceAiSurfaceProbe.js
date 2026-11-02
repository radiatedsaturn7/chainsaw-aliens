import {clamp} from './simulation/SimulationMath.js';

// Candidate lanes share their longitudinal samples. Cache only static road
// geometry for this single decision; every lane still samples live Track State.
export function createRaceAiSurfaceProbe(editor, session, routeLength) {
  const sections = new Map();
  const runtimeType = session.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  return (distance, offset) => {
    let sample = sections.get(distance);
    if (!sample) {
      const pose = editor.getRaceWorldPoseAtDistance(distance, {runtimeType});
      const metrics = editor.getRaceSurfaceMetricsAtDistance
        ? editor.getRaceSurfaceMetricsAtDistance(distance, {routeLength,runtimeType})
        : editor.getRaceSurfaceSectionAtDistance(distance, {routeLength,runtimeType}).metrics;
      sample = {
        pose,
        right: editor.getRaceRightVector(pose.yaw),
        roadHalfWidth: Math.max(1, Number(metrics?.roadEnd || editor.getRaceRoadHalfWidthWorld(pose.segment)))
      };
      sections.set(distance, sample);
    }
    const lateral = clamp(Number(offset || 0), -.85, .85) * sample.roadHalfWidth;
    return {x:Number(sample.pose.x || 0)+sample.right.x*lateral,
      z:Number(sample.pose.z ?? sample.pose.y ?? 0)+sample.right.z*lateral};
  };
}
