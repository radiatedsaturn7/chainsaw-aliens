import {getRaceAiDirector} from './RaceAiDirector.js';
import {sampleRaceRacingLine} from './RaceRacingLine.js';
import {clamp} from './simulation/SimulationMath.js';

// Candidate lanes share their longitudinal samples. Cache only static road
// geometry for this single decision; every lane still samples live Track State.
export function createRaceAiSurfaceProbe(editor, session, routeLength) {
  const sections = new Map();
  const plan=getRaceAiDirector(editor)?.plan;
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
        line:sampleRaceRacingLine(plan,distance),
        roadHalfWidth: Math.max(1, Number(metrics?.roadEnd || editor.getRaceRoadHalfWidthWorld(pose.segment)))
      };
      sections.set(distance, sample);
    }
    const base=sample.line ? (sample.line.x-sample.pose.x)*sample.right.x+(sample.line.z-(sample.pose.z??sample.pose.y))*sample.right.z : 0;
    const limit=sample.line?Math.max(0,sample.roadHalfWidth-plan.racingLine.vehicleWidth/2-plan.racingLine.margin):sample.roadHalfWidth*.85;
    const lateral = clamp(base+clamp(Number(offset || 0), -.85, .85) * sample.roadHalfWidth,-limit,limit);
    return {x:Number(sample.pose.x || 0)+sample.right.x*lateral,
      z:Number(sample.pose.z ?? sample.pose.y ?? 0)+sample.right.z*lateral};
  };
}
