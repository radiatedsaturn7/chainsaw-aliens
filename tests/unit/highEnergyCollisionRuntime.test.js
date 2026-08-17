import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildRaceBakedSurfaceSampler,
  packRaceBakedSurfaceSampler,
  sampleRaceBakedSurface
} from '../../src/racing/RaceBakedSurfaceSampler.js';
import { RaceSurfaceModel } from '../../src/racing/RaceSurfaceModel.js';
import {
  createChassisBodyContactCandidates
} from '../../src/racing/simulation/ChassisBodyCollision.js';
import {
  ContactPatchTireModel,
  calculateWheelContactKinematics
} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  createPhysicsTerrainQueryFrameCache
} from '../../src/racing/simulation/PhysicsTerrainQueryFrame.js';
import {
  quaternionFromEuler,
  rotateVectorByQuaternion
} from '../../src/racing/simulation/RigidBodyMath.js';
import {
  PreparedStaticRaceColliderWorld,
  prepareStaticRaceColliders
} from '../../src/racing/simulation/StaticRaceColliderWorld.js';
import {
  VehicleDynamicsRunner
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
import {
  hashTrackStateValue,
  stableTrackStateStringify
} from '../../src/racing/trackState/TrackStateMath.js';

const WRX2_INCIDENT = JSON.parse(readFileSync(
  new URL('../fixtures/studioSprint2HillIncident.json', import.meta.url),
  'utf8'
));
const WRX2_CONFIG = WRX2_INCIDENT.vehicleConfiguration;
const SPEEDS_MPS = Object.freeze([30, 60, 100, 134.112]);
const RENDER_FPS_VALUES = Object.freeze([30, 60, 90, 120, 144]);
const TIRE_HZ_VALUES = Object.freeze([120, 240, 360]);
const WALL_THICKNESSES_M = Object.freeze([Infinity, 0.5, 0.1, 0.05]);
const WHEEL_IDS = Object.freeze(['fl', 'fr', 'rl', 'rr']);
const IMPACT_TIME_SECONDS = 0.245;
const SIMULATION_SECONDS = 0.275;
const HITCH_SECONDS = 0.25;
const ROUTE_DISTANCE_M = 500;
const CCD_PENETRATION_TOLERANCE_M = 0.02;
const DOMAIN_MIN_M = -80;
const DOMAIN_MAX_M = 80;
const WALL_HEIGHT_M = 3;
const SQRT_HALF = Math.SQRT1_2;

const FLOOR_FIXTURES = Object.freeze([
  { id: 'flat-floor', surface: 'flat' },
  { id: 'sloped-floor', surface: 'slope' },
  { id: 'triangle-seam', surface: 'seam' },
  { id: 'narrow-crest', surface: 'crest' },
  { id: 'one-corner-first', surface: 'flat', pitchRad: -0.16, rollRad: 0.14 },
  { id: 'roof-first', surface: 'flat', rollRad: Math.PI }
]);

const WALL_FIXTURES = Object.freeze([
  { id: 'head-on', yawRad: 0, velocityDirection: { x: 0, y: 0, z: 1 } },
  {
    id: '45-degree', yawRad: Math.PI / 4,
    velocityDirection: { x: SQRT_HALF, y: 0, z: SQRT_HALF }
  },
  { id: 'broadside', yawRad: Math.PI / 2, velocityDirection: { x: 0, y: 0, z: 1 } },
  { id: 'reverse', yawRad: Math.PI, velocityDirection: { x: 0, y: 0, z: 1 } },
  {
    id: 'spinning-impact', yawRad: 0, yawRateRadps: 8,
    velocityDirection: { x: 0, y: 0, z: 1 }
  },
  {
    id: 'wall-floor-corner', yawRad: 0,
    velocityDirection: { x: 0, y: -SQRT_HALF, z: SQRT_HALF }
  }
]);

const finite = (value) => Number.isFinite(Number(value));
const checksum = (value) => hashTrackStateValue(stableTrackStateStringify(value));
const thicknessLabel = (thicknessM) => (
  Number.isFinite(thicknessM) ? `${thicknessM.toFixed(2)}m` : 'infinite-plane'
);

function addRectangleTriangles(target, {
  minX = DOMAIN_MIN_M,
  maxX = DOMAIN_MAX_M,
  minZ,
  maxZ,
  heightAt = () => 0,
  id
}) {
  const a = { x: minX, z: minZ, elevation: heightAt(minX, minZ) };
  const b = { x: maxX, z: minZ, elevation: heightAt(maxX, minZ) };
  const c = { x: maxX, z: maxZ, elevation: heightAt(maxX, maxZ) };
  const d = { x: minX, z: maxZ, elevation: heightAt(minX, maxZ) };
  target.push(
    { vertices: [a, c, b], region: 'road', source: `${id}:0` },
    { vertices: [a, d, c], region: 'road', source: `${id}:1` }
  );
}

function buildPreparedFloor(surface = 'flat') {
  const triangles = [];
  if (surface === 'slope') {
    addRectangleTriangles(triangles, {
      minZ: DOMAIN_MIN_M,
      maxZ: DOMAIN_MAX_M,
      heightAt: (_x, z) => z * 0.12,
      id: 'sloped-floor'
    });
  } else if (surface === 'crest') {
    addRectangleTriangles(triangles, {
      minZ: DOMAIN_MIN_M,
      maxZ: -0.08,
      id: 'crest-before'
    });
    addRectangleTriangles(triangles, {
      minZ: -0.08,
      maxZ: 0,
      heightAt: (_x, z) => (z + 0.08) / 0.08 * 0.22,
      id: 'crest-rise'
    });
    addRectangleTriangles(triangles, {
      minZ: 0,
      maxZ: 0.08,
      heightAt: (_x, z) => (0.08 - z) / 0.08 * 0.22,
      id: 'crest-fall'
    });
    addRectangleTriangles(triangles, {
      minZ: 0.08,
      maxZ: DOMAIN_MAX_M,
      id: 'crest-after'
    });
  } else if (surface === 'seam') {
    addRectangleTriangles(triangles, {
      minZ: DOMAIN_MIN_M,
      maxZ: 0,
      id: 'floor-seam-before'
    });
    addRectangleTriangles(triangles, {
      minZ: 0,
      maxZ: DOMAIN_MAX_M,
      id: 'floor-seam-after'
    });
  } else {
    addRectangleTriangles(triangles, {
      minZ: DOMAIN_MIN_M,
      maxZ: DOMAIN_MAX_M,
      id: 'flat-floor'
    });
  }
  return createPreparedSurface(triangles, `floor:${surface}`, [{
    id: `static-floor:${surface}`,
    type: 'prepared-triangle-mesh',
    twoSided: true,
    solidBelow: true,
    friction: WRX2_CONFIG.bodyCollisionFriction,
    restitution: WRX2_CONFIG.bodyCollisionRestitution,
    triangles: triangles.map((triangle, triangleIndex) => ({
      id: `${triangle.source || surface}:${triangleIndex}`,
      vertices: triangle.vertices.map((vertex) => ({
        x: vertex.x,
        y: vertex.elevation,
        z: vertex.z
      }))
    }))
  }]);
}

function buildPreparedWall(thicknessM) {
  const triangles = [];
  addRectangleTriangles(triangles, {
    minZ: DOMAIN_MIN_M,
    maxZ: DOMAIN_MAX_M,
    id: 'wall-floor'
  });
  const wall = Number.isFinite(thicknessM) ? {
    id: `static-wall:${thicknessLabel(thicknessM)}`,
    type: 'box',
    center: { x: 0, y: WALL_HEIGHT_M * 0.5, z: thicknessM * 0.5 },
    size: { x: DOMAIN_MAX_M - DOMAIN_MIN_M, y: WALL_HEIGHT_M, z: thicknessM },
    friction: WRX2_CONFIG.bodyCollisionFriction,
    restitution: WRX2_CONFIG.bodyCollisionRestitution
  } : {
    id: 'static-wall:infinite-plane',
    type: 'plane',
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: -1 },
    friction: WRX2_CONFIG.bodyCollisionFriction,
    restitution: WRX2_CONFIG.bodyCollisionRestitution
  };
  return createPreparedSurface(triangles, `wall:${thicknessLabel(thicknessM)}`, [
    {
      id: 'static-wall-test-floor',
      type: 'plane',
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      friction: WRX2_CONFIG.bodyCollisionFriction,
      restitution: WRX2_CONFIG.bodyCollisionRestitution
    },
    wall
  ]);
}

