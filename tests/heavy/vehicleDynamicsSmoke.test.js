import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactScenarioOutcome,
  createDeterminismChecksum,
  runVehicleDynamicsScenario,
  vehicleDynamicsScenarios
} from '../helpers/vehicleDynamicsRunnerCases.js';

const sourceByName = new Map(vehicleDynamicsScenarios.map((scenario) => [scenario.name, scenario]));
const smokeScenarios = [
  sourceByName.get('straight-line acceleration'),
  {
    ...sourceByName.get('step steer'),
    controls: (time) => ({ steering: time < 0.15 ? 0 : 0.7, throttle: 0.05 }),
    breakpoints: [0.15]
  },
  {
    ...sourceByName.get('emergency braking'),
    controls: (time) => ({ brake: time < 0.15 ? 0 : 1 }),
    breakpoints: [0.15]
  },
  {
    ...sourceByName.get('curb strike'),
    environment: (time) => ({
      surfaceHeightByWheel: { fl: time >= 0.15 && time <= 0.35 ? 0.12 : 0, fr: 0, rl: 0, rr: 0 }
    })
  },
  {
    ...sourceByName.get('airborne motion and landing'),
    name: 'airborne landing',
    initialState: {
      position: { x: 0, y: 1.2, z: 0 }, velocity: { x: 0, y: -2, z: 20 },
      speedMps: 20, grounded: false
    }
  }
];

for (const scenario of smokeScenarios) {
  test(`replay smoke: ${scenario.name}`, () => {
    let baseline = null;
    for (const fps of [30, 60, 144]) {
      const checksum = createDeterminismChecksum();
      const { runner } = runVehicleDynamicsScenario(scenario, fps, {
        durationSeconds: 0.5, telemetryRetention: 'transient', onTelemetry: checksum.observe
      });
      const outcome = compactScenarioOutcome(runner, checksum);
      if (baseline) assert.deepEqual(outcome, baseline, `${scenario.name} at ${fps} FPS`);
      else baseline = outcome;
    }
  });
}
