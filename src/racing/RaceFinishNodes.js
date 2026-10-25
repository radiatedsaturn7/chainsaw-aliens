import { normalizeMenuVariables } from '../menus/MenuProgress.js';
import { normalizeRaceFinishBehavior } from './raceData.js';

export function normalizeNodeFinish(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    variables: normalizeMenuVariables(value.variables),
    ...(value.destination ? { destination: normalizeRaceFinishBehavior(value.destination) } : {})
  };
}

export function getNetworkFinishNodes(network) {
  return (network?.nodes || []).filter(node => node.id === network.finishNodeId || (node.finish && typeof node.finish === 'object' && !Array.isArray(node.finish)));
}

export function resolveRaceNodeFinish(race, nodeId) {
  const base = normalizeRaceFinishBehavior(race?.finishBehavior);
  const node = getNetworkFinishNodes(race?.road?.network).find(node => node.id === nodeId);
  if (!node) return base;
  const finish = normalizeNodeFinish(node.finish) || { variables: {} };
  return normalizeRaceFinishBehavior({
    ...(finish.destination || base),
    variables: { ...base.variables, ...finish.destination?.variables, ...finish.variables,
      lastRaceExit: node.id, lastRaceExitName: node.name || node.id }
  });
}
