import {roadContinuationExtent} from './RaceRoadContinuations.js';

// Use the authored untimed road. Legacy auto-extended roads have a straight
// runoff; finite roads without a continuation must not send cars into the void.
export function raceAiFinishStopDistance(road, routeLength) {
  const available = road?.autoExtend === false ? roadContinuationExtent(road, 'finish') : 220;
  return routeLength + Math.max(0, Math.min(220, available) - Math.min(8, available * .1));
}

export function raceAiOpenRoadDistance(editor, projection, ai, routeLength) {
  let distance = Number(projection.distance ?? ai.distance ?? 0);
  if (editor.selectedRace?.road?.autoExtend !== false && distance >= routeLength - .01) {
    const end = editor.getRaceWorldPoseAtDistance(routeLength, {runtimeType:'destination'});
    const beyond = (ai.worldX-end.x)*Math.sin(end.yaw)+(ai.worldZ-end.z)*Math.cos(end.yaw);
    distance = Math.max(distance, routeLength + beyond);
  }
  return distance;
}