function createPreparedSurface(triangles, revision, staticColliders = []) {
  const unpacked = buildRaceBakedSurfaceSampler({
    mesh: { triangles },
    elevationScaleM: 1,
    bucketSizeM: 20
  });
  const sampler = packRaceBakedSurfaceSampler(unpacked);
  sampler.revision = revision;
  const segment = Object.freeze({ id: revision, surface: 'asphalt' });
  const surfaceModel = new RaceSurfaceModel({
    elevationScaleM: 1,
    getRouteLength: () => 200,
    getActiveRuntimeType: () => 'destination',
    projectWorldToTrack: (point) => ({
      distance: Number(point.z || 0) + 100,
      lateral: Number(point.x || 0),
      yaw: 0,
      segment
    }),
    getRoadHalfWidth: () => 100,
    getMarginWidth: () => 0,
    getShoulderWidth: () => 0,
    getBlendWidth: () => 0,
    getSurfaceById: () => ({ id: 'asphalt', grip: 1 }),
    getEffectiveSurfaceId: () => 'asphalt',
    getGroundSurfaceForWorldPoint: () => 'asphalt',
    sampleRoadbedProfileAtDistance: (distance) => ({
      x: 0,
      z: Number(distance || 0) - 100,
      yaw: 0,
      elevation: 0,
      grade: 0,
      roadHalfWidth: 100,
      marginWidth: 0,
      shoulderWidth: 0,
      blendWidth: 0,
      segment
    }),
    sampleBakedSurface: (point, options) => sampleRaceBakedSurface(sampler, point, options),
    sampleTerrain: (point) => sampleRaceBakedSurface(sampler, point)?.elevation ?? 0,
    sampleRawTerrain: (point) => sampleRaceBakedSurface(sampler, point)?.elevation ?? 0
  });
  return {
    id: revision,
    sampler,
    staticColliderWorld: prepareStaticRaceColliders(staticColliders, { revision }),
    surfaceModel,
    queryContext: surfaceModel.createPhysicsQueryContext({
      routeLength: 200,
      runtimeType: 'destination',
      fallbackSurfaceId: 'asphalt'
    })
  };
}

