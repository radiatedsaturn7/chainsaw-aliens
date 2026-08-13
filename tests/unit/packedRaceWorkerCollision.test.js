import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRaceBakedSurfaceSampler,
  packRaceBakedSurfaceSampler
} from '../../src/racing/RaceBakedSurfaceSampler.js';
import { createPackedRaceWorkerEnvironmentProvider } from '../../src/racing/simulation/PackedRaceWorkerEnvironment.js';

test('static collision definitions are rebuilt as an indexed worker-owned world', () => {
  const surfaceSampler = packRaceBakedSurfaceSampler(buildRaceBakedSurfaceSampler({
    mesh: { triangles: [{ region: 'road', vertices: [
      { x: -10, y: -10, elevation: 0 },
      { x: 10, y: -10, elevation: 0 },
      { x: 0, y: 10, elevation: 0 }
    ] }] }
  }));
  const provider = createPackedRaceWorkerEnvironmentProvider({
    surfaceSampler,
    staticColliderDefinitions: [{
      id: 'wall', type: 'box', center: { x: 2, y: 1, z: 0 }, size: { x: 1, y: 2, z: 8 }
    }]
  });
  const environment = provider({
    state: { position: { x: 0, y: 1, z: 0 }, orientation: { w: 1 }, suspensionState: {} },
    controls: {},
    reuseContactGeometry: true
  }, {
    frontTrackWidthM: 1.6, rearTrackWidthM: 1.6,
    suspensionTravelFrontM: 0.2, suspensionTravelRearM: 0.2,
    staticSagRatioFront: 0.5, staticSagRatioRear: 0.5,
    cgHeightM: 0.55, wheelRadiusM: 0.33,
    frontAxleDistanceFromCgM: 1.3, rearAxleDistanceFromCgM: 1.3,
    suspensionRestLengthFrontM: 0.4, suspensionRestLengthRearM: 0.4
  });
  assert.equal(typeof environment.staticColliderWorld.querySweptAabb, 'function');
  assert.equal(environment.staticColliderWorld.colliders[0].id, 'wall');
});
