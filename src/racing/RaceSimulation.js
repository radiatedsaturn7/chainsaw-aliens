import { RACE_WHEEL_IDS, clamp, normalizeAngle } from './simulation/SimulationMath.js';
import { getSurfaceById } from './raceData.js';
import {
  RACE_CONTROLLER_STEERING,
  RACE_PEDAL_INPUT,
  RACE_THREE_ELEVATION_M
} from './simulation/RaceSimulationConfig.js';
import {
  getAuthoritativeChassisState,
  getAuthoritativeVehicleState,
  syncVehicleDynamicsCompatibilityOutputs
} from './simulation/VehicleState.js';
import {
  VehicleDynamicsRunner,
  createVehicleDynamicsConfigFromTuning,
  normalizeVehicleControlInput
} from './simulation/VehicleDynamicsRunner.js';
import {
  calculateWheelContactKinematics,
  createWheelContactKinematicsScratch
} from './simulation/ContactPatchTireModel.js';
import { createDeterministicAtmosphere, getRaceWakeSourcesForFrame } from './simulation/AeroEnvironment.js';
import { quaternionFromEuler, rotateVectorByQuaternion } from './simulation/RigidBodyMath.js';
import { createInvalidSurfaceSample, createSurfaceSample } from './simulation/SurfaceSample.js';
import { createPhysicsTerrainQueryFrameCache } from './simulation/PhysicsTerrainQueryFrame.js';
import { prepareStaticRaceColliders } from './simulation/StaticRaceColliderWorld.js';
import { createRaceWheelContactStateFromSamples } from './RaceVehicleSurfaceContact.js';
import {
  getRaceBakedSurfaceTrianglesInBounds,
  packRaceBakedSurfaceSampler
} from './RaceBakedSurfaceSampler.js';
import { hashTrackStateValue, stableTrackStateStringify } from './trackState/TrackStateMath.js';
import {
  RaceVehicleDynamicsWorkerBridge,
  prepareRaceVehicleDynamicsWorkerSurface
} from './simulation/RaceVehicleDynamicsWorkerBridge.js';
import { qualifyVehicleDynamicsWorkerMigration } from './simulation/VehicleDynamicsWorkerClient.js';

const RACE_TIRE_FOOTPRINT_OFFSETS = new Float64Array([
  -0.7, -0.42,
  -0.7, 0.42,
  0.7, -0.42,
  0.7, 0.42,
  -0.15, 0,
  0.15, 0,
  0, -0.48,
  0, 0.48
]);
const MAX_RACE_TIRE_FOOTPRINT_SAMPLES = RACE_TIRE_FOOTPRINT_OFFSETS.length / 2;
const RACE_BODY_VARIATION_OPTIONS = Object.freeze({
  heightToleranceM: 0.025,
  normalToleranceRad: 8 * Math.PI / 180
});
const RACE_ENVIRONMENT_SCRATCH_COUNT = 8;

function createRaceEnvironmentScratch() {
  const centerSamples = {};
  const groundedByWheel = {};
  const surfaceHeightByWheel = {};
  const surfaceSamplesByWheel = {};
  const surfaceNormalByWheel = {};
  const contactSamplesByWheel = {};
  const footprintSamplesByWheel = {};
  const contactTriangleByWheel = {};
  const materialByWheel = {};
  const tireByWheel = {};
  const trackStateSampleByWheel = {};
  const trackStateConditionScratchByWheel = {};
  const footprintContactEntries = Array.from(
    { length: MAX_RACE_TIRE_FOOTPRINT_SAMPLES },
    () => ({ contacts: {} })
  );
  const footprintContacts = [];
  const bodyCollisionClassification = {
    classification: 'smooth-connected-surface',
    discontinuity: false,
    featureCount: 0,
    edgeClassifications: null
  };
  const wheelCollisionClassification = {
    classification: 'smooth-connected-surface',
    discontinuity: false,
    featureCount: 0,
    edgeClassifications: null
  };
  const wheelVariationBounds = {
    minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0
  };
  const callbackContext = {};
  const atmosphereRequest = {
    weatherState: null, race: null, timeSeconds: 0, target: null
  };
  const fixedContactRequest = {
    wheelIds: RACE_WHEEL_IDS,
    positions: null,
    surfaceSamples: null,
    carDimensions: null,
    tuning: null,
    selectedSegment: null,
    trackState: null,
    groundedByWheel: null,
    elevationScaleM: RACE_THREE_ELEVATION_M,
    preparedSamples: true,
    trackStateSampleByWheel,
    trackStateConditionScratchByWheel,
    target: null
  };
  const adaptivePackedQueryOptions = {
    startIndex: RACE_WHEEL_IDS.length + 4 * RACE_WHEEL_IDS.length
  };
  const wheelMaterialContext = { surfaceModel: null, queryContext: null };
  const wheelMaterialResolver = (point, context) => (
    context.surfaceModel.samplePhysicsGeometry(point, context.queryContext)
  );
  const sampleRecoveryTerrain = (worldPoint, fallbackSurfaceId = 'asphalt') => {
    const context = callbackContext;
    const sample = context.surfaceModel.samplePhysicsGeometry(worldPoint, {
      ...context.physicsQueryContext,
      fallbackSurfaceId
    });
    return {
      ...createSurfaceSample(sample, {
        queryPosition: worldPoint,
        heightScale: RACE_THREE_ELEVATION_M,
        source: sample.bakedSurfaceSource || `race-${sample.region || 'terrain'}`
      }),
      friction: Number(sample.friction ?? 1),
      surfaceId: sample.surfaceId || null
    };
  };
  const getRouteRecoveryState = ({
    failedState,
    preferredRouteDistances = [],
    rejectedSourceKeys = [],
    stage = 'route'
  } = {}) => {
    const context = callbackContext;
    const { session, editor, state, authority, runtimeType } = context;
    const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
    const failedPosition = failedState?.position || state.position || {
      x: session.worldX,
      z: session.worldZ
    };
    const projection = editor.getRaceRouteProjectionForWorldPoint(failedPosition);
    const rawProjectedDistance = projection?.distance;
    const projectedDistance = rawProjectedDistance !== null
      && rawProjectedDistance !== undefined
      && rawProjectedDistance !== ''
      && Number.isFinite(Number(rawProjectedDistance))
      ? Number(rawProjectedDistance) : null;
    const rawSessionRouteDistance = session.projectedDistance ?? session.distance;
    const sessionRouteDistance = rawSessionRouteDistance !== null
      && rawSessionRouteDistance !== undefined
      && rawSessionRouteDistance !== ''
      && Number.isFinite(Number(rawSessionRouteDistance))
      ? Number(rawSessionRouteDistance) : null;
    const searchStepM = Math.max(0.5, Number(
      authority.runner.config.penetrationRecoveryRewindM || 0.35
    ));
    const maximumSearchM = stage === 'hard-stop' ? 80 : 50;
    const searchDistances = createPenetrationRecoveryRouteSearch({
      preferredRouteDistances,
      projectedDistance,
      sessionRouteDistance,
      routeLength,
      runtimeType,
      searchStepM,
      maximumSearchM
    });
    for (const distance of searchDistances) {
      const candidate = context.createTerrainAlignedRecoveryState(distance, rejectedSourceKeys);
      if (candidate) return candidate;
    }
    return null;
  };
  const sampleTerrainAtWorldPoint = (worldPoint, query = {}) => {
    const context = callbackContext;
    const terrainQueryFrame = context.terrainQueryFrame;
    let sample = null;
    const wheelId = query.wheelId;
    if (!context.capturePhysicsIncidentDiagnostics
      && context.environmentResult?.reuseContactGeometry === true
      && wheelId
      && typeof terrainQueryFrame?.samplePointOnTriangle === 'function') {
      const contactTriangle = context.contactTriangleByWheel[wheelId];
      sample = terrainQueryFrame.samplePointOnTriangle(
        worldPoint,
        contactTriangle?.triangleId,
        query.target || null
      );
      if (!sample.valid) {
        context.environmentResult.geometryRefreshRequested = true;
        terrainQueryFrame.statistics.contactTriangleExitRefreshes += 1;
        context.physicsCosts.count('contactTriangleExitRefreshes');
        sample = terrainQueryFrame.samplePoint(worldPoint, query.target || undefined);
        if (sample.valid && contactTriangle) contactTriangle.triangleId = sample.triangleId;
      }
    }
    if (!sample) sample = context.capturePhysicsIncidentDiagnostics
      ? context.surfaceModel.samplePhysicsGeometry(worldPoint, {
          ...context.physicsQueryContext,
          fallbackSurfaceId: context.fixedContacts.contacts?.fl?.surfaceId || 'asphalt'
        })
      : terrainQueryFrame.samplePoint(worldPoint, query.target || undefined);
    if (!context.capturePhysicsIncidentDiagnostics && wheelId && sample.valid) {
      context.contactTriangleByWheel[wheelId].triangleId = sample.triangleId;
    }
    if (context.capturePhysicsIncidentDiagnostics) {
      context.recordTerrainSamples(query.query === 'iterative-tread-contact'
        ? 'iterative-tread-contact' : 'body', [{
        point: worldPoint,
        wheelId: query.wheelId || null,
        offsetIndex: Number.isFinite(Number(query.iteration)) ? Number(query.iteration) : null
      }], [sample]);
    }
    if (!context.capturePhysicsIncidentDiagnostics) return sample;
    const authoritativeSample = createSurfaceSample(sample, {
      queryPosition: worldPoint,
      heightScale: RACE_THREE_ELEVATION_M,
      source: sample.bakedSurfaceSource || `race-${sample.region || 'terrain'}`
    });
    return {
      ...authoritativeSample,
      friction: Number(sample.friction ?? 1),
      surfaceId: sample.surfaceId || null
    };
  };
  const sampleTerrainMaximumHeightInBounds = (bounds) => {
    const context = callbackContext;
    const bodyBounds = context.bodyVariationBounds;
    if (bounds.minX >= bodyBounds.minX
      && bounds.maxX <= bodyBounds.maxX
      && bounds.minZ >= bodyBounds.minZ
      && bounds.maxZ <= bodyBounds.maxZ
      && Number.isFinite(context.chassisMaximumTerrainHeightM)) {
      return context.chassisMaximumTerrainHeightM;
    }
    const timer = context.physicsCosts.start('bakedSurfaceSampling');
    const maximumHeightM = context.terrainQueryFrame.maximumHeightInBounds(bounds);
    context.physicsCosts.end(timer);
    return maximumHeightM;
  };
  const sampleTerrainAtWorldPoints = (worldPoints) => {
    const context = callbackContext;
    if (!context.capturePhysicsIncidentDiagnostics) {
      return context.terrainQueryFrame.samplePoints(worldPoints);
    }
    const samples = context.surfaceModel.samplePhysicsGeometryBatch(worldPoints, {
      ...context.physicsQueryContext,
      fallbackSurfaceId: context.fixedContacts.contacts?.fl?.surfaceId || 'asphalt'
    });
    context.recordTerrainSamples(
      'body-batch', worldPoints.map((point) => ({ point })), samples
    );
    return samples.map((sample, index) => ({
      ...createSurfaceSample(sample, {
        queryPosition: worldPoints[index],
        heightScale: RACE_THREE_ELEVATION_M,
        source: sample.bakedSurfaceSource || `race-${sample.region || 'terrain'}`
      }),
      friction: Number(sample.friction ?? 1),
      surfaceId: sample.surfaceId || null
    }));
  };
  const sampleTerrainTrianglesInBounds = (bounds) => {
    const context = callbackContext;
    const sampler = (context.editor.playtestSession?.worldBake
      || context.editor.raceWorldBakeCache)?.surfaceSampler;
    const timer = context.physicsCosts.start('bakedSurfaceSampling');
    const triangles = getRaceBakedSurfaceTrianglesInBounds(sampler, bounds, {
      physicsCostAccounting: context.physicsCosts
    });
    context.physicsCosts.end(timer);
    return triangles.map((triangle) => ({
      ...triangle,
      triangleId: triangle.id,
      vertices: triangle.vertices.map((vertex) => ({
        x: vertex.x,
        y: Number(vertex.elevation) * RACE_THREE_ELEVATION_M,
        z: vertex.z
      }))
    }));
  };
  const sampleRenderedTerrainAtWorldPoint = (worldPoint) => {
    const sample = callbackContext.editor.getRaceBakedSurfaceAtWorldPoint(worldPoint) || {};
    const elevation = Number(sample.elevation);
    return createSurfaceSample(sample, {
      queryPosition: worldPoint,
      heightScale: RACE_THREE_ELEVATION_M,
      source: sample.source || 'rendered-race-surface'
    });
  };
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    groundedByWheel[wheelId] = true;
    contactSamplesByWheel[wheelId] = new Array(MAX_RACE_TIRE_FOOTPRINT_SAMPLES);
    footprintSamplesByWheel[wheelId] = Array.from(
      { length: MAX_RACE_TIRE_FOOTPRINT_SAMPLES },
      () => ({
        valid: false,
        heightM: null,
        normal: null,
        region: null,
        source: null,
        triangleId: null,
        queryPosition: null,
        reason: 'unqueried',
        normalX: null,
        normalY: null,
        normalZ: null,
        supported: false
      })
    );
    contactTriangleByWheel[wheelId] = { triangleId: null };
    materialByWheel[wheelId] = {};
    tireByWheel[wheelId] = {};
    trackStateSampleByWheel[wheelId] = { visual: {} };
    trackStateConditionScratchByWheel[wheelId] = { current: {}, baseline: {} };
  }
  const environmentResult = {
    physicsTerrainQueryFrame: null,
    staticColliderWorld: null,
    physicsTerrainQueryStatistics: null,
    capturePhysicsIncidentDiagnostics: false,
    routeDistanceM: null,
    physicsIncidentDiagnostics: null,
    requireValidTerrainEnvelope: true,
    contactGeometrySubstepIndex: 0,
    contactGeometryState: null,
    reuseContactGeometry: false,
    geometryRefreshRequested: false,
    contactTriangleByWheel,
    chassisMaximumTerrainHeightM: null,
    bodyCollisionPredicted: false,
    getRouteRecoveryState,
    surfaceHeightByWheel,
    surfaceSamplesByWheel,
    surfaceNormalByWheel,
    contactSamplesByWheel,
    materialByWheel,
    sampleTerrainAtWorldPoint,
    sampleTerrainAtWorldPoints,
    sampleTerrainTrianglesInBounds,
    sampleRenderedTerrainAtWorldPoint,
    sampleTerrainMaximumHeightInBounds,
    adaptiveBodySupport: false,
    terrainHasDiscontinuities: false,
    terrainCollisionClassification: 'smooth-connected-surface',
    bodyTerrainCollisionClassification: 'smooth-connected-surface',
    targetVelocityWorld: null,
    ambientTemperatureC: 0,
    windWorldMps: null,
    gustWorldMps: null,
    windSpeedMps: 0,
    windDirectionRad: 0,
    gustStrength: 0,
    vehicleId: 'player',
    wakeSources: null,
    bodyDamage: 0,
    frontAeroDamage: 0,
    rearAeroDamage: 0,
    activeAeroState: 0,
    damage: { engine: 0, transmission: 0, brakes: null },
    tireByWheel
  };
  const scratch = {
    centerSamples,
    groundedByWheel,
    surfaceHeightByWheel,
    surfaceSamplesByWheel,
    surfaceNormalByWheel,
    contactSamplesByWheel,
    footprintSamplesByWheel,
    contactTriangleByWheel,
    materialByWheel,
    tireByWheel,
    trackStateSampleByWheel,
    trackStateConditionScratchByWheel,
    footprintContactEntries,
    footprintContacts,
    bodyCollisionClassification,
    wheelCollisionClassification,
    wheelVariationBounds,
    callbackContext,
    atmosphereRequest,
    fixedContactRequest,
    adaptivePackedQueryOptions,
    wheelMaterialContext,
    wheelMaterialResolver,
    sampleRecoveryTerrain,
    getRouteRecoveryState,
    environmentResult,
    sampleTerrainAtWorldPoint,
    sampleTerrainAtWorldPoints,
    sampleTerrainMaximumHeightInBounds,
    sampleTerrainTrianglesInBounds,
    sampleRenderedTerrainAtWorldPoint,
    atmosphere: {
      windWorldMps: { x: 0, y: 0, z: 0 },
      gustWorldMps: { x: 0, y: 0, z: 0 }
    },
    brakeDamage: {}
  };
  return scratch;
}

function copyRecordInto(target, source) {
  for (const key in target) delete target[key];
  for (const key in source || {}) target[key] = source[key];
  return target;
}

function createRaceCompatibilityTelemetryScratch() {
  const scratch = {
    demandedForceByWheel: {},
    appliedForceByWheel: {},
    limitByWheel: {},
    wheelLongitudinalUsage: {},
    wheelFrictionUsage: {},
    diagnostics: {},
    fixedStepTelemetry: [],
    latest: {
      state: null,
      telemetry: null,
      diagnostics: null,
      fixedStepTelemetry: null,
      advance: null
    }
  };
  return scratch;
}

function createWorkerEnvironmentStateSnapshot(environment = {}) {
  const copyVector = (value = {}) => ({
    x: Number(value.x || 0), y: Number(value.y || 0), z: Number(value.z || 0)
  });
  return {
    ambientTemperatureC: Number(environment.ambientTemperatureC || 0),
    windWorldMps: copyVector(environment.windWorldMps),
    gustWorldMps: copyVector(environment.gustWorldMps),
    windSpeedMps: Number(environment.windSpeedMps || 0),
    windDirectionRad: Number(environment.windDirectionRad || 0),
    gustStrength: Number(environment.gustStrength || 0),
    bodyDamage: Number(environment.bodyDamage || 0),
    frontAeroDamage: Number(environment.frontAeroDamage || 0),
    rearAeroDamage: Number(environment.rearAeroDamage || 0),
    activeAeroState: Number(environment.activeAeroState || 0),
    damage: environment.damage ? structuredClone(environment.damage) : null,
    tireByWheel: environment.tireByWheel ? structuredClone(environment.tireByWheel) : {}
  };
}

function createRaceStaticColliderWorld(editor, {
  authority,
  worldBake,
  runtimeType,
  routeLength
} = {}) {
  // Keep the cache identity stable even for playtests backed by an applied
  // document rather than a selected library entry. `|| {}` manufactured a
  // new identity on every render update and defeated the fast cache check.
  const race = editor.selectedRace || null;
  const cachedWorld = authority.staticColliderWorldCache;
  if (cachedWorld?.worldBake === worldBake
    && cachedWorld.race === race
    && cachedWorld.runtimeType === runtimeType
    && cachedWorld.routeLength === routeLength) {
    return cachedWorld.world;
  }
  const margin = editor.ensureRaceMarginSettings?.() || {};
  const scenery = editor.ensureRaceScenery?.() || [];
  const authored = [
    ...(Array.isArray(worldBake?.staticColliders) ? worldBake.staticColliders : []),
    ...(Array.isArray(race?.staticColliders) ? race.staticColliders : [])
  ];
  const scenerySignature = scenery.map((sprite) => [
    sprite?.id || '', sprite?.doodadRef || '',
    Math.round(Number(sprite?.x || 0) * 100),
    Math.round(Number(sprite?.z || 0) * 100),
    Math.round(Number(sprite?.yaw || 0) * 1000),
    sprite?.solid === true || sprite?.collidable === true ? 1 : 0
  ].join(':')).join('|');
  const revision = [
    worldBake?.surfaceRevision || worldBake?.revision || worldBake?.key || 'surface',
    race?.id || race?.name || 'race',
    runtimeType,
    Math.round(Number(routeLength || 0) * 10),
    margin.collisionEdge || margin.collisionMode || 'none',
    margin.collisionEffect || 'collide',
    Math.round(Number(margin.widthM || 0) * 100),
    margin.marginMode || 'off',
    Math.round(Number(margin.shoulderWidthM || 0) * 100),
    margin.shoulderMode || 'off',
    authored.length,
    scenerySignature
  ].join('::static-colliders::');
  if (authority.staticColliderWorldCache?.revision === revision) {
    return authority.staticColliderWorldCache.world;
  }
  const definitions = authored.slice();
  const samples = editor.getRacePathSamplesCached?.({ step: 3 }) || [];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    const segment = next.segment || previous.segment || editor.selectedSegment;
    const edgeMode = editor.getRaceEdgeCollisionMode(segment);
    if (edgeMode === 'none') continue;
    const dx = Number(next.x || 0) - Number(previous.x || 0);
    const dz = Number(next.z || 0) - Number(previous.z || 0);
    const segmentLengthM = Math.hypot(dx, dz);
    if (!(segmentLengthM > 0.05)) continue;
    const yaw = Math.atan2(dx, dz);
    const right = editor.getRaceRightVector(yaw);
    const roadHalfWidthM = editor.getRaceRoadHalfWidthWorld(segment);
    const contactLimitM = Math.max(0.2,
      roadHalfWidthM
      + editor.getRaceCollisionMarginWidthWorld(segment, edgeMode)
      + editor.getRaceCollisionShoulderWidthWorld(segment, edgeMode));
    const thicknessM = 0.4;
    const centerX = (Number(previous.x || 0) + Number(next.x || 0)) * 0.5;
    const centerZ = (Number(previous.z || 0) + Number(next.z || 0)) * 0.5;
    const centerY = (
      (Number(previous.elevation || 0) + Number(next.elevation || 0)) * 0.5
      * RACE_THREE_ELEVATION_M
    ) + 2;
    const orientation = quaternionFromEuler({ yaw });
    for (const side of [-1, 1]) {
      definitions.push({
        id: `road-edge:${edgeMode}:${index}:${side < 0 ? 'left' : 'right'}`,
        type: 'box',
        center: {
          x: centerX + Number(right.x || 0) * side * (contactLimitM + thicknessM * 0.5),
          y: centerY,
          z: centerZ + Number(right.z || 0) * side * (contactLimitM + thicknessM * 0.5)
        },
        orientation,
        size: { x: thicknessM, y: 6, z: segmentLengthM + 1.2 },
        friction: 0.7,
        restitution: 0.22,
        source: `edge:${edgeMode}`
      });
    }
  }
  scenery.forEach((sprite) => {
    const doodad = editor.getRaceDoodadForScenery?.(sprite) || {};
    const rules = [doodad.defaultRule, ...(doodad.rules || [])].filter(Boolean);
    const permanentlySolid = sprite?.solid === true
      || sprite?.collidable === true
      || (rules.length > 0 && rules.every((rule) => rule.behavior === 'collide'));
    if (!permanentlySolid || !sprite?.id) return;
    const widthM = Math.max(0.1, Number(
      doodad.hitboxWidthM ?? doodad.widthM ?? sprite.widthM ?? 1
    ));
    const heightM = Math.max(0.1, Number(
      doodad.hitboxHeightM ?? doodad.heightM ?? sprite.heightM ?? 1
    ));
    const ground = editor.sampleRaceDoodadGroundPoint?.(
      Number(sprite.x || 0), Number(sprite.z || 0), sprite, doodad
    );
    definitions.push({
      id: `solid-scenery:${sprite.id}`,
      type: 'box',
      center: {
        x: Number(sprite.x || 0),
        y: Number(ground?.elevation || 0) * RACE_THREE_ELEVATION_M + heightM * 0.5,
        z: Number(sprite.z || 0)
      },
      orientation: quaternionFromEuler({ yaw: Number(sprite.yaw || 0) }),
      size: { x: widthM, y: heightM, z: widthM },
      friction: 0.72,
      restitution: 0.08,
      source: `scenery:${sprite.id}`
    });
  });
  const world = definitions.length
    ? prepareStaticRaceColliders(definitions, { revision, bucketSizeM: 16 })
    : null;
  authority.staticColliderWorldCache = {
    revision,
    world,
    definitions,
    worldBake,
    race,
    runtimeType,
    routeLength
  };
  authority.staticColliderDefinitions = definitions;
  return world;
}

export function calculateAuthoritativeRouteAdvance({ velocityWorld = {}, roadYaw = 0, seconds = 0 } = {}) {
  const roadForward = { x: Math.sin(Number(roadYaw || 0)), z: Math.cos(Number(roadYaw || 0)) };
  return (
    Number(velocityWorld.x || 0) * roadForward.x
    + Number(velocityWorld.z || 0) * roadForward.z
  ) * Math.max(0, Number(seconds || 0));
}

export function createPenetrationRecoveryRouteSearch({
  preferredRouteDistances = [],
  projectedDistance = null,
  sessionRouteDistance = null,
  routeLength = 1,
  runtimeType = 'point-to-point',
  searchStepM = 0.5,
  maximumSearchM = 50
} = {}) {
  const finite = (value) => value !== null && value !== undefined && value !== ''
    && Number.isFinite(Number(value)) ? Number(value) : null;
  const length = Math.max(1, Number(routeLength) || 1);
  const normalizeDistance = (distance) => runtimeType === 'circuit'
    ? ((distance % length) + length) % length
    : clamp(distance, 0, length);
  const exact = [...preferredRouteDistances, projectedDistance, sessionRouteDistance]
    .map(finite).filter((value) => value !== null)
    .filter((distance, index, values) => values.indexOf(distance) === index);
  const results = [];
  const append = (distance) => {
    const normalized = normalizeDistance(distance);
    if (!results.includes(normalized)) results.push(normalized);
  };
  exact.forEach(append);
  const projected = finite(projectedDistance);
  const backwardAnchor = projected ?? exact[0] ?? null;
  if (backwardAnchor === null) return results;
  const stepM = Math.max(0.5, Number(searchStepM) || 0.5);
  for (let offsetM = stepM; offsetM <= maximumSearchM + 1e-9; offsetM += stepM) {
    const distance = normalizeDistance(backwardAnchor - offsetM);
    append(distance);
    if (runtimeType !== 'circuit' && distance <= 0) break;
  }
  return results;
}