function rotatedBodyExtents(config, orientation) {
  const points = createChassisBodyContactCandidates(config).map(({ localPoint }) => (
    rotateVectorByQuaternion(localPoint, orientation)
  ));
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    maxX: Math.max(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxY: Math.max(...points.map(({ y }) => y)),
    minZ: Math.min(...points.map(({ z }) => z)),
    maxZ: Math.max(...points.map(({ z }) => z))
  };
}

function samplePreparedHeight(surface, point) {
  return sampleRaceBakedSurface(surface.sampler, point)?.elevation ?? null;
}

function createFloorCase(fixture, speedMps) {
  const surface = buildPreparedFloor(fixture.surface);
  const orientation = quaternionFromEuler({
    pitch: fixture.pitchRad || 0,
    roll: fixture.rollRad || 0
  });
  const extents = rotatedBodyExtents(WRX2_CONFIG, orientation);
  const referenceHeights = [-2.4, 0, 2.4].flatMap((z) => (
    [-1, 0, 1].map((x) => samplePreparedHeight(surface, { x, z }))
  )).filter(finite);
  const maximumFloorHeightM = Math.max(0, ...referenceHeights);
  const impactSpeedMps = Number(speedMps);
  return {
    kind: 'floor',
    id: fixture.id,
    surface,
    speedMps: impactSpeedMps,
    orientation,
    initialState: {
      position: {
        x: 0,
        y: maximumFloorHeightM - extents.minY + impactSpeedMps * IMPACT_TIME_SECONDS,
        z: 0
      },
      orientation,
      velocity: { x: 0, y: -impactSpeedMps, z: 0 },
      angularVelocityWorld: { x: 0, y: 0, z: 0 },
      grounded: false,
      wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [wheelId, 0]))
    }
  };
}

