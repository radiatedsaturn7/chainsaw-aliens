import {deterministicUnitFloat} from './simulation/SimulationMath.js';
// IDs are ordered from pole to last. Explicit orders come from the previous
// championship classification; ordinary races draw from the requested tail.
export function raceStartingGrid(drivers = [], {order = null, random = null, seed = ''} = {}) {
  const ids = ['player', ...new Set(drivers.map(d => d.id).filter(id => id && id !== 'player'))];
  if (Array.isArray(order) && order.includes('player')) {
    const valid = [...new Set(order)].filter(id => ids.includes(id));
    return [...valid, ...ids.filter(id => !valid.includes(id))];
  }
  const rank = {easy: 0, medium: 1, hard: 2, expert: 2};
  const difficulty = Math.max(0, ...drivers.map(d => rank[d.difficulty] ?? 1));
  const first = Math.min(ids.length - 1, Math.floor(ids.length * [0.5, 0.75, 1][difficulty]));
  const slot = first + Math.min(ids.length - first - 1, Math.floor(Math.max(0, Number(random ? random() : deterministicUnitFloat(seed, ...ids)) || 0) * (ids.length - first)));
  const result = ids.slice(1);
  result.splice(slot, 0, 'player');
  return result;
}
export function raceGridDistance(order, id, frontDistance = 7.5, spacing = 7, columns = 2) {
  return -(frontDistance + Math.floor(Math.max(0, order.indexOf(id))/Math.max(1,columns)) * spacing);
}

export function raceGridColumns(halfWidth,width=1.8) {
 return halfWidth*2 >= width*2+.9 ? 2 : 1;
}
export function raceGridLateral(order,id,halfWidth,width=1.8,columns=2) {
 if(columns===1)return 0;
 const side=Math.max(0,order.indexOf(id))%2===0 ? -1 : 1;
 return side*Math.min(Math.max(0,halfWidth-width/2-.3),Math.max(width/2+.35,halfWidth*.28));
}