function ensureVehicleDynamicsAuthority(editor, tuning, controls) {
  const session = editor.playtestSession;
  if (session.vehicleDynamicsRunner) {
    if (!editor.vehicleDynamicsAuthority
      || editor.vehicleDynamicsAuthority.runner !== session.vehicleDynamicsRunner) {
      editor.vehicleDynamicsAuthority?.workerBridge?.close?.();
      editor.vehicleDynamicsAuthority = { session, runner: session.vehicleDynamicsRunner };
    }
    return editor.vehicleDynamicsAuthority;
  }
  const requestedPhysicsQualityProfile = String(
    session.physicsQualityProfile
      || globalThis.__RTG_VEHICLE_PHYSICS_QUALITY_PROFILE__
      || 'realtime'
  ).toLowerCase();
  const config = createVehicleDynamicsConfigFromTuning(tuning, {
    physicsQualityProfile: requestedPhysicsQualityProfile,
    // Preserve any remaining fixed-step backlog instead of trying to consume a
    // long hitch in one render frame and creating a self-sustaining frame-time
    // spiral.
    maxCatchUpSteps: 8,
    // Two seconds is enough for live diagnostics. Replay owns its compact input
    // timeline separately, so normal play must not retain thousands of deep
    // per-wheel state snapshots for every active vehicle.
    telemetryLimit: 32,
    telemetryRetention: 'transient',
    inputTimelineLimit: 512,
    // Incident capture is intentionally armed by the deterministic capture
    // harness/debug session. Normal races keep the recorder dormant so the
    // regression tooling cannot consume the frame budget it is diagnosing.
    physicsIncidentRecordingEnabled: globalThis.__RTG_CAPTURE_PHYSICS_INCIDENTS__ === true
  });
  const initialContacts = editor.getRaceWheelContactState({
    car: editor.getRaceSessionCar(session),
    tuning,
    session: Number(session.countdownRemainingMs || 0) > 0
      ? { ...session, trackState: null }
      : session
  });
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: {
      worldX: session.worldX,
      heightM: (session.grounded === false || session.airborne)
        && Number.isFinite(Number(session.bodyY ?? session.heightM))
        ? Number(session.bodyY ?? session.heightM)
        : Number(initialContacts.averageHeightM || 0) + config.cgHeightM,
      worldZ: session.worldZ,
      speedMps: session.speedMps,
      velocity: {
        x: Math.sin(Number(session.velocityYaw ?? session.carYaw ?? 0)) * Number(session.speedMps || 0),
        y: Number(session.verticalVelocityMps || 0),
        z: Math.cos(Number(session.velocityYaw ?? session.carYaw ?? 0)) * Number(session.speedMps || 0)
      },
      carYaw: session.carYaw,
      yawVelocityRadps: session.yawVelocityRadps,
      pitchRad: session.pitchRad,
      rollRad: session.rollRad,
      angularVelocityWorld: {
        x: Number(session.pitchRate || 0),
        y: Number(session.yawVelocityRadps || 0),
        z: Number(session.rollRate || 0)
      },
      grounded: session.grounded !== false && !session.airborne,
      engineRpm: session.engineRpm,
      gear: session.gear
    },
    inputTimeline: [{
      timeSeconds: 0,
      input: normalizeVehicleControlInput(controls)
    }]
  });
  runner.physicsIncidentRecorder.configureMetadata({
    sourceDocumentChecksum: hashTrackStateValue(stableTrackStateStringify(editor.selectedRace || {})),
    vehicleConfiguration: config,
    triangleProvider: (bounds) => {
      const sampler = (editor.playtestSession?.worldBake || editor.raceWorldBakeCache)?.surfaceSampler;
      return getRaceBakedSurfaceTrianglesInBounds(sampler, bounds).map((triangle) => ({
        ...triangle,
        vertices: triangle.vertices.map((vertex) => ({
          x: vertex.x,
          y: Number(vertex.elevation) * RACE_THREE_ELEVATION_M,
          z: vertex.z,
          preparedElevation: vertex.elevation
        }))
      }));
    }
  });
  editor.vehicleDynamicsAuthority = { session, runner };
  session.vehicleDynamicsRunner = runner;
  return editor.vehicleDynamicsAuthority;
}

function createTrackStateStepScratch() {
  const positions = {};
  const longitudinalSlipByWheel = {};
  const lateralSlipByWheel = {};
  const wheelContactScaleByWheel = {};
  const tireTemperatures = {};
  const lockByWheel = {};
  const wheelSpinByWheel = {};
  const physicalMutationTotalsByWheel = {};
  const trackStateContactByWheel = {};
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    positions[wheelId] = { x: 0, z: 0 };
    longitudinalSlipByWheel[wheelId] = 0;
    lateralSlipByWheel[wheelId] = 0;
    wheelContactScaleByWheel[wheelId] = 0;
    tireTemperatures[wheelId] = 70;
    lockByWheel[wheelId] = 0;
    wheelSpinByWheel[wheelId] = 0;
    physicalMutationTotalsByWheel[wheelId] = {
      rollingDistanceM: 0,
      groundedContactDurationSeconds: 0,
      normalImpulseNs: 0,
      longitudinalSlipWorkJ: 0,
      lateralScrubWorkJ: 0,
      lockedWheelWorkJ: 0,
      wheelspinWorkJ: 0,
      surfaceHeatingWorkJ: 0,
      rubberDepositionWorkJ: 0,
      waterDisplacementImpulseNs: 0,
      looseMaterialSweepWorkJ: 0,
      materialPickupCapacity: 0,
      carriedMaterialDepositCapacity: 0
    };
    trackStateContactByWheel[wheelId] = {};
  }
  const wheelSurfaceState = { positions };
  const brakeState = { lockByWheel };
  const scratch = {
    positions,
    longitudinalSlipByWheel,
    lateralSlipByWheel,
    wheelContactScaleByWheel,
    tireTemperatures,
    lockByWheel,
    wheelSpinByWheel,
    physicalMutationTotalsByWheel,
    wheelSurfaceState,
    brakeState,
    direction: { x: 0, z: 1 },
    queueOptions: {
      vehicleId: 'player',
      wheelIds: RACE_WHEEL_IDS,
      collectAcceptedEvents: false,
      contactByWheel: trackStateContactByWheel,
      normalLoads: null,
      tireSlipByWheel: null,
      longitudinalSlipByWheel,
      lateralSlipByWheel,
      wheelContactScaleByWheel,
      wheelSurfaceState,
      previousPositions: null,
      speedMps: 0,
      tireCompoundByWheel: null,
      tireTemperatures,
      brakeState,
      wheelSpinByWheel,
      physicalMutationTotalsByWheel,
      contactDurationSeconds: 1 / 120,
      direction: null
    },
    advanceResult: {},
    result: { positions, advance: null },
    emitRequest: null
  };
  scratch.emitRequest = { scratch };
  return scratch;
}

function emitAuthoritativeTrackStateStep({
  editor,
  systems,
  trackState,
  telemetry,
  wheelSurfaceState,
  setup,
  weatherState,
  weatherForcing = null,
  previousPositions,
  scratch = createTrackStateStepScratch()
}) {
  const patches = telemetry.state?.contactPatches || {};
  const positions = scratch.positions;
  const fixedDt = 1 / 120;
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    const patch = patches[wheelId] || {};
    const point = patch.contactPointWorld || {};
    positions[wheelId].x = Number(point.x || 0);
    positions[wheelId].z = Number(point.z || 0);
    const energy = patch.tireEnergyWork || {};
    const radiusM = Math.max(0.01, Number(patch.effectiveRollingRadiusM || 0.33));
    const rollingSurfaceSpeed = Number(patch.wheelAngularVelocityRadps || 0) * radiusM;
    const groundSpeed = Number(patch.longitudinalVelocityMps || 0);
    const longitudinalSlipSpeed = rollingSurfaceSpeed - groundSpeed;
    const lateralSpeed = Number(patch.lateralVelocityMps || 0);
    const longitudinalWorkJ = Math.max(0, Number(energy.longitudinalFrictionWorkJ
      ?? Math.abs(Number(patch.longitudinalForceN || 0) * longitudinalSlipSpeed) * fixedDt));
    const lateralWorkJ = Math.max(0, Number(energy.lateralFrictionWorkJ
      ?? Math.abs(Number(patch.lateralForceN || 0) * lateralSpeed) * fixedDt));
    const rollingDistanceM = Math.abs(groundSpeed) * fixedDt;
    const normalLoadN = Math.max(0, Number(patch.normalLoadN || 0));
    const aquaplaning = patch.aquaplaning || {};
    const displacementImpulseNs = Math.max(0, Number(aquaplaning.displacedWaterVolumeM3ps || 0))
      * 1000 * Math.max(Math.abs(groundSpeed), Math.abs(rollingSurfaceSpeed)) * fixedDt;
    const lockedWheelWorkJ = longitudinalSlipSpeed < 0 ? longitudinalWorkJ : 0;
    const wheelspinWorkJ = longitudinalSlipSpeed > 0 ? longitudinalWorkJ : 0;
    const surfaceHeatingWorkJ = Math.max(0, Number(patch.frictionHeatingWorkJ
      ?? (longitudinalWorkJ + lateralWorkJ) * 0.62));
    const sweepWorkJ = normalLoadN * rollingDistanceM;
    const totals = scratch.physicalMutationTotalsByWheel[wheelId];
    totals.rollingDistanceM = rollingDistanceM;
    totals.groundedContactDurationSeconds = normalLoadN > 1 ? fixedDt : 0;
    totals.normalImpulseNs = normalLoadN * fixedDt;
    totals.longitudinalSlipWorkJ = longitudinalWorkJ;
    totals.lateralScrubWorkJ = lateralWorkJ;
    totals.lockedWheelWorkJ = lockedWheelWorkJ;
    totals.wheelspinWorkJ = wheelspinWorkJ;
    totals.surfaceHeatingWorkJ = surfaceHeatingWorkJ;
    totals.rubberDepositionWorkJ = (longitudinalWorkJ + lateralWorkJ) * 0.82
      + normalLoadN * rollingDistanceM * 0.025;
    totals.waterDisplacementImpulseNs = displacementImpulseNs;
    totals.looseMaterialSweepWorkJ = sweepWorkJ;
    totals.materialPickupCapacity = sweepWorkJ;
    totals.carriedMaterialDepositCapacity = sweepWorkJ;
    scratch.longitudinalSlipByWheel[wheelId] = Math.abs(Number(patch.slipRatio || 0));
    scratch.lateralSlipByWheel[wheelId] = Math.abs(Math.tan(Number(patch.slipAngleRad || 0)));
    scratch.wheelContactScaleByWheel[wheelId] = Number(
      telemetry.state?.wheelLoadsN?.[wheelId] || 0
    ) > 1 ? 1 : 0;
    scratch.tireTemperatures[wheelId] = Number(
      telemetry.state?.tireState?.[wheelId]?.temperatureF || 70
    );
    scratch.lockByWheel[wheelId] = Math.max(0, -Number(patch.slipRatio || 0));
    scratch.wheelSpinByWheel[wheelId] = Math.max(0, Number(patch.slipRatio || 0));
  }
  const yaw = Number(telemetry.state?.yawRad || 0);
  scratch.direction.x = Math.sin(yaw);
  scratch.direction.z = Math.cos(yaw);
  const queueOptions = scratch.queueOptions;
  queueOptions.vehicleId = editor.playtestSession.carId || 'player';
  queueOptions.normalLoads = telemetry.state?.wheelLoadsN;
  queueOptions.tireSlipByWheel = telemetry.state?.wheelSlip;
  queueOptions.previousPositions = previousPositions;
  queueOptions.speedMps = Math.abs(Number(telemetry.state?.speedMps || 0));
  queueOptions.tireCompoundByWheel = setup.tireCompoundByWheel;
  queueOptions.direction = scratch.direction;
  systems.surface.queueTrackStateTireEvents(trackState, queueOptions);
  scratch.result.advance = trackState.advance(
    fixedDt,
    weatherForcing || systems.surface.createTrackStateWeatherForcing({
      weatherState,
      race: editor.selectedRace
    }),
    scratch.advanceResult
  );
  return scratch.result;
}