function createWallCase(fixture, speedMps, thicknessM) {
  const surface = buildPreparedWall(thicknessM);
  const orientation = quaternionFromEuler({ yaw: fixture.yawRad || 0 });
  const extents = rotatedBodyExtents(WRX2_CONFIG, orientation);
  const direction = fixture.velocityDirection;
  const velocity = {
    x: direction.x * speedMps,
    y: direction.y * speedMps,
    z: direction.z * speedMps
  };
  const normalSpeedMps = Math.max(0.001, velocity.z);
  const bodyLongitudinalSpeedMps = velocity.x * Math.sin(fixture.yawRad || 0)
    + velocity.z * Math.cos(fixture.yawRad || 0);
  const initialFloorClearanceM = fixture.id === 'wall-floor-corner'
    ? Math.abs(velocity.y) * IMPACT_TIME_SECONDS
    : WRX2_CONFIG.bodyGroundClearanceM;
  return {
    kind: 'wall',
    id: fixture.id,
    surface,
    speedMps,
    thicknessM,
    wallEndM: Number.isFinite(thicknessM) ? thicknessM : Infinity,
    orientation,
    initialState: {
      position: {
        x: -velocity.x * IMPACT_TIME_SECONDS,
        y: -extents.minY + initialFloorClearanceM,
        z: -extents.maxZ - normalSpeedMps * IMPACT_TIME_SECONDS
      },
      orientation,
      velocity,
      angularVelocityWorld: { x: 0, y: fixture.yawRateRadps || 0, z: 0 },
      yawRad: fixture.yawRad || 0,
      speedMps: bodyLongitudinalSpeedMps,
      groundSpeedMps: Math.hypot(velocity.x, velocity.z),
      bodyLongitudinalSpeedMps,
      bodyLateralSpeedMps: velocity.x * Math.cos(fixture.yawRad || 0)
        - velocity.z * Math.sin(fixture.yawRad || 0),
      signedTravelSpeedMps: bodyLongitudinalSpeedMps,
      grounded: fixture.id !== 'wall-floor-corner',
      wheelAngularVelocityRadps: Object.fromEntries(WHEEL_IDS.map((wheelId) => [
        wheelId, bodyLongitudinalSpeedMps / WRX2_CONFIG.wheelRadiusM
      ]))
    }
  };
}

