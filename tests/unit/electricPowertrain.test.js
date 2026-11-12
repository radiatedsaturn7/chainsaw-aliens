import test from 'node:test';
import assert from 'node:assert/strict';
import { stepElectricPowertrain as step } from '../../src/racing/simulation/ElectricPowertrainModel.js';
// Deliberately generic fixture; not an OEM specification.
const config = { peakTorqueNm: 700, peakPowerKw: 400, maxMotorRpm: 18000,
  reductionRatio: 10, usableBatteryKwh: 70, driveEfficiency: .9, regenEfficiency: .8,
  maxRegenTorqueNm: 100, maxRegenPowerKw: 50, standstillLossKw: 2, regenFullSpeedRadps: 5 };
const run = (args = {}) => step({ config, direction: 1, dt: .01, ...args });
test('zero RPM launch has torque without idle, clutch or invented free RPM', () => {
  const r = run({ throttle: 1 });
  assert.equal(r.axleTorqueNm, 7000);
  assert.equal(r.telemetry.motorRpm, 0);
  assert.ok(r.state.batteryEnergyJ < 70 * 3.6e6);
});
test('constant-power envelope and overspeed cutoff', () => {
  const r = run({ throttle: 1, wheelOmegaRadps: 100 });
  assert.equal(r.telemetry.driveMotorTorqueNm, 400);
  assert.equal(run({ throttle: 1, wheelOmegaRadps: 200 }).axleTorqueNm, 0);
});
test('neutral, empty pack and opposite-direction command cannot propel', () => {
  for (const args of [{ direction: 0 }, { previous: { batteryEnergyJ: 0 } }, { wheelOmegaRadps: -10 }]) {
    assert.equal(run({ throttle: 1, ...args }).axleTorqueNm, 0);
  }
  assert.equal(run({ direction: -1, throttle: 1 }).axleTorqueNm, -7000);
});
test('regen opposes both directions, tapers to zero and cannot charge full pack', () => {
  for (const omega of [-10, 10]) {
    const r = run({ regen: 1, wheelOmegaRadps: omega, previous: { batteryEnergyJ: 1e8 } });
    assert.ok(r.axleTorqueNm * omega < 0);
    assert.ok(r.state.batteryEnergyJ > 1e8);
    assert.ok(r.telemetry.batteryPowerW < 0);
  }
  assert.equal(run({ regen: 1, wheelOmegaRadps: 10 }).axleTorqueNm, 0);
  assert.equal(run({ regen: 1, previous: { batteryEnergyJ: 0 } }).axleTorqueNm, 0);
});
test('substep energy bounds scale delivered torque, never create energy', () => {
  const r = run({ throttle: 1, wheelOmegaRadps: 20, dt: 1, previous: { batteryEnergyJ: 1 } });
  assert.equal(r.state.batteryEnergyJ, 0);
  assert.ok(r.axleTorqueNm * 20 <= 1);
  const full = config.usableBatteryKwh * 3.6e6;
  const regen = run({ regen: 1, wheelOmegaRadps: 20, dt: 1, previous: { batteryEnergyJ: full - 1 } });
  assert.equal(regen.state.batteryEnergyJ, full);
  assert.ok(Math.abs(regen.telemetry.batteryPowerW + 1) < 1e-10);
});
test('traction intervention precedes energy accounting; neutral does not regenerate', () => {
  assert.equal(run({ throttle: 1, torqueScale: 0 }).telemetry.batteryPowerW, 0);
  assert.equal(run({ direction: 0, regen: 1, wheelOmegaRadps: 10,
    previous: { batteryEnergyJ: 0 } }).axleTorqueNm, 0);
});
test('explicit state is deterministic and serializable; zero dt preserves energy', () => {
  const a = run({ throttle: .4, wheelOmegaRadps: 20 });
  assert.deepEqual(run({ previous: a.state }), run({ previous: JSON.parse(JSON.stringify(a.state)) }));
  assert.equal(run({ throttle: 1, dt: 0 }).state.batteryEnergyJ, 70 * 3.6e6);
});
test('reject invalid integration inputs rather than poison replay state', () => {
  for (const args of [{ dt: NaN }, { dt: -1 }, { wheelOmegaRadps: Infinity }, { direction: 2 },
    { throttle: NaN }, { config: { ...config, usableBatteryKwh: 0 } },
    { config: { ...config, driveEfficiency: 2 } }, { previous: { batteryEnergyJ: NaN } }]) {
    assert.throws(() => run(args), RangeError);
  }
});

test('launch energy includes rotational acceleration even with zero winding losses', () => {
  const dt=1/360, inertia=6;
  const r=run({config:{...config,standstillLossKw:0}, previous:{batteryEnergyJ:1},
    throttle:1,dt,equivalentWheelInertiaKgM2:inertia});
  const omega=r.axleTorqueNm/inertia*dt;
  assert.ok(.5*inertia*omega**2 <= 1);
  assert.ok(r.state.batteryEnergyJ<1e-10);
});
test('regen cannot reverse a shaft or recover more than its kinetic energy',()=>{
  const dt=1,omega=.1,inertia=6,energy=1e8;
  const r=run({previous:{batteryEnergyJ:energy},regen:1,wheelOmegaRadps:omega,dt,
    equivalentWheelInertiaKgM2:inertia});
  assert.ok(omega+r.axleTorqueNm/inertia*dt>=-1e-12);
  assert.ok(r.state.batteryEnergyJ-energy <= .5*inertia*omega**2+1e-8);
});