function advanceVehicleDynamicsAuthority(editor, {
  systems,
  tuning,
  seconds,
  controls,
  wheelContactState,
  wheelSurfaceState,
  tirePressureDynamicsByWheel,
  setup,
  damage,
  countdownActive,
  trackState,
  weatherState
}) {
  const session = editor.playtestSession;
  const authority = ensureVehicleDynamicsAuthority(editor, tuning, controls);
  if (authority.workerBridge) {
    const workerSnapshot = authority.workerBridge.update({
      controls,
      session,
      environmentUpdate: {
        weatherState,
        race: editor.selectedRace,
        weatherForcing: systems.surface.createTrackStateWeatherForcing({
          weatherState,
          race: editor.selectedRace
        }),
        damage
      }
    });
    if (!workerSnapshot
      && authority.workerBridge.client.lastError
      && !authority.workerBridge.client.latestSnapshot) {
      const failure = authority.workerBridge.client.lastError.message;
      authority.workerBridge.close();
      authority.workerBridge = null;
      authority.authoritativeThread = 'render-thread-fallback';
      authority.workerMigrationFailure = failure;
      session.vehicleDynamicsAuthorityThread = 'render';
      session.vehicleDynamicsWorkerMigrationFailure = failure;
    } else {
      // The legacy render calculation runs before this authority adapter and
      // replaces session.tireSlip every frame. While the worker owns physics,
      // keep presenting the last authoritative compatibility view instead of
      // exposing that non-authoritative intermediate calculation as telemetry.
      if (authority.compatibilityTireSlip) {
        session.tireSlip = authority.compatibilityTireSlip;
      }
      session.vehicleDynamicsWorkerStatus = workerSnapshot
        ? 'active' : authority.workerBridge.client.ready ? 'awaiting-snapshot' : 'initializing';
      session.physicsPerformance = {
        ...session.physicsPerformance,
        vehicleDynamicsWorker: session.vehicleDynamicsWorkerMetrics
      };
      return;
    }
  }
  authority.terrainQueryFrameCache ||= createPhysicsTerrainQueryFrameCache({
    resultCapacity: 128
  });
  const physicsCosts = authority.runner.physicsCostAccounting;
  const qualificationWorkerMode = String(
    globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__
      || (globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__ === true ? 'force' : 'auto')
  ).toLowerCase();
  const collectingLiveWorkerQualification = qualificationWorkerMode === 'auto'
    && !authority.liveWorkerQualification
    && typeof Worker === 'function';
  physicsCosts.enabled = editor.raceInput.physicsPerformanceVisible === true
    || session.physicsPerformanceVisible === true
    || globalThis.__RTG_PHYSICS_COST_ACCOUNTING__ === true
    || collectingLiveWorkerQualification;
  if (collectingLiveWorkerQualification) physicsCosts.stepHistoryMode = 'elapsed-ring';
  const ownsCostFrame = physicsCosts.beginFrame({
    source: 'RaceSimulation',
    deltaSeconds: Number(seconds) || 0,
    renderFps: Number(editor.playtestFps || 0)
  });
  const authorityTimer = physicsCosts.start('raceSimulationVehicleAuthorityUpdate');
  if (countdownActive && !authority.formationTargetVelocityWorld) {
    const yaw = Number(authority.runner.state.yawRad || 0);
    const speed = Number(session.rollingStart ? session.rollingStartSpeedMps : 0);
    authority.formationTargetVelocityWorld = {
      x: Math.sin(yaw) * speed,
      y: 0,
      z: Math.cos(yaw) * speed
    };
  } else if (!countdownActive) {
    authority.formationTargetVelocityWorld = null;
  }
  if (!authority.tireConfigByWheel) {
    authority.tireConfigByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
      const compound = editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
      const pressure = tirePressureDynamicsByWheel[wheelId] || {};
      const tireDamage = Number(damage.tires?.[wheelId] || 0);
      return [wheelId, {
        compound,
        pressurePsi: pressure.pressurePsi ?? setup.tirePressurePsi[wheelId],
        coldPressurePsi: setup.tirePressurePsi[wheelId],
        targetPressurePsi: pressure.targetPsi,
        widthMm: setup.tireSize?.widthMm,
        aspectRatio: setup.tireSize?.aspectRatio,
        wheelDiameterIn: setup.tireSize?.wheelDiameterIn,
        wear: tireDamage / 100,
        damage: tireDamage,
        loadSensitivityExponent: 0.08
      }];
    }));
  }
  const surfaceModel = editor.getRaceSurfaceModel();
  surfaceModel.physicsCostAccounting = physicsCosts;
  const runtimeType = session.routeRuntimeType || editor.getActiveRaceRuntimeType();
  authority.physicsQueryContextRequest ||= { target: {}, roadbedRequest: {} };
  const physicsQueryContextRequest = authority.physicsQueryContextRequest;
  physicsQueryContextRequest.runtimeType = runtimeType;
  physicsQueryContextRequest.weatherState = weatherState;
  const physicsQueryContext = surfaceModel.createPhysicsQueryContext(physicsQueryContextRequest);
  authority.wheelPhysicsQueryContext ||= {};
  const wheelPhysicsQueryContext = authority.wheelPhysicsQueryContext;
  wheelPhysicsQueryContext.runtimeType = physicsQueryContext.runtimeType;
  wheelPhysicsQueryContext.routeLength = physicsQueryContext.routeLength;
  wheelPhysicsQueryContext.roadbedProfile = physicsQueryContext.roadbedProfile;
  wheelPhysicsQueryContext.weatherState = physicsQueryContext.weatherState;
  wheelPhysicsQueryContext.allowVisualExtension = physicsQueryContext.allowVisualExtension;
  wheelPhysicsQueryContext.fallbackSurfaceId = editor.selectedSegment?.surface || 'asphalt';
  authority.trackWeatherForcingRequest ||= { target: {} };
  const trackWeatherForcingRequest = authority.trackWeatherForcingRequest;
  trackWeatherForcingRequest.weatherState = weatherState;
  trackWeatherForcingRequest.race = editor.selectedRace;
  const trackWeatherForcing = systems.surface.createTrackStateWeatherForcing(
    trackWeatherForcingRequest
  );
  const wakeSources = getRaceWakeSourcesForFrame(session, {
    playerWidthM: Number(tuning.widthM || 1.8)
  });
  const carDimensions = editor.getRaceCarDimensions(editor.getRaceSessionCar(session));
  const preparedWorldBake = editor.playtestSession?.worldBake || editor.raceWorldBakeCache;
  const staticColliderWorld = createRaceStaticColliderWorld(editor, {
    authority,
    worldBake: preparedWorldBake,
    runtimeType,
    routeLength: session.routeLength || editor.getRaceRouteLength()
  });
  authority.raceEnvironmentProviderContext ||= {};
  const providerContext = authority.raceEnvironmentProviderContext;
  providerContext.physicsCosts = physicsCosts;
  providerContext.preparedWorldBake = preparedWorldBake;
  providerContext.weatherState = weatherState;
  providerContext.editor = editor;
  providerContext.session = session;
  providerContext.surfaceModel = surfaceModel;
  providerContext.runtimeType = runtimeType;
  providerContext.physicsQueryContext = physicsQueryContext;
  providerContext.wheelPhysicsQueryContext = wheelPhysicsQueryContext;
  providerContext.damage = damage;
  providerContext.setup = setup;
  providerContext.tuning = tuning;
  providerContext.carDimensions = carDimensions;
  providerContext.trackWeatherForcing = trackWeatherForcing;
  providerContext.wheelSurfaceState = wheelSurfaceState;
  providerContext.countdownActive = countdownActive;
  providerContext.staticColliderWorld = staticColliderWorld;
  providerContext.wakeSources = wakeSources;
  if (!authority.raceEnvironmentProvider) authority.raceEnvironmentProvider = ({
    state,
    previousState = null,
    controls: fixedControls,
    timeSeconds,
    stepIndex = 0,
    tireSubstepDt = 1 / authority.runner.config.tireHz,
    chassisStepDt = 1 / authority.runner.config.chassisHz,
    substepIndex = 0,
    reuseContactGeometry = false,
    recoveryRecalculation = false
  }) => {
    const {
      physicsCosts,
      preparedWorldBake,
      weatherState,
      editor,
      session,
      surfaceModel,
      runtimeType,
      physicsQueryContext,
      wheelPhysicsQueryContext,
      damage,
      setup,
      tuning,
      carDimensions,
      trackWeatherForcing,
      wheelSurfaceState,
      countdownActive,
      staticColliderWorld,
      wakeSources
    } = authority.raceEnvironmentProviderContext;
    if (reuseContactGeometry === true
      && authority.chassisGeometryEnvironment
      && authority.chassisGeometryStepIndex === stepIndex) {
      const cachedEnvironment = authority.chassisGeometryEnvironment;
      cachedEnvironment.contactGeometrySubstepIndex = substepIndex;
      cachedEnvironment.contactGeometryState = state;
      cachedEnvironment.reuseContactGeometry = true;
      cachedEnvironment.geometryRefreshRequested = false;
      return cachedEnvironment;
    }
    authority.raceEnvironmentScratch ||= Array.from(
      { length: RACE_ENVIRONMENT_SCRATCH_COUNT },
      createRaceEnvironmentScratch
    );
    authority.raceEnvironmentScratchCursor ||= 0;
    const environmentScratch = authority.raceEnvironmentScratch[
      authority.raceEnvironmentScratchCursor++ % authority.raceEnvironmentScratch.length
    ];
    const wheelQueryTimer = physicsCosts.start('wheelCenterAndFootprintQueries');
    const refreshWithinChassisStep = recoveryRecalculation !== true
      && authority.chassisGeometryStepIndex === stepIndex
      && authority.chassisGeometryEnvironment?.physicsTerrainQueryFrame;
    if (!refreshWithinChassisStep) physicsCosts.count('chassisGeometryFrames');
    const worldBake = preparedWorldBake;
    const preparedSampler = worldBake?.surfaceSampler || null;
    const profile = authority.runner.config.bodyProfile || {};
    const bodyHalfWidthM = Number(
      profile.overallWidthM || authority.runner.config.bodyWidthM || 1.8
    ) * 0.5;
    const bodyHalfLengthM = Number(
      profile.overallLengthM || authority.runner.config.bodyLengthM || 4.5
    ) * 0.5;
    const bodyHeightM = Number(
      profile.overallHeightM || authority.runner.config.bodyHeightM || 1.45
    );
    const horizontalReachM = Math.hypot(bodyHalfWidthM, bodyHalfLengthM, bodyHeightM)
      + Math.max(0.5, Number(authority.runner.config.wheelRadiusM || 0.34));
    const predictedX = Number(state.position?.x || 0)
      + Number(state.velocity?.x || 0) * chassisStepDt;
    const predictedZ = Number(state.position?.z || 0)
      + Number(state.velocity?.z || 0) * chassisStepDt;
    const previousX = Number(previousState?.position?.x ?? state.position?.x ?? 0);
    const previousZ = Number(previousState?.position?.z ?? state.position?.z ?? 0);
    authority.terrainQueryBounds ||= {
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0
    };
    authority.terrainQueryBounds.minX = Math.min(
      previousX, Number(state.position?.x || 0), predictedX
    ) - horizontalReachM;
    authority.terrainQueryBounds.maxX = Math.max(
      previousX, Number(state.position?.x || 0), predictedX
    ) + horizontalReachM;
    authority.terrainQueryBounds.minZ = Math.min(
      previousZ, Number(state.position?.z || 0), predictedZ
    ) - horizontalReachM;
    authority.terrainQueryBounds.maxZ = Math.max(
      previousZ, Number(state.position?.z || 0), predictedZ
    ) + horizontalReachM;
    // Event-triggered tire refreshes update contact state inside the swept
    // terrain prepared at the 120 Hz chassis boundary. They must not rebuild
    // world geometry or discard the frame caches at tire frequency.
    authority.terrainQueryFrameBeginOptions ||= {};
    const queryFrameBeginOptions = authority.terrainQueryFrameBeginOptions;
    queryFrameBeginOptions.sampler = preparedSampler;
    queryFrameBeginOptions.revision = worldBake?.surfaceRevision
      ?? worldBake?.revision ?? worldBake?.key ?? 0;
    queryFrameBeginOptions.bounds = authority.terrainQueryBounds;
    queryFrameBeginOptions.elevationScaleM = RACE_THREE_ELEVATION_M;
    queryFrameBeginOptions.physicsCostAccounting = physicsCosts;
    const terrainQueryFrame = refreshWithinChassisStep
      ? authority.chassisGeometryEnvironment.physicsTerrainQueryFrame
      : authority.terrainQueryFrameCache.begin(queryFrameBeginOptions);
    const capturePhysicsIncidentDiagnostics = authority.runner.config.physicsIncidentRecordingEnabled;
    const incidentTerrainSamples = capturePhysicsIncidentDiagnostics ? [] : null;
    const incidentTerrainSampleKeys = capturePhysicsIncidentDiagnostics ? new Set() : null;
    const recordTerrainSamples = capturePhysicsIncidentDiagnostics ? (kind, requests, samples) => {
      requests.forEach((request, index) => {
        const sample = samples[index] || {};
        const bakedElevation = Number(sample.bakedElevation);
        const analyticalElevation = Number(sample.analyticalElevation);
        const authoritativeSample = createSurfaceSample(sample, {
          queryPosition: request.point,
          heightScale: RACE_THREE_ELEVATION_M,
          source: sample.bakedSurfaceSource || `race-${sample.region || 'terrain'}`
        });
        const entry = {
          kind,
          wheelId: request.wheelId || null,
          offsetIndex: Number.isFinite(request.offsetIndex) ? request.offsetIndex : null,
          point: { ...request.point },
          physics: {
            valid: authoritativeSample.valid,
            heightM: authoritativeSample.heightM,
            normal: authoritativeSample.normal,
            region: sample.region || null,
            source: authoritativeSample.source,
            triangleId: authoritativeSample.triangleId,
            reason: authoritativeSample.reason,
            surfaceId: sample.surfaceId || null,
            friction: Number(sample.friction || 0)
          },
          prepared: {
            triangleId: Number.isFinite(Number(sample.bakedTriangleId))
              ? Number(sample.bakedTriangleId) : null,
            heightM: Number.isFinite(bakedElevation)
              ? bakedElevation * RACE_THREE_ELEVATION_M : null,
            normal: sample.bakedNormal || null,
            source: sample.bakedSurfaceSource || null
          },
          analytical: {
            heightM: Number.isFinite(analyticalElevation)
              ? analyticalElevation * RACE_THREE_ELEVATION_M : null,
            normal: sample.analyticalNormal || null
          },
          projection: sample.projection ? {
            distance: Number(sample.projection.distance || 0),
            lateral: Number(sample.projection.lateral || 0),
            yaw: Number(sample.projection.yaw || 0)
          } : null
        };
        const key = `${kind.startsWith('body') ? 'body' : kind}:${Number(request.point?.x || 0).toFixed(5)}:${Number(request.point?.z || 0).toFixed(5)}`;
        if (!incidentTerrainSampleKeys.has(key)) {
          incidentTerrainSampleKeys.add(key);
          incidentTerrainSamples.push(entry);
        }
      });
    } : null;
    if (!authority.preliminaryWheelKinematicsScratch) {
      authority.preliminaryWheelKinematicsScratch = {};
      authority.preliminaryWheelKinematicsRequests = {};
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        authority.preliminaryWheelKinematicsScratch[wheelId] =
          createWheelContactKinematicsScratch();
        authority.preliminaryWheelKinematicsRequests[wheelId] = { wheelId };
      }
    }
    authority.preliminaryWheelPatches ||= {};
    authority.preliminaryWheelPositions ||= {};
    authority.emptyWheelKinematicsEnvironment ||= {};
    const preliminaryPatches = authority.preliminaryWheelPatches;
    const positions = authority.preliminaryWheelPositions;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      const kinematicsScratch = authority.preliminaryWheelKinematicsScratch[wheelId];
      const kinematicsRequest = authority.preliminaryWheelKinematicsRequests[wheelId];
      kinematicsRequest.state = state;
      kinematicsRequest.controls = fixedControls;
      kinematicsRequest.config = authority.runner.config;
      kinematicsRequest.environment = authority.emptyWheelKinematicsEnvironment;
      kinematicsRequest.target = kinematicsScratch.target;
      kinematicsRequest.computationScratch = kinematicsScratch.computation;
      preliminaryPatches[wheelId] = calculateWheelContactKinematics(kinematicsRequest);
      positions[wheelId] = preliminaryPatches[wheelId].contactPointWorld;
    }
    const atmosphereRequest = environmentScratch.atmosphereRequest;
    atmosphereRequest.weatherState = weatherState;
    atmosphereRequest.race = editor.selectedRace;
    atmosphereRequest.timeSeconds = timeSeconds;
    atmosphereRequest.target = environmentScratch.atmosphere;
    const atmosphere = createDeterministicAtmosphere(atmosphereRequest);
    const wheelMaterialResolver = environmentScratch.wheelMaterialResolver;
    const wheelMaterialContext = environmentScratch.wheelMaterialContext;
    wheelMaterialContext.surfaceModel = surfaceModel;
    wheelMaterialContext.queryContext = wheelPhysicsQueryContext;
    const panelDamage = damage.panels || {};
    const footprintSampleCount = Math.max(4, Math.min(
      MAX_RACE_TIRE_FOOTPRINT_SAMPLES,
      Math.trunc(Number(authority.runner.config.contactFootprintSamples) || 4)
    ));
    const tireWidthM = Math.max(0.12, Number(setup.tireSize?.widthMm || 245) / 1000);
    authority.terrainWheelPointBuffer ||= new Float64Array(
      (1 + MAX_RACE_TIRE_FOOTPRINT_SAMPLES) * RACE_WHEEL_IDS.length * 3
    );
    const wheelPointBuffer = authority.terrainWheelPointBuffer;
    for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
      const wheelId = RACE_WHEEL_IDS[index];
      const point = positions[wheelId];
      const pointOffset = index * 3;
      wheelPointBuffer[pointOffset] = point.x;
      wheelPointBuffer[pointOffset + 1] = point.y;
      wheelPointBuffer[pointOffset + 2] = point.z;
    }
    for (let offsetIndex = 0; offsetIndex < footprintSampleCount; offsetIndex += 1) {
      const longitudinal = RACE_TIRE_FOOTPRINT_OFFSETS[offsetIndex * 2];
      const lateral = RACE_TIRE_FOOTPRINT_OFFSETS[offsetIndex * 2 + 1];
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        const patch = preliminaryPatches[wheelId];
        const pointOffset = (RACE_WHEEL_IDS.length
          + offsetIndex * RACE_WHEEL_IDS.length + wheelIndex) * 3;
        wheelPointBuffer[pointOffset] = patch.contactPointWorld.x
          + patch.wheelForwardWorld.x * longitudinal * 0.16
          + patch.wheelLateralWorld.x * lateral * tireWidthM;
        wheelPointBuffer[pointOffset + 1] = patch.contactPointWorld.y;
        wheelPointBuffer[pointOffset + 2] = patch.contactPointWorld.z
          + patch.wheelForwardWorld.z * longitudinal * 0.16
          + patch.wheelLateralWorld.z * lateral * tireWidthM;
      }
    }
    // Only wheel centers need route, weather, material, and Track State
    // classification. Footprint/body points consume prepared geometry from the
    // shared substep frame and therefore avoid repeating route projection.
    const baseFootprintPointCount = Math.min(4, footprintSampleCount) * RACE_WHEEL_IDS.length;
    const baseFootprintSampleStart = RACE_WHEEL_IDS.length;
    const wheelGeometrySamples = terrainQueryFrame.samplePackedPoints(
      wheelPointBuffer,
      baseFootprintSampleStart + baseFootprintPointCount
    );
    let fullSurfaceClassificationCount = 0;
    for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
      const wheelId = RACE_WHEEL_IDS[index];
      const point = positions[wheelId];
      const geometrySample = wheelGeometrySamples[index];
      const missesBefore = terrainQueryFrame.statistics.materialCacheMisses;
      const materialSample = terrainQueryFrame.materialForWheelSignature(
        index,
        geometrySample.triangleId,
        geometrySample.region,
        geometrySample.source,
        wheelMaterialResolver,
        point,
        wheelMaterialContext
      );
      if (terrainQueryFrame.statistics.materialCacheMisses > missesBefore) {
        fullSurfaceClassificationCount += 1;
      }
      geometrySample.friction = Number.isFinite(Number(materialSample?.friction))
        ? Number(materialSample.friction) : null;
      geometrySample.surfaceId = materialSample?.surfaceId || null;
      geometrySample.projection = materialSample?.projection || null;
      geometrySample.segment = materialSample?.segment
        || materialSample?.projection?.segment || null;
    }
    terrainQueryFrame.noteFullSurfaceClassification(fullSurfaceClassificationCount);
    if (capturePhysicsIncidentDiagnostics) {
      const diagnosticRequests = [];
      const diagnosticSamples = [];
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        const wheelId = RACE_WHEEL_IDS[wheelIndex];
        diagnosticRequests.push({ wheelId, point: positions[wheelId] });
        diagnosticSamples.push(wheelGeometrySamples[wheelIndex]);
      }
      for (let index = 0; index < baseFootprintPointCount; index += 1) {
        diagnosticRequests.push({
          wheelId: RACE_WHEEL_IDS[index % RACE_WHEEL_IDS.length],
          offsetIndex: Math.trunc(index / RACE_WHEEL_IDS.length),
          point: wheelGeometrySamples[baseFootprintSampleStart + index].queryPosition
        });
        diagnosticSamples.push(wheelGeometrySamples[baseFootprintSampleStart + index]);
      }
      recordTerrainSamples('wheel-center-and-footprint', diagnosticRequests, diagnosticSamples);
    }
    const centerSamples = environmentScratch.centerSamples;
    const groundedByWheel = environmentScratch.groundedByWheel;
    for (let index = 0; index < RACE_WHEEL_IDS.length; index += 1) {
      const wheelId = RACE_WHEEL_IDS[index];
      centerSamples[wheelId] = wheelGeometrySamples[index] || {};
      groundedByWheel[wheelId] = state.validTreadContactByWheel?.[wheelId] !== false;
    }
    const activeTrackState = countdownActive ? null : session.trackState;
    authority.fixedContactScratch ||= {};
    const fixedContactRequest = environmentScratch.fixedContactRequest;
    fixedContactRequest.positions = positions;
    fixedContactRequest.surfaceSamples = centerSamples;
    fixedContactRequest.carDimensions = carDimensions;
    fixedContactRequest.tuning = tuning;
    fixedContactRequest.selectedSegment = editor.selectedSegment;
    fixedContactRequest.trackState = activeTrackState;
    fixedContactRequest.groundedByWheel = groundedByWheel;
    fixedContactRequest.target = authority.fixedContactScratch;
    const fixedContacts = createRaceWheelContactStateFromSamples(fixedContactRequest);
    const footprintContacts = environmentScratch.footprintContacts;
    const footprintContactEntries = environmentScratch.footprintContactEntries;
    footprintContacts.length = 0;
    for (let offsetIndex = 0; offsetIndex < Math.min(4, footprintSampleCount); offsetIndex += 1) {
      const entry = footprintContactEntries[offsetIndex];
      const contacts = entry.contacts;
      footprintContacts.push(entry);
      for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
        contacts[RACE_WHEEL_IDS[wheelIndex]] = wheelGeometrySamples[
          baseFootprintSampleStart + offsetIndex * RACE_WHEEL_IDS.length + wheelIndex
        ];
      }
    }
    let needsAdaptiveSamples = false;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      let minimumHeightM = Infinity;
      let maximumHeightM = -Infinity;
      for (let offsetIndex = 0; offsetIndex < Math.min(4, footprintSampleCount); offsetIndex += 1) {
        const heightM = Number(footprintContacts[offsetIndex].contacts[wheelId]?.elevation)
          * RACE_THREE_ELEVATION_M;
        if (!Number.isFinite(heightM)) {
          needsAdaptiveSamples = true;
          break;
        }
        minimumHeightM = Math.min(minimumHeightM, heightM);
        maximumHeightM = Math.max(maximumHeightM, heightM);
      }
      if (maximumHeightM - minimumHeightM > 0.02) needsAdaptiveSamples = true;
    }
    if (needsAdaptiveSamples && footprintSampleCount > 4) {
      const adaptiveOffsetCount = footprintSampleCount - 4;
      const adaptivePointCount = adaptiveOffsetCount * RACE_WHEEL_IDS.length;
      const adaptiveSamples = terrainQueryFrame.samplePackedPoints(
        wheelPointBuffer,
        adaptivePointCount,
        environmentScratch.adaptivePackedQueryOptions
      );
      for (let adaptiveOffset = 0; adaptiveOffset < adaptiveOffsetCount; adaptiveOffset += 1) {
        const entry = footprintContactEntries[adaptiveOffset + 4];
        const contacts = entry.contacts;
        footprintContacts.push(entry);
        for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
          contacts[RACE_WHEEL_IDS[wheelIndex]] = adaptiveSamples[
            adaptiveOffset * RACE_WHEEL_IDS.length + wheelIndex
          ];
        }
      }
      if (capturePhysicsIncidentDiagnostics) {
        const requests = new Array(adaptivePointCount);
        for (let index = 0; index < adaptivePointCount; index += 1) {
          requests[index] = {
            wheelId: RACE_WHEEL_IDS[index % RACE_WHEEL_IDS.length],
            offsetIndex: 4 + Math.trunc(index / RACE_WHEEL_IDS.length),
            point: adaptiveSamples[index].queryPosition
          };
        }
        recordTerrainSamples('adaptive-footprint', requests, adaptiveSamples);
      }
    }
    physicsCosts.end(wheelQueryTimer);
    const sampleRecoveryTerrain = environmentScratch.sampleRecoveryTerrain;
    let createTerrainAlignedRecoveryState = environmentScratch.createTerrainAlignedRecoveryState;
    if (!createTerrainAlignedRecoveryState) {
      createTerrainAlignedRecoveryState = (distance, rejectedSourceKeys = []) => {
      const {
        editor, runtimeType, authority, state, session
      } = environmentScratch.callbackContext;
      const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType });
      const poseX = Number(pose?.x);
      const poseZ = Number(pose?.z);
      const yaw = Number(pose?.yaw);
      if (![poseX, poseZ, yaw].every(Number.isFinite)) return null;
      const fallbackSurfaceId = pose.segment?.surface
        || editor.selectedSegment?.surface || 'asphalt';
      const config = authority.runner.config;
      const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const wheelLayout = RACE_WHEEL_IDS.map((wheelId) => {
        const front = wheelId[0] === 'f';
        const left = wheelId[1] === 'l';
        const axle = front ? config.frontAxleDistanceFromCgM : -config.rearAxleDistanceFromCgM;
        const track = front ? config.frontTrackWidthM : config.rearTrackWidthM;
        return {
          wheelId,
          front,
          left,
          x: poseX + forward.x * axle + right.x * (left ? -track * 0.5 : track * 0.5),
          z: poseZ + forward.z * axle + right.z * (left ? -track * 0.5 : track * 0.5)
        };
      });
      const wheelTerrain = wheelLayout.map((wheel) => ({
        ...wheel,
        sample: sampleRecoveryTerrain({ x: wheel.x, y: Number(state.position?.y || 0), z: wheel.z },
          fallbackSurfaceId)
      }));
      if (wheelTerrain.some(({ sample }) => !sample.valid)) return null;
      const averageHeight = (predicate) => {
        const samples = wheelTerrain.filter(predicate);
        return samples.reduce((sum, entry) => sum + entry.sample.heightM, 0) / samples.length;
      };
      const frontHeightM = averageHeight((entry) => entry.front);
      const rearHeightM = averageHeight((entry) => !entry.front);
      const leftHeightM = averageHeight((entry) => entry.left);
      const rightHeightM = averageHeight((entry) => !entry.left);
      const orientation = quaternionFromEuler({
        yaw,
        pitch: -Math.atan2(frontHeightM - rearHeightM, config.wheelbaseM),
        roll: Math.atan2(rightHeightM - leftHeightM, (
          config.frontTrackWidthM + config.rearTrackWidthM
        ) * 0.5)
      });
      const bodyFeatures = authority.runner.bodyCollision.getSupportCandidates({ orientation })
        .map((candidate) => ({
          id: candidate.id,
          kind: 'body',
          arm: rotateVectorByQuaternion(candidate.localPoint, orientation)
        }));
      const wheelFeatures = wheelLayout.map((wheel) => ({
        id: `recovery-${wheel.wheelId}-tread`,
        kind: 'wheel',
        wheelId: wheel.wheelId,
        front: wheel.front,
        arm: rotateVectorByQuaternion({
          x: (wheel.left ? -0.5 : 0.5)
            * (wheel.front ? config.frontTrackWidthM : config.rearTrackWidthM),
          y: -config.cgHeightM,
          z: wheel.front ? config.frontAxleDistanceFromCgM : -config.rearAxleDistanceFromCgM
        }, orientation)
      }));
      const features = bodyFeatures.concat(wheelFeatures).map((feature) => {
        const queryPosition = {
          x: poseX + feature.arm.x,
          y: Number(state.position?.y || 0),
          z: poseZ + feature.arm.z
        };
        return {
          ...feature,
          sample: sampleRecoveryTerrain(queryPosition, fallbackSurfaceId)
        };
      });
      if (features.some(({ sample }) => !sample.valid)) return null;
      const safetyMarginM = config.penetrationRecoverySafetyMarginM;
      const cgHeightM = Math.max(...features.map((feature) => (
        feature.sample.heightM - feature.arm.y + (feature.kind === 'body'
          ? (safetyMarginM + 0.002) / Math.max(0.2, Number(feature.sample.normal?.y || 1))
          : 0)
      )));
      const candidate = {
        position: { x: poseX, y: cgHeightM, z: poseZ },
        orientation,
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocityWorld: { x: 0, y: 0, z: 0 },
        grounded: true,
        engineRpm: Number(session.engineRpm || config.idleRpm),
        gear: Number(session.gear || 0),
        routeDistance: distance
      };
      const recoveryEnvironment = {
        sampleTerrainAtWorldPoint: (point) => sampleRecoveryTerrain(point, fallbackSurfaceId),
        adaptiveBodySupport: true
      };
      const bodySample = authority.runner.bodyCollision.samplePosePenetration(
        candidate, recoveryEnvironment, config.bodyCollisionToleranceM
      );
      const wheelsValid = wheelFeatures.every((wheelFeature) => {
        const feature = features.find(({ id }) => id === wheelFeature.id);
        const contactHeightM = cgHeightM + feature.arm.y;
        const gapM = contactHeightM - feature.sample.heightM;
        const droopReachM = (wheelFeature.front
          ? config.suspensionTravelFrontM * config.staticSagRatioFront
          : config.suspensionTravelRearM * config.staticSagRatioRear)
          + config.treadReachToleranceM;
        return gapM >= -config.bodyCollisionToleranceM && gapM <= droopReachM;
      });
      const triangleIds = [...new Set(features.map(({ sample }) => sample.triangleId)
        .filter((value) => value !== null && value !== undefined).map(String))].sort();
      const terrainSources = [...new Set(features.map(({ sample }) => sample.source)
        .filter(Boolean).map(String))].sort();
      const sourceKey = [
        'route',
        Math.round(distance * 10) / 10,
        triangleIds.join(','),
        config.bodyProfile?.preset || config.bodyShapePreset || 'car'
      ].join('|');
      if (rejectedSourceKeys.includes(sourceKey)
        || bodySample.maximumPenetrationM === null
        || bodySample.maximumPenetrationM > -safetyMarginM + 1e-6
        || Number(bodySample.invalidTerrainSampleCount || 0) > 0
        || !wheelsValid) return null;
      return {
        ...candidate,
        sourceKey,
        recoveryValidation: {
          terrainSamplesValid: true,
          wheelsValid,
          bodyResolved: true,
          maximumWheelOvertravelM: 0,
          bodyClearanceM: -bodySample.maximumPenetrationM,
          triangleIds,
          terrainSources
        }
      };
      };
      environmentScratch.createTerrainAlignedRecoveryState = createTerrainAlignedRecoveryState;
    }
    const recordedRouteDistance = centerSamples.fl?.projection?.distance
      ?? editor.getRaceRouteProjectionForWorldPoint(state.position)?.distance;
    const incidentRouteDistanceM = recordedRouteDistance !== null
      && recordedRouteDistance !== undefined
      && Number.isFinite(Number(recordedRouteDistance))
      ? Number(recordedRouteDistance) : null;
    const bodyVariationBounds = terrainQueryFrame.bodyVariationBounds;
    const bodyCollisionReachM = Math.hypot(bodyHalfWidthM, bodyHalfLengthM) + 0.15;
    bodyVariationBounds.minX = Math.min(Number(state.position?.x || 0), predictedX)
      - bodyCollisionReachM;
    bodyVariationBounds.maxX = Math.max(Number(state.position?.x || 0), predictedX)
      + bodyCollisionReachM;
    bodyVariationBounds.minZ = Math.min(Number(state.position?.z || 0), predictedZ)
      - bodyCollisionReachM;
    bodyVariationBounds.maxZ = Math.max(Number(state.position?.z || 0), predictedZ)
      + bodyCollisionReachM;
    const uprightUnderbodyHeightM = Number(state.position?.y || 0)
      - Number(authority.runner.config.cgHeightM || 0.55)
      + Number(authority.runner.config.bodyGroundClearanceM || 0.13);
    const predictedUnderbodyHeightM = uprightUnderbodyHeightM + Math.min(
      0,
      Number(state.velocity?.y || 0) * chassisStepDt
    ) - Math.hypot(
      Number(state.angularVelocityWorld?.x || 0),
      Number(state.angularVelocityWorld?.z || 0)
    ) * chassisStepDt * Math.max(bodyHalfWidthM, bodyHalfLengthM);
    const lowerHullProbeRangeM = Number(
      authority.runner.config.bodyCollisionLowerHullProbeRangeM ?? 0.08
    );
    bodyVariationBounds.minY = predictedUnderbodyHeightM - lowerHullProbeRangeM;
    bodyVariationBounds.maxY = Math.max(
      Number(state.position?.y || 0),
      Number(state.position?.y || 0) + Number(state.velocity?.y || 0) * chassisStepDt
    ) + bodyHeightM;
    const bodyTerrainCollisionClassification = terrainQueryFrame
      .classifyCollisionFeaturesInBounds(
        bodyVariationBounds,
        environmentScratch.bodyCollisionClassification
      );
    const terrainHasDiscontinuities = bodyTerrainCollisionClassification.discontinuity === true;
    const wheelVariationBounds = environmentScratch.wheelVariationBounds;
    wheelVariationBounds.minX = bodyVariationBounds.minX;
    wheelVariationBounds.maxX = bodyVariationBounds.maxX;
    wheelVariationBounds.minZ = bodyVariationBounds.minZ;
    wheelVariationBounds.maxZ = bodyVariationBounds.maxZ;
    wheelVariationBounds.minY = Infinity;
    wheelVariationBounds.maxY = -Infinity;
    const wheelRadiusM = Math.max(0.1, Number(authority.runner.config.wheelRadiusM || 0.34));
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelPointY = Number(positions[RACE_WHEEL_IDS[wheelIndex]]?.y || 0);
      wheelVariationBounds.minY = Math.min(
        wheelVariationBounds.minY,
        wheelPointY - wheelRadiusM - lowerHullProbeRangeM
      );
      wheelVariationBounds.maxY = Math.max(
        wheelVariationBounds.maxY,
        wheelPointY + wheelRadiusM + lowerHullProbeRangeM
      );
    }
    const wheelTerrainCollisionClassification = terrainQueryFrame
      .classifyCollisionFeaturesInBounds(
        wheelVariationBounds,
        environmentScratch.wheelCollisionClassification
      );
    const chassisMaximumTerrainHeightM = refreshWithinChassisStep
      && Number.isFinite(authority.chassisGeometryMaximumTerrainHeightM)
      ? authority.chassisGeometryMaximumTerrainHeightM
      : terrainQueryFrame.maximumHeightInBounds(bodyVariationBounds);
    const chassisCenterTerrainSample = terrainQueryFrame.samplePoint(state.position);
    const chassisCenterTerrainHeightM = Number(chassisCenterTerrainSample.heightM);
    const bodyCollisionPredicted = terrainHasDiscontinuities
      || !Number.isFinite(chassisCenterTerrainHeightM)
      || predictedUnderbodyHeightM - chassisCenterTerrainHeightM
        <= Number(authority.runner.config.bodyCollisionLowerHullProbeRangeM ?? 0.08)
      || Math.abs(Number(state.pitchRad || 0)) > 0.35
      || Math.abs(Number(state.rollRad || 0)) > 0.35;
    const surfaceHeightByWheel = environmentScratch.surfaceHeightByWheel;
    const surfaceSamplesByWheel = environmentScratch.surfaceSamplesByWheel;
    const surfaceNormalByWheel = environmentScratch.surfaceNormalByWheel;
    const contactSamplesByWheel = environmentScratch.contactSamplesByWheel;
    const footprintSamplesByWheel = environmentScratch.footprintSamplesByWheel;
    const contactTriangleByWheel = environmentScratch.contactTriangleByWheel;
    const materialByWheel = environmentScratch.materialByWheel;
    const tireByWheel = environmentScratch.tireByWheel;
    for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
      const wheelId = RACE_WHEEL_IDS[wheelIndex];
      surfaceHeightByWheel[wheelId] = fixedContacts.heights?.[wheelId]
        ?? wheelContactState?.heights?.[wheelId];
      surfaceSamplesByWheel[wheelId] = fixedContacts.contacts?.[wheelId]?.surfaceSample
        || createInvalidSurfaceSample({
          queryPosition: positions[wheelId],
          source: 'race-wheel-contact',
          reason: 'missing-wheel-surface'
        });
      surfaceNormalByWheel[wheelId] = fixedContacts.contacts?.[wheelId]?.normal
        || wheelSurfaceState.normalByWheel?.[wheelId];
      const contactSamples = contactSamplesByWheel[wheelId];
      contactSamples.length = footprintContacts.length;
      for (let sampleIndex = 0; sampleIndex < footprintContacts.length; sampleIndex += 1) {
        const geometry = footprintContacts[sampleIndex].contacts?.[wheelId] || {};
        const sample = footprintSamplesByWheel[wheelId][sampleIndex];
        const valid = geometry.valid === true
          && Number.isFinite(Number(geometry.heightM))
          && geometry.normal !== null;
        sample.valid = valid;
        sample.heightM = valid ? Number(geometry.heightM) : null;
        sample.normal = valid ? geometry.normal : null;
        sample.region = geometry.region ?? null;
        sample.source = geometry.source ?? geometry.bakedSurfaceSource
          ?? 'race-wheel-footprint';
        sample.triangleId = geometry.triangleId ?? geometry.bakedTriangleId ?? null;
        sample.queryPosition = geometry.queryPosition || positions[wheelId];
        sample.reason = valid ? null : geometry.reason || 'invalid-surface-sample';
        sample.normalX = valid ? geometry.normal.x : null;
        sample.normalY = valid ? geometry.normal.y : null;
        sample.normalZ = valid ? geometry.normal.z : null;
        sample.supported = valid;
        contactSamples[sampleIndex] = sample;
      }
      let contactTriangleId = surfaceSamplesByWheel[wheelId]?.triangleId ?? null;
      if (contactTriangleId === null || contactTriangleId === undefined) {
        for (let sampleIndex = 0; sampleIndex < contactSamples.length; sampleIndex += 1) {
          const triangleId = contactSamples[sampleIndex]?.triangleId;
          if (!Number.isInteger(Number(triangleId))) continue;
          contactTriangleId = triangleId;
          break;
        }
      }
      contactTriangleByWheel[wheelId].triangleId = contactTriangleId;

      const contact = fixedContacts.contacts?.[wheelId] || {};
      const trackSample = contact.trackState;
      const cell = trackSample?.cell || null;
      const baseSurfaceId = cell?.baseSurfaceId || contact.baseSurfaceId
        || wheelSurfaceState.baseSurfaceByWheel?.[wheelId] || 'asphalt';
      const nominalBaseGrip = Math.max(0.025, Number(getSurfaceById(baseSurfaceId)?.grip || 1));
      const localBaseGrip = Number(cell?.baseGrip ?? contact.friction ?? nominalBaseGrip);
      const surfaceGripScale = localBaseGrip / nominalBaseGrip
        * Number(trackSample?.effectiveGripMultiplier ?? 1);
      const material = materialByWheel[wheelId];
      for (const key in material) delete material[key];
      if (cell) {
        for (const key in cell) material[key] = cell[key];
      }
      material.baseSurfaceId = baseSurfaceId;
      material.surfaceId = contact.surfaceId || wheelSurfaceState.surfaceByWheel?.[wheelId];
      material.effectiveGrip = trackSample?.effectiveGrip ?? contact.friction
        ?? wheelSurfaceState.frictionByWheel?.[wheelId] ?? 1;
      material.effectiveGripMultiplier = trackSample?.effectiveGripMultiplier ?? 1;
      material.surfaceGripScale = surfaceGripScale;
      material.grip = material.effectiveGrip;
      material.trackStateConditionApplied = Boolean(trackSample);
      const fixedTire = authority.tireConfigByWheel[wheelId];
      const localTrackState = fixedContacts.contacts?.[wheelId]?.trackState;
      const rollingMultiplier = localTrackState
        ? Number(localTrackState.rollingResistanceMultiplier || 1)
          / Math.max(0.2, Number(localTrackState.cell?.baseRollingResistance || 1))
        : 1;
      const tire = tireByWheel[wheelId];
      for (const key in tire) delete tire[key];
      for (const key in fixedTire) tire[key] = fixedTire[key];
      tire.temperatureF = state.tireState?.[wheelId]?.temperatureF ?? 70;
      tire.treadTemperatureC = state.tireState?.[wheelId]?.treadTemperatureC;
      tire.carcassTemperatureC = state.tireState?.[wheelId]?.carcassTemperatureC;
      tire.internalAirTemperatureC = state.tireState?.[wheelId]?.internalAirTemperatureC;
      tire.effectivePressurePsi = state.tireState?.[wheelId]?.effectivePressurePsi
        ?? fixedTire.pressurePsi;
      tire.pressurePsi = tire.effectivePressurePsi;
      tire.wear = state.tireState?.[wheelId]?.wear ?? fixedTire.wear;
      tire.damage = Number(damage.tires?.[wheelId] ?? fixedTire.damage ?? 0);
      tire.rollingResistanceCoefficient = 0.012 * rollingMultiplier;
    }
    const brakeDamage = environmentScratch.brakeDamage;
    for (const key in brakeDamage) delete brakeDamage[key];
    const sourceBrakeDamage = damage.brakes || {};
    for (const key in sourceBrakeDamage) brakeDamage[key] = sourceBrakeDamage[key];
    let bodyDamage = 0;
    for (const key in panelDamage) bodyDamage = Math.max(bodyDamage, Number(panelDamage[key]) || 0);
    const callbackContext = environmentScratch.callbackContext;
    callbackContext.terrainQueryFrame = terrainQueryFrame;
    callbackContext.capturePhysicsIncidentDiagnostics = capturePhysicsIncidentDiagnostics;
    callbackContext.contactTriangleByWheel = contactTriangleByWheel;
    callbackContext.physicsCosts = physicsCosts;
    callbackContext.surfaceModel = surfaceModel;
    callbackContext.physicsQueryContext = physicsQueryContext;
    callbackContext.fixedContacts = fixedContacts;
    callbackContext.recordTerrainSamples = recordTerrainSamples;
    callbackContext.editor = editor;
    callbackContext.session = session;
    callbackContext.state = state;
    callbackContext.authority = authority;
    callbackContext.runtimeType = runtimeType;
    callbackContext.createTerrainAlignedRecoveryState = createTerrainAlignedRecoveryState;
    callbackContext.bodyVariationBounds = bodyVariationBounds;
    callbackContext.chassisMaximumTerrainHeightM = chassisMaximumTerrainHeightM;
    const environmentResult = environmentScratch.environmentResult;
    environmentResult.physicsTerrainQueryFrame = terrainQueryFrame;
    environmentResult.staticColliderWorld = staticColliderWorld;
    environmentResult.physicsTerrainQueryStatistics = terrainQueryFrame.statistics;
    environmentResult.capturePhysicsIncidentDiagnostics = capturePhysicsIncidentDiagnostics;
    environmentResult.routeDistanceM = incidentRouteDistanceM;
    environmentResult.physicsIncidentDiagnostics = capturePhysicsIncidentDiagnostics ? {
        terrainSamples: incidentTerrainSamples,
        routeDistanceM: incidentRouteDistanceM,
        recoveryState: authority.runner.penetrationRecoveryState
      } : null;
    environmentResult.contactGeometrySubstepIndex = substepIndex;
    environmentResult.contactGeometryState = state;
    environmentResult.reuseContactGeometry = false;
    environmentResult.geometryRefreshRequested = false;
    environmentResult.chassisMaximumTerrainHeightM = chassisMaximumTerrainHeightM;
    environmentResult.bodyCollisionPredicted = bodyCollisionPredicted;
    environmentResult.adaptiveBodySupport = terrainHasDiscontinuities;
    environmentResult.terrainHasDiscontinuities = terrainHasDiscontinuities;
    environmentResult.terrainCollisionClassification =
      wheelTerrainCollisionClassification.classification;
    environmentResult.bodyTerrainCollisionClassification =
      bodyTerrainCollisionClassification.classification;
    environmentResult.targetVelocityWorld = countdownActive
      ? authority.formationTargetVelocityWorld : null;
    environmentResult.ambientTemperatureC = trackWeatherForcing.ambientTemperatureC;
    environmentResult.windWorldMps = atmosphere.windWorldMps;
    environmentResult.gustWorldMps = atmosphere.gustWorldMps;
    environmentResult.windSpeedMps = atmosphere.windSpeedMps;
    environmentResult.windDirectionRad = atmosphere.windDirectionRad;
    environmentResult.gustStrength = atmosphere.gustStrength;
    environmentResult.wakeSources = wakeSources;
    environmentResult.bodyDamage = bodyDamage;
    environmentResult.frontAeroDamage = clamp(Number(panelDamage.front || 0) / 100, 0, 1);
    environmentResult.rearAeroDamage = clamp(Number(panelDamage.rear || 0) / 100, 0, 1);
    environmentResult.activeAeroState = Number(session.activeAeroState || 0);
    environmentResult.damage.engine = Number(damage.engine || 0);
    environmentResult.damage.transmission = Number(damage.transmission || 0);
    environmentResult.damage.brakes = brakeDamage;
    callbackContext.environmentResult = environmentResult;
    authority.chassisGeometryEnvironment = environmentResult;
    authority.chassisGeometryStepIndex = stepIndex;
    authority.chassisGeometryMaximumTerrainHeightM = chassisMaximumTerrainHeightM;
    return environmentResult;
  };
  authority.runner.environmentProvider = authority.raceEnvironmentProvider;
  let latestFixedStepTelemetry = null;
  let previousTrackPositions = session.trackStatePreviousWheelPositions || {};
  let latestTrackStateAdvance = null;
  authority.trackStateStepScratch ||= Array.from(
    { length: 8 }, createTrackStateStepScratch
  );
  authority.trackStateStepScratchCursor ||= 0;
  authority.raceFixedStepContext ||= {};
  const fixedStepContext = authority.raceFixedStepContext;
  fixedStepContext.editor = editor;
  fixedStepContext.session = session;
  fixedStepContext.authority = authority;
  fixedStepContext.countdownActive = countdownActive;
  fixedStepContext.trackState = trackState;
  fixedStepContext.systems = systems;
  fixedStepContext.wheelSurfaceState = wheelSurfaceState;
  fixedStepContext.setup = setup;
  fixedStepContext.weatherState = weatherState;
  fixedStepContext.trackWeatherForcing = trackWeatherForcing;
  fixedStepContext.physicsCosts = physicsCosts;
  fixedStepContext.previousTrackPositions = previousTrackPositions;
  fixedStepContext.latestFixedStepTelemetry = null;
  fixedStepContext.latestTrackStateAdvance = null;
  if (!authority.raceFixedStepCallback) authority.raceFixedStepCallback = (telemetry) => {
      const {
        editor,
        session,
        authority,
        countdownActive,
        trackState,
        systems,
        wheelSurfaceState,
        setup,
        weatherState,
        trackWeatherForcing,
        physicsCosts
      } = fixedStepContext;
      fixedStepContext.latestFixedStepTelemetry = telemetry;
      const bodyContacts = telemetry?.forces?.bodyCollision?.contacts;
      if (bodyContacts?.length) {
        for (let contactIndex = 0; contactIndex < bodyContacts.length; contactIndex += 1) {
          const contact = bodyContacts[contactIndex];
          const colliderSource = String(contact.colliderSource || '');
          if (contact.contactType !== 'static-body'
            || Number(contact.normalImpulseNs || 0) <= 1
            || (!colliderSource.startsWith('edge:')
              && !colliderSource.startsWith('scenery:'))) continue;
          session.staticColliderDamageHistory ||= [];
          const damageKey = `${telemetry.stepIndex}:${contact.colliderId}:${contact.pieceId || ''}`;
          if (session.staticColliderDamageHistory.includes(damageKey)) continue;
          session.staticColliderDamageHistory.push(damageKey);
          if (session.staticColliderDamageHistory.length > 128) {
            session.staticColliderDamageHistory.splice(
              0, session.staticColliderDamageHistory.length - 128
            );
          }
          const normal = contact.normal || {};
          const yaw = Number(telemetry.state?.yawRad || 0);
          const sinYaw = Math.sin(yaw);
          const cosYaw = Math.cos(yaw);
          const forwardDot = Number(normal.x || 0) * sinYaw
            + Number(normal.z || 0) * cosYaw;
          const rightDot = Number(normal.x || 0) * cosYaw
            - Number(normal.z || 0) * sinYaw;
          const panel = Math.abs(rightDot) > Math.abs(forwardDot)
            ? (rightDot > 0 ? 'left' : 'right')
            : (forwardDot < 0 ? 'front' : 'rear');
          const severity = clamp(
            Number(contact.normalImpulseNs || 0)
              / Math.max(1, authority.runner.config.massKg * 18) * 14,
            0.2,
            14
          );
          editor.applyRaceDamage('panels', severity, {
            keys: [panel],
            source: colliderSource
          });
        }
      }
      if (countdownActive || !trackState) return;
      const trackStateScratch = authority.trackStateStepScratch[
        authority.trackStateStepScratchCursor++ % authority.trackStateStepScratch.length
      ];
      const emitRequest = trackStateScratch.emitRequest;
      emitRequest.editor = editor;
      emitRequest.systems = systems;
      emitRequest.trackState = trackState;
      emitRequest.telemetry = telemetry;
      emitRequest.wheelSurfaceState = wheelSurfaceState;
      emitRequest.setup = setup;
      emitRequest.weatherState = weatherState;
      emitRequest.weatherForcing = trackWeatherForcing;
      emitRequest.previousPositions = fixedStepContext.previousTrackPositions;
      const trackStateTimer = physicsCosts.start('trackState');
      let result;
      try {
        result = emitAuthoritativeTrackStateStep(emitRequest);
      } finally {
        physicsCosts.end(trackStateTimer);
      }
      fixedStepContext.previousTrackPositions = result.positions;
      fixedStepContext.latestTrackStateAdvance = result.advance;
    };
  authority.raceAdvanceRequest ||= { input: null, onFixedStep: authority.raceFixedStepCallback };
  authority.raceAdvanceRequest.input = controls;
  const advance = authority.runner.advance(seconds, authority.raceAdvanceRequest);
  if (!countdownActive && Number(advance.completedSteps || 0) > 0
    && Number(advance.advanceWallTimeMs || 0) > 0) {
    authority.workerQualificationSamples ||= [];
    authority.workerQualificationCompletedSteps ||= 0;
    authority.workerQualificationWallTimeMs ||= 0;
    authority.workerQualificationPeakBacklog ||= 0;
    const samples = authority.workerQualificationSamples;
    samples.push(Number(advance.advanceWallTimeMs) / Number(advance.completedSteps));
    authority.workerQualificationCompletedSteps += Number(advance.completedSteps);
    authority.workerQualificationWallTimeMs += Number(advance.advanceWallTimeMs);
    authority.workerQualificationPeakBacklog = Math.max(
      authority.workerQualificationPeakBacklog,
      Number(advance.backlogSteps || 0)
    );
    if (samples.length > 240) samples.shift();
    const exactStepSamples = physicsCosts.appendStepElapsedHistory([]);
    if (exactStepSamples.length >= 240 && !authority.liveWorkerQualification) {
      const sorted = exactStepSamples.slice(-240).sort((left, right) => left - right);
      const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
      authority.liveWorkerQualification = qualifyVehicleDynamicsWorkerMigration({
        achievedStepsPerSecond: authority.workerQualificationCompletedSteps
          / Math.max(1e-6, authority.workerQualificationWallTimeMs / 1000),
        p95StepMs: sorted[p95Index],
        backlogStart: 0,
        backlogEnd: Number(advance.backlogSteps || 0),
        growingBacklog: authority.workerQualificationPeakBacklog > 0
      });
      session.vehicleDynamicsWorkerQualification = authority.liveWorkerQualification;
    }
  }
  latestFixedStepTelemetry = fixedStepContext.latestFixedStepTelemetry;
  previousTrackPositions = fixedStepContext.previousTrackPositions;
  latestTrackStateAdvance = fixedStepContext.latestTrackStateAdvance;
  if (!countdownActive && trackState) {
    session.trackStatePreviousWheelPositions = previousTrackPositions;
    session.trackStateRuntime ||= {};
    const trackStateRuntime = session.trackStateRuntime;
    trackStateRuntime.stepIndex = trackState.stepIndex;
    trackStateRuntime.simulationTimeMs = trackState.simulationTimeMs;
    trackStateRuntime.activeCellCount = trackState.cells.size;
    trackStateRuntime.pendingAggregateCount = trackState.contactAccumulator.size;
    if (latestTrackStateAdvance) {
      for (const key in latestTrackStateAdvance) {
        trackStateRuntime[key] = latestTrackStateAdvance[key];
      }
    }
  }
  const legacyWorkerPreference = globalThis.__RTG_ENABLE_VEHICLE_DYNAMICS_WORKER__;
  const requestedWorkerMode = String(
    globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__
      || (legacyWorkerPreference === true ? 'force' : 'auto')
  ).toLowerCase();
  const explicitQualification = globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_QUALIFICATION__;
  const qualification = requestedWorkerMode === 'force'
    ? qualifyVehicleDynamicsWorkerMigration(explicitQualification || {})
    : authority.liveWorkerQualification;
  const mobileDevice = Boolean(editor.game?.deviceIsMobile || editor.game?.isMobile);
  const mobileAutoMigrationBlocked = mobileDevice && requestedWorkerMode === 'auto';
  const workerPermitted = typeof Worker === 'function' && !mobileAutoMigrationBlocked && (
    requestedWorkerMode === 'force'
    || (requestedWorkerMode === 'auto' && qualification?.qualified === true)
  );
  if (!authority.workerBridge && !workerPermitted) {
    authority.authoritativeThread = 'render-thread';
    session.vehicleDynamicsAuthorityThread = 'render';
  }
  if (!authority.workerBridge
    && !authority.workerMigrationAttempted
    && !authority.preparedWorkerSurfaceSampler
    && countdownActive
    && workerPermitted) {
    try {
      const sourceSurfaceSampler = preparedWorldBake?.surfaceSampler;
      const packedSurfaceSampler = sourceSurfaceSampler?.packed
        ? sourceSurfaceSampler
        : packRaceBakedSurfaceSampler(sourceSurfaceSampler);
      authority.preparedWorkerSurfaceSampler = prepareRaceVehicleDynamicsWorkerSurface(
        packedSurfaceSampler
      );
    } catch (error) {
      authority.workerPreparationFailure = String(error?.message || error);
    }
  }
  if (!authority.workerBridge
    && !authority.workerMigrationAttempted
    && !countdownActive
    && workerPermitted
    && (session.aiRuntime || []).every((ai) => ai.sleeping === true || ai.vehicleDynamicsRunner)) {
    authority.workerMigrationAttempted = true;
    let migrationWorker = null;
    try {
      const sourceSurfaceSampler = preparedWorldBake?.surfaceSampler;
      const packedSurfaceSampler = sourceSurfaceSampler?.packed
        ? sourceSurfaceSampler
        : packRaceBakedSurfaceSampler(sourceSurfaceSampler);
      const surfaceSampler = authority.preparedWorkerSurfaceSampler
        || prepareRaceVehicleDynamicsWorkerSurface(packedSurfaceSampler);
      if (!surfaceSampler?.packed) {
        throw new Error('vehicle dynamics worker requires a packed immutable surface');
      }
      migrationWorker = new Worker(
        new URL('./simulation/vehicleDynamicsWorker.js', import.meta.url),
        { type: 'module', name: 'rtg-vehicle-dynamics' }
      );
      const bridge = new RaceVehicleDynamicsWorkerBridge({
        worker: migrationWorker,
        qualification
      });
      bridge.initialize({
        runner: authority.runner,
        surfaceSampler,
        staticColliderDefinitions: authority.staticColliderDefinitions || [],
        materialByRegion: { default: { grip: 1 } },
        environmentState: createWorkerEnvironmentStateSnapshot(
          authority.chassisGeometryEnvironment || {}
        ),
        trackState: countdownActive ? null : trackState,
        weatherForcing: trackWeatherForcing,
        tireCompoundByWheel: setup.tireCompoundByWheel,
        activeAiVehicles: (session.aiRuntime || []).map((ai, index) => {
          ai.workerVehicleId = `ai-${ai.id || index}`;
          const aiRunner = ai.vehicleDynamicsRunner;
          const aiEnvironment = aiRunner?.environmentProvider?.({
            state: aiRunner.state,
            previousState: aiRunner.state,
            controls: {},
            timeSeconds: aiRunner.simulationTimeSeconds,
            tireSubstepDt: 1 / Math.max(1, Number(aiRunner.config?.tireHz || 120)),
            chassisStepDt: 1 / Math.max(1, Number(aiRunner.config?.chassisHz || 120)),
            substepIndex: 0,
            reuseContactGeometry: false
          }) || {};
          return {
            id: ai.workerVehicleId,
            runner: aiRunner,
            active: ai.sleeping !== true,
            environmentState: createWorkerEnvironmentStateSnapshot(aiEnvironment)
          };
        })
      });
      authority.workerBridge = bridge;
      authority.preparedWorkerSurfaceSampler = null;
      authority.authoritativeThread = 'vehicle-dynamics-worker';
      authority.runner.dormant = true;
      authority.runner.dormantSinceStepIndex = authority.runner.stepIndex;
      session.workerTrackStateVisual = {
        cells: new Map(),
        stepIndex: Number(session.trackState?.stepIndex || 0),
        cellRevision: 0,
        eventSequence: Number(session.vehicleDynamicsEventSequence || 0),
        remainingDirtyCellCount: 0
      };
      session.trackStateVisualCache = null;
      session.trackStateVisualAtlas = null;
      for (const ai of session.aiRuntime || []) {
        if (!ai.vehicleDynamicsRunner) continue;
        ai.vehicleDynamicsRunner.dormant = true;
        ai.vehicleDynamicsRunner.dormantSinceStepIndex = ai.vehicleDynamicsRunner.stepIndex;
      }
      session.vehicleDynamicsAuthorityThread = 'worker';
      session.vehicleDynamicsWorkerMigrationTimeMs = performance.now();
    } catch (error) {
      migrationWorker?.terminate?.();
      authority.workerMigrationFailure = String(error?.message || error);
      session.vehicleDynamicsAuthorityThread = 'render';
      session.vehicleDynamicsWorkerMigrationFailure = authority.workerMigrationFailure;
    }
  }
  authority.compatibilityTelemetryScratch ||= createRaceCompatibilityTelemetryScratch();
  const compatibilityScratch = authority.compatibilityTelemetryScratch;
  copyRecordInto(compatibilityScratch.diagnostics, authority.runner.diagnostics);
  compatibilityScratch.fixedStepTelemetry.length = latestFixedStepTelemetry ? 1 : 0;
  if (latestFixedStepTelemetry) {
    compatibilityScratch.fixedStepTelemetry[0] = latestFixedStepTelemetry;
  }
  const latest = compatibilityScratch.latest;
  // This is a transient render-frame view. Replay/checkpoint callers use the
  // runner snapshot API explicitly, so its wrapper storage may be reused.
  latest.state = authority.runner.state;
  latest.telemetry = latestFixedStepTelemetry;
  latest.diagnostics = compatibilityScratch.diagnostics;
  latest.fixedStepTelemetry = compatibilityScratch.fixedStepTelemetry;
  latest.advance = advance;
  authority.latest = latest;
  syncVehicleDynamicsCompatibilityOutputs(authority.runner, session);
  session.physicsCatchUpWarning = advance.catchUpBudgetWarning || null;
  const authoritativeState = authority.runner.state;
  session.authoritativeHandbrakeActive = authoritativeState.handbrakeCommandState?.active === true;
  session.handbrakeCommandState = copyRecordInto(
    session.handbrakeCommandState || {},
    authoritativeState.handbrakeCommandState
  );
  session.steeringTelemetry = copyRecordInto(
    session.steeringTelemetry || {},
    authoritativeState.steeringTelemetry
  );
  const authoritativePatches = authoritativeState.contactPatches || {};
  const powertrainTelemetry = authoritativeState.powertrainState?.telemetry || {};
  const drivenWheelIds = authority.runner.config.drivenWheelIds || [];
  const wheelRadiusM = Math.max(0.1, Number(authority.runner.config.wheelRadiusM || 0.33));
  const demandedForceByWheel = compatibilityScratch.demandedForceByWheel;
  const appliedForceByWheel = compatibilityScratch.appliedForceByWheel;
  const limitByWheel = compatibilityScratch.limitByWheel;
  const wheelLongitudinalUsage = compatibilityScratch.wheelLongitudinalUsage;
  const wheelFrictionUsage = compatibilityScratch.wheelFrictionUsage;
  let wheelSpin = 0;
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    const patch = authoritativePatches[wheelId] || {};
    demandedForceByWheel[wheelId] = Math.abs(Number(
      powertrainTelemetry.wheelDriveTorqueNm?.[wheelId] || 0
    )) / wheelRadiusM;
    appliedForceByWheel[wheelId] = Math.abs(Number(patch.longitudinalForceN || 0));
    limitByWheel[wheelId] = Math.max(0, Number(patch.combinedSlipLimitN || 0));
    wheelLongitudinalUsage[wheelId] = demandedForceByWheel[wheelId]
      / Math.max(1, limitByWheel[wheelId]);
    wheelFrictionUsage[wheelId] = Math.hypot(
      Number(patch.longitudinalForceN || 0),
      Number(patch.lateralForceN || 0)
    ) / Math.max(1, limitByWheel[wheelId]);
    wheelSpin = Math.max(
      wheelSpin,
      Number(patch.rawSlipRatio ?? patch.slipRatio ?? 0)
    );
  }
  let demandedForceN = 0;
  let appliedForceN = 0;
  let drivenLimitN = 0;
  let drivenPostPeakEfficiency = drivenWheelIds.length ? Infinity : 1;
  for (let index = 0; index < drivenWheelIds.length; index += 1) {
    const wheelId = drivenWheelIds[index];
    demandedForceN += Number(demandedForceByWheel[wheelId] || 0);
    appliedForceN += Number(appliedForceByWheel[wheelId] || 0);
    drivenLimitN += Number(limitByWheel[wheelId] || 0);
    drivenPostPeakEfficiency = Math.min(
      drivenPostPeakEfficiency,
      Number(authoritativePatches[wheelId]?.postPeakSlidingForceN || limitByWheel[wheelId])
        / Math.max(1, limitByWheel[wheelId])
    );
  }
  drivenLimitN = Math.max(1, drivenLimitN);
  const driveDemandRatio = demandedForceN / drivenLimitN;
  const appliedDriveDemandRatio = appliedForceN / drivenLimitN;
  session.tireSlip = session.tireSlip || {};
  session.tireSlip.wheelSpin = Math.max(0, wheelSpin);
  const effectiveFrictionMuByWheel = session.tireSlip.effectiveFrictionMuByWheel || {};
  for (let wheelIndex = 0; wheelIndex < RACE_WHEEL_IDS.length; wheelIndex += 1) {
    const wheelId = RACE_WHEEL_IDS[wheelIndex];
    effectiveFrictionMuByWheel[wheelId] = Number(
      authoritativePatches[wheelId]?.gripCoefficient || 0
    );
  }
  session.tireSlip.effectiveFrictionMuByWheel = effectiveFrictionMuByWheel;
  const engineDrive = session.tireSlip.engineDrive || {};
  engineDrive.demandedForceN = demandedForceN;
  engineDrive.appliedRawForceN = appliedForceN;
  engineDrive.appliedForceN = appliedForceN;
  engineDrive.driveDemandRatio = driveDemandRatio;
  engineDrive.appliedDriveDemandRatio = appliedDriveDemandRatio;
  engineDrive.wheelLongitudinalUsage = wheelLongitudinalUsage;
  engineDrive.wheelFrictionUsage = wheelFrictionUsage;
  engineDrive.tractionControlCut = Number(powertrainTelemetry.tractionTorqueScale ?? 1);
  engineDrive.shiftTorqueCut = Number(powertrainTelemetry.shiftTorqueScale ?? 1);
  engineDrive.drivetrainUnload = demandedForceN > 1
    ? clamp(1 - appliedForceN / demandedForceN, 0, 1)
    : 0;
  engineDrive.postPeakTractionEfficiency = drivenPostPeakEfficiency;
  engineDrive.combinedSlipEfficiency = clamp(
    1 - Math.max(0, appliedDriveDemandRatio - 1), 0, 1
  );
  engineDrive.authoritative = true;
  session.tireSlip.engineDrive = engineDrive;
  authority.compatibilityTireSlip = session.tireSlip;
  physicsCosts.end(authorityTimer);
  physicsCosts.setFrameCounter('backlogSteps', advance.backlogSteps);
  if (ownsCostFrame) physicsCosts.finishFrame({
    completedSteps: advance.completedSteps,
    completedTireSubsteps: advance.completedTireSubsteps,
    backlogSteps: advance.backlogSteps,
    advanceWallTimeMs: advance.advanceWallTimeMs,
    renderFps: Number(editor.playtestFps || 0)
  });
  session.physicsPerformance = physicsCosts.getSummary();
}

