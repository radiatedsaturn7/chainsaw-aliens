import assert from 'node:assert/strict';
import test from 'node:test';

if (process.env.FULL_PHYSICS_MATRIX === '1') {
  const {
    compactScenarioOutcome,
    createDeterminismChecksum,
    runVehicleDynamicsScenario,
    vehicleDynamicsScenarios
  } = await import('../helpers/vehicleDynamicsRunnerCases.js');

  const renderFps = [30, 60, 90, 120, 144];

  for (const scenario of vehicleDynamicsScenarios) {
    test(`full determinism: ${scenario.name}`, () => {
      let baseline = null;
      for (const fps of renderFps) {
        const checksum = createDeterminismChecksum();
        const { runner, sawCatchUpLimit } = runVehicleDynamicsScenario(scenario, fps, {
          telemetryRetention: 'transient', onTelemetry: checksum.observe
        });
        const outcome = compactScenarioOutcome(runner, checksum);
        assert.equal(runner.stepIndex, 240);
        assert.equal(runner.diagnostics.completedTireSubsteps, 720);
        if (scenario.hitch && fps === 30) assert.equal(sawCatchUpLimit, true);
        if (baseline) assert.deepEqual(outcome, baseline, `${scenario.name} at ${fps} FPS`);
        else baseline = outcome;
      }
    });

    test(`full replay: ${scenario.name}`, () => {
      const originalChecksum = createDeterminismChecksum();
      let { runner: original } = runVehicleDynamicsScenario(scenario, 90, {
        telemetryRetention: 'transient', onTelemetry: originalChecksum.observe
      });
      const record = original.createReplayRecord();
      const expected = compactScenarioOutcome(original, originalChecksum);
      original = null;
      const replayChecksum = createDeterminismChecksum();
      const { runner: replay } = runVehicleDynamicsScenario(scenario, 90, {
        telemetryRetention: 'transient', onTelemetry: replayChecksum.observe, replayRecord: record
      });
      assert.deepEqual(compactScenarioOutcome(replay, replayChecksum), expected, scenario.name);
    });
  }
}
