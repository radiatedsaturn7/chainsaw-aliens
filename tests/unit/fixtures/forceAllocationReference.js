import {clamp} from '../../../src/racing/simulation/SimulationMath.js';
export const referenceForceAllocation = {
  allocateForceWithinCapacities(totalForceN = 0, capacityById = {}, nominalShareById = {}) {
    const ids = Object.keys(capacityById || {});
    const capacities = Object.fromEntries(ids.map((id) => [id, Math.max(0, Number(capacityById[id]) || 0)]));
    const capacityTotal = ids.reduce((sum, id) => sum + capacities[id], 0);
    const target = clamp(Math.max(0, Number(totalForceN) || 0), 0, capacityTotal);
    const nominalTotal = ids.reduce((sum, id) => sum + Math.max(0, Number(nominalShareById?.[id]) || 0), 0);
    const allocations = Object.fromEntries(ids.map((id) => [
      id,
      Math.min(
        capacities[id],
        target * (nominalTotal > 0 ? Math.max(0, Number(nominalShareById?.[id]) || 0) / nominalTotal : 1 / Math.max(1, ids.length))
      )
    ]));
    let remaining = target - ids.reduce((sum, id) => sum + allocations[id], 0);
    for (let pass = 0; pass < ids.length && remaining > 0.0001; pass += 1) {
      const availableTotal = ids.reduce((sum, id) => sum + Math.max(0, capacities[id] - allocations[id]), 0);
      if (availableTotal <= 0.0001) break;
      ids.forEach((id) => {
        const available = Math.max(0, capacities[id] - allocations[id]);
        if (available <= 0) return;
        const addition = Math.min(available, remaining * (available / availableTotal));
        allocations[id] += addition;
      });
      remaining = target - ids.reduce((sum, id) => sum + allocations[id], 0);
    }
    return allocations;
  }

};
