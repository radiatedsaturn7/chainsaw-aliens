import assert from 'node:assert/strict';
import test from 'node:test';

import { HandlingAssist } from '../../src/racing/simulation/HandlingAssist.js';
import { RACE_CONTROLLER_STEERING } from '../../src/racing/simulation/RaceSimulationConfig.js';
import {
  calculateAuthoritativeSteeringEnvelope,
  updateCountersteeringRange,
  calculateWheelContactKinematics,
  classifySteeringResponseTelemetry,
  resolvePhysicalCenterSteeringAngle
} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {
  VehicleControlInputTimeline,
  VehicleDynamicsRunner,
  normalizeVehicleControlInput
} from '../../src/racing/simulation/VehicleDynamicsRunner.js';

test('steering position is independent of front support and aquaplaning', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1500,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const patch = {
    normalLoadN: 4200, suspensionNormalLoadN: 4200,
    gripCoefficient: 1, utilization: 0.2
  };
  const twoWheel = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25, contactPatches: { fl: patch, fr: patch }
  }, config);
  const oneWheel = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25, contactPatches: { fl: patch }
  }, config);
  const aquaplaning = calculateAuthoritativeSteeringEnvelope({
    groundSpeedMps: 25,
    contactPatches: {
      fl: { ...patch, normalLoadN: 900 },
      fr: { ...patch, normalLoadN: 900 }
    }
  }, config);
  assert.equal(twoWheel,oneWheel);
  assert.equal(oneWheel,aquaplaning);
  assert.equal(resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, {
    groundSpeedMps: 25, contactPatches: { fl: patch, fr: patch }
  }), twoWheel);
});

test('loose-surface grip and current utilization do not collapse Sport rack authority', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1550,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const patch = (gripCoefficient, utilization) => ({
    normalLoadN: 4400, suspensionNormalLoadN: 4400,
    gripCoefficient, utilization
  });
  const clean = { groundSpeedMps: 24.6, contactPatches: {
    fl: patch(1.05, 0.05), fr: patch(1.05, 0.05)
  } };
  const poweredGravel = { groundSpeedMps: 24.6, contactPatches: {
    fl: patch(0.48, 0.96), fr: patch(0.48, 0.96)
  } };
  const cleanAngle = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, clean);
  const gravelAngle = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, poweredGravel);
  assert.equal(gravelAngle, cleanAngle);
  assert.ok(gravelAngle > 0.16, `permitted rack angle ${gravelAngle}`);
  assert.ok(gravelAngle > Math.atan(0.48 * 9.81 * config.wheelbaseM / (24.6 ** 2)) * 4);
});

test('WRX2 Sport rack can command beyond ideal slip-free steering on loose surfaces', () => {
  const config = {
    handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1575,
    frontWeightDistribution: 0.58, wheelbaseM: 2.68
  };
  const surfaces = {
    gravel: 0.52,
    'wet-gravel': 0.4,
    mud: 0.34,
    asphalt: 1.02
  };
  for (const mph of [35, 45, 55]) {
    const speedMps = mph * MPH_TO_MPS;
    for (const [surface, grip] of Object.entries(surfaces)) {
      for (const compound of ['tarmac', 'dirt']) {
        const contact = (utilization) => ({
          normalLoadN: 4480,
          suspensionNormalLoadN: 4480,
          gripCoefficient: grip * (compound === 'dirt' && surface !== 'asphalt' ? 1.08 : 1),
          utilization
        });
        const state = { groundSpeedMps: speedMps, contactPatches: {
          fl: contact(0.98), fr: contact(0.98)
        } };
        const permitted = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, state);
        const unloadedDemand = resolvePhysicalCenterSteeringAngle({ steering: 1 }, config, {
          ...state, contactPatches: { fl: contact(0), fr: contact(0) }
        });
        assert.equal(permitted, unloadedDemand, `${mph} mph ${surface} ${compound}`);
        if (surface !== 'asphalt') {
          const idealNoSlip = Math.atan(grip * 9.81 * config.wheelbaseM / (speedMps ** 2));
          assert.ok(permitted > idealNoSlip * 2.5,
            `${mph} mph ${surface} ${compound}: ${permitted} <= ${idealNoSlip}`);
        }
      }
    }
  }
});