function createRuntimeEnvironment(surface, tireHz) {
  const queryCache = createPhysicsTerrainQueryFrameCache({ resultCapacity: 256 });
  const controls = Object.freeze({
    steering: 0,
    centerSteeringAngleRad: 0,
    throttle: 0,
    brake: 0,
    clutch: 0,
    handbrake: 0,
    requestedGear: 0,
    assists: Object.freeze({
      absEnabled: false,
      tractionControlEnabled: false,
      stabilityControlEnabled: false,
      launchControlEnabled: false,
      autoShift: false
    })
  });
  const environmentProvider = ({ state, previousState, tireSubstepDt, physicsCostAccounting }) => {
    const velocity = state.velocity || {};
    const previousPosition = previousState?.position || state.position;
    const proposedX = Number(state.position.x || 0) + Number(velocity.x || 0) * tireSubstepDt;
    const proposedZ = Number(state.position.z || 0) + Number(velocity.z || 0) * tireSubstepDt;
    const horizontalReachM = Math.hypot(
      WRX2_CONFIG.bodyLengthM * 0.5,
      WRX2_CONFIG.bodyWidthM * 0.5
    ) + WRX2_CONFIG.wheelRadiusM + 0.75;
    const bounds = {
      minX: Math.min(Number(previousPosition.x || 0), proposedX) - horizontalReachM,
      maxX: Math.max(Number(previousPosition.x || 0), proposedX) + horizontalReachM,
      minZ: Math.min(Number(previousPosition.z || 0), proposedZ) - horizontalReachM,
      maxZ: Math.max(Number(previousPosition.z || 0), proposedZ) + horizontalReachM
    };
    const queryFrame = queryCache.begin({
      sampler: surface.sampler,
      revision: surface.id,
      bounds,
      elevationScaleM: 1,
      physicsCostAccounting
    });
    const surfaceSamplesByWheel = {};
    const surfaceHeightByWheel = {};
    const surfaceNormalByWheel = {};
    const contactSamplesByWheel = {};
    const materialByWheel = {};
    const tireByWheel = {};
    for (const wheelId of WHEEL_IDS) {
      const provisional = calculateWheelContactKinematics({
        state,
        controls,
        config: { ...WRX2_CONFIG, tireHz },
        environment: {},
        wheelId
      });
      const center = surface.surfaceModel.samplePhysicsGeometry(
        provisional.contactPointWorld,
        surface.queryContext
      );
      surfaceSamplesByWheel[wheelId] = center;
      surfaceHeightByWheel[wheelId] = center.heightM;
      surfaceNormalByWheel[wheelId] = center.normal;
      const longitudinalHalfM = 0.09;
      const lateralHalfM = 0.12;
      const footprintPoints = [
        [-longitudinalHalfM, -lateralHalfM],
        [-longitudinalHalfM, lateralHalfM],
        [longitudinalHalfM, -lateralHalfM],
        [longitudinalHalfM, lateralHalfM],
        [0, -lateralHalfM],
        [0, lateralHalfM]
      ].map(([longitudinal, lateral]) => ({
        x: provisional.contactPointWorld.x
          + provisional.wheelForwardWorld.x * longitudinal
          + provisional.wheelLateralWorld.x * lateral,
        y: provisional.contactPointWorld.y,
        z: provisional.contactPointWorld.z
          + provisional.wheelForwardWorld.z * longitudinal
          + provisional.wheelLateralWorld.z * lateral
      }));
      contactSamplesByWheel[wheelId] = queryFrame.samplePoints(footprintPoints).map((sample) => ({
        valid: sample.valid,
        supported: sample.valid,
        heightM: sample.heightM,
        normal: sample.normal,
        normalX: sample.normal.x,
        normalY: sample.normal.y,
        normalZ: sample.normal.z,
        triangleId: sample.triangleId,
        region: sample.region,
        source: sample.source
      }));
      materialByWheel[wheelId] = {
        baseSurfaceId: 'asphalt',
        surfaceId: 'asphalt',
        grip: 1,
        effectiveGrip: 1,
        surfaceGripScale: 1
      };
      tireByWheel[wheelId] = { ...(WRX2_CONFIG.tireByWheel?.[wheelId] || {}) };
    }
    const reference = queryFrame.bodyVariationReference;
    reference.point.x = Number(state.position.x || 0);
    reference.point.y = Number(state.position.y || 0);
    reference.point.z = Number(state.position.z || 0);
    const referenceSample = queryFrame.samplePoint(reference.point);
    reference.heightM = Number(referenceSample.heightM || 0);
    reference.normal.x = Number(referenceSample.normal?.x || 0);
    reference.normal.y = Number(referenceSample.normal?.y ?? 1);
    reference.normal.z = Number(referenceSample.normal?.z || 0);
    const variation = queryFrame.terrainVariationInBounds(bounds, reference, {
      heightToleranceM: 0.025,
      normalToleranceRad: 5 * Math.PI / 180
    });
    const terrainHasDiscontinuities = !variation.valid || variation.discontinuity;
    return {
      physicsTerrainQueryFrame: queryFrame,
      staticColliderWorld: surface.staticColliderWorld,
      staticCollidersOwnBodyCollision: true,
      routeDistanceM: ROUTE_DISTANCE_M,
      requireValidTerrainEnvelope: true,
      surfaceSamplesByWheel,
      surfaceHeightByWheel,
      surfaceNormalByWheel,
      contactSamplesByWheel,
      materialByWheel,
      tireByWheel,
      sampleTerrainAtWorldPoint: (point) => queryFrame.samplePoint(point),
      sampleTerrainAtWorldPoints: (points) => queryFrame.samplePoints(points),
      sampleTerrainMaximumHeightInBounds: (queryBounds) => (
        queryFrame.maximumHeightInBounds(queryBounds)
      ),
      sampleRenderedTerrainAtWorldPoint: (point) => queryFrame.samplePoint(point),
      adaptiveBodySupport: terrainHasDiscontinuities,
      terrainHasDiscontinuities,
      airDensityKgM3: 1.225,
      ambientTemperatureC: 20,
      windWorldMps: { x: 0, y: 0, z: 0 },
      gustWorldMps: { x: 0, y: 0, z: 0 },
      vehicleId: 'wrx2-high-energy-regression'
    };
  };
  return { environmentProvider, controls };
}

function instrumentCollisionDetection(runner) {
  const observations = [];
  const originalStep = runner.bodyCollision.step.bind(runner.bodyCollision);
  runner.bodyCollision.step = (args) => {
    const ordinal = observations.length;
    const proposedPosition = { ...args.workingState.position };
    const result = originalStep(args);
    observations.push({
      ordinal,
      dt: args.dt,
      proposedPosition,
      resolvedPosition: { ...args.workingState.position },
      result
    });
    return result;
  };
  return observations;
}

function firstTimeOfImpactSeconds(observations) {
  const hit = observations.find(({ result }) => finite(result.timeOfImpactFraction));
  return hit ? (hit.ordinal + Number(hit.result.timeOfImpactFraction)) * hit.dt : null;
}

function stateIsFinite(state) {
  const visit = (value) => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(visit);
    if (value && typeof value === 'object') return Object.values(value).every(visit);
    return true;
  };
  return visit(state);
}

