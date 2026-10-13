import {clamp} from './simulation/SimulationMath.js';

export const CAR_CATEGORIES = ['car', 'truck', 'van', 'suv'];
export const CAR_PERFORMANCE_CLASSES = ['E', 'D', 'C', 'B', 'A'];
const finite = (value, fallback) => Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback;
export const carCatalogId = car => String(car?.__playtestId || car?.id || '');
export const carCategory = car => CAR_CATEGORIES.includes(car?.category) ? car.category : 'car';

// Versioned game-balance estimate, not a lap-time prediction. Recomputed from
// current tuning rather than trusting a stale saved rating after an upgrade.
export function calculateCarPerformance(car = {}) {
  const t = car.tuning || {}, p = t.physics || {};
  const mass = Math.max(100, finite(t.weightKg, 1500));
  const power = Math.max(1, finite(t.powerHp, 150));
  const grip = clamp(finite(t.tireGrip, 1), 0.1, 3);
  const powerPerTonne = power * 1000 / mass;
  const estimatedAcceleration = Math.max(26.8224 / (9.81 * grip),
    0.5 * mass * 26.8224 ** 2 / (power * 745.7 * clamp(finite(t.drivetrainEfficiency, 0.8), 0.1, 1) * 0.65)) + 0.5;
  const zeroToSixtySec = Math.max(0.5, finite(t.zeroToSixtySec, estimatedAcceleration));
  const topSpeedMph = Math.max(1, finite(t.topSpeedMph, 120));
  const brakeG = grip * clamp(finite(t.brakePressure, 1), 0.1, 2);
  const dampingQuality = ['Front', 'Rear'].reduce((sum, axle) => {
    const spring = Math.max(1000, finite(p[`suspensionSpringRate${axle}Npm`], 32000));
    const damping = Math.max(0, finite(p[`suspensionReboundDamper${axle}NsM`], 3500));
    const ratio = damping / (2 * Math.sqrt(spring * mass / 4));
    return sum + clamp(1 - Math.abs(ratio - 0.65) / 0.65, 0, 1) / 2;
  }, 0);
  const components = {
    engineWeight: Math.round(350 * clamp(powerPerTonne / 500, 0, 1)),
    acceleration: Math.round(180 * clamp((18 - zeroToSixtySec) / 15, 0, 1)),
    speed: Math.round(180 * clamp((topSpeedMph - 50) / 170, 0, 1)),
    grip: Math.round(140 * clamp((grip - 0.4) / 1.2, 0, 1)),
    brakes: Math.round(100 * clamp((brakeG - 0.3) / 1.1, 0, 1)),
    suspension: Math.round(50 * dampingQuality)
  };
  const points = Object.values(components).reduce((sum, n) => sum + n, 0);
  return {version:1, points, class:CAR_PERFORMANCE_CLASSES[Math.min(4, Math.floor(points / 200))],
    components, zeroToSixtySec, accelerationEstimated:t.zeroToSixtySec == null || !Number.isFinite(Number(t.zeroToSixtySec)), powerPerTonne, topSpeedMph};
}

export function normalizeAiCarSelection(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    // null means all saved cars; [] is an intentionally empty candidate pool.
    availableCarIds:Array.isArray(value.availableCarIds) ? [...new Set(value.availableCarIds.filter(id=>typeof id==='string' && id))] : null,
    category:CAR_CATEGORIES.includes(value.category) ? value.category : 'any',
    performanceClass:CAR_PERFORMANCE_CLASSES.includes(value.performanceClass) ? value.performanceClass : 'any',
    defaultCarId:typeof value.defaultCarId==='string' ? value.defaultCarId : ''
  };
}

export function selectEligibleRaceAiCars(cars, count, {playerCarId='', selection={}, random=Math.random} = {}) {
  const rules=normalizeAiCarSelection(selection),catalog=new Map();
  for(const car of cars || []){const id=carCatalogId(car);if(id && id!==playerCarId && !catalog.has(id))catalog.set(id,car);}
  const eligible=[...catalog].filter(([id,car])=>
    (rules.availableCarIds ? rules.availableCarIds.includes(id) : Boolean(car.__playtestDocumentName))
    && (rules.category==='any' || carCategory(car)===rules.category)
    && (rules.performanceClass==='any' || calculateCarPerformance(car).class===rules.performanceClass)
  ).map(([id])=>id);
  for(let i=eligible.length-1;i>0;i--){const j=Math.min(i,Math.floor(clamp(finite(random(),0),0,1)*(i+1)));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  // An explicitly selected fallback can be outside the filter, but never the
  // player's car. If unavailable, prefer a matching car before a stock car.
  const fallback=catalog.has(rules.defaultCarId) ? rules.defaultCarId : eligible[0] || [...catalog].find(([,car])=>!car.__playtestDocumentName)?.[0] || [...catalog.keys()][0];
  const size=clamp(Math.floor(finite(count,0)),0,11),result=eligible.slice(0,size);
  while(fallback && result.length<size)result.push(fallback);
  return result;
}