const MPH_TO_MPS = 0.44704;
const SPEEDS_MPH = [0, 15, 30, 60, 100];
const assist = new HandlingAssist(RACE_CONTROLLER_STEERING);

function command({ mph, mode, input = 1 }) {
  return assist.resolvePhysicalCenterSteeringAngle({
    driverInput: input,
    speedMps: mph * MPH_TO_MPS,
    wheelbaseM: 2.68,
    availableLateralG: 0.95,
    handlingPreset: mode === 'simulation-wheel' ? 'simulation' : 'sport',
    steeringInputMode: mode,
    maxPhysicalAngleRad: 0.52
  });
}

for (const mode of ['keyboard', 'gamepad']) {
  test(`${mode} Sport full input remains responsive at low speed and bounded at highway speed`, () => {
    const angles = SPEEDS_MPH.map((mph) => command({ mph, mode }));
    assert.equal(angles[0] > 0.45, true);
    assert.equal(angles[1] > angles[4], true);
    assert.equal(angles[2] > angles[3], true);
    assert.equal(angles[3] < 0.04, true);
    assert.equal(angles[4] < 0.015, true);
  });
}

test('Accessible uses the same safe physical envelope as Sport', () => {
  for (const mph of SPEEDS_MPH) {
    const sport = assist.resolvePhysicalCenterSteeringAngle({
      driverInput: 1, speedMps: mph * MPH_TO_MPS, wheelbaseM: 2.68,
      availableLateralG: 0.95, handlingPreset: 'sport', maxPhysicalAngleRad: 0.52
    });
    const accessible = assist.resolvePhysicalCenterSteeringAngle({
      driverInput: 1, speedMps: mph * MPH_TO_MPS, wheelbaseM: 2.68,
      availableLateralG: 0.95, handlingPreset: 'accessible', maxPhysicalAngleRad: 0.52
    });
    assert.equal(accessible, sport);
  }
});

test('simulation wheel commands the physical rack range directly at every speed', () => {
  for (const mph of SPEEDS_MPH) {
    assert.equal(command({ mph, mode: 'simulation-wheel' }), 0.52);
    assert.equal(Math.abs(command({ mph, mode: 'simulation-wheel', input: -0.4 }) + 0.208) < 1e-12, true);
  }
});