function bodySupportWorldPoints(runner) {
  return createChassisBodyContactCandidates(runner.config).map(({ localPoint }) => {
    const rotated = rotateVectorByQuaternion(localPoint, runner.state.orientation);
    return {
      x: runner.state.position.x + rotated.x,
      y: runner.state.position.y + rotated.y,
      z: runner.state.position.z + rotated.z
    };
  });
}

function runCase(collisionCase, {
  fps = 60,
  tireHz = 360,
  hitch = false,
  verifyReplay = true
} = {}) {
  const runtime = createRuntimeEnvironment(collisionCase.surface, tireHz);
  const config = {
    ...WRX2_CONFIG,
    tireHz,
    maxCatchUpSteps: 64,
    telemetryRetention: 'history',
    telemetryLimit: 128,
    physicsIncidentRecordingEnabled: false
  };
  const runner = new VehicleDynamicsRunner({
    config,
    initialState: collisionCase.initialState,
    tireContactSubsystem: new ContactPatchTireModel(),
    environmentProvider: runtime.environmentProvider
  });
  runner.addInputSample(0, runtime.controls, { replace: true });
  runner.addInputSample(SIMULATION_SECONDS, runtime.controls);
  const observations = instrumentCollisionDetection(runner);
  if (hitch) {
    runner.advance(HITCH_SECONDS);
    let elapsed = HITCH_SECONDS;
    while (elapsed < SIMULATION_SECONDS - 1e-12) {
      const dt = Math.min(1 / fps, SIMULATION_SECONDS - elapsed);
      runner.advance(dt);
      elapsed += dt;
    }
  } else {
    let elapsed = 0;
    while (elapsed < SIMULATION_SECONDS - 1e-12) {
      const dt = Math.min(1 / fps, SIMULATION_SECONDS - elapsed);
      runner.advance(dt);
      elapsed += dt;
    }
  }
  runner.drainCatchUp();
  const stateSnapshot = runner.createStateSnapshot();
  const replayRecord = runner.createReplayRecord();
  let replay = null;
  if (verifyReplay) {
    const replayRuntime = createRuntimeEnvironment(collisionCase.surface, tireHz);
    replay = VehicleDynamicsRunner.replay(replayRecord, {
      tireContactSubsystem: new ContactPatchTireModel(),
      environmentProvider: replayRuntime.environmentProvider
    });
  }
  const maximumPenetrationM = observations.reduce((maximum, observation) => Math.max(
    maximum,
    Number(observation.result.maximumPenetrationAfterSolveM || 0),
    Number(observation.result.residualPenetrationM || 0)
  ), 0);
  return {
    runner,
    replay,
    observations,
    stateSnapshot,
    stateChecksum: checksum(stateSnapshot),
    replayChecksum: replay ? checksum(replay.createStateSnapshot()) : null,
    timeOfImpactSeconds: firstTimeOfImpactSeconds(observations),
    maximumPenetrationM,
    bodyPoints: bodySupportWorldPoints(runner)
  };
}

