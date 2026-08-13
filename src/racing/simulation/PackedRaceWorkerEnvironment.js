import {
  getRaceBakedSurfaceTrianglesInBounds,
  sampleRaceBakedSurface
} from '../RaceBakedSurfaceSampler.js';
import {
  calculateWheelContactKinematics,
  createWheelContactKinematicsScratch
} from './ContactPatchTireModel.js';
import { RACE_WHEEL_IDS } from './SimulationMath.js';
import { prepareStaticRaceColliders } from './StaticRaceColliderWorld.js';
import { createDeterministicAtmosphere } from './AeroEnvironment.js';

function createSample(raw, point, sampler, fallbackHeightM = 0) {
  if (!raw) return {
    valid: false,
    supported: false,
    heightM: fallbackHeightM,
    normal: { x: 0, y: 1, z: 0 },
    queryPosition: point,
    reason: 'outside-packed-physics-world'
  };
  const scale = Number(sampler?.elevationScaleM || 1);
  return {
    valid: true,
    supported: true,
    heightM: Number(raw.elevation || 0) * scale,
    elevation: Number(raw.elevation || 0) * scale,
    normal: raw.normal || { x: 0, y: 1, z: 0 },
    region: raw.region || 'terrain',
    source: raw.source || 'packed-race-worker',
    triangleId: raw.triangleId,
    queryPosition: point,
    reason: null
  };
}

export function getPackedRaceWorkerEnvironmentTransferables(descriptor = {}) {
  const sampler = descriptor.surfaceSampler || {};
  return [
    sampler.positions?.buffer,
    sampler.normals?.buffer,
    sampler.bounds?.buffer,
    sampler.regions?.buffer,
    sampler.sources?.buffer,
    sampler.priorities?.buffer,
    sampler.bucketCoords?.buffer,
    sampler.bucketOffsets?.buffer,
    sampler.bucketTriangles?.buffer
  ].filter((buffer, index, buffers) => buffer instanceof ArrayBuffer
    && buffers.indexOf(buffer) === index);
}

export function createPackedRaceWorkerEnvironmentProvider({
  surfaceSampler,
  materialByRegion = {},
  staticColliderWorld = null,
  staticColliderDefinitions = null,
  environmentState = {},
  trackState = null,
  fallbackHeightM = 0
} = {}) {
  if (!surfaceSampler?.packed) {
    throw new TypeError('Worker physics requires one packed immutable race surface sampler');
  }
  const kinematicsScratch = Object.fromEntries(
    RACE_WHEEL_IDS.map((wheelId) => [wheelId, createWheelContactKinematicsScratch()])
  );
  const preparedStaticColliderWorld = staticColliderWorld
    || (Array.isArray(staticColliderDefinitions) && staticColliderDefinitions.length
      ? prepareStaticRaceColliders(staticColliderDefinitions)
      : null);
  const output = {
    ...environmentState,
    surfaceHeightByWheel: {},
    surfaceNormalByWheel: {},
    materialByWheel: {},
    trackStateSampleByWheel: {},
    staticColliderWorld: preparedStaticColliderWorld,
    requireValidTerrainEnvelope: true
  };
  const liveWeatherState = {};
  const liveRaceAtmosphere = {};
  let hasLiveAtmosphere = false;
  const samplePoint = (point) => createSample(
    sampleRaceBakedSurface(surfaceSampler, point), point, surfaceSampler, fallbackHeightM
  );
  output.sampleTerrainAtWorldPoint = samplePoint;
  output.sampleTerrainAtWorldPoints = (points) => points.map(samplePoint);
  output.sampleTerrainTrianglesInBounds = (bounds) => (
    getRaceBakedSurfaceTrianglesInBounds(surfaceSampler, bounds).map((triangle) => ({
      ...triangle,
      triangleId: triangle.id,
      vertices: triangle.vertices.map((vertex) => ({
        x: vertex.x,
        y: Number(vertex.elevation || 0) * Number(surfaceSampler.elevationScaleM || 1),
        z: vertex.z
      }))
    }))
  );
  output.sampleTerrainMaximumHeightInBounds = (bounds) => {
    const triangles = getRaceBakedSurfaceTrianglesInBounds(surfaceSampler, bounds);
    let maximum = -Infinity;
    for (const triangle of triangles) {
      for (const vertex of triangle.vertices || []) {
        maximum = Math.max(
          maximum,
          Number(vertex.elevation || 0) * Number(surfaceSampler.elevationScaleM || 1)
        );
      }
    }
    return Number.isFinite(maximum) ? maximum : fallbackHeightM;
  };
  const provider = ({ state, controls, reuseContactGeometry, timeSeconds }, runnerConfig = null) => {
    if (hasLiveAtmosphere) {
      createDeterministicAtmosphere({
        weatherState: liveWeatherState,
        race: liveRaceAtmosphere,
        timeSeconds,
        target: output
      });
    }
    const config = runnerConfig || state?.vehicleConfig || {};
    if (!reuseContactGeometry) {
      for (const wheelId of RACE_WHEEL_IDS) {
        const wheelScratch = kinematicsScratch[wheelId];
        const kinematics = calculateWheelContactKinematics({
          state,
          config,
          controls,
          environment: output,
          wheelId,
          target: wheelScratch.target,
          computationScratch: wheelScratch.computation
        });
        const sample = samplePoint(kinematics.wheelCenterWorld);
        const trackSample = trackState?.sample?.(kinematics.wheelCenterWorld) || null;
        output.surfaceHeightByWheel[wheelId] = sample.heightM;
        output.surfaceNormalByWheel[wheelId] = sample.normal;
        output.materialByWheel[wheelId] = {
          ...(materialByRegion[sample.region]
          || materialByRegion.default
          || { grip: 1 }),
          ...(trackSample ? { grip: Number(trackSample.effectiveGrip || 1) } : null)
        };
        output.trackStateSampleByWheel[wheelId] = trackSample;
      }
    }
    return output;
  };
  provider.setWakeSources = (wakeSources, vehicleId) => {
    output.wakeSources = wakeSources;
    output.vehicleId = String(vehicleId || 'vehicle');
  };
  provider.updateEnvironmentState = (nextState = {}) => {
    if (nextState.weatherState) {
      Object.assign(liveWeatherState, nextState.weatherState);
      hasLiveAtmosphere = true;
    }
    if (nextState.raceAtmosphere) {
      Object.assign(liveRaceAtmosphere, nextState.raceAtmosphere);
      hasLiveAtmosphere = true;
    }
    const damage = nextState.damage;
    if (damage) {
      output.bodyDamage = Number(damage.bodyDamage || 0);
      output.frontAeroDamage = Number(damage.frontAeroDamage || 0);
      output.rearAeroDamage = Number(damage.rearAeroDamage || 0);
      output.damage ||= { brakes: {} };
      output.damage.engine = Number(damage.engine || 0);
      output.damage.transmission = Number(damage.transmission || 0);
      output.damage.brakes ||= {};
      Object.assign(output.damage.brakes, damage.brakes || {});
      for (const wheelId of RACE_WHEEL_IDS) {
        output.tireByWheel ||= {};
        output.tireByWheel[wheelId] ||= {};
        output.tireByWheel[wheelId].damage = Number(damage.tires?.[wheelId] || 0);
      }
    }
  };
  return provider;
}