test('explicit center steering angle overrides normalized input before Ackermann', () => {
  const config = {
    maxSteerAngleRad: 0.52,
    steeringRackRatio: 1,
    wheelbaseM: 2.68,
    frontTrackWidthM: 1.58,
    rearTrackWidthM: 1.58,
    frontAxleDistanceFromCgM: 1.3,
    rearAxleDistanceFromCgM: 1.38,
    cgHeightM: 0.55,
    wheelRadiusM: 0.33,
    ackermannRatio: 1,
    camberFrontRad: 0,
    camberRearRad: 0
  };
  const controls = { steering: 1, centerSteeringAngleRad: 0.028 };
  const state = {
    position: { x: 0, y: 0.55, z: 0 },
    velocity: { x: 0, y: 0, z: 27 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocityWorld: { x: 0, y: 0, z: 0 },
    wheelAngularVelocityRadps: {}
  };
  const environment = { surfaceNormalByWheel: {} };
  const fl = calculateWheelContactKinematics({ state, config, controls, environment, wheelId: 'fl' });
  const fr = calculateWheelContactKinematics({ state, config, controls, environment, wheelId: 'fr' });

  assert.equal(resolvePhysicalCenterSteeringAngle(controls, config), 0.028);
  assert.equal(Math.max(fl.steeringAngleRad, fr.steeringAngleRad) < 0.03, true);
  assert.notEqual(fl.steeringAngleRad, fr.steeringAngleRad);
});

test('WRX modest controller input does not become generic maximum lock', () => {
  const angle = command({ mph: 60, mode: 'gamepad', input: 0.35 });
  assert.equal(angle < 0.014, true);
  assert.equal(angle < 0.52 * 0.1, true);
});

test('input timeline keeps normalized driver command separate from physical center angle', () => {
  const first = normalizeVehicleControlInput({
    steering: 1,
    centerSteeringAngleRad: 0.04,
    steeringInputMode: 'keyboard'
  });
  assert.equal(first.steering, 1);
  assert.equal(first.centerSteeringAngleRad, 0.04);
  const timeline = new VehicleControlInputTimeline([
    { timeSeconds: 0, input: first },
    { timeSeconds: 1, input: { ...first, centerSteeringAngleRad: 0.02 } }
  ]);
  const sampled = timeline.sampleAt(0.5);
  assert.equal(sampled.steering, 1);
  assert.equal(sampled.centerSteeringAngleRad, 0.03);
  assert.equal(sampled.steeringInputMode, 'keyboard');
});

test('gamepad uses one controller response stage and reaches playability timing targets', () => {
  let output = 0;
  const samples = new Map();
  for (let elapsedMs = 10; elapsedMs <= 400; elapsedMs += 10) {
    output = assist.stepControllerToRackInput({
      mode: 'gamepad', intent: 1, currentOutput: output, seconds: 0.01
    });
    samples.set(elapsedMs, output);
  }
  assert.ok(samples.get(10) > 0.05, `first visible response ${samples.get(10)}`);
  const halfTime = [...samples].find(([, value]) => value >= 0.5)?.[0];
  const ninetyTime = [...samples].find(([, value]) => value >= 0.9)?.[0];
  assert.ok(halfTime >= 40 && halfTime <= 70, `50% at ${halfTime} ms`);
  assert.ok(ninetyTime >= 140 && ninetyTime <= 190, `90% at ${ninetyTime} ms`);
});

test('gamepad controller response is render-partition independent at supported frame rates', () => {
  const run = (fps) => {
    let output = 0;
    for (let frame = 0; frame < fps; frame += 1) {
      output = assist.stepControllerToRackInput({
        mode: 'gamepad', intent: 0.82, currentOutput: output, seconds: 1 / fps
      });
    }
    return output;
  };
  const expected = run(120);
  for (const fps of [30, 60, 90, 120, 144]) {
    assert.ok(Math.abs(run(fps) - expected) < 1e-12, `${fps} FPS response drift`);
  }
});

test('simulation wheel is direct while controller metadata remains replayable', () => {
  assert.equal(assist.stepControllerToRackInput({
    mode: 'simulation-wheel', intent: -0.73, currentOutput: 0.8, seconds: 1 / 30
  }), -0.73);
  const timeline = new VehicleControlInputTimeline([
    { timeSeconds: 0, input: {
      steering: 0, driverSteeringIntent: 0, steeringTarget: 0, controllerFilterOutput: 0
    } },
    { timeSeconds: 1, input: {
      steering: 1, driverSteeringIntent: 1, steeringTarget: 1, controllerFilterOutput: 0.8
    } }
  ]);
  assert.deepEqual(
    Object.fromEntries(['driverSteeringIntent', 'steeringTarget', 'controllerFilterOutput']
      .map((key) => [key, timeline.sampleAt(0.5)[key]])),
    { driverSteeringIntent: 0.5, steeringTarget: 0.5, controllerFilterOutput: 0.4 }
  );
});

test('dirt response diagnostics classify latency, envelope, saturation, drivetrain, ESC, and grip failures', () => {
  const base = {
    inputIntent: 1, steeringTarget: 1, controllerFilterOutput: 1,
    requestedRackAngleRad: 0.3, permittedRackAngleRad: 0.3,
    frontUtilization: { fl: 0.5, fr: 0.5 },
    throttleFrictionCircleUse: { fl: 0, fr: 0 },
    frontGripCoefficients: { fl: 0.6, fr: 0.6 }
  };
  assert.equal(classifySteeringResponseTelemetry({ ...base, controllerFilterOutput: 0.2 }), 'input-latency');
  assert.equal(classifySteeringResponseTelemetry({ ...base, permittedRackAngleRad: 0.1 }), 'steering-envelope-limitation');
  assert.equal(classifySteeringResponseTelemetry({ ...base, frontUtilization: { fl: 0.98, fr: 0.9 } }), 'front-tire-saturation');
  assert.equal(classifySteeringResponseTelemetry({
    ...base, frontUtilization: { fl: 0.9, fr: 0.85 }, throttleFrictionCircleUse: { fl: 0.7, fr: 0.65 }
  }), 'drivetrain-understeer');
  assert.equal(classifySteeringResponseTelemetry({ ...base, escInterventionActive: true }), 'esc-intervention');
  assert.equal(classifySteeringResponseTelemetry({
    ...base, frontGripCoefficients: { fl: 0.3, fr: 0.35 }
  }), 'insufficient-surface-grip');
});

test('gamepad gains a modest speed-dependent steering range while keyboard and simulation keep their mapping', () => {
  for (const speedMps of [0, 5, 7.5, 10, 15, 27, 45, 65]) {
    const options = { driverInput: 1, speedMps, handlingPreset: 'sport', maxPhysicalAngleRad: 0.52 };
    const keyboard = assist.resolvePhysicalCenterSteeringAngle(options);
    const gamepad = assist.resolvePhysicalCenterSteeringAngle({ ...options, steeringInputMode: 'gamepad' });
    if (speedMps <= 7.5) assert.equal(gamepad, keyboard);
    else {
      assert.ok(gamepad > keyboard);
      assert.ok(gamepad <= keyboard * 1.100001);
      assert.ok(gamepad <= 0.52);
    }
    assert.equal(assist.resolvePhysicalCenterSteeringAngle({ ...options, steeringInputMode: 'gamepad', driverInput: -1 }), -gamepad);
    assert.equal(assist.resolvePhysicalCenterSteeringAngle({ ...options, steeringInputMode: 'gamepad', handlingPreset: 'simulation' }), 0.52);
  }
});

test('Race editor applies the gamepad envelope to runtime and visible steering commands', async () => {
  const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');
  const editor = new RaceEditor({ isMobile: true, deviceIsMobile: true });
  editor.raceInput.analogSteeringActive = false;
  editor.raceInput.lastSteeringInputMode = 'binary';
  const keyboard = editor.getRaceResolvedCenterSteeringAngle(1, 27);
  const visibleKeyboard = editor.getRacePhysicalTireAngleForSteering(1, 27);
  editor.raceInput.analogSteeringActive = true;
  assert.ok(Math.abs(editor.getRaceResolvedCenterSteeringAngle(1, 27) / keyboard - 1.1) < 1e-9);
  assert.ok(Math.abs(editor.getRacePhysicalTireAngleForSteering(1, 27) / visibleKeyboard - 1.1) < 1e-9);
});

test('authoritative gamepad rack receives the extra angle while preserving contact limits and input magnitude', () => {
  const config = { handlingPreset: 'sport', maxSteerAngleRad: 0.52, massKg: 1575, frontWeightDistribution: 0.58 };
  const patch = { normalLoadN: 4480, suspensionNormalLoadN: 4480 };
  for (const speed of [5, 10, 15, 30, 50]) {
    const state = { groundSpeedMps: speed, contactPatches: { fl: patch, fr: patch } };
    const keyboard = resolvePhysicalCenterSteeringAngle({ steering: 1, steeringInputMode: 'keyboard' }, config, state);
    const gamepad = resolvePhysicalCenterSteeringAngle({ steering: 1, steeringInputMode: 'gamepad' }, config, state);
    if (speed <= 7.5) assert.equal(gamepad, keyboard);
    else assert.ok(gamepad > keyboard && gamepad <= keyboard * 1.100001);
    assert.equal(resolvePhysicalCenterSteeringAngle({ steering: -0.5, steeringInputMode: 'gamepad' }, config, state), -gamepad * 0.5);
    const airborne = resolvePhysicalCenterSteeringAngle({ steering: 1, steeringInputMode: 'gamepad' }, config, { groundSpeedMps: speed });
    assert.equal(airborne,gamepad);
    assert.ok(gamepad <= config.maxSteerAngleRad);
  }
});

test('steering limits vary continuously with speed, including former threshold speeds', () => {
  const config = { handlingPreset: 'sport', maxSteerAngleRad: .52, massKg: 1500, frontWeightDistribution: .5 };
  const patch = { normalLoadN: 4000, suspensionNormalLoadN: 4000 };
  for (const support of [1, .1]) {
    const contact = { ...patch, normalLoadN: patch.normalLoadN * support };
    const angle = speed => resolvePhysicalCenterSteeringAngle(
      { steering: 1, steeringInputMode: 'gamepad' }, config,
      { groundSpeedMps: speed, contactPatches: { fl: contact, fr: contact } });
    let previous = angle(0);
    for (let i = 1; i <= 8000; i++) {
      const next = angle(i / 100);
      assert.ok(Math.abs(next - previous) < .01, `rack step at ${i / 100} m/s`);
      previous = next;
    }
    for (const threshold of [1, 7.5, 15]) {
      assert.ok(Math.abs(angle(threshold + 1e-6) - angle(threshold - 1e-6)) < 1e-5);
    }
  }
  for (const grip of [.12, .5, .95]) {
    const angle = speed => assist.getUsableFullLockTireAngle(speed, { availableLateralG: grip });
    assert.ok(Math.abs(angle(7.500001) - angle(7.499999)) < 1e-5);
  }
});

test('touch/gamepad release stays player-directed under tire aligning torque',()=>{
 const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
 const contactPatches={fl:{normalLoadN:20000,lateralForceN:10000,selfAligningMomentNm:-500},fr:{normalLoadN:0,lateralForceN:0,selfAligningMomentNm:0}};
 for(const rackAngleRad of [-.3,0,.3])for(const activeTurnInput of [false,true]){
  assert.equal(assist.getSelfAligningSteeringCorrection({contactPatches,rackAngleRad,casterRad:.1,seconds:1/60,activeTurnInput,steeringInputMode:'gamepad'}),0);
 }
 // The normal input filter returns toward the player's centre without crossing it.
 for(const currentOutput of [-.7,.7]){
  const next=assist.stepControllerToRackInput({mode:'gamepad',intent:0,currentOutput,seconds:1/60});
  assert.equal(Math.sign(next),Math.sign(currentOutput));assert.ok(Math.abs(next)<Math.abs(currentOutput));
 }
});

test('player-commanded countersteering opens the rack during a slide without automatic steering',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52,massKg:1500,frontWeightDistribution:.58};
 const patch={normalLoadN:4300,suspensionNormalLoadN:4300};
 for(const mode of ['gamepad','keyboard'])for(const speed of [15,25,40])for(const sign of [-1,1]){
  const straight={groundSpeedMps:speed,bodyLongitudinalSpeedMps:speed,bodyLateralSpeedMps:0,contactPatches:{fl:patch,fr:patch}};
  const sliding={...straight,bodyLateralSpeedMps:sign*speed*Math.tan(16*Math.PI/180)};
  const steer=value=>resolvePhysicalCenterSteeringAngle({steering:value,steeringInputMode:mode},config,sliding);
  assert.equal(steer(0),0,'no automatic correction');
  assert.ok(Math.abs(steer(sign))>16*Math.PI/180,'can steer beyond the travel angle to arrest rotation');
  assert.ok(Math.abs(steer(sign))<.45,'moderate slides do not demand maximum physical lock');
  assert.ok(Math.abs(steer(sign*.5))<Math.abs(steer(sign)),'partial input remains below full input');
  assert.equal(steer(sign*.1),resolvePhysicalCenterSteeringAngle({steering:sign*.1,steeringInputMode:mode},config,straight),'small corrections keep their center gain');
  assert.equal(steer(-sign),resolvePhysicalCenterSteeringAngle({steering:-sign,steeringInputMode:mode},config,straight),'ordinary turn-in range stays bounded');
  assert.equal(Math.sign(steer(sign)),sign);
 }
});
test('countersteering range blends smoothly and retains contact and direct-wheel policies',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52,massKg:1500,frontWeightDistribution:.58};
 const patch={normalLoadN:4300,suspensionNormalLoadN:4300};
 const state={groundSpeedMps:30,bodyLongitudinalSpeedMps:30,contactPatches:{fl:patch,fr:patch}};
 let previous=0;
 for(let degrees=0;degrees<=20;degrees+=.1){
  const next=resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,{...state,bodyLateralSpeedMps:-30*Math.tan(degrees*Math.PI/180)});
  if(previous)assert.ok(Math.abs(Math.abs(next)-previous)<.015);previous=Math.abs(next);
 }
 const slide={...state,bodyLateralSpeedMps:-10};
 assert.equal(resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,{...slide,contactPatches:{}}),resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,slide),'wheel position remains available in the air');
 assert.equal(resolvePhysicalCenterSteeringAngle({steering:-.5,steeringInputMode:'simulation-wheel'},config,slide),-.26);
 assert.equal(resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,{...slide,bodyLongitudinalSpeedMps:-30}),resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,{...state,bodyLongitudinalSpeedMps:-30}),'do not interpret reversing as a forward drift');
});

