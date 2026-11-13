import { axleTireGeometry, tireSizeForWheel } from './TireSizes.js';
import {RACE_TIRE_COMPOUNDS} from './raceData.js';
import {RACE_MAX_AI_DRIVERS} from './simulation/RaceSimulationConfig.js';
import { isUserRaceCar } from './CarPresets.js';
import {clamp} from './simulation/SimulationMath.js';

export const CAR_CATEGORIES = ['car', 'truck', 'van', 'suv'];
export const CAR_PERFORMANCE_CLASSES = ['E1', 'E2', 'E3', 'E4', 'F', 'D', 'C', 'B', 'A', 'S'];
export const CAR_PERFORMANCE_LIMITS = CAR_PERFORMANCE_CLASSES.map((label,i)=>({label,limit:(i+1)*100}));
export const carPerformanceClass = points => CAR_PERFORMANCE_LIMITS.find(c=>points<=c.limit)?.label || 'S';
const finite = (value, fallback) => Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback;
export const carCatalogId = car => String(car?.__playtestId || car?.id || '');
export const carCategory = car => CAR_CATEGORIES.includes(car?.category) ? car.category : 'car';

// Versioned game-balance estimate, not a lap-time prediction. Recomputed from
// current tuning rather than trusting a stale saved rating after an upgrade.
export function calculateCarPerformance(car = {}) {
  const t = {...car.tuning,...car.transmissions?.[car.defaultTransmissionType],...axleTireGeometry(car.setup, car.tuning)}, p = t.physicalVehicleProfile || car.physicalVehicleProfile || t.physics || {};
  const mass = Math.max(100, finite(t.weightKg, 1500));
  const power = Math.max(1, finite(t.powerHp, 150));
  const compound=car.setup?.tireDefinition?.tire?.compound||RACE_TIRE_COMPOUNDS.find(c=>c.id===(car.setup?.defaultTireCompound||'stock'));
  const width=clamp(Math.sqrt(((finite(tireSizeForWheel(car.setup,'fl').widthMm,245) + finite(tireSizeForWheel(car.setup,'rl').widthMm,245)) / 2)/245),.8,1.2);
  const grip = clamp(finite(t.tireGrip, 1)*finite(compound?.surfaceGrip?.asphalt,1)*width, 0.1, 3);
  const powerPerTonne = power * 1000 / mass;
  const efficiency=clamp(finite(t.drivetrainEfficiency,.84),.1,1),drive=String(t.drivetrain||'awd').toLowerCase();
  const front=clamp(finite(t.frontWeightDistribution,.54),.3,.75);
  const transfer=clamp(finite(t.cgHeightM,.55)/finite(t.wheelbaseM,2.65)*grip,0,.25);
  const drivenLoad=drive==='fwd'?front-transfer:drive==='rwd'?1-front+transfer:1;
  const lock=clamp(finite(t[drive==='fwd'?'frontDifferentialAccel':'rearDifferentialAccel'],finite(t.differentialAccel,0)),0,1);
  const traction=grip*9.81*drivenLoad*(.88+.12*lock);
  const validGears=(Array.isArray(t.gearRatios)?t.gearRatios:[]).filter(r=>Number.isFinite(r)&&r>0);
  const cvt=t.cvt && t.powertrainType!=='electric' && t.cvt.minRatio>0 && t.cvt.maxRatio>=t.cvt.minRatio ? t.cvt:null;
  const gears=cvt?[cvt.maxRatio,cvt.minRatio]:validGears.length?validGears:[3.45,1.95,1.37,.97,.74,.67];
  const finalDrive=finite(t.finalDrive,finite(t.gearFinalDrive,4.11)),radius=finite(t.wheelRadiusM,.337),redline=finite(t.redlineRpm,6500);
  const gearing=clamp(gears[0]*finalDrive*.337/radius/12,.45,1.15);
  const shifts=cvt?0:gears.filter(r=>redline*2*Math.PI*radius/(60*r*finalDrive)<26.8224).length;
  const zeroToSixtySec=Math.max(26.8224/Math.max(.1,traction),.5*mass*26.8224**2/(power*745.7*efficiency*.65*gearing))+.2+shifts*finite(t.shiftTimeMs,420)/1000;
  const area=finite(p.frontalAreaM2,finite(t.frontalAreaM2,Math.max(1.55,finite(t.widthM,1.8)*finite(t.lengthM,4.5)*.26)));
  const drag=.5*1.225*clamp(finite(p.dragCoefficient,finite(t.dragCoefficient,.35)),.08,.9)*area;
  const wheelPower=power*745.7*efficiency;
  let lo=0,hi=180;
  for(let i=0;i<32;i++){const speed=(lo+hi)/2;if(drag*speed**3+mass*.12*speed>wheelPower)hi=speed;else lo=speed;}
  const gearLimit=redline*2*Math.PI*radius/(60*Math.min(...gears)*finalDrive);
  const topSpeedMph=Math.min(lo,gearLimit)/.44704;
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
    grip: Math.round(140 * clamp((grip - 0.4) / .78, 0, 1)),
    brakes: Math.round(100 * clamp((brakeG - 0.3) / 1.1, 0, 1)),
    suspension: Math.round(50 * dampingQuality)
  };
  const points = Object.values(components).reduce((sum, n) => sum + n, 0);
  return {version:3, points, class:carPerformanceClass(points),
    components, zeroToSixtySec, accelerationEstimated:true, powerPerTonne, topSpeedMph};
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
  for(const car of cars || []){if(!isUserRaceCar(car))continue;const id=carCatalogId(car);if(id && id!==playerCarId && !catalog.has(id))catalog.set(id,car);}
  const eligible=[...catalog].filter(([id,car])=>
    (rules.availableCarIds ? rules.availableCarIds.includes(id) : Boolean(car.__playtestDocumentName))
    && (rules.category==='any' || carCategory(car)===rules.category)
    && (rules.performanceClass==='any' || calculateCarPerformance(car).class===rules.performanceClass)
  ).map(([id])=>id);
  for(let i=eligible.length-1;i>0;i--){const j=Math.min(i,Math.floor(clamp(finite(random(),0),0,1)*(i+1)));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  // An explicitly selected fallback can be outside the filter, but never the
  // player's car. If unavailable, prefer a matching car before a stock car.
  const fallback=catalog.has(rules.defaultCarId) ? rules.defaultCarId : eligible[0] || [...catalog].find(([,car])=>!car.__playtestDocumentName)?.[0] || [...catalog.keys()][0];
  const size=clamp(Math.floor(finite(count,0)),0,RACE_MAX_AI_DRIVERS),result=eligible.slice(0,size);
  while(fallback && result.length<size)result.push(fallback);
  return result;
}
