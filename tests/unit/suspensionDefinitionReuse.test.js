import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSuspensionDefinition, solveSuspensionGeometry } from '../../src/racing/simulation/SuspensionGeometry.js';

test('immutable definitions reuse conversion with exact uncached output parity', () => {
  for (const type of ['macpherson', 'double-wishbone', 'multilink', 'trailing-arm', 'solid-axle']) {
    const definition = normalizeSuspensionDefinition({type, axis: {x: .13, y: -.97, z: .21}});
    let axis;
    for (let i = 0; i < 100; i++) {
      const args = {compressionM: (i - 50) / 200, steeringAngleRad: i / 100,
        staticCamberRad: -.03, staticToeRad: .01, alignmentSideSign: i % 2 ? 1 : -1,
        springRateNpm: 35000};
      const actual = solveSuspensionGeometry({...args, definition});
      // A caller-owned copy takes the original uncached normalization path.
      const expected = solveSuspensionGeometry({...args, definition: {...definition}});
      assert.deepEqual(actual, expected);
      if (axis) assert.equal(actual.suspensionAxis, axis);
      axis = actual.suspensionAxis;
    }
  }
});

test('mutable caller definitions and axes still update immediately', () => {
  const definition = {camberGainDegPerM: -12, axis: {x: 0, y: -1, z: 0}};
  const before = solveSuspensionGeometry({definition, compressionM: .1});
  definition.camberGainDegPerM = -20;
  definition.axis.x = .5;
  const after = solveSuspensionGeometry({definition, compressionM: .1});
  assert.notEqual(before.camberRad, after.camberRad);
  assert.notDeepEqual(before.suspensionAxis, after.suspensionAxis);
});