test('a developing 8 degree slide gets bounded corrective steering',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52,massKg:1500,frontWeightDistribution:.58};
 const patch={normalLoadN:4300,suspensionNormalLoadN:4300};
 for(const sign of [-1,1]){
  const state={groundSpeedMps:30,bodyLongitudinalSpeedMps:30,bodyLateralSpeedMps:sign*30*Math.tan(8*Math.PI/180),contactPatches:{fl:patch,fr:patch}};
  const angle=Math.abs(resolvePhysicalCenterSteeringAngle({steering:sign,steeringInputMode:'gamepad'},config,state));
  assert.ok(angle>8*Math.PI/180&&angle<17*Math.PI/180);
  assert.equal(resolvePhysicalCenterSteeringAngle({steering:0,steeringInputMode:'gamepad'},config,state),0);
 }
});
test('deliberate stick reversal is quicker without amplifying the final input',()=>{
 const assist=new HandlingAssist(RACE_CONTROLLER_STEERING);
 const reversed=assist.stepControllerToRackInput({mode:'gamepad',intent:-1,currentOutput:.5,seconds:.05});
 const ordinary=assist.stepControllerToRackInput({mode:'gamepad',intent:1,currentOutput:0,seconds:.05});
 assert.ok((.5-reversed)/1.5>ordinary);
 assert.ok(reversed>=-1&&reversed<.5);
});