function collisionViolations(result, collisionCase) {
  const { runner } = result;
  const violations = [];
  if (runner.collisionTimeline.length !== 0) {
    violations.push(`pre-queued ${runner.collisionTimeline.length} collision contacts`);
  }
  if (!stateIsFinite(result.stateSnapshot)) violations.push('non-finite authoritative state');
  if (runner.penetrationRecoveryState.history.length !== 0) {
    violations.push(`catastrophic recoveries=${runner.penetrationRecoveryState.history.length}`);
  }
  if (runner.contactStabilizationState.gameplayResetCount !== 0) {
    violations.push(`gameplay resets=${runner.contactStabilizationState.gameplayResetCount}`);
  }
  if (runner.contactStabilizationState.history.some((entry) => (
    entry.routeDistanceAfter === 0 || entry.routeDistanceBefore === 0
  ))) violations.push('route distance reset to zero');
  if (result.maximumPenetrationM > CCD_PENETRATION_TOLERANCE_M) {
    violations.push(
      `penetration=${result.maximumPenetrationM}m > ${CCD_PENETRATION_TOLERANCE_M}m`
    );
  }
  if (result.timeOfImpactSeconds === null) violations.push('missing swept contact TOI');
  if (runner.impactHistory.length === 0) violations.push('missing authoritative impact history');
  for (const impact of runner.impactHistory) {
    if (!finite(impact.preImpactKineticEnergyJ)) violations.push('non-finite pre-impact energy');
    if (!finite(impact.postImpactKineticEnergyJ)) violations.push('non-finite post-impact energy');
    if (impact.postImpactKineticEnergyJ > impact.preImpactKineticEnergyJ * 1.01 + 1) {
      violations.push(
        `post-impact energy=${impact.postImpactKineticEnergyJ}J > ${impact.preImpactKineticEnergyJ}J`
      );
    }
  }
  if (collisionCase.kind === 'floor') {
    const entirelyBelowFloor = result.bodyPoints.every((point) => {
      const heightM = samplePreparedHeight(collisionCase.surface, point);
      return finite(heightM) && point.y < heightM - CCD_PENETRATION_TOLERANCE_M;
    });
    if (entirelyBelowFloor) violations.push('body crossed completely through floor');
  } else {
    const wallEndM = collisionCase.wallEndM;
    const crossedThinWall = Number.isFinite(wallEndM)
      && result.bodyPoints.every((point) => point.z > wallEndM + CCD_PENETRATION_TOLERANCE_M);
    const crossedInfinitePlane = !Number.isFinite(wallEndM)
      && result.bodyPoints.every((point) => point.z > CCD_PENETRATION_TOLERANCE_M);
    if (crossedThinWall || crossedInfinitePlane) {
      violations.push('body crossed completely through wall');
    }
  }
  if (result.replay) {
    if (result.replayChecksum !== result.stateChecksum) {
      violations.push(`replay checksum ${result.replayChecksum} != ${result.stateChecksum}`);
    }
    if (checksum(result.replay.impactHistory) !== checksum(runner.impactHistory)) {
      violations.push('replay impact history mismatch');
    }
    if (checksum(result.replay.penetrationRecoveryState.history)
      !== checksum(runner.penetrationRecoveryState.history)) {
      violations.push('replay recovery history mismatch');
    }
  }
  return violations;
}

function assertCollisionOutcome(result, collisionCase, label) {
  const violations = collisionViolations(result, collisionCase);
  assert.deepEqual(violations, [], `${label}: ${violations.join('; ')}`);
}

function appendLabeledViolations(target, result, collisionCase, label) {
  collisionViolations(result, collisionCase).forEach((violation) => {
    target.push(`${label}: ${violation}`);
  });
}

test('high-energy runtime fixture uses exact 300 mph and complete WRX2 physical systems', () => {
  assert.equal(SPEEDS_MPS.at(-1), 134.112);
  assert.equal(134.112 / 0.44704, 300);
  assert.equal(WRX2_CONFIG.physicalProfileId, 'wrx2-2022-physical-v1');
  assert.equal(WRX2_CONFIG.bodyProfile.preset, 'car');
  // The immutable recorded incident embeds its original four-piece body;
  // current WRX2 configuration coverage lives in vehicleBodyProfile.test.js.
  assert.equal(WRX2_CONFIG.bodyProfile.pieces.length, 4);
  assert.equal(WRX2_CONFIG.contactFootprintSamples >= 4, true);
  assert.equal(buildPreparedFloor('flat').surfaceModel instanceof RaceSurfaceModel, true);
  assert.equal(buildPreparedFloor('flat').sampler.triangleCount > 0, true);
  assert.equal(
    buildPreparedFloor('flat').staticColliderWorld instanceof PreparedStaticRaceColliderWorld,
    true
  );
  assert.deepEqual(TIRE_HZ_VALUES, [120, 240, 360]);
  assert.deepEqual(RENDER_FPS_VALUES, [30, 60, 90, 120, 144]);
});

for (const fixture of FLOOR_FIXTURES) {
  for (const speedMps of SPEEDS_MPS) {
    test(`full-runtime WRX2 ${fixture.id} at ${speedMps} m/s`, () => {
      const collisionCase = createFloorCase(fixture, speedMps);
      const result = runCase(collisionCase);
      assertCollisionOutcome(result, collisionCase, `${fixture.id} ${speedMps} m/s`);
    });
  }
}

for (const fixture of WALL_FIXTURES) {
  for (const speedMps of SPEEDS_MPS) {
    for (const thicknessM of WALL_THICKNESSES_M) {
      test(`full-runtime WRX2 ${fixture.id} wall ${thicknessLabel(thicknessM)} at ${speedMps} m/s`, () => {
        const collisionCase = createWallCase(fixture, speedMps, thicknessM);
        const result = runCase(collisionCase);
        assertCollisionOutcome(result, collisionCase,
          `${fixture.id} ${thicknessLabel(thicknessM)} ${speedMps} m/s`);
      });
    }
  }
}