export function updateRaceSimulation({
  editor,
  systems,
  vehicleState: requestedVehicleState,
  input,
  dt = 0
} = {}) {
  if (!editor || !systems) return;
  const vehicleState = getAuthoritativeVehicleState(
    requestedVehicleState || editor.playtestSession
  );
  if (!vehicleState?.running) return;
  if (input && input !== editor.raceInput) editor.raceInput = input;
  if (editor.raceInput.paused) return;
  const car = editor.getRaceSessionCar(editor.playtestSession);
  const tuning = editor.getRaceCarTuning(car);
  const authoritativeGroundSpeedMps = Number(editor.playtestSession.groundSpeedMps
    ?? getAuthoritativeChassisState(editor.playtestSession)?.groundSpeedMps);
  const steeringSafetySpeedMps = Number.isFinite(authoritativeGroundSpeedMps)
    ? Math.max(0, authoritativeGroundSpeedMps)
    : Math.abs(Number(editor.playtestSession.speedMps) || 0);
  tuning.absEnabled = editor.playtestSession.absEnabled !== false;
  tuning.tractionControlEnabled = editor.playtestSession.tractionControlEnabled !== false;
  const seconds = Math.max(0, Number(dt) || 0);
  ensureVehicleDynamicsAuthority(editor, tuning, {
    steering: -editor.raceInput.steeringWheel,
    driverSteeringIntent: -Number(editor.raceInput.analogSteeringActive
      ? editor.raceInput.analogSteeringIntent
      : editor.raceInput.binarySteer || 0),
    steeringTarget: -Number(editor.raceInput.steeringTarget || 0),
    controllerFilterOutput: -Number(editor.raceInput.steeringWheel || 0),
    centerSteeringAngleRad: -editor.getRaceResolvedCenterSteeringAngle(
      editor.raceInput.steeringWheel,
      steeringSafetySpeedMps,
      {
        wheelbaseM: tuning.wheelbaseM,
        availableLateralG: 0.95,
        handlingPreset: tuning.handlingPreset || 'sport',
        maxPhysicalAngleRad: 0.52
      }
    ),
    steeringInputMode: String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation'
      ? 'simulation-wheel'
      : editor.raceInput.controllerSteeringMode || (editor.raceInput.analogSteeringActive ? 'gamepad' : 'keyboard'),
    throttle: editor.raceInput.throttleAxis,
    brake: editor.raceInput.brakeAxis,
    clutch: editor.raceInput.clutchAxis,
    handbrake: editor.raceInput.handbrake ? 1 : 0,
    handbrakeHoldSequence: editor.raceInput.handbrakeHoldSequence,
    handbrakeHoldSeconds: editor.raceInput.handbrakeHoldSeconds,
    requestedGear: editor.raceInput.gear,
    assists: {
      absEnabled: tuning.absEnabled,
      tractionControlEnabled: tuning.tractionControlEnabled,
      launchControlEnabled: tuning.launchControlEnabled === true,
      stabilityControlEnabled: String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation'
        ? editor.playtestSession.stabilityControlExplicitlyEnabled === true
        : editor.playtestSession.stabilityControlEnabled !== false,
      autoShift: editor.raceInput.autoShift !== false
    }
  });
  const countdownRemainingMs = Number(editor.playtestSession.countdownRemainingMs || 0);
  const countdownVisible = countdownRemainingMs > 0;
  // The final second is the displayed GO phase, not another staged-countdown
  // second. Release the drivetrain as soon as GO is shown while allowing the
  // banner timer to finish independently.
  const countdownActive = countdownRemainingMs > 1000;
  editor.playtestSession.sceneElapsedMs = Math.max(
    0,
    Number(editor.playtestSession.sceneElapsedMs || 0) + seconds * 1000
  );
  if (editor.raceInput.syntheticAnalogSteering !== true) {
    editor.applyRaceAnalogInput();
  }
  const physicalGamepad = editor.hasPhysicalRaceGamepad();
  if (!physicalGamepad) editor.raceInput.lookIntentX = 0;
  const lookTarget = physicalGamepad ? clamp(Number(editor.raceInput.lookIntentX || 0), -1, 1) * Math.PI : 0;
  const lookRate = Math.abs(lookTarget) > 0.01 ? 7.5 : 4.2;
  editor.raceInput.lookAngle += (lookTarget - Number(editor.raceInput.lookAngle || 0)) * Math.min(1, seconds * lookRate);
  editor.updateRacePedalAxes(seconds);
  const launchSteeringLocked = countdownActive || (
    editor.isRaceLaunchSteeringLocked(editor.playtestSession)
    && editor.raceInput.analogSteeringActive
  );
  if (launchSteeringLocked) {
    editor.raceInput.steeringTarget = 0;
    editor.raceInput.steeringWheel = 0;
    editor.raceInput.digitalSteerHoldMs = 0;
    editor.playtestSession.lateral = 0;
    editor.playtestSession.heading = 0;
    editor.playtestSession.roadViewOffset = 0;
    editor.playtestSession.trackViewOffset = 0;
  }
  const damageEffects = editor.getRaceDamageEffects();
  const segmentInfo = editor.getRaceSegmentAtDistance(editor.playtestSession.distance, {
    wrap: (editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType()) === 'circuit'
  });
  const weatherState = editor.getRaceWeatherState(editor.selectedRace, editor.playtestSession);
  const trackState = editor.playtestSession.trackState || null;
  let latestTrackStateAdvance = null;
  const surface = getSurfaceById(editor.getRaceEffectiveSurfaceId(segmentInfo.segment?.surface || 'asphalt', weatherState));
  const engineJitter = damageEffects.engineJitter
    ? 1 - damageEffects.engineJitter * (0.5 + 0.5 * Math.sin(editor.playtestSession.elapsedMs / 173))
    : 1;
  const setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, editor.playtestSession.speedMps);
  const damage = editor.getRaceSessionDamage();
  const surfaceSession = countdownActive && trackState
    ? { ...editor.playtestSession, trackState: null }
    : editor.playtestSession;
  const wheelSurfaceState = editor.getRaceWheelSurfaceState({
    car,
    tuning,
    session: surfaceSession,
    damage
  });
  const wheelContactState = editor.getRaceWheelContactState({
    car,
    tuning,
    session: surfaceSession
  });
  const snowDepthInches = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(wheelSurfaceState.snowDepthByWheel?.[wheelId] ?? weatherState.snowDepthInches ?? 0)
  ), 0) / RACE_WHEEL_IDS.length;
  const surfaceGrip = wheelSurfaceState.averageSurfaceGrip || (surface.grip * editor.getRaceSegmentSurfaceDetailGrip(segmentInfo.segment));
  const looseSurfaceFactor = editor.getRaceLooseSurfaceFactor(wheelSurfaceState);
  const tireTemperatures = editor.playtestSession?.diagnostics?.tireTemperature || {};
  const tireTemperatureGrip = editor.getRaceTireTemperatureGripMultipliers(tireTemperatures);
  const weatherGripMultiplier = trackState ? 1 : editor.getRaceWeatherGripMultiplier(weatherState);
  const gripFactor = Math.max(0.35, Math.min(1.4, tuning.tireGrip)) * surfaceGrip * weatherGripMultiplier * damageEffects.grip * setupModifiers.grip;
  const setup = editor.getRaceCarSetup(car);
  const tirePressureDynamicsByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const compound = editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]);
    return [
      wheelId,
      editor.getRaceTirePressureDynamics({
        pressurePsi: setup.tirePressurePsi[wheelId],
        compoundId: compound.id,
        surfaceId: wheelSurfaceState.surfaceByWheel?.[wheelId] || surface.id,
        tireSize: setup.tireSize,
        temperatureF: tireTemperatures[wheelId]
      })
    ];
  }));
  const perWheelGrip = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const pressureDynamics = tirePressureDynamicsByWheel[wheelId] || {};
    const coldPressureGrip = Math.max(0.01, Number(pressureDynamics.coldGripMultiplier || pressureDynamics.gripMultiplier || 1));
    const hotPressureGrip = Number(pressureDynamics.gripMultiplier || coldPressureGrip);
    const temperaturePressureGrip = clamp(hotPressureGrip / coldPressureGrip, 0.72, 1.08);
    return [
      wheelId,
      clamp(
        Number(wheelSurfaceState.gripByWheel?.[wheelId] || 0.7)
          * Number(tireTemperatureGrip[wheelId] || 1)
          * temperaturePressureGrip,
        0.08,
        1.38
      )
    ];
  }));
  const tirePressureRollingMultiplier = RACE_WHEEL_IDS.reduce((sum, wheelId) => (
    sum + Number(tirePressureDynamicsByWheel[wheelId]?.rollingMultiplier || 1)
  ), 0) / RACE_WHEEL_IDS.length;
  const leftTireGrip = (perWheelGrip.fl + perWheelGrip.rl) * 0.5;
  const rightTireGrip = (perWheelGrip.fr + perWheelGrip.rr) * 0.5;
  let gear = clamp(Math.round(Number(editor.raceInput.gear ?? 0)), -1, tuning.gearRatios.length);
  let automaticOverrevUpshifts = 0;
  const driverThrottle = clamp(Number(editor.raceInput.throttleAxis || 0), 0, 1);
  const driverBrake = clamp(Number(editor.raceInput.brakeAxis || 0), 0, 1);
  let throttle = countdownActive ? 0 : driverThrottle;
  let brake = countdownActive ? 0 : driverBrake;
  const controlsLockedByRollover = Boolean(editor.playtestSession.rolledOver);
  let controlLockReason = controlsLockedByRollover ? 'rollover' : 'none';
  if (controlsLockedByRollover) {
    throttle = 0;
    brake = 0;
  }
  const engineThrottle = controlsLockedByRollover ? 0 : driverThrottle;
  let handbrake = controlsLockedByRollover || countdownActive
    ? 0
    : editor.raceInput.handbrake ? 1 : 0;
  if (handbrake) {
    editor.playtestSession.handbrakeSlipMs = Math.max(Number(editor.playtestSession.handbrakeSlipMs || 0), 760);
  } else {
    editor.playtestSession.handbrakeSlipMs = Math.max(0, Number(editor.playtestSession.handbrakeSlipMs || 0) - seconds * 1000);
  }
  const rawHandbrakeSlip = clamp(Number(editor.playtestSession.handbrakeSlipMs || 0) / 760, 0, 1);
  const absSpeedBefore = Math.max(0, Number(
    editor.playtestSession.groundSpeedMps ?? Math.abs(editor.playtestSession.speedMps || 0)
  ) || 0);
  const physicsRouteRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const previousStepDistance = Number(editor.playtestSession.previousDistance || editor.playtestSession.distance || 0);
  const contactRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0), { runtimeType: physicsRouteRuntimeType });
  const contactPreviousRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousStepDistance, { runtimeType: physicsRouteRuntimeType });
  const contactRoadElevation = Number(contactRoadProfile.elevation);
  const previousRoadElevation = Number(contactPreviousRoadProfile.elevation);
  const contactRoadRiseMps = seconds > 0
    && Number.isFinite(contactRoadElevation) && Number.isFinite(previousRoadElevation)
    ? ((contactRoadElevation - previousRoadElevation) * RACE_THREE_ELEVATION_M) / seconds
    : 0;
  const previousWheelContactCount = editor.playtestSession.vehicle3d?.enabled
    ? RACE_WHEEL_IDS.filter((wheelId) => {
      const wheel = editor.playtestSession.vehicle3d.wheels?.[wheelId];
      if (!wheel?.inContact) return false;
      if (wheel.normalLoadKnown === false) return true;
      return Number(wheel.normalLoadN || 0) > 1;
    }).length
    : (editor.playtestSession.airborne || editor.playtestSession.grounded === false ? 0 : RACE_WHEEL_IDS.length);
  const crestLaunchPredicted = previousWheelContactCount > 0
    && contactRoadRiseMps < -2.6
    && absSpeedBefore > 18;
  const tireContactScale = crestLaunchPredicted || editor.playtestSession.airborne || editor.playtestSession.grounded === false
    ? 0
    : clamp(previousWheelContactCount / RACE_WHEEL_IDS.length, 0, 1);
  if (!controlsLockedByRollover && tireContactScale <= 0.001) controlLockReason = 'airborne-contact';
  const isAutomatic = editor.raceInput.autoShift && tuning.shiftMode !== 'manual';
  if (isAutomatic && gear <= 0 && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 1.1) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  if (isAutomatic && brake > RACE_PEDAL_INPUT.reverseThreshold && throttle <= RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75 && gear >= 0) {
    gear = -1;
    editor.raceInput.gear = -1;
  }
  const automaticReverseBrakeActive = isAutomatic
    && gear < 0
    && brake > RACE_PEDAL_INPUT.activeThreshold
    && throttle <= RACE_PEDAL_INPUT.activeThreshold;
  if (automaticReverseBrakeActive) {
    throttle = brake;
    brake = 0;
  }
  if (isAutomatic && gear < 0 && driverThrottle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 0.75) {
    gear = 1;
    editor.raceInput.gear = 1;
  }
  const gearRatio = editor.getRaceGearRatio(tuning, gear);
  const binarySteer = launchSteeringLocked ? 0 : clamp(Number(editor.raceInput.binarySteer || 0), -1, 1);
  const binaryActive = Math.abs(binarySteer) > 0.01;
  const simulationWheelInput = String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation';
  if (launchSteeringLocked) {
    editor.raceInput.digitalSteerHoldMs = 0;
  } else if (editor.raceInput.analogSteeringActive) {
    editor.raceInput.lastSteeringInputMode = 'analog';
    editor.raceInput.digitalSteerHoldMs = 0;
    const analogIntent = clamp(Number(editor.raceInput.analogSteeringIntent || 0), -1, 1);
    // Analog intent is the target. A single controller response stage below
    // produces the rack command; filtering this target first caused the old
    // disconnected, cascaded response on dirt.
    editor.raceInput.steeringTarget = analogIntent;
  } else {
    if (binaryActive) {
      editor.raceInput.lastSteeringInputMode = 'binary';
      editor.raceInput.digitalSteerHoldMs = Number(editor.raceInput.digitalSteerHoldMs || 0) + seconds * 1000;
      const hold = clamp(
        Number(editor.raceInput.digitalSteerHoldMs || 0) / RACE_CONTROLLER_STEERING.digitalTargetHoldRampMs,
        0,
        1
      );
      const speedFactor = clamp(
        steeringSafetySpeedMps / RACE_CONTROLLER_STEERING.speedReferenceMps,
        0,
        1
      );
      const nudgeRate = (
        RACE_CONTROLLER_STEERING.digitalTargetPressBase
        + hold * RACE_CONTROLLER_STEERING.digitalTargetPressHoldBonus
      ) * (1 - speedFactor * 0.35);
      editor.raceInput.steeringTarget += binarySteer * seconds * nudgeRate;
    } else {
      editor.raceInput.digitalSteerHoldMs = 0;
      const analogCentered = editor.raceInput.lastSteeringInputMode === 'analog';
      const centeredMs = Number(editor.raceInput.analogSteeringCenteredMs || 0) + (analogCentered ? seconds * 1000 : 0);
      if (analogCentered) editor.raceInput.analogSteeringCenteredMs = centeredMs;
      if (analogCentered) {
        editor.raceInput.steeringTarget = 0;
      } else {
        const returnRate = editor.getRaceSteeringReturnRate(steeringSafetySpeedMps);
        editor.raceInput.steeringTarget += (0 - Number(editor.raceInput.steeringTarget || 0)) * Math.min(0.88, seconds * returnRate);
      }
    }
  }
  editor.raceInput.steeringTarget = clamp(editor.raceInput.steeringTarget, -1, 1);
  const activeTurnInput = !launchSteeringLocked && (binaryActive || editor.raceInput.analogSteeringActive);
  const controllerInputMode = simulationWheelInput
    ? 'simulation-wheel'
    : editor.raceInput.analogSteeringActive || editor.raceInput.lastSteeringInputMode === 'analog'
      ? 'gamepad'
      : 'keyboard';
  editor.raceInput.steeringWheel = controllerInputMode === 'keyboard'
    ? editor.raceInput.steeringTarget
    : systems.handlingAssist.stepControllerToRackInput({
      mode: controllerInputMode,
      intent: editor.raceInput.steeringTarget,
      currentOutput: editor.raceInput.steeringWheel,
      seconds
    });
  editor.raceInput.controllerSteeringMode = controllerInputMode;
  if (!editor.raceInput.analogSteeringActive
    && !binaryActive
    && Math.abs(editor.raceInput.steeringWheel) < 0.026
    && Math.abs(editor.raceInput.steeringTarget) < 0.026) {
    editor.raceInput.steeringWheel = 0;
    editor.raceInput.steeringTarget = 0;
    editor.raceInput.analogSteeringCenteredMs = 0;
    editor.raceInput.lastSteeringInputMode = null;
  }
  const driveDirection = gear < 0 ? -1 : gear > 0 ? 1 : 0;
  editor.playtestSession.previousDistance = editor.playtestSession.distance;
  if (countdownVisible) {
    editor.playtestSession.countdownRemainingMs = Math.max(0, Number(editor.playtestSession.countdownRemainingMs || 0) - seconds * 1000);
    if (editor.playtestSession.countdownRemainingMs <= 1000) {
      editor.playtestSession.startupPhase = 'running';
    }
  }
  if (!countdownActive) {
    editor.playtestSession.elapsedMs += seconds * 1000;
  }
  if (!countdownActive) editor.updateRaceTriggers();
  editor.playtestSession.launchLockMs = Math.max(0, Number(editor.playtestSession.launchLockMs || 0) - seconds * 1000);
  editor.playtestSession.edgeResetFadeMs = Math.max(0, Number(editor.playtestSession.edgeResetFadeMs || 0) - seconds * 1000);
  editor.updateRaceEdgeCenterResetFade();
  editor.playtestSession.shiftCooldownMs = Math.max(0, Number(editor.playtestSession.shiftCooldownMs || 0) - seconds * 1000);
  const inlineRunnerActive = editor.playtestSession.vehicleDynamicsRunner?.dormant !== true;
  const wheelContacts3d = (inlineRunnerActive ? editor.playtestSession.wheelContacts3d : null)
    || getAuthoritativeChassisState(editor.playtestSession)?.contactPatches
    || editor.playtestSession.vehicle3d?.wheels
    || null;
  const effectiveWheelContacts3d = crestLaunchPredicted
    ? Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, {
      ...(wheelContacts3d?.[wheelId] || {}),
      inContact: false,
      normalLoadKnown: true,
      normalLoadN: 0
    }]))
    : wheelContacts3d;
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(looseSurfaceFactor);
  const neutralReferenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, absSpeedBefore, { aeroLoadEffectiveness });
  const aeroDownforceForLoads = editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeedBefore, looseSurfaceFactor);
  const neutralNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    neutralReferenceNormalLoads,
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  const initialNormalLoads = { ...neutralNormalLoads };
  const bumpNormalLoadScales = editor.getRaceBumpNormalLoadScales({
    segment: segmentInfo.segment,
    distance: editor.playtestSession.distance,
    speedMps: absSpeedBefore
  });
  editor.applyRaceBumpNormalLoadScales(initialNormalLoads, bumpNormalLoadScales);
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const drivenStaticLoad = drivenWheelIds.reduce((sum, wheelId) => sum + Math.max(1, Number(neutralReferenceNormalLoads[wheelId] || 0)), 0);
  const drivenContactLoad = wheelContacts3d
    ? drivenWheelIds.reduce((sum, wheelId) => {
      const wheel = wheelContacts3d[wheelId];
      if (!wheel || wheel.inContact === false) return sum;
      return sum + Math.max(0, Number(initialNormalLoads[wheelId] || 0));
    }, 0)
    : drivenStaticLoad * tireContactScale;
  const drivenLoadScale = tireContactScale <= 0.001
    ? 0
    : clamp(drivenContactLoad / Math.max(1, drivenStaticLoad), 0, 1);
  const drivenWheelRotationSamples = drivenWheelIds
    .map((wheelId) => {
      const wheel = effectiveWheelContacts3d?.[wheelId];
      const loadN = Math.max(0, Number(wheel?.filteredNormalLoadN ?? wheel?.normalLoadN) || 0);
      if (!wheel || wheel.inContact === false || loadN <= 1) return null;
      return {
        loadN,
        angularSpeedRadps: Math.abs(Number(wheel.angularSpeedRadps) || 0),
        slipRatio: Math.max(0, Number(wheel.longitudinalSlipRatio ?? wheel.slipLongitudinal) || 0)
      };
    })
    .filter(Boolean);
  const drivenWheelRotationLoadN = drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.loadN, 0);
  const measuredDrivenWheelSlipRatio = drivenWheelRotationLoadN > 1
    ? drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.slipRatio * wheel.loadN, 0) / drivenWheelRotationLoadN
    : 0;
  const coupledDrivenWheelAngularSpeedRadps = drivenWheelRotationLoadN > 1
    ? drivenWheelRotationSamples.reduce((sum, wheel) => sum + wheel.angularSpeedRadps * wheel.loadN, 0) / drivenWheelRotationLoadN
    : null;
  const wheelRpm = gearRatio
    ? (
      coupledDrivenWheelAngularSpeedRadps == null
        ? absSpeedBefore / Math.max(0.01, tuning.wheelRadiusM)
        : coupledDrivenWheelAngularSpeedRadps
    ) * gearRatio * tuning.finalDrive * (60 / (Math.PI * 2))
    : 0;
  const limiterPhase = Math.sin(editor.playtestSession.sceneElapsedMs / 34) > 0 ? 1 : 0;
  const neutralLimiterTarget = tuning.revLimitRpm - tuning.revLimiterDropRpm * limiterPhase;
  const neutralRevTarget = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? neutralLimiterTarget : tuning.idleRpm;
  const roadCoupledRpmTarget = gearRatio
    ? clamp(
      Math.max(
        wheelRpm * (1 + tuning.torqueConverterSlip * engineThrottle),
        engineThrottle > RACE_PEDAL_INPUT.activeThreshold
          ? Math.min(tuning.launchRpm, tuning.revLimitRpm)
          : tuning.idleRpm
      ),
      tuning.idleRpm,
      tuning.revLimitRpm
    )
    : neutralRevTarget;
  const shiftWindowMs = Math.max(1, tuning.shiftTimeMs + editor.getRaceDamageEffects().shiftDelayMs);
  const shiftClutchDisengagement = editor.playtestSession.shiftCooldownMs > 0
    ? clamp(Number(editor.playtestSession.shiftCooldownMs || 0) / shiftWindowMs, 0, 1)
    : 0;
  const previousLongitudinalWheelSlipRatio = measuredDrivenWheelSlipRatio;
  const longitudinalSlipTarget = editor.getRaceLongitudinalSlipTarget(looseSurfaceFactor);
  const wheelspinDrivetrainUnload = gearRatio
    && driveDirection !== 0
    && drivenLoadScale > 0.001
    ? clamp((previousLongitudinalWheelSlipRatio - longitudinalSlipTarget) / 0.9, 0, 1) * (
      engineThrottle > RACE_PEDAL_INPUT.activeThreshold
        ? 0.48 + looseSurfaceFactor * 0.3
        : 0.18 + looseSurfaceFactor * 0.2
    )
    : 0;
  const drivetrainUnload = gearRatio ? Math.max(1 - drivenLoadScale, shiftClutchDisengagement, wheelspinDrivetrainUnload) : 1;
  const stagedFreeRevTarget = tuning.idleRpm
    + (neutralLimiterTarget - tuning.idleRpm) * engineThrottle;
  const loadedRpmTarget = countdownActive
    ? stagedFreeRevTarget
    : gearRatio
      ? roadCoupledRpmTarget + (neutralRevTarget - roadCoupledRpmTarget) * drivetrainUnload
      : neutralRevTarget;
  const loadedRpmResponse = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 4.6 : 8.5;
  const freeRpmResponse = engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 7.6 : 3.8;
  const rpmResponse = countdownActive
    ? freeRpmResponse
    : gearRatio
      ? loadedRpmResponse + (freeRpmResponse - loadedRpmResponse) * drivetrainUnload
      : freeRpmResponse;
  const liftOffWheelspinInertia = throttle <= RACE_PEDAL_INPUT.activeThreshold
    ? clamp((previousLongitudinalWheelSlipRatio - 0.8) / 0.9, 0, 1) * (0.28 + looseSurfaceFactor * 0.38)
    : 0;
  const effectiveRpmResponse = rpmResponse * (1 - liftOffWheelspinInertia);
  const diagnosticEngineRpm = clamp(
    Number(editor.playtestSession.engineRpm || tuning.idleRpm)
      + (loadedRpmTarget - Number(editor.playtestSession.engineRpm || tuning.idleRpm))
        * Math.min(1, seconds * effectiveRpmResponse),
    tuning.idleRpm * 0.72,
    tuning.revLimitRpm + (gearRatio ? 40 : 80)
  );
  const limiterActive = diagnosticEngineRpm >= tuning.revLimitRpm - 80;
  const limiterCut = limiterActive && engineThrottle > RACE_PEDAL_INPUT.activeThreshold ? 0.08 + 0.18 * limiterPhase : 1;
  const shiftTorqueCut = editor.playtestSession.shiftCooldownMs > 0
    ? clamp(1 - (editor.playtestSession.shiftCooldownMs / shiftWindowMs), 0.12, 1)
    : 1;
  const launchAssistRpm = tuning.idleRpm + (tuning.launchRpm - tuning.idleRpm) * clamp(absSpeedBefore / 5, 0.35, 1);
  const torqueRpm = gearRatio && throttle > RACE_PEDAL_INPUT.activeThreshold && absSpeedBefore < 5
    ? Math.max(diagnosticEngineRpm, launchAssistRpm)
    : diagnosticEngineRpm;
  const engineTorqueNm = editor.getRaceTorqueNmAtRpm(torqueRpm, tuning) * damageEffects.enginePower * engineJitter;
  const availablePowerW = tuning.powerHp * 745.7 * damageEffects.enginePower * engineJitter;
  const driveForceComponents = editor.getRaceDriveForceComponents({
    tuning,
    gearRatio,
    engineTorqueNm,
    availablePowerW,
    speedMps: absSpeedBefore
  });
  let driveForceCommandRaw = driveForceComponents.baseForceN * tuning.accelerationCalibration * throttle * limiterCut * shiftTorqueCut * driveDirection;
  let driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  if (automaticReverseBrakeActive && driverThrottle <= RACE_PEDAL_INPUT.activeThreshold && driverBrake > RACE_PEDAL_INPUT.activeThreshold) {
    const reverseAssistForce = tuning.weightKg * 1.05 * clamp(driverBrake, 0, 1);
    driveForceCommandRaw = Math.min(driveForceCommandRaw, -reverseAssistForce);
    driveForceRaw = drivenLoadScale > 0.001 ? driveForceCommandRaw : 0;
  }
  if (controlsLockedByRollover) {
    driveForceCommandRaw = 0;
    driveForceRaw = 0;
  }
  const driveForceDemandRaw = driveForceCommandRaw;
  const preliminaryDrivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: initialNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const preliminaryDrivenTractionLimit = preliminaryDrivenTraction.tractionLimitN;
  const preliminaryDriveDemandRatio = driveForceDemandRaw
    ? Math.abs(driveForceDemandRaw) / Math.max(1, preliminaryDrivenTractionLimit)
    : 0;
  const tractionControlActive = tuning.tractionControlEnabled
    && !handbrake
    && throttle > RACE_PEDAL_INPUT.activeThreshold
    && drivenLoadScale > 0.001;
  const preliminaryTractionControlSlip = measuredDrivenWheelSlipRatio;
  const preliminaryTractionControlCutTarget = editor.getRaceTractionControlCutTarget(
    preliminaryTractionControlSlip,
    looseSurfaceFactor,
    tractionControlActive
  );
  const tractionControlCut = editor.getRaceTractionControlAppliedCut(
    preliminaryTractionControlCutTarget,
    looseSurfaceFactor,
    seconds,
    tractionControlActive,
    { commit: false }
  );
  const preliminaryDriveForceRaw = drivenLoadScale > 0.001
    ? driveForceCommandRaw * tractionControlCut
    : 0;
  const preliminaryAppliedDriveDemandRatio = preliminaryDriveForceRaw
    ? Math.abs(preliminaryDriveForceRaw) / Math.max(1, preliminaryDrivenTractionLimit)
    : 0;
  const preliminaryExcessDriveSlip = clamp(
    (measuredDrivenWheelSlipRatio - longitudinalSlipTarget) / Math.max(0.2, 0.65 + looseSurfaceFactor * 0.25),
    0,
    1
  );
  const preliminaryPostPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    preliminaryExcessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const preliminaryEffectiveDrivenTractionLimit = preliminaryDrivenTractionLimit * preliminaryPostPeakTractionEfficiency;
  const preliminaryAppliedDriveForce = clamp(
    preliminaryDriveForceRaw,
    -preliminaryEffectiveDrivenTractionLimit,
    preliminaryEffectiveDrivenTractionLimit
  );
  const driveLoadAcceleration = clamp(
    preliminaryAppliedDriveForce / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  const driveNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, absSpeedBefore, { aeroLoadEffectiveness }),
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(driveNormalLoads, bumpNormalLoadScales);
  let driveForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: driveForceRaw
  });
  const drivenTraction = editor.getRaceDrivenTractionLimit({
    tuning,
    drivenWheelIds,
    normalLoads: driveNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    gripByWheel: perWheelGrip,
    gripFactor,
    looseSurfaceFactor,
    setupModifiers
  });
  const drivenTractionLimit = drivenTraction.tractionLimitN;
  driveForceShareByWheel = drivenTraction.forceShareByWheel || driveForceShareByWheel;
  const twoWheelDriveDemandScale = drivenWheelIds.length === 2 ? 1.25 : 1;
  const driveLoadSensitivityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      editor.getRaceTireLoadSensitivityMultiplier(driveNormalLoads[wheelId], neutralReferenceNormalLoads[wheelId], looseSurfaceFactor)
  ]));
  const driveDemandRatio = driveForceDemandRaw
    ? Math.abs(driveForceDemandRaw) / Math.max(1, drivenTractionLimit) * twoWheelDriveDemandScale
    : 0;
  const tractionControlSlip = measuredDrivenWheelSlipRatio;
  const tractionControlCutTarget = editor.getRaceTractionControlCutTarget(
    tractionControlSlip,
    looseSurfaceFactor,
    tractionControlActive
  );
  const finalTractionControlCut = editor.getRaceTractionControlAppliedCut(
    tractionControlCutTarget,
    looseSurfaceFactor,
    seconds,
    tractionControlActive
  );
  if (finalTractionControlCut < 1) driveForceRaw = drivenLoadScale > 0.001
    ? driveForceCommandRaw * finalTractionControlCut
    : 0;
  const appliedDriveDemandRatio = driveForceRaw
    ? Math.abs(driveForceRaw) / Math.max(1, drivenTractionLimit) * twoWheelDriveDemandScale
    : 0;
  const excessDriveSlip = clamp(
    (measuredDrivenWheelSlipRatio - longitudinalSlipTarget) / Math.max(0.2, 0.65 + looseSurfaceFactor * 0.25),
    0,
    1
  );
  const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(
    excessDriveSlip,
    looseSurfaceFactor,
    false
  );
  const effectiveDrivenTractionLimit = drivenTractionLimit * postPeakTractionEfficiency;
  const driveForce = clamp(driveForceRaw, -effectiveDrivenTractionLimit, effectiveDrivenTractionLimit);
  const wheelSpinRatio = clamp(measuredDrivenWheelSlipRatio, 0, 1.8);
  const relaxedWheelSpinRatio = editor.getRaceRelaxedLongitudinalSlipRatio({
    targetSlipRatio: wheelSpinRatio,
    speedMps: absSpeedBefore,
    looseSurfaceFactor,
    tireContactScale,
    seconds,
    reset: launchSteeringLocked || drivenLoadScale <= 0.001
  });
  editor.playtestSession.longitudinalWheelSlipRatio = measuredDrivenWheelSlipRatio;
  editor.playtestSession.measuredDrivenWheelSlipRatio = measuredDrivenWheelSlipRatio;
  editor.playtestSession.tractionControlSlipTarget = longitudinalSlipTarget;
  const engineBraking = editor.getRaceEngineBrakingForce({
    tuning,
    gearRatio,
    throttle,
    speedMps: editor.playtestSession.speedMps,
    engineRpm: diagnosticEngineRpm,
    drivenTractionLimit,
    tireContactScale: drivenLoadScale
  });
  if (countdownActive) engineBraking.force = 0;
  const engineBrakeForceShareByWheel = editor.getRaceDriveForceShareByWheel(tuning, drivenWheelIds, {
    normalLoads: driveNormalLoads,
    gripByWheel: perWheelGrip,
    driveForce: engineBraking.force
  });
  const engineBrakeForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    engineBraking.force * Number(engineBrakeForceShareByWheel[wheelId] || 0)
  ]));
  const preliminaryBrakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: initialNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    looseSurfaceFactor,
    speedMps: editor.playtestSession.speedMps
  });
  if (tireContactScale <= 0.001) preliminaryBrakeState.force = 0;
  const brakeLoadAcceleration = -preliminaryBrakeState.force / Math.max(450, Number(tuning.weightKg) || 1400);
  const brakeNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(
      tuning,
      brakeLoadAcceleration,
      Number(editor.playtestSession.tireSlip?.lateralAcceleration || 0),
      absSpeedBefore,
      { aeroLoadEffectiveness }
    ),
    effectiveWheelContacts3d,
    { aeroDownforce: aeroDownforceForLoads }
  );
  editor.applyRaceBumpNormalLoadScales(brakeNormalLoads, bumpNormalLoadScales);
  const brakeState = editor.getRaceBrakeForceForInput({
    tuning,
    brake,
    handbrake,
    gripByWheel: Object.fromEntries(Object.entries(perWheelGrip).map(([wheelId, grip]) => [wheelId, grip * Math.max(0.35, gripFactor)])),
    normalLoads: brakeNormalLoads,
    referenceNormalLoads: neutralReferenceNormalLoads,
    looseSurfaceFactor,
    speedMps: editor.playtestSession.speedMps
  });
  if (tireContactScale <= 0.001) {
    brakeState.force = 0;
    brakeState.appliedByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
    brakeState.lockByWheel = { fl: 0, fr: 0, rl: 0, rr: 0 };
  }
  const brakeForce = brakeState.force;
  const offRoadWheelCount = Object.values(wheelSurfaceState.terrainByWheel).filter((terrain) => terrain !== 'road').length;
  const localRollingResistance = trackState
    ? Math.max(0.35, Number(wheelSurfaceState.averageRollingResistance || 1))
    : 1;
  const terrainResistance = (1 + looseSurfaceFactor * 0.32 + offRoadWheelCount * 0.18
    + Object.values(wheelSurfaceState.terrainGripScaleByWheel).reduce((sum, value) => sum + Math.max(0, 1 - Number(value || 1)), 0) * 0.22
    + editor.getRaceSnowResistanceMultiplier(snowDepthInches)) * localRollingResistance;
  const resistanceForces = editor.getRaceLongitudinalResistanceForces({
    tuning,
    speedMps: absSpeedBefore,
    setupModifiers,
    terrainResistance,
    tirePressureRollingMultiplier,
    tireContactScale,
    panelDrag: damageEffects.panelDrag
  });
  const dragForce = resistanceForces.totalN;
  const resistanceDirection = editor.playtestSession.speedMps >= 0 ? -1 : 1;
  const brakeDirection = editor.playtestSession.speedMps >= 0 ? -1 : 1;
  const gradeSampleDistance = 12;
  const gradeRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const gradeProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0), { runtimeType: gradeRuntimeType });
  const gradeAheadProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0) + gradeSampleDistance, { runtimeType: gradeRuntimeType });
  const gradeBehindProfile = editor.getRaceRoadSurfaceProfileAtDistance(Number(editor.playtestSession.distance || 0) - gradeSampleDistance, { runtimeType: gradeRuntimeType });
  const roadGrade = Number.isFinite(Number(gradeProfile.grade))
    ? Number(gradeProfile.grade)
    : Number.isFinite(Number(gradeAheadProfile.elevation))
      && Number.isFinite(Number(gradeBehindProfile.elevation))
      ? clamp(
          ((Number(gradeAheadProfile.elevation) - Number(gradeBehindProfile.elevation))
            * RACE_THREE_ELEVATION_M) / (gradeSampleDistance * 2),
          -0.42,
          0.42
        )
      : 0;
  const gradeForce = -tuning.weightKg * 9.81 * editor.getRaceGradeGravityRatio(roadGrade) * tireContactScale;
  const tireLongitudinalLoadAcceleration = clamp(
    (driveForce + engineBraking.force + brakeDirection * brakeForce) / Math.max(450, Number(tuning.weightKg) || 1400),
    -9.5,
    9.5
  );
  let acceleration = (
    driveForce
    + engineBraking.force
    + gradeForce
    + resistanceDirection * dragForce
    + brakeDirection * brakeForce
  ) / tuning.weightKg;
  const routeRuntimeType = editor.playtestSession.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const absSpeed = Math.max(0, Number(
    editor.playtestSession.groundSpeedMps ?? Math.abs(editor.playtestSession.speedMps || 0)
  ) || 0);
  const tireTravelDirection = editor.playtestSession.speedMps < -0.2 ? -1 : 1;
  const launchLockActive = editor.isRaceLaunchSteeringLocked(editor.playtestSession);
  const roadSteer = launchSteeringLocked ? 0 : editor.raceInput.steeringWheel;
  const roadPose = editor.getRaceWorldPoseAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const previousRoadPose = editor.getRaceWorldPoseAtDistance(previousStepDistance, { runtimeType: routeRuntimeType });
  const roadProfile = editor.getRaceRoadSurfaceProfileAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const previousRoadProfile = editor.getRaceRoadSurfaceProfileAtDistance(previousStepDistance, { runtimeType: routeRuntimeType });
  const deckSample = editor.getRaceRoadCorridorSampleAtDistance(editor.playtestSession.distance, { runtimeType: routeRuntimeType });
  const bankAngleRad = Number(deckSample?.bankAngleRad || 0);
  roadPose.elevation = roadProfile.elevation;
  previousRoadPose.elevation = previousRoadProfile.elevation;
  const roadYaw = roadPose.yaw;
  const previousCarYaw = Number.isFinite(editor.playtestSession.carYaw)
    ? editor.playtestSession.carYaw
    : roadYaw;
  const wheelbaseM = tuning.wheelbaseM;
  const launchAligning = launchLockActive || (Number(editor.playtestSession.elapsedMs || 0) <= 120 && absSpeed < 0.8);
  const effectiveRoadSteer = launchAligning ? 0 : roadSteer;
  const rawSteeringAngle = launchAligning
    ? 0
    : editor.getRaceRawTireAngleForSteering(effectiveRoadSteer, steeringSafetySpeedMps);
  const bankTurnDirection = Math.sign(
    (rawSteeringAngle || effectiveRoadSteer || 0) * tireTravelDirection
    || -bankAngleRad
    || 0
  );
  const signedBankSupportG = clamp(
    -bankTurnDirection * Math.sin(bankAngleRad),
    -0.68,
    0.68
  );
  const bankSupportG = Math.max(0, signedBankSupportG);
  const bankOppositionG = Math.max(0, -signedBankSupportG);
  const bankNormalLoadScale = clamp(
    Math.cos(bankAngleRad) + bankSupportG * 0.28 - bankOppositionG * 0.16,
    0.7,
    1.16
  );
  const steeringSpeedScale = launchAligning ? 0 : clamp(absSpeed / 2.8, 0, 1);
  const lateralForceSpeedScale = launchAligning ? 0 : clamp(absSpeed / 6, 0, 1);
  const previousVelocityYaw = Number.isFinite(editor.playtestSession.velocityYaw)
    ? editor.playtestSession.velocityYaw
    : previousCarYaw;
  const vehicleSlipAngle = normalizeAngle(previousVelocityYaw - previousCarYaw);
  const previousLateralAcceleration = Number(editor.playtestSession.tireSlip?.lateralAcceleration || 0);
  const dynamicReferenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, absSpeed, { aeroLoadEffectiveness });
  const dynamicNormalLoads = editor.getRace3DResolvedWheelNormalLoads(
    editor.getRaceWheelNormalLoads(tuning, tireLongitudinalLoadAcceleration, previousLateralAcceleration, absSpeed, { aeroLoadEffectiveness }),
    effectiveWheelContacts3d,
    { aeroDownforce: editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeed, looseSurfaceFactor) }
  );
  editor.applyRaceBumpNormalLoadScales(dynamicNormalLoads, bumpNormalLoadScales);
  const wheelContactScaleByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    clamp(
      Number(dynamicNormalLoads[wheelId] || 0) / Math.max(1, Number(dynamicReferenceNormalLoads[wheelId] || 1)),
      0,
      1
    )
  ]));
  const frontNormal = (dynamicNormalLoads.fl + dynamicNormalLoads.fr) * bankNormalLoadScale;
  const rearNormal = (dynamicNormalLoads.rl + dynamicNormalLoads.rr) * bankNormalLoadScale;
  const referenceFrontNormal = Math.max(1, (dynamicReferenceNormalLoads.fl + dynamicReferenceNormalLoads.fr) * bankNormalLoadScale);
  const referenceRearNormal = Math.max(1, (dynamicReferenceNormalLoads.rl + dynamicReferenceNormalLoads.rr) * bankNormalLoadScale);
  const frontAxleLoadRatio = clamp(frontNormal / referenceFrontNormal, 0, 1);
  const frontContactAuthorityProgress = clamp((frontAxleLoadRatio - 0.08) / 0.62, 0, 1);
  const frontAxleContactScale = frontContactAuthorityProgress
    * frontContactAuthorityProgress
    * (3 - 2 * frontContactAuthorityProgress);
  const rearAxleContactScale = clamp(rearNormal / referenceRearNormal, 0, 1);
  const handbrakeSlip = rawHandbrakeSlip * rearAxleContactScale;
  const frontGrip = (perWheelGrip.fl + perWheelGrip.fr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.frontGrip;
  const rearGrip = (perWheelGrip.rl + perWheelGrip.rr) * 0.5 * Math.max(0.25, gripFactor) * setupModifiers.rearGrip * (1 - handbrakeSlip * 0.92);
  const steeringYawAuthorityScale = steeringSpeedScale * frontAxleContactScale;
  const wheelLongitudinalUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    const brakeUsage = Number(brakeState.appliedByWheel?.[wheelId] || 0);
    const driveUsage = Math.abs(driveForceRaw) * Number(driveForceShareByWheel[wheelId] || 0);
    const engineBrakeUsage = Math.abs(engineBraking.force) * Number(engineBrakeForceShareByWheel[wheelId] || 0);
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp((brakeUsage + driveUsage + engineBrakeUsage) / wheelLimit, 0, 2.2)];
  }));
  const driveForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForce * Number(driveForceShareByWheel[wheelId] || 0)
  ]));
  const driveCommandForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    driveForceRaw * Number(driveForceShareByWheel[wheelId] || 0)
      + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const chassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(driveForceByWheel[wheelId] || 0) + Number(engineBrakeForceByWheel[wheelId] || 0)
  ]));
  const frontLongitudinalUsage = (wheelLongitudinalUsage.fl + wheelLongitudinalUsage.fr) * 0.5;
  const rearLongitudinalUsage = (wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5;
  const effectiveFrictionMuByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const physicalMu = Number(effectiveWheelContacts3d?.[wheelId]?.gripCoefficient
      ?? effectiveWheelContacts3d?.[wheelId]?.loadSensitivityMultiplier);
    if (Number.isFinite(physicalMu)) return [wheelId, physicalMu];
    const load = Math.max(0, Number(dynamicNormalLoads[wheelId] || 0) * bankNormalLoadScale);
    const limit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    return [wheelId, load > 0.001 ? limit / load : 0];
  }));
  const frontFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow(frontLongitudinalUsage, 2) * 0.78));
  const rearFrictionCircle = Math.sqrt(Math.max(0.08, 1 - Math.pow(rearLongitudinalUsage, 2) * 0.86));
  const frontLoadSensitivity = editor.getRaceAxleLoadSensitivity(dynamicNormalLoads, dynamicReferenceNormalLoads, 'front', looseSurfaceFactor);
  const rearLoadSensitivity = editor.getRaceAxleLoadSensitivity(dynamicNormalLoads, dynamicReferenceNormalLoads, 'rear', looseSurfaceFactor);
  const axleLateralGripModifier = {
    front: Math.max(0.1, Number(setupModifiers.frontGrip) || 1),
    rear: Math.max(0.1, Number(setupModifiers.rearGrip) || 1) * (1 - handbrakeSlip * 0.92)
  };
  const wheelRemainingLateralLimit = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    editor.getRaceWheelRemainingLateralLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      gripByWheel: perWheelGrip,
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale,
      longitudinalUsage: wheelLongitudinalUsage[wheelId],
      axleGripModifier: wheelId === 'fl' || wheelId === 'fr' ? axleLateralGripModifier.front : axleLateralGripModifier.rear
    })
  ]));
  const frontPerWheelLatLimit = Number(wheelRemainingLateralLimit.fl || 0) + Number(wheelRemainingLateralLimit.fr || 0);
  const rearPerWheelLatLimit = Number(wheelRemainingLateralLimit.rl || 0) + Number(wheelRemainingLateralLimit.rr || 0);
  const baseFrontLatLimit = Math.min(frontNormal * frontGrip * frontFrictionCircle * frontLoadSensitivity, frontPerWheelLatLimit);
  const baseRearLatLimit = Math.min(rearNormal * rearGrip * rearFrictionCircle * rearLoadSensitivity, rearPerWheelLatLimit);
  const steeringEnvelopeCorneringG = clamp(
    (
      frontNormal * frontGrip * frontLoadSensitivity
      + rearNormal * rearGrip * rearLoadSensitivity
    ) / Math.max(1, tuning.weightKg * 9.81) * 0.82,
    0.28,
    1.08
  );
  const lateralContactScale = clamp((frontNormal + rearNormal) / Math.max(1, referenceFrontNormal + referenceRearNormal), 0, 1);
  const availableCorneringG = clamp(
    ((baseFrontLatLimit + baseRearLatLimit) / Math.max(1, tuning.weightKg * 9.81)) * 0.82,
    0.18,
    1.08
  );
  const usableFullLockTireAngle = launchAligning
    ? 0
    : Math.abs(editor.getRaceResolvedCenterSteeringAngle(1, absSpeed, {
      wheelbaseM,
      availableLateralG: steeringEnvelopeCorneringG,
      handlingPreset: tuning.handlingPreset || 'sport',
      maxPhysicalAngleRad: 0.52
    }));
  const steeringAngle = launchAligning
    ? 0
    : clamp(Number(effectiveRoadSteer) || 0, -1, 1) * usableFullLockTireAngle;
  const targetFrontSlipAngle = normalizeAngle(steeringAngle - vehicleSlipAngle);
  const targetRearSlipAngle = normalizeAngle(-vehicleSlipAngle);
  const relaxedSlipAngles = editor.getRaceRelaxedTireSlipAngles({
    targetFrontSlipAngle,
    targetRearSlipAngle,
    speedMps: absSpeed,
    looseSurfaceFactor,
    tireContactScale,
    seconds,
    reset: launchAligning
  });
  editor.playtestSession.tireSlipRelaxationAngles = {
    front: relaxedSlipAngles.front,
    rear: relaxedSlipAngles.rear
  };
  const frontSlipAngle = relaxedSlipAngles.front;
  const rearSlipAngle = relaxedSlipAngles.rear;
  const rawFrontLatForce = frontSlipAngle * tuning.weightKg * 42 * lateralForceSpeedScale * tireTravelDirection;
  const rawRearLatForce = rearSlipAngle * tuning.weightKg * 34 * lateralForceSpeedScale * tireTravelDirection;
  const frontLateralDemandUsage = Math.abs(rawFrontLatForce) / Math.max(1, baseFrontLatLimit);
  const rearLateralDemandUsage = Math.abs(rawRearLatForce) / Math.max(1, baseRearLatLimit);
  const frontPostPeakGrip = editor.getRaceTirePostPeakEfficiency(
    Math.hypot(frontLongitudinalUsage, frontLateralDemandUsage),
    looseSurfaceFactor
  );
  const rearPostPeakGrip = editor.getRaceTirePostPeakEfficiency(
    Math.hypot(rearLongitudinalUsage, rearLateralDemandUsage),
    looseSurfaceFactor
  );
  const frontLatLimit = baseFrontLatLimit * frontPostPeakGrip;
  const rearLatLimit = baseRearLatLimit * rearPostPeakGrip;
  const frontLatForce = clamp(rawFrontLatForce * frontPostPeakGrip, -frontLatLimit, frontLatLimit);
  const rearLatForce = clamp(rawRearLatForce * rearPostPeakGrip, -rearLatLimit, rearLatLimit);
  const wheelSlipAngles = {
    fl: frontSlipAngle,
    fr: frontSlipAngle,
    rl: rearSlipAngle,
    rr: rearSlipAngle
  };
  const wheelLateralUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => {
    const isFront = wheelId === 'fl' || wheelId === 'fr';
    const axleNormal = Math.max(1, isFront ? frontNormal : rearNormal);
    const axleForce = isFront ? frontLatForce : rearLatForce;
    const wheelLoadShare = (Number(dynamicNormalLoads[wheelId] || 0) * bankNormalLoadScale) / axleNormal;
    const wheelLatForce = Math.abs(axleForce) * clamp(wheelLoadShare * 2, 0.35, 1.65) * 0.5;
    const wheelLimit = editor.getRaceLoadSensitiveWheelLimit({
      wheelId,
      normalLoads: dynamicNormalLoads,
      referenceNormalLoads: dynamicReferenceNormalLoads,
      grip: perWheelGrip[wheelId],
      gripFactor: Math.max(0.25, gripFactor),
      looseSurfaceFactor,
      normalLoadScale: bankNormalLoadScale
    });
    if (wheelLimit <= 0.001) return [wheelId, 0];
    return [wheelId, clamp(wheelLatForce / wheelLimit, 0, 1.45)];
  }));
  const wheelFrictionUsage = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.hypot(Number(wheelLongitudinalUsage[wheelId] || 0), Number(wheelLateralUsage[wheelId] || 0))
  ]));
  const combinedLongitudinalEfficiency = editor.getRaceCombinedLongitudinalEfficiency(
    wheelFrictionUsage,
    wheelLongitudinalUsage,
    looseSurfaceFactor,
    lateralContactScale
  );
  const longitudinalTireForce = driveForce + engineBraking.force + brakeDirection * brakeForce;
  const combinedLongitudinalForceLoss = longitudinalTireForce * (1 - combinedLongitudinalEfficiency);
  const combinedLongitudinalAppliedForce = longitudinalTireForce - combinedLongitudinalForceLoss;
  const combinedLongitudinalForceScale = Math.abs(longitudinalTireForce) > 0.001
    ? clamp(Math.abs(combinedLongitudinalAppliedForce / longitudinalTireForce), 0, 1)
    : 1;
  const combinedChassisLongitudinalForceByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Number(chassisLongitudinalForceByWheel[wheelId] || 0) * combinedLongitudinalForceScale
  ]));
  const combinedBrakeState = {
    ...brakeState,
    force: Number(brakeState.force || 0) * combinedLongitudinalForceScale,
    appliedByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(brakeState.appliedByWheel?.[wheelId] || 0) * combinedLongitudinalForceScale
    ]))
  };
  acceleration = (
    combinedLongitudinalAppliedForce
    + gradeForce
    + resistanceDirection * dragForce
  ) / tuning.weightKg;
  // VehicleDynamicsRunner integrates longitudinal motion from tire, brake,
  // aerodynamic, gravity, and grade forces. Legacy calculations below remain
  // diagnostics and control-demand inputs only.
  const topSpeedMps = editor.getRaceRuntimeTopSpeedLimitMps(car, tuning, {
    setupModifiers,
    terrainResistance,
    tirePressureRollingMultiplier,
    gripFactor,
    looseSurfaceFactor,
    enginePowerScale: damageEffects.enginePower
  });
  if (countdownActive) {
    acceleration = 0;
  }
  const lateralAcceleration = launchAligning
    ? 0
    : (frontLatForce + rearLatForce) / tuning.weightKg;
  const rawLateralDemandG = launchAligning
    ? 0
    : (Math.abs(Math.tan(steeringAngle) * absSpeed * absSpeed / Math.max(1.8, wheelbaseM)) / 9.81) * frontAxleContactScale;
  const lateralDemandG = Math.max(0, rawLateralDemandG - bankSupportG);
  const lateralOverdrive = clamp(
    (rawLateralDemandG + bankOppositionG - (availableCorneringG + bankSupportG * 0.72)) / 0.55,
    0,
    1
  );
  const rearGripG = rearLatLimit / Math.max(1, tuning.weightKg * 9.81);
  const rearLoadShare = rearNormal / Math.max(1, frontNormal + rearNormal);
  const rearLightness = clamp((0.48 - rearLoadShare) / 0.16, 0, 1);
  const throttleDestabilize = clamp((throttle - 0.38) / 0.62, 0, 1) * (tuning.drivetrain === 'rwd' ? 0.52 : tuning.drivetrain === 'awd' ? 0.2 : 0.08) * tireContactScale;
  const brakeDestabilize = clamp((brake + Math.max(handbrake, handbrakeSlip * 0.96) * 4.4) / 1.18, 0, 1) * (tuning.drivetrain === 'rwd' ? 1.08 : 0.78) * tireContactScale;
  const rearLongitudinalOverload = clamp(((wheelLongitudinalUsage.rl + wheelLongitudinalUsage.rr) * 0.5 - 0.72) / 0.45, 0, 1);
  const leftLongitudinalDemand = (wheelLongitudinalUsage.fl + wheelLongitudinalUsage.rl) * 0.5;
  const rightLongitudinalDemand = (wheelLongitudinalUsage.fr + wheelLongitudinalUsage.rr) * 0.5;
  const splitGripYaw = clamp(
    ((rightTireGrip - leftTireGrip) * (Math.abs(driveForceRaw) > brakeForce ? throttle : brake + handbrake))
      + (rightLongitudinalDemand - leftLongitudinalDemand) * 0.24,
    -0.58,
    0.58
  );
  const mixedSurfaceYaw = splitGripYaw * clamp(absSpeed / 8, 0.18, 1) * tireContactScale;
  const powerOverloadYawSeed = Math.sin(Number(editor.playtestSession.elapsedMs || 0) * 0.017)
    + Math.sin(Number(editor.playtestSession.elapsedMs || 0) * 0.031 + 1.7) * 0.42;
  const drivetrainYawScale = tuning.drivetrain === 'rwd' ? 1
    : tuning.drivetrain === 'awd' ? 0.62
      : 0.36;
  const postPeakDriveInstability = clamp(
    (driveDemandRatio - 0.96) / 1.35,
    0,
    1
  ) * clamp(relaxedWheelSpinRatio - 0.72, 0, 1.1) * tireContactScale;
  const powerOverloadYaw = clamp(
    powerOverloadYawSeed * postPeakDriveInstability * drivetrainYawScale * (0.12 + looseSurfaceFactor * 0.72),
    -0.58,
    0.58
  );
  const rearFrictionOveruse = clamp(((wheelFrictionUsage.rl + wheelFrictionUsage.rr) * 0.5 - 0.86) / 0.42, 0, 1);
  const frontFrictionOveruse = clamp(((wheelFrictionUsage.fl + wheelFrictionUsage.fr) * 0.5 - 0.92) / 0.42, 0, 1);
  const bodyTravelSlipOveruse = clamp(
    (Math.abs(vehicleSlipAngle) - 0.22) / Math.max(0.22, 0.55 - looseSurfaceFactor * 0.14),
    0,
    1
  );
  const velocityAlignmentOveruse = Math.max(
    frontFrictionOveruse * 0.72,
    rearFrictionOveruse,
    postPeakDriveInstability * (0.58 + looseSurfaceFactor * 0.42),
    bodyTravelSlipOveruse * (0.62 + looseSurfaceFactor * 0.26)
  );
  const previousYawVelocity = Number.isFinite(editor.playtestSession.yawVelocityRadps)
    ? editor.playtestSession.yawVelocityRadps
    : 0;
  const highGripSurfaceStability = Math.pow(1 - looseSurfaceFactor, 1.4);
  const highGripPoweredFrontStability = highGripSurfaceStability
    * (tuning.drivetrain === 'awd' ? 0.84 : tuning.drivetrain === 'fwd' ? 0.86 : 0);
  const rearBreakaway = launchAligning
    ? 0
    : clamp(
      ((lateralDemandG - rearGripG * 0.68) / Math.max(0.08, rearGripG * 0.38))
        + rearLightness * 0.42
        + throttleDestabilize
        + brakeDestabilize
        + lateralOverdrive * 0.75
        + rearFrictionOveruse * 0.88,
      0,
      1
    ) * clamp((absSpeed - 5.5) / 19, 0, 1) * tireContactScale * (1 - highGripPoweredFrontStability);
  const previousRearBreakawayMemory = Number(editor.playtestSession.rearBreakawayMemory || 0);
  const rearBreakawayRecoveryPenalty = (
    handbrakeSlip * 0.42
    + clamp(Math.abs(previousYawVelocity) / 1.8, 0, 1) * 0.28
    + (tuning.drivetrain === 'awd' ? clamp(throttle, 0, 1) * 0.18 : 0)
  );
  const rearBreakawayDecay = seconds * (0.82 - rearBreakawayRecoveryPenalty);
  editor.playtestSession.rearBreakawayMemory = clamp(
    Math.max(rearBreakaway, previousRearBreakawayMemory - Math.max(0.08, rearBreakawayDecay)),
    0,
    1
  );
  const sustainedRearBreakaway = Math.max(
    rearBreakaway,
    editor.playtestSession.rearBreakawayMemory * clamp((absSpeed - 8) / 24, 0, 1) * tireContactScale,
    handbrakeSlip * clamp((absSpeed - 7) / 22, 0, 1) * tireContactScale
  );
  const tirePull = clamp(
    mixedSurfaceYaw + (Number(damageEffects.suspensionPull || 0) * 0.7),
    -0.34,
    0.34
  ) * clamp(absSpeed / 18, 0, 1);
  const leftLongitudinalForce = Number(combinedChassisLongitudinalForceByWheel.fl || 0)
    + Number(combinedChassisLongitudinalForceByWheel.rl || 0);
  const rightLongitudinalForce = Number(combinedChassisLongitudinalForceByWheel.fr || 0)
    + Number(combinedChassisLongitudinalForceByWheel.rr || 0);
  const longitudinalTorqueYawAcceleration = clamp(
    ((rightLongitudinalForce - leftLongitudinalForce) * Math.max(1.25, Number(tuning.trackWidthM) || 1.82) * 0.5)
      / Math.max(1, editor.getRaceYawInertiaKgM2(tuning)),
    -1.6,
    1.6
  ) * tireContactScale;
  const yawSpeedMps = editor.playtestSession.speedMps < -0.2 ? editor.playtestSession.speedMps * 0.72 : editor.playtestSession.speedMps;
  const bicycleYawRate = -yawSpeedMps * Math.tan(steeringAngle) / Math.max(2.1, wheelbaseM);
  const physicalYawAcceleration = editor.getRaceYawAccelerationFromAxleForces({
    tuning,
    frontLatForce,
    rearLatForce
  }) * steeringSpeedScale;
  const slipYawRate = -Math.sign(steeringAngle || roadSteer || 0)
    * Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
    * (0.58 + clamp(absSpeed / 58, 0, 1) * 0.86)
    * tireTravelDirection;
  const rearLockSpin = handbrakeSlip
    * clamp((absSpeed - 12) / 32, 0, 1)
    * tireContactScale
    * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0)
    * tireTravelDirection;
  const rearBreakawaySpin = Math.max(sustainedRearBreakaway, rearLongitudinalOverload * 0.72)
    * clamp(absSpeed / 42, 0, 1)
    * (0.42 + handbrakeSlip * 0.58)
    * -Math.sign(steeringAngle || roadSteer || vehicleSlipAngle || 0)
    * tireTravelDirection;
  const counterSteerRecovery = Math.sign(previousYawVelocity || 0) !== 0
    && Math.sign((steeringAngle || 0) * tireTravelDirection) === Math.sign(previousYawVelocity || 0)
    ? clamp(Math.abs(steeringAngle) / 0.12, 0, 1) * clamp(absSpeed / 24, 0, 1)
    : 0;
  const yawStability = setupModifiers.yawStability
    * (1 - sustainedRearBreakaway * 0.72)
    * (1 - handbrakeSlip * 0.46);
  const yawAssistOveruse = Math.max(
    sustainedRearBreakaway,
    rearFrictionOveruse * 0.82,
    postPeakDriveInstability * (0.55 + looseSurfaceFactor * 0.45),
    bodyTravelSlipOveruse * (0.5 + looseSurfaceFactor * 0.28),
    handbrakeSlip * 0.7
  );
  const severeLoosePowerOveruse = clamp((postPeakDriveInstability - 0.32) / 0.48, 0, 1)
    * clamp(looseSurfaceFactor / 0.62, 0, 1)
    * clamp(relaxedWheelSpinRatio - 0.85, 0, 1);
  const yawAssistAuthority = (1 - clamp(yawAssistOveruse, 0, 1) * (0.58 + looseSurfaceFactor * 0.28))
    * (1 - severeLoosePowerOveruse * 0.58);
  const passiveYawDampingAuthority = (1 - clamp(yawAssistOveruse, 0, 1) * (0.45 + looseSurfaceFactor * 0.3))
    * (1 - severeLoosePowerOveruse * 0.52);
  const bodySlipYawCorrectionPenalty = bodyTravelSlipOveruse
    * (0.32 + looseSurfaceFactor * 0.28)
    * clamp(absSpeed / 18, 0, 1);
  const bicycleYawCorrectionAuthority = yawAssistAuthority
    * (1 - severeLoosePowerOveruse * 0.68)
    * (1 - bodySlipYawCorrectionPenalty);
  const settledControlsForSpinRecovery = !activeTurnInput
    && throttle <= RACE_PEDAL_INPUT.activeThreshold
    && brake <= RACE_PEDAL_INPUT.activeThreshold
    && !handbrake;
  const tireYawRateCorrection = (bicycleYawRate * steeringYawAuthorityScale - previousYawVelocity)
    * (2.2 + yawStability * 1.35)
    * bicycleYawCorrectionAuthority
    * tireContactScale;
  const tireYawDamping = ((0.8 + yawStability * 1.1) * passiveYawDampingAuthority + counterSteerRecovery * 3.6)
    * tireContactScale;
  const airborneYawDamping = 0;
  const yawAcceleration = launchAligning
    ? -previousYawVelocity * 12
    : (
      physicalYawAcceleration * (0.72 + yawStability * 0.24)
      + tireYawRateCorrection
      + slipYawRate * (2.4 + handbrakeSlip * 3.2)
      + rearBreakawaySpin * 3.2
      + rearLockSpin * 7.2
      + tirePull * 2.2
      + longitudinalTorqueYawAcceleration
      + powerOverloadYaw * (2.2 + looseSurfaceFactor * 5.2)
      - Math.sign(previousYawVelocity || 0) * counterSteerRecovery * tireContactScale * (1.8 + clamp(absSpeed / 42, 0, 1) * 2.2)
      - previousYawVelocity * (tireYawDamping + airborneYawDamping)
    );
  let yawRate = clamp(
    launchAligning ? 0 : previousYawVelocity + yawAcceleration * seconds,
    -3.8,
    3.8
  );
  let lowSpeedSpinRecovery = 0;
  let runawaySpinRecovery = 0;
  let yawSpinRecoveryRate = 0;
  const activeThrottleSpinOveruse = clamp((throttle - RACE_PEDAL_INPUT.activeThreshold) / Math.max(0.001, 1 - RACE_PEDAL_INPUT.activeThreshold), 0, 1)
    * Math.max(
      severeLoosePowerOveruse,
      postPeakDriveInstability * clamp(looseSurfaceFactor / 0.62, 0, 1),
      rearLongitudinalOverload * 0.65
    );
  const spinRecoveryAuthority = 1 - activeThrottleSpinOveruse * (0.68 + looseSurfaceFactor * 0.22);
  if (!launchAligning && tireContactScale > 0.001) {
    lowSpeedSpinRecovery = clamp((4.5 - absSpeed) / 4.5, 0, 1);
    runawaySpinRecovery = clamp((Math.abs(yawRate) - 1.15) / 2.2, 0, 1);
    const recoveryGrip = clamp(gripFactor, 0.18, 1.15) * (1 - handbrakeSlip * 0.72);
    const recoveryRate = (lowSpeedSpinRecovery * 5.5 + (settledControlsForSpinRecovery ? 2.8 : 0.8))
      * runawaySpinRecovery
      * recoveryGrip
      * spinRecoveryAuthority
      * seconds;
    yawSpinRecoveryRate = recoveryRate;
    yawRate *= Math.max(0.08, 1 - recoveryRate);
  }
  const predictedCarYaw = launchAligning
    ? roadYaw
    : previousCarYaw + yawRate * seconds;
  const velocityYawRateFromLateralForce = launchAligning
    ? 0
    : lateralAcceleration / Math.max(2.2, absSpeed)
      * tireTravelDirection
      * clamp(absSpeed / 3, 0, 1)
      * lateralContactScale;
  const velocityYawAfterForce = launchAligning
    ? roadYaw
    : normalizeAngle(previousVelocityYaw + velocityYawRateFromLateralForce * seconds);
  const slipAngle = normalizeAngle(predictedCarYaw - velocityYawAfterForce);
  const slipAlignmentOveruse = clamp(
    (Math.abs(slipAngle) - 0.18) / Math.max(0.22, 0.48 - looseSurfaceFactor * 0.12),
    0,
    1
  );
  const settledControls = !activeTurnInput && throttle <= RACE_PEDAL_INPUT.activeThreshold && brake <= RACE_PEDAL_INPUT.activeThreshold && !handbrake;
  const gripAlignmentRate = launchAligning
    ? 8
    : (3.4 + clamp(gripFactor, 0.25, 1.25) * 3.8)
      * (1 - Math.pow(clamp(absSpeed / 78, 0, 1), 0.72) * 0.5)
      * (1 - Math.max(sustainedRearBreakaway, handbrakeSlip * 0.72) * 0.97)
      * (1 - clamp(velocityAlignmentOveruse, 0, 1) * (0.68 + looseSurfaceFactor * 0.28))
      * (1 - slipAlignmentOveruse * (0.36 + looseSurfaceFactor * 0.42))
      * setupModifiers.yawStability
      * (settledControls ? 2.15 : 1);
  const velocityAlignmentAlpha = launchAligning
    ? 1
    : Math.min(0.36, seconds * gripAlignmentRate * tireContactScale);
  const velocityYaw = launchAligning
    ? roadYaw
    : velocityYawAfterForce + slipAngle * velocityAlignmentAlpha;
  const slipAmountRaw = Math.abs(normalizeAngle(predictedCarYaw - velocityYaw));
  const lowSpeedSlipGate = clamp((absSpeed - 1.8) / 7, 0, 1);
  const rearBreakawayScrubAuthority = clamp(
    (Math.abs(vehicleSlipAngle) + Math.abs(previousYawVelocity) * 0.35 + Math.abs(steeringAngle) * 3 + Math.abs(roadSteer) * 1.5) / 0.18,
    0,
    1
  );
  const slipAmount = Math.max(slipAmountRaw, sustainedRearBreakaway * 0.22 * rearBreakawayScrubAuthority) * lowSpeedSlipGate;
  const scrub = clamp((slipAmount - 0.055 - bankSupportG * 0.055) / 0.46, 0, 1)
    * clamp((absSpeed - 2.2) / 24, 0, 1)
    * (1 - bankSupportG * 0.32)
    * tireContactScale;
  const wheelSpinSlip = Math.max(0, relaxedWheelSpinRatio - 0.78) * 1.1;
  const brakeLockSlip = Math.max(...Object.values(brakeState.lockByWheel));
  const lateralSlipFront = Math.max(
    clamp((Math.abs(frontLatForce) / Math.max(1, frontLatLimit) - 0.92) / 0.4, 0, 1),
    frontFrictionOveruse * 0.55
  ) * lowSpeedSlipGate;
  const lateralSlipRear = Math.max(
    clamp((Math.abs(rearLatForce) / Math.max(1, rearLatLimit) - 0.92) / 0.4, 0, 1),
    sustainedRearBreakaway,
    rearFrictionOveruse
  ) * lowSpeedSlipGate;
  const contactWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * Number(wheelContactScaleByWheel[wheelId] || 0)
      : 0
  ]));
  const freeWheelSpinRatioByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    drivenWheelIds.includes(wheelId)
      ? relaxedWheelSpinRatio * (1 - Number(wheelContactScaleByWheel[wheelId] || 0))
      : 0
  ]));
  const drivenSlipByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
    wheelId,
    Math.max(0, Number(contactWheelSpinRatioByWheel[wheelId] || 0) - 0.78) * 1.1
  ]));
  const tireSlipByWheel = {
    fl: Math.max(lateralSlipFront, brakeState.lockByWheel.fl, drivenSlipByWheel.fl) * wheelContactScaleByWheel.fl,
    fr: Math.max(lateralSlipFront, brakeState.lockByWheel.fr, drivenSlipByWheel.fr) * wheelContactScaleByWheel.fr,
    rl: Math.max(lateralSlipRear, brakeState.lockByWheel.rl, drivenSlipByWheel.rl) * wheelContactScaleByWheel.rl,
    rr: Math.max(lateralSlipRear, brakeState.lockByWheel.rr, drivenSlipByWheel.rr) * wheelContactScaleByWheel.rr
  };
  const leftSlip = (tireSlipByWheel.fl + tireSlipByWheel.rl) * 0.5 + clamp(1 - leftTireGrip, 0, 1) * 0.12;
  const rightSlip = (tireSlipByWheel.fr + tireSlipByWheel.rr) * 0.5 + clamp(1 - rightTireGrip, 0, 1) * 0.12;
  const audibleSlip = editor.getRaceAudibleTireSlip({
    wheelSpin: Math.max(...Object.values(drivenSlipByWheel)),
    brakeLock: brakeLockSlip,
    slipAngle: slipAmount,
    scrub,
    leftSlip,
    rightSlip,
    speedMps: absSpeed
  });
  const selfAligningSteeringCorrection = editor.getRaceSelfAligningSteeringCorrection({
    contactPatches: getAuthoritativeChassisState(editor.playtestSession)?.contactPatches || {},
    rackAngleRad: steeringAngle,
    casterRad: Number(tuning.casterFront || 0) * Math.PI / 180,
    wheelRadiusM: tuning.wheelRadiusM,
    steeringInputMode: String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation'
      ? 'simulation-wheel'
      : editor.raceInput.analogSteeringActive ? 'gamepad' : 'keyboard',
    seconds,
    activeTurnInput,
    launchAligning
  });
  if (selfAligningSteeringCorrection) {
    editor.raceInput.steeringWheel = clamp(Number(editor.raceInput.steeringWheel || 0) + selfAligningSteeringCorrection, -1, 1);
    if (!activeTurnInput) {
      editor.raceInput.steeringTarget = clamp(Number(editor.raceInput.steeringTarget || 0) + selfAligningSteeringCorrection * 0.72, -1, 1);
    }
  }
  const automaticUpshiftRpm = editor.getRaceAutomaticUpshiftRpm(tuning);
  const automaticDownshiftRpm = editor.getRaceAutomaticDownshiftRpm(tuning);
  editor.playtestSession.tireSlip = {
    ...tireSlipByWheel,
    left: leftSlip,
    right: rightSlip,
    pull: tirePull,
    longitudinalTorqueYawAcceleration,
    frontSlipAngle,
    rearSlipAngle,
    targetFrontSlipAngle,
    targetRearSlipAngle,
    slipRelaxationRates: relaxedSlipAngles.rates,
    lateralAcceleration,
    roadGrade,
    gradeForce,
    tireContactScale,
    crestLaunchPredicted,
    contactRoadRiseMps,
    rollover: {
      confirmed: Boolean(editor.playtestSession.rolledOver),
      candidateMs: Number(editor.playtestSession.rolloverCandidateMs || 0),
      recoveryMs: Number(editor.playtestSession.rolloverRecoveryMs || 0),
      supportedWheelCount: Number(editor.playtestSession.rolloverSupportedWheelCount ?? RACE_WHEEL_IDS.length),
      supportedLoadRatio: Number(editor.playtestSession.rolloverSupportedLoadRatio ?? 1)
    },
    slipAngle: slipAmount,
    yawVelocity: yawRate,
    scrub,
    rearBreakaway,
    rawHandbrakeSlip,
    handbrakeSlip,
    lateralOverdrive,
    bankAngleRad,
    bankSupportG,
    signedBankSupportG,
    bankOppositionG,
    rearLongitudinalOverload,
    frontFrictionOveruse,
    rearFrictionOveruse,
    velocityAlignmentOveruse,
    bodyTravelSlipOveruse,
    slipAlignmentOveruse,
    yawAssistOveruse,
    yawAssistAuthority,
    passiveYawDampingAuthority,
    severeLoosePowerOveruse,
    bodySlipYawCorrectionPenalty,
    bicycleYawCorrectionAuthority,
    physicalYawAcceleration,
    bicycleYawRate,
    tireTravelDirection,
    velocityYawRateFromLateralForce,
    velocityAlignmentAlpha,
    tireYawRateCorrection,
    tireYawDamping,
    airborneYawDamping,
    effectiveFrictionMuByWheel,
    lowSpeedSpinRecovery,
    runawaySpinRecovery,
    yawSpinRecoveryRate,
    spinRecoveryAuthority,
    activeThrottleSpinOveruse,
    yawInertiaKgM2: editor.getRaceYawInertiaKgM2(tuning),
    frontPostPeakGrip,
    rearPostPeakGrip,
    powerOverloadYaw,
    postPeakDriveInstability,
    rearLockSpin,
    counterSteerRecovery,
    selfAligningSteeringCorrection,
    frontTireAngle: steeringAngle,
    steeringInputMode: editor.raceInput.analogSteeringActive ? 'analog' : binaryActive ? 'digital' : 'centered',
    requestedSteering: effectiveRoadSteer,
    rawSteeringAngle,
    usableFullLockTireAngle,
    steeringEnvelopeCorneringG,
    availableCorneringG,
    frontAxleLoadRatio,
    frontSteeringContactAuthority: frontAxleContactScale,
    tireSlipRelaxationRates: relaxedSlipAngles.rates,
    wheelSlipAngles,
    aeroDownforce: editor.getRaceAeroDownforceByAxle(tuning, absSpeed),
    effectiveAeroDownforce: editor.getRaceEffectiveAeroDownforceByAxle(tuning, absSpeed, looseSurfaceFactor),
    aeroLoadEffectiveness,
    wheelNormalLoads: dynamicNormalLoads,
    wheelContactScaleByWheel,
    wheelContactState,
    vehicle3dTireLimitByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.tireLimitN || 0)
    ])),
    vehicle3dLoadSensitivityByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.loadSensitivityMultiplier || 1)
    ])),
    vehicle3dFrictionCircleScaleByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(effectiveWheelContacts3d?.[wheelId]?.frictionCircleScale || 1)
    ])),
    driveNormalLoads,
    driveLoadAcceleration,
    preliminaryDrivenTractionLimit,
    preliminaryAppliedDriveForce,
    driveLoadSensitivityByWheel,
    lateralLoadSensitivity: { front: frontLoadSensitivity, rear: rearLoadSensitivity },
    axleContactScale: { front: frontAxleContactScale, rear: rearAxleContactScale },
    steeringYawAuthorityScale,
    brakeNormalLoads,
    brakeLoadAcceleration,
    preliminaryBrakeForce: preliminaryBrakeState.force,
    tireLongitudinalLoadAcceleration,
    bumpNormalLoadScales,
    driveForceShareByWheel,
    engineBrakeForceShareByWheel,
    engineBrakeForceByWheel,
    chassisLongitudinalForceByWheel,
    combinedChassisLongitudinalForceByWheel,
    wheelLongitudinalUsage,
    wheelLateralUsage,
    wheelFrictionUsage,
    wheelRemainingLateralLimit,
    combinedLongitudinalForceScale,
    combinedLongitudinalEfficiency,
    lateralContactScale,
    combinedLongitudinalAppliedForce,
    combinedLongitudinalForceLoss,
    wheelSpin: wheelSpinSlip,
    wheelSpinRatio: relaxedWheelSpinRatio,
    targetWheelSpinRatio: wheelSpinRatio,
    contactWheelSpinRatioByWheel,
    freeWheelSpinRatioByWheel,
    brakeLock: brakeLockSlip,
    brakeLockByWheel: brakeState.lockByWheel,
    brakeRequestedByWheel: brakeState.requestedByWheel,
    brakeAppliedByWheel: brakeState.appliedByWheel,
    combinedBrakeAppliedByWheel: combinedBrakeState.appliedByWheel,
    combinedBrakeForce: combinedBrakeState.force,
    brakeLimitByWheel: brakeState.limitByWheel,
    absInterventionByWheel: brakeState.absInterventionByWheel,
    brakeSlidingEfficiencyByWheel: brakeState.slidingEfficiencyByWheel,
    tireTemperatureGrip,
    gripFactor,
    perWheelGrip,
    tireTemperature: { ...(editor.playtestSession.diagnostics?.tireTemperature || {}) },
    tirePressureDynamics: tirePressureDynamicsByWheel,
    resistanceForces,
    tireHealth: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      1 - clamp(Number(damage.tires?.[wheelId] || 0) / 100, 0, 1)
    ])),
    engineDrive: {
      gearRatio,
      torqueRpm,
      engineTorqueNm,
      availablePowerW,
      topSpeedLimitMps: topSpeedMps,
      torqueForceN: driveForceComponents.torqueForceN,
      powerForceN: driveForceComponents.powerForceN,
      baseForceN: driveForceComponents.baseForceN,
      powerLimitBlend: driveForceComponents.powerLimitBlend,
      demandedForceN: driveForceDemandRaw,
      appliedRawForceN: driveForceRaw,
      appliedForceN: driveForce,
      limitingSource: driveForceComponents.limitingSource,
      controlLockReason,
      limiterCut,
      shiftTorqueCut,
      torqueCutReason: limiterCut < 1
        ? 'rev-limiter'
        : shiftTorqueCut < 1
          ? 'shift'
          : finalTractionControlCut < 0.999
            ? 'traction-control'
            : 'none',
      shiftClutchDisengagement,
      drivetrainUnload,
      liftOffWheelspinInertia,
      automaticUpshiftRpm,
      automaticDownshiftRpm,
      automaticOverrevUpshifts,
      rpmResponse: effectiveRpmResponse,
      drivenLoadScale,
      wheelspinDrivetrainUnload,
      previousLongitudinalWheelSlipRatio,
      tractionControlCut: finalTractionControlCut,
      tractionControlCutTarget,
      preliminaryTractionControlCutTarget,
      preliminaryTractionControlSlip,
      tractionControlSlip,
      measuredDrivenWheelSlipRatio,
      tractionControlSlipTarget: longitudinalSlipTarget,
      coupledEngineRpmTarget: roadCoupledRpmTarget,
      drivenTraction,
      postPeakTractionEfficiency,
      combinedSlipEfficiency: combinedLongitudinalEfficiency,
      combinedSlipAppliedForceN: combinedLongitudinalAppliedForce,
      combinedSlipForceLossN: combinedLongitudinalForceLoss,
      driveDemandRatio,
      appliedDriveDemandRatio,
      wheelLongitudinalUsage,
      wheelLateralUsage,
      wheelFrictionUsage,
      wheelRemainingLateralLimit,
      driveLoadAcceleration,
      tireLongitudinalLoadAcceleration,
      preliminaryDrivenTractionLimit,
      preliminaryAppliedDriveForce,
      engineBrakeForceByWheel,
      chassisLongitudinalForceByWheel,
      engineBraking
    },
    wheelSurfaces: wheelSurfaceState.surfaceByWheel,
    wheelBaseSurfaces: wheelSurfaceState.baseSurfaceByWheel,
    wheelTerrains: wheelSurfaceState.terrainByWheel,
    snowDepthByWheel: wheelSurfaceState.snowDepthByWheel,
    snowDepthInches,
    snowResistanceMultiplier: editor.getRaceSnowResistanceMultiplier(snowDepthInches),
    audibleSlip
  };
  editor.playtestSession.steeringWheelRotation = editor.getRaceSteeringWheelRotationForTireAngle(steeringAngle, car);
  const lateralDrift = (
    normalizeAngle(editor.playtestSession.velocityYaw - roadYaw) * clamp(absSpeed / 32, 0, 1) * 0.04
    + Math.sign(steeringAngle || roadSteer || 0) * tireTravelDirection * rearBreakaway * 0.035
  );
  editor.playtestSession.driftLateral = clamp(
    Number(editor.playtestSession.driftLateral || 0) * Math.max(0, 1 - seconds * 1.7) + lateralDrift,
    -0.24,
    0.24
  );
  if (!countdownActive) editor.updateRaceSceneryCollisions(seconds);
  advanceVehicleDynamicsAuthority(editor, {
    systems,
    tuning,
    seconds,
    controls: {
      steering: -editor.raceInput.steeringWheel,
      driverSteeringIntent: -Number(editor.raceInput.analogSteeringActive
        ? editor.raceInput.analogSteeringIntent
        : editor.raceInput.binarySteer || 0),
      steeringTarget: -Number(editor.raceInput.steeringTarget || 0),
      controllerFilterOutput: -Number(editor.raceInput.steeringWheel || 0),
      centerSteeringAngleRad: -steeringAngle,
      steeringInputMode: String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation'
        ? 'simulation-wheel'
        : editor.raceInput.controllerSteeringMode || (editor.raceInput.analogSteeringActive ? 'gamepad' : 'keyboard'),
      throttle: countdownActive ? driverThrottle : throttle,
      brake,
      // Formation/countdown throttle is a free rev. Record clutch disengagement
      // in the authoritative input timeline so replay cannot turn it into wheel
      // torque or a suspension pitch moment.
      clutch: countdownActive ? 1 : editor.raceInput.clutchAxis,
      handbrake,
      handbrakeHoldSequence: editor.raceInput.handbrakeHoldSequence,
      handbrakeHoldSeconds: editor.raceInput.handbrakeHoldSeconds,
      requestedGear: editor.raceInput.gear,
      assists: {
        absEnabled: tuning.absEnabled,
        tractionControlEnabled: tuning.tractionControlEnabled,
        launchControlEnabled: tuning.launchControlEnabled === true,
        stabilityControlEnabled: String(tuning.handlingPreset || 'sport').toLowerCase() === 'simulation'
          ? editor.playtestSession.stabilityControlExplicitlyEnabled === true
          : editor.playtestSession.stabilityControlEnabled !== false,
        autoShift: editor.raceInput.autoShift !== false
      }
    },
    wheelContactState,
    wheelSurfaceState,
    tirePressureDynamicsByWheel,
    setup,
    damage,
    countdownActive,
    trackState,
    weatherState
  });
  handbrake = editor.playtestSession.authoritativeHandbrakeActive ? 1 : handbrake;
  const presentationState = getAuthoritativeChassisState(editor.playtestSession) || {};
  const authoritativeWheelLoads = { ...(presentationState.wheelLoadsN || {}) };
  if (RACE_WHEEL_IDS.every((wheelId) => Number.isFinite(Number(authoritativeWheelLoads[wheelId])))) {
    editor.playtestSession.tireSlip.wheelNormalLoads = authoritativeWheelLoads;
    if (throttle > 0.001) {
      editor.playtestSession.tireSlip.driveNormalLoads = authoritativeWheelLoads;
      editor.playtestSession.tireSlip.driveLoadSensitivityByWheel = Object.fromEntries(
        RACE_WHEEL_IDS.map((wheelId) => [wheelId,
          editor.getRaceTireLoadSensitivityMultiplier(
            authoritativeWheelLoads[wheelId],
            neutralReferenceNormalLoads[wheelId],
            looseSurfaceFactor
          )
        ])
      );
    }
    if (brake > 0.001 || handbrake > 0.001) {
      editor.playtestSession.tireSlip.brakeNormalLoads = authoritativeWheelLoads;
    }
  }
  const routeLength = Math.max(1, Number(editor.playtestSession.routeLength || editor.getRaceRouteLength()));
  let projection = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  const boundarySegment = projection.segment || segmentInfo.segment || editor.selectedSegment;
  const projectedRoadHalfWidth = Math.max(1, editor.getRaceRoadHalfWidthWorld(boundarySegment));
  const projectedLateralMeters = Number(projection.lateral || 0);
  const projectedLateralNormalized = clamp(projectedLateralMeters / projectedRoadHalfWidth, -1.5, 1.5);
  editor.playtestSession.routeLateralM = projectedLateralMeters;
  editor.playtestSession.routeLateralNormalized = projectedLateralNormalized;
  editor.playtestSession.lateral = projectedLateralNormalized;
  // Road-edge geometry is prepared once and swept by VehicleDynamicsRunner at
  // the tire/contact rate. This render-frame projection remains diagnostic and
  // cannot queue an impulse, mutate the authoritative pose, or reset progress.
  projection = editor.getRaceRouteProjectionForWorldPoint({
    x: editor.playtestSession.worldX,
    z: editor.playtestSession.worldZ
  });
  editor.playtestSession.routeLateralM = Number(projection.lateral || 0);
  editor.playtestSession.routeLateralNormalized = clamp(
    Number(projection.lateral || 0) / Math.max(1, editor.getRaceRoadHalfWidthWorld(projection.segment || boundarySegment)),
    -1.5,
    1.5
  );
  editor.playtestSession.lateral = editor.playtestSession.routeLateralNormalized;
  const previousDistance = Number(editor.playtestSession.previousDistance || editor.playtestSession.distance || 0);
  const progressRoadYaw = editor.getRaceWorldPoseAtDistance(previousDistance).yaw;
  const authoritativeVelocity = presentationState.velocity || {};
  const routeAdvance = calculateAuthoritativeRouteAdvance({
    velocityWorld: authoritativeVelocity,
    roadYaw: progressRoadYaw,
    seconds
  });
  const integratedDistance = previousDistance + routeAdvance;
  if (routeRuntimeType === 'circuit') {
    const nextDistance = ((integratedDistance % routeLength) + routeLength) % routeLength;
    if (!countdownActive) {
      editor.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance,
        routeAdvance
      });
    }
    const crossedStart = routeAdvance > 0 && previousDistance > routeLength * 0.72 && nextDistance < routeLength * 0.28;
    const checkpointsComplete = Number(editor.playtestSession.checkpointIndex || 0) >= Number(editor.playtestSession.checkpointCount || 0);
    if (!countdownActive && crossedStart && checkpointsComplete) {
      editor.playtestSession.lap += 1;
      const nextCheckpoint = (editor.playtestSession.checkpointDistances || []).findIndex((distance) => (
        distance > Math.max(8, editor.getRaceCarWorldWidth(editor.getRaceSessionCar(editor.playtestSession)) * 2)
      ));
      editor.playtestSession.checkpointIndex = nextCheckpoint >= 0 ? nextCheckpoint : 0;
      editor.playtestSession.passedCheckpoints = [];
      if (editor.playtestSession.lap > Math.max(1, Number(editor.selectedRace.laps || 1))) {
        editor.playtestSession.lap = Math.max(1, Number(editor.selectedRace.laps || 1));
        editor.finishPlaytest();
        return;
      }
    }
    editor.playtestSession.distance = nextDistance;
  } else {
    editor.playtestSession.distance = clamp(integratedDistance, 0, routeLength);
    if (!countdownActive) {
      editor.updateRaceCheckpointProgress({
        previousDistance,
        nextDistance: editor.playtestSession.distance,
        routeAdvance
      });
    }
    const finish = editor.getRaceWorldPoseAtDistance(routeLength);
    const finishDx = Number(editor.playtestSession.worldX || 0) - Number(finish.x || 0);
    const finishDz = Number(editor.playtestSession.worldZ || 0) - Number(finish.z || 0);
    const runtimeCarWidth = editor.getRaceCarWorldWidth(editor.getRaceSessionCar(editor.playtestSession));
    const finishRange = Math.max(editor.getRaceRoadHalfWidthWorld() * 1.55, runtimeCarWidth * 5);
    const integratedFinish = integratedDistance >= routeLength;
    const checkpointsComplete = Number(editor.playtestSession.checkpointIndex || 0) >= Number(editor.playtestSession.checkpointCount || 0);
    if (!countdownActive && ((editor.playtestSession.distance >= routeLength - Math.max(4, runtimeCarWidth * 2)
      && Math.hypot(finishDx, finishDz) <= finishRange
      && checkpointsComplete)
      || (integratedFinish && checkpointsComplete))) {
      editor.playtestSession.distance = routeLength;
      editor.finishPlaytest();
      return;
    }
  }
  const routeProjectedDistance = routeRuntimeType === 'circuit'
    ? ((Number(projection.distance || 0) % routeLength) + routeLength) % routeLength
    : clamp(Number(projection.distance || editor.playtestSession.distance || 0), 0, routeLength);
  const previousProjectedDistance = Number(editor.playtestSession.projectedDistance);
  if (previousProjectedDistance < 0) {
    const startBackDistance = Math.max(0, Number(editor.playtestSession.startBackDistance || 0));
    const preStartProjectedDistance = clamp(previousProjectedDistance + routeAdvance, -startBackDistance, 0);
    editor.playtestSession.projectedDistance = preStartProjectedDistance;
  } else {
    editor.playtestSession.projectedDistance = routeProjectedDistance;
  }
  editor.playtestSession.heading = normalizeAngle(editor.playtestSession.carYaw - roadYaw);
  const cameraSlipYaw = Math.abs(normalizeAngle(
    Number(editor.playtestSession.velocityYaw || 0) - Number(editor.playtestSession.carYaw || 0)
  ));
  editor.playtestSession.cameraYaw = editor.getCarCameraTrackingMode(car) !== 'fixed-rear'
    && cameraSlipYaw > 0.12
    ? Number(editor.playtestSession.velocityYaw || 0)
    : editor.getRacePlaytestCameraYaw(editor.playtestSession, { seconds, smooth: true });
  editor.playtestSession.cameraChaseYaw = Number(editor.playtestSession.cameraYaw || roadYaw);
  const trackViewTarget = clamp(
    (-editor.playtestSession.lateral * 0.24) + (editor.playtestSession.heading * 0.66),
    -0.58,
    0.58
  );
  editor.playtestSession.roadViewOffset += (trackViewTarget - Number(editor.playtestSession.roadViewOffset || 0)) * Math.min(1, seconds * 3.2);
  const authoritativeEngineRpm = Number(editor.playtestSession.engineRpm || diagnosticEngineRpm);
  editor.playtestSession.rpm = clamp(authoritativeEngineRpm / tuning.revLimitRpm, 0, 1.08);
  editor.updateRaceEngineAudio({ tuning, throttle: engineThrottle, load: relaxedWheelSpinRatio });
  editor.updateRaceTireAudio({
    slip: audibleSlip,
    surface: segmentInfo.segment?.surface,
    speedMps: absSpeed
  });
  if (editor.raceInput.autoShift && Number.isFinite(Number(presentationState.gear))) {
    editor.raceInput.gear = Number(presentationState.gear || gear);
  }
  editor.playtestSession.steeringWheel = editor.raceInput.steeringWheel;
  editor.playtestSession.steeringTarget = editor.raceInput.steeringTarget;
  editor.playtestSession.cameraView = editor.raceInput.cameraView;
  editor.updateRaceWeatherApproachDistance(seconds, {
    previousSpeedMps: absSpeedBefore,
    currentSpeedMps: editor.playtestSession.groundSpeedMps
  });
  editor.updateRaceWeatherFxState(seconds, {
    weatherState
  });
  editor.playtestSession.handbrakeMs = Math.max(0, Number(editor.playtestSession.handbrakeMs || 0) - seconds * 1000);
  if (handbrake) editor.playtestSession.handbrakeMs = 180;
  if (!countdownActive) {
    editor.updateRaceDiagnostics(seconds, {
      tuning,
      car,
      throttle,
      brake,
      handbrake,
      acceleration,
      lateralAcceleration,
      dynamicNormalLoads,
      initialNormalLoads,
      wheelContactScaleByWheel,
      tireSlipByWheel,
      tirePressureDynamicsByWheel,
      wheelSurfaceState,
      previousDistance,
      routeLength,
      routeRuntimeType
    });
    const authoritativeTires = presentationState.tireState || {};
    editor.playtestSession.diagnostics.tireTemperature = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      Number(authoritativeTires[wheelId]?.temperatureF
        ?? editor.playtestSession.diagnostics.tireTemperature?.[wheelId] ?? 70)
    ]));
    editor.playtestSession.diagnostics.tireThermal = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      {
        treadTemperatureC: Number(authoritativeTires[wheelId]?.treadTemperatureC || 0),
        carcassTemperatureC: Number(authoritativeTires[wheelId]?.carcassTemperatureC || 0),
        internalAirTemperatureC: Number(authoritativeTires[wheelId]?.internalAirTemperatureC || 0),
        effectivePressurePsi: Number(authoritativeTires[wheelId]?.effectivePressurePsi || 0)
      }
    ]));
  }
  const tireFxContext = {
    tireSlipByWheel,
    wheelSurfaceState,
    brakeState,
    handbrake,
    wheelSpin: relaxedWheelSpinRatio,
    wheelSpinByWheel: contactWheelSpinRatioByWheel,
    wheelContactScaleByWheel,
    speedMps: absSpeed
  };
  if (!countdownActive) {
    editor.updateRaceTireTracks(tireFxContext);
    editor.stepRaceTireFxParticles(seconds, tireFxContext);
  }
  editor.updateRaceAiDrivers(seconds, {
    preStartMode: countdownActive
      ? editor.playtestSession.rollingStart ? 'rolling' : 'standing'
      : 'none',
    rollingStartSpeedMps: editor.playtestSession.rollingStartSpeedMps
  });
  if (!countdownActive) {
    editor.recordRaceGhostSample();
    editor.updateRaceWearAndDamage(seconds);
    if (trackState) systems.surface.queueTrackStateCrashEvents(trackState, editor.playtestSession);
  }
}