test('160 mph center precision coexists with bounded early yaw correction',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52,wheelbaseM:2.67};
 const straight={groundSpeedMps:160*.44704,bodyLongitudinalSpeedMps:160*.44704,bodyLateralSpeedMps:0,yawRateRadps:0};
 const turning={...straight,yawRateRadps:.8};
 const angle=(input,state)=>resolvePhysicalCenterSteeringAngle({steering:input,steeringInputMode:'gamepad'},config,state);
 assert.equal(angle(-.1,turning),angle(-.1,straight),'small highway corrections retain their gain');
 assert.ok(Math.abs(angle(-1,turning))>.10&&Math.abs(angle(-1,turning))<.22,'catch rotation without a sudden maximum-lock command');
 assert.equal(angle(1,turning),angle(1,straight),'no extra lock turning into the spin');
 assert.equal(angle(0,turning),0);
 assert.ok(Math.abs(angle(1,straight))<.11);
});
test('countersteering range decays smoothly on the physics clock and clears at rest',()=>{
 const config={},state={bodyLongitudinalSpeedMps:30,yawRateRadps:.8};
 updateCountersteeringRange(state,config,1/120);assert.equal(state.countersteerRangeLeft,1);
 state.yawRateRadps=0;
 updateCountersteeringRange(state,config,1/120);assert.ok(state.countersteerRangeLeft>.97);
 const split={...state},whole={...state};
 for(let i=0;i<120;i++)updateCountersteeringRange(split,config,1/120);
 updateCountersteeringRange(whole,config,1);
 assert.ok(Math.abs(split.countersteerRangeLeft-whole.countersteerRangeLeft)<1e-12);
 assert.ok(split.countersteerRangeLeft<.06);
 state.bodyLongitudinalSpeedMps=0;updateCountersteeringRange(state,config,1/120);
 assert.equal(state.countersteerRangeLeft,0);
});