for (const fixture of FLOOR_FIXTURES) {
  for (const tireHz of TIRE_HZ_VALUES) {
    test(`300 mph ${fixture.id} is render-partition deterministic at ${tireHz} tire Hz`, () => {
      const collisionCase = createFloorCase(fixture, 134.112);
      const results = RENDER_FPS_VALUES.map((fps) => runCase(collisionCase, {
        fps,
        tireHz,
        verifyReplay: fps === 30
      }));
      const failures = [];
      results.forEach((result, index) => appendLabeledViolations(
        failures, result, collisionCase,
        `${fixture.id} ${RENDER_FPS_VALUES[index]} FPS ${tireHz} Hz`
      ));
      results.slice(1).forEach((result) => {
        if (result.stateChecksum !== results[0].stateChecksum) {
          failures.push(`${fixture.id} ${tireHz} Hz render-partition checksum mismatch`);
        }
        if (result.timeOfImpactSeconds !== results[0].timeOfImpactSeconds) {
          failures.push(`${fixture.id} ${tireHz} Hz render-partition TOI mismatch`);
        }
      });
      assert.deepEqual(failures, [], failures.join('\n'));
    });
  }
  test(`300 mph ${fixture.id} survives a 250 ms pre-impact hitch at every tire rate`, () => {
    const collisionCase = createFloorCase(fixture, 134.112);
    const failures = [];
    for (const tireHz of TIRE_HZ_VALUES) {
      for (const fps of RENDER_FPS_VALUES) {
        const smooth = runCase(collisionCase, { fps, tireHz, verifyReplay: false });
        const hitched = runCase(collisionCase, { fps, tireHz, hitch: true,
          verifyReplay: fps === 30 });
        appendLabeledViolations(
          failures, hitched, collisionCase, `${fixture.id} hitch ${fps} FPS ${tireHz} Hz`
        );
        if (hitched.stateChecksum !== smooth.stateChecksum) {
          failures.push(`${fixture.id} hitch ${fps} FPS ${tireHz} Hz checksum mismatch`);
        }
        if (hitched.timeOfImpactSeconds !== smooth.timeOfImpactSeconds) {
          failures.push(`${fixture.id} hitch ${fps} FPS ${tireHz} Hz TOI mismatch`);
        }
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}

for (const fixture of WALL_FIXTURES) {
  test(`300 mph ${fixture.id} thin-wall collision covers the render/contact/hitch matrix`, () => {
    const collisionCase = createWallCase(fixture, 134.112, 0.05);
    const failures = [];
    for (const tireHz of TIRE_HZ_VALUES) {
      const results = RENDER_FPS_VALUES.map((fps) => runCase(collisionCase, {
        fps,
        tireHz,
        verifyReplay: fps === 30
      }));
      results.forEach((result, index) => appendLabeledViolations(
        failures, result, collisionCase,
        `${fixture.id} 0.05m ${RENDER_FPS_VALUES[index]} FPS ${tireHz} Hz`
      ));
      results.slice(1).forEach((result) => {
        if (result.stateChecksum !== results[0].stateChecksum) {
          failures.push(`${fixture.id} ${tireHz} Hz render-partition checksum mismatch`);
        }
        if (result.timeOfImpactSeconds !== results[0].timeOfImpactSeconds) {
          failures.push(`${fixture.id} ${tireHz} Hz render-partition TOI mismatch`);
        }
      });
      for (let fpsIndex = 0; fpsIndex < RENDER_FPS_VALUES.length; fpsIndex += 1) {
        const fps = RENDER_FPS_VALUES[fpsIndex];
        const hitched = runCase(collisionCase, { fps, tireHz, hitch: true,
          verifyReplay: fps === 30 });
        appendLabeledViolations(
          failures, hitched, collisionCase,
          `${fixture.id} 0.05m hitch ${fps} FPS ${tireHz} Hz`
        );
        if (hitched.stateChecksum !== results[fpsIndex].stateChecksum) {
          failures.push(`${fixture.id} hitch ${fps} FPS ${tireHz} Hz checksum mismatch`);
        }
        if (hitched.timeOfImpactSeconds !== results[fpsIndex].timeOfImpactSeconds) {
          failures.push(`${fixture.id} hitch ${fps} FPS ${tireHz} Hz TOI mismatch`);
        }
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}