export function estimateRacePowerLimitedTopSpeedMps(editor, {
  tuning = editor.getRaceCarTuning(),
  setupModifiers = editor.getRaceSetupPhysicsModifiers(tuning, 0),
  terrainResistance = 1,
  tirePressureRollingMultiplier = 1,
  gripFactor = 1,
  looseSurfaceFactor = 0,
  respectConfiguredLimit = false
} = {}) {
  const ratios = Array.isArray(tuning.gearRatios) && tuning.gearRatios.length ? tuning.gearRatios : [1];
  const redline = Math.max(Number(tuning.revLimitRpm || tuning.redlineRpm) || 6500, Number(tuning.idleRpm || 800) + 500);
  const topGearSpeedMps = Math.max(...ratios.map((_ratio, index) => editor.getRaceRedlineSpeedMps(tuning, index + 1)), 20);
  const configuredLimitMps = Math.max(20, Number(tuning.topSpeedMps) || topGearSpeedMps);
  const gearLimitedMps = Math.max(topGearSpeedMps, 20);
  const hardLimitMps = respectConfiguredLimit ? Math.min(gearLimitedMps, configuredLimitMps) : gearLimitedMps;
  const scanLimit = hardLimitMps;
  const loose = clamp(Number(looseSurfaceFactor) || 0, 0, 1);
  const drivenWheelIds = editor.getRaceDrivenWheelIds(tuning);
  const aeroLoadEffectiveness = editor.getRaceAeroLoadEffectiveness(loose);
  const mass = Math.max(450, Number(tuning.weightKg) || 1400);
  let best = 0;
  for (let speed = 0; speed <= scanLimit + 0.0001; speed += 0.5) {
    let bestDriveForce = 0;
    ratios.forEach((ratio, index) => {
      const gear = index + 1;
      const rpm = editor.getRaceProjectedEngineRpmForGear(tuning, speed, gear);
      if (rpm > redline * 1.015 || rpm < Math.max(400, Number(tuning.idleRpm || 800) * 0.55)) return;
      const engineTorqueNm = editor.getRaceTorqueNmAtRpm(clamp(rpm, Number(tuning.idleRpm || 800), redline), tuning);
      const driveForce = editor.getRaceDriveForceComponents({
        tuning,
        gearRatio: Math.max(0.1, Number(ratio) || 1),
        engineTorqueNm,
        availablePowerW: Math.max(0, Number(tuning.powerHp) || 0) * 745.7,
        speedMps: speed
      }).baseForceN * clamp(Number(tuning.accelerationCalibration) || 1, 0.7, 1.35);
      bestDriveForce = Math.max(bestDriveForce, driveForce);
    });
    if (bestDriveForce > 0 && (loose > 0.001 || Number(gripFactor) < 0.995)) {
      const referenceNormalLoads = editor.getRaceWheelNormalLoads(tuning, 0, 0, speed, { aeroLoadEffectiveness });
      const driveLoadAcceleration = clamp(bestDriveForce / mass, -9.5, 9.5);
      const normalLoads = editor.getRaceWheelNormalLoads(tuning, driveLoadAcceleration, 0, speed, { aeroLoadEffectiveness });
      const drivenTractionLimit = editor.getRaceDrivenTractionLimit({
        tuning,
        drivenWheelIds,
        normalLoads,
        referenceNormalLoads,
        gripByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 1])),
        gripFactor,
        looseSurfaceFactor: loose,
        setupModifiers
      }).tractionLimitN;
      const driveDemandRatio = bestDriveForce / Math.max(1, drivenTractionLimit);
      const excessDriveSlip = clamp((driveDemandRatio - 1) / 1.2, 0, 1);
      const postPeakTractionEfficiency = editor.getRaceDrivenPostPeakTractionEfficiency(excessDriveSlip, loose, false);
      bestDriveForce = Math.min(bestDriveForce, drivenTractionLimit * postPeakTractionEfficiency);
    }
    const resistance = editor.getRaceLongitudinalResistanceForces({
      tuning,
      speedMps: speed,
      setupModifiers: editor.getRaceSetupPhysicsModifiers(tuning, speed),
      terrainResistance,
      tirePressureRollingMultiplier,
      looseSurfaceFactor: loose,
      tireContactScale: 1
    }).totalN;
    if (bestDriveForce >= resistance) best = speed;
  }
  return clamp(best || hardLimitMps, 20, hardLimitMps);
}