test('airborne runner keeps commanded front-wheel angle and replays recovery range exactly',()=>{
 const runner=new VehicleDynamicsRunner({environmentProvider:()=>({grounded:false}),config:{handlingPreset:'sport',maxSteerAngleRad:.52,chassisHz:120,tireHz:120},initialState:{heightM:10,speedMps:30,velocity:{x:-15,y:0,z:30},bodyLateralSpeedMps:-15,yawRateRadps:.8,angularVelocityWorld:{x:0,y:.8,z:0}}});
 runner.addInputSample(0,{steering:-1,steeringInputMode:'gamepad'});
 runner.advance(1/120);
 assert.ok(runner.state.countersteerRangeLeft>.99);
 assert.ok(runner.state.steeringTelemetry.resolvedCenterRackAngleRad<-.51);
 for(const id of ['fl','fr']){
  assert.ok(Math.abs(runner.state.contactPatches[id].steeringAngleRad)>.4);
  assert.equal(runner.state.contactPatches[id].normalLoadN,0,'steering position adds no tire support');
 }
 const snapshot=runner.createSnapshot();
 const replay=new VehicleDynamicsRunner({config:snapshot.config,environmentProvider:()=>({grounded:false})});replay.restoreSnapshot(snapshot);
 for(let i=0;i<10;i++){runner.advance(1/120);replay.advance(1/120);}
 assert.equal(runner.state.countersteerRangeLeft,replay.state.countersteerRangeLeft);
 assert.deepEqual(runner.state.position,replay.state.position);
 assert.deepEqual(runner.state.steeringTelemetry,replay.state.steeringTelemetry);
});

