import test from 'node:test';
import assert from 'node:assert/strict';
import { PowertrainModel } from '../../src/racing/simulation/PowertrainModel.js';

const model = new PowertrainModel();
const tuning = {
  idleRpm: 850, redlineRpm: 6500, revLimitRpm: 6800,
  autoUpshiftRpm: 6100, autoDownshiftRpm: 2400,
  gearRatios: [3.5, 2.2, 1.5, 1.1, 0.85, 0.7], finalDrive: 4,
  shiftTimeMs: 180, wheelRadiusM: 0.33, drivetrain: 'awd'
};
function step({ rpm = 3500, gear = 4, throttle = 1, brake = 0, autoShift = true } = {}) {
  const omega = rpm / (tuning.gearRatios[gear - 1] * tuning.finalDrive) * Math.PI * 2 / 60;
  return model.stepAuthoritativeWheelTorques({
    tuning, config: { ...tuning, maxRpm: tuning.revLimitRpm },
    previous: { gear, targetGear: gear, engineRpm: rpm },
    controls: { requestedGear: gear, throttle, brake, assists: { autoShift } },
    kinematicsByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(id => [id, { wheelAngularVelocityRadps: omega }])),
    dt: 1 / 360
  }).state;
}
test('automatic kicks down at mid RPM on demand but holds the cruising gear at light throttle', () => {
  assert.equal(step({ throttle: 0.3 }).targetGear, 4);
  assert.equal(step({ throttle: 1 }).targetGear, 3);
  assert.equal(step({ throttle: 1, autoShift: false }).targetGear, 4);
});
test('automatic lower gear stays below the upshift point and refuses an unsafe braking downshift', () => {
  assert.equal(step({ rpm: 4700, brake: 0.6 }).targetGear, 4);
  assert.equal(step({ rpm: 3500, brake: 0.6, throttle: 0 }).targetGear, 3);
  const lowerRpm = 3500 * 1.5 / 1.1;
  assert.equal(step({ rpm: lowerRpm, gear: 3 }).targetGear, 3);
  assert.equal(step({ rpm: 6200 }).targetGear, 5);
});

// Hold wheel speed constant while allowing converter RPM to flare. This used
// to upshift on engine RPM, then kick back down on shaft RPM indefinitely.
test('sustained converter flare does not hunt between third and fourth', () => {
  for (const fps of [60, 360]) {
    const omega = 3500 / (tuning.gearRatios[3] * tuning.finalDrive) * Math.PI * 2 / 60;
    let previous = { gear: 4, targetGear: 4, engineRpm: 6300 };
    const transitions = [];
    for (let i = 0; i < fps * 4; i++) {
      const next = model.stepAuthoritativeWheelTorques({
        tuning, config: { ...tuning, maxRpm: tuning.revLimitRpm },
        previous: { ...previous, engineRpm: 6300 },
        controls: { requestedGear: previous.gear, throttle: 1, assists: { autoShift: true } },
        kinematicsByWheel: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(id => [id, { wheelAngularVelocityRadps: omega }])),
        dt: 1 / fps
      }).state;
      if (next.gear !== previous.gear) transitions.push(next.gear);
      previous = next;
    }
    assert.deepEqual(transitions, [3], `${fps} Hz shifts`);
  }
});

test('automatic lets the drivetrain settle before requesting another shift', () => {
  const state = model.stepAuthoritativeWheelTorques({
    tuning, config: { ...tuning, maxRpm: tuning.revLimitRpm },
    previous: { gear: 4, targetGear: 4, engineRpm: 2000, shiftRecoveryTimeRemainingSeconds: .16 },
    controls: { requestedGear: 4, throttle: 1, assists: { autoShift: true } },
    dt: 1 / 360
  }).state;
  assert.equal(state.targetGear, 4);
});