test('cockpit wheel displays the physical rack, including worker render fallback',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 editor.playtestSession={vehicleDynamicsRunner:{state:{steeringTelemetry:{resolvedCenterRackAngleRad:-.45}}}};
 assert.equal(editor.getRaceVisibleSteeringWheelRotationRad(),editor.getRaceSteeringWheelRotationForTireAngle(.45));
 editor.playtestSession={vehicleRenderState:{wheels:{fl:{steeringAngleRad:-.4},fr:{steeringAngleRad:-.5}}}};
 assert.equal(editor.getRaceVisibleSteeringWheelRotationRad(),editor.getRaceSteeringWheelRotationForTireAngle(.45));
});

test('recovery permission does not retain excessive correction after a slide settles',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52};
 const pose={groundSpeedMps:45,bodyLongitudinalSpeedMps:45,countersteerRangeLeft:1};
 const angle=(u,s)=>Math.abs(resolvePhysicalCenterSteeringAngle({steering:-u,steeringInputMode:'gamepad'},config,s));
 const mild={...pose,bodyLateralSpeedMps:-1.5,yawRateRadps:.2};
 const severe={...pose,bodyLateralSpeedMps:-20,yawRateRadps:.8};
 const settled={...pose,bodyLateralSpeedMps:0,yawRateRadps:0};
 assert.ok(angle(.5,mild)<5*Math.PI/180,'half-stick mild correction stays modest');
 assert.ok(angle(.5,severe)>angle(.5,mild)*2,'large sideways momentum still gets useful angle');
 assert.ok(angle(.5,settled)<angle(.5,mild),'retained permission does not retain a large steering angle');
 assert.ok(angle(1,mild)<11*Math.PI/180,'even strong input cannot suddenly demand 30 degrees in a mild skid');
 assert.ok(angle(1,severe)>.51,'physical lock remains available when momentum requires it');
 for(let u=0,previous=0;u<=1;u+=.001){
  const current=angle(u,mild);assert.ok(current>=previous-1e-10);assert.ok(current-previous<.003);previous=current;
 }
});
test('sideways recovery remains available across the old 4 m/s forward cutoff',()=>{
 const config={handlingPreset:'sport',maxSteerAngleRad:.52};
 const angle=forward=>resolvePhysicalCenterSteeringAngle({steering:-1,steeringInputMode:'gamepad'},config,{
  groundSpeedMps:45,bodyLongitudinalSpeedMps:forward,bodyLateralSpeedMps:-44,yawRateRadps:.5
 });
 assert.ok(Math.abs(angle(3))>.51);
 assert.ok(Math.abs(angle(4.001)-angle(3.999))<.001);
 assert.ok(Math.abs(angle(0))>.3);
});

test('momentum mapping reduces opposite-spin overshoot in a fixed mild-slide maneuver',()=>{
 // Same car, surface and 200ms half-stick correction. Baseline reproduces
 // the prior range-only mapping, injected as a direct physical wheel angle.
 const maneuver=previousMapping=>{
  const runner=new VehicleDynamicsRunner({
   config:{handlingPreset:'sport',chassisHz:120,tireHz:120,maxSteerAngleRad:.52},
   initialState:{heightM:.55,velocity:{x:-1.5,y:0,z:45},speedMps:45,bodyLateralSpeedMps:-1.5,yawRateRadps:.2,angularVelocityWorld:{x:0,y:.2,z:0},countersteerRangeLeft:1},
   environmentProvider:()=>({surfaceHeightByWheel:{fl:0,fr:0,rl:0,rr:0}})
  });
  let oppositeYaw=0,maxAngle=0;
  for(let i=0;i<60;i++){
   const input=i<24?-.5:0;
   const speed=runner.state.groundSpeedMps;
   const base=.52/(1+(speed/23)**1.35);
   const t=Math.max(0,(Math.abs(input)-.2)/.8);
   const oldAngle=input*Math.min(.52,1.1*(base+(.52-base)*(runner.state.countersteerRangeLeft||0)*t*t*(3-2*t)));
   runner.addInputSample(i/120,previousMapping
    ? {steeringInputMode:'simulation-wheel',centerSteeringAngleRad:oldAngle}
    : {steeringInputMode:'gamepad',steering:input});
   runner.advance(1/120);
   oppositeYaw=Math.max(oppositeYaw,-runner.state.yawRateRadps);
   maxAngle=Math.max(maxAngle,Math.abs(runner.state.steeringTelemetry.resolvedCenterRackAngleRad));
  }
  return {oppositeYaw,maxAngle,finalYaw:Math.abs(runner.state.yawRateRadps)};
 };
 const previous=maneuver(true),momentum=maneuver(false);
 assert.ok(momentum.oppositeYaw<previous.oppositeYaw*.8,JSON.stringify({previous,momentum}));
 assert.ok(momentum.maxAngle<previous.maxAngle*.7);
 assert.ok(momentum.finalYaw<previous.finalYaw*.6);
});
