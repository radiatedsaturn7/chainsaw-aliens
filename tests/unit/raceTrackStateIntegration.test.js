import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRaceTrackState,
  createRaceTrackStateWeatherForcing,
  queueRaceTrackStateCrashEvents,
  queueRaceTrackStateTireEvents
} from '../../src/racing/trackState/TrackStateIntegration.js';
import {
  getRaceWheelContactState,
  getRaceWheelSurfaceState
} from '../../src/racing/RaceVehicleSurfaceContact.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

const surfaceModel = {
  sampleWorld(point = {}) {
    const x = Number(point.x || 0);
    return {
      x,
      z: Number(point.z || 0),
      elevation: x * -0.01,
      surfaceId: x < 0 ? 'dirt' : x < 2 ? 'asphalt' : 'gravel',
      baseSurfaceId: x < 0 ? 'dirt' : x < 2 ? 'asphalt' : 'gravel',
      materialId: x < 0 ? 'dirt' : x < 2 ? 'asphalt' : 'gravel',
      region: x < -2 ? 'terrain' : 'road',
      friction: x < 0 ? 0.72 : x < 2 ? 1 : 0.68,
      normal: { x: 0, y: 1, z: 0 }
    };
  }
};

const create = () => createRaceTrackState({
  seed: 7,
  surfaceModel,
  elevationScaleM: 12
});

function createLiveRacePlaytest(mode = 'race') {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.mode = mode;
  editor.startPlaytest('starter-rwd', {
    hydrateCars: false,
    carEditorPreview: true
  });
  return editor;
}

test('live Race, Level, and Car playtests advance Track State for every unpaused frame', () => {
  for (const mode of ['race', 'level', 'car']) {
    const editor = createLiveRacePlaytest(mode);
    for (let frame = 0; frame < 120; frame += 1) editor.updatePlaytest(1 / 60);
    assert.equal(editor.playtestSession.trackState.fixedStepMs, 100, mode);
    assert.equal(editor.playtestSession.trackState.stepIndex, 20, mode);
  }
});

test('live RaceEditor Track State checksums are independent of render frame rate', () => {
  const checksums = [30, 60, 90, 120, 144].map((fps) => {
    const editor = createLiveRacePlaytest();
    for (let frame = 0; frame < fps * 10; frame += 1) editor.updatePlaytest(1 / fps);
    assert.equal(editor.playtestSession.trackState.stepIndex, 100);
    return editor.playtestSession.trackState.getChecksum();
  });
  assert.equal(new Set(checksums).size, 1);
});

function runMovingTrackStateScenario(fps) {
  const state = createRaceTrackState({
    seed: 19,
    maxCatchUpSteps: 10,
    eventHistoryLimit: 10000,
    surfaceModel: {
      getSurfaceById(id) {
        return { grip: id === 'dirt' ? 0.72 : 1 };
      },
      sampleWorld(point = {}) {
        const dirt = Number(point.x || 0) < 4;
        return {
          region: 'road',
          segment: { surface: dirt ? 'dirt' : 'asphalt' },
          baseSurfaceId: dirt ? 'dirt' : 'asphalt',
          surfaceId: dirt ? 'dirt' : 'asphalt',
          materialId: dirt ? 'dirt' : 'asphalt',
          elevation: Number(point.x || 0) * -0.001,
          normal: { x: 0, y: 1, z: 0 }
        };
      }
    }
  });
  for (let x = 0; x < 50; x += 1) {
    for (let z = 0; z < 4; z += 1) {
      state.mutateCell({ x, z }, {
        standingWaterDepthMm: 2,
        looseMarbles: 0.3,
        dirt: x < 4 ? 0.8 : 0,
        mud: x < 4 ? 0.4 : 0
      });
    }
  }
  const wheels = ['fl', 'fr', 'rl', 'rr'];
  let time = 0;
  let hitchApplied = false;
  while (time < 2.5 - 1e-10) {
    let dt = Math.min(1 / fps, 2.5 - time);
    if (!hitchApplied && time >= 1.4 - 1e-8) {
      dt = Math.min(0.25, 2.5 - time);
      hitchApplied = true;
    }
    wheels.forEach((wheelId, index) => {
      const z = index + 0.2;
      state.queueTireContact({
        vehicleId: 'moving-car',
        wheelId,
        previousPosition: { x: time * 18 + 0.2, z },
        position: { x: (time + dt) * 18 + 0.2, z },
        contactDurationSeconds: dt,
        contactScale: 1,
        normalLoadN: 3600 + index * 100,
        speedMps: 18,
        slipEnergy: [1.1, 0.9, 0.7, 0.1][index],
        brakeLock: index === 1 ? 0.95 : 0,
        wheelSpin: index === 0 ? 1.2 : 0,
        compoundId: 'tarmac',
        tireTemperatureF: 95 + index * 3,
        directionX: 1,
        directionZ: index === 2 ? 0.4 : 0
      });
    });
    state.advance(dt, time < 1 - 1e-8
      ? { type: 'clear', ambientTemperatureC: 22, sunIntensity: 0.8 }
      : {
          type: 'rain',
          precipitationRateMmPerS: 0.5,
          ambientTemperatureC: 16,
          humidity: 0.9
        });
    time += dt;
  }
  const sum = (field) => [...state.cells.values()]
    .reduce((total, cell) => total + Number(cell[field] || 0), 0);
  const replay = state.createReplayRecord();
  return {
    checksum: state.getChecksum(),
    acceptedEventCount: state.eventHistory.length,
    nextSequence: state.nextSequence,
    rubberTotal: sum('rubber'),
    standingWaterTotal: sum('standingWaterDepthMm'),
    dirtTotal: sum('dirt'),
    mudTotal: sum('mud'),
    cells: state.createSnapshot().cells,
    replayFinalChecksum: replay.finalChecksum,
    pendingAggregateCount: state.contactAccumulator.size,
    pendingEventCount: state.pendingEvents.length,
    weatherRecordCount: state.weatherTimeline.size
  };
}

test('moving tire mutation is fixed-step identical across supported render frame rates', () => {
  const results = [30, 60, 90, 120, 144].map(runMovingTrackStateScenario);
  results.slice(1).forEach((result) => assert.deepEqual(result, results[0]));
  assert.equal(results[0].acceptedEventCount, 260);
  assert.equal(results[0].nextSequence, 261);
  assert.ok(results[0].rubberTotal > 0);
  assert.ok(results[0].standingWaterTotal > 0);
  assert.ok(results[0].dirtTotal > 0);
  assert.ok(results[0].mudTotal > 0);
  assert.equal(results[0].pendingAggregateCount, 0);
  assert.equal(results[0].pendingEventCount, 0);
  assert.equal(results[0].weatherRecordCount, 2);
  assert.equal(results[0].replayFinalChecksum, results[0].checksum);
});

test('four physical tires consume four distinct exact local Track State cells', () => {
  const state = create();
  const positions = {
    fl: { x: -0.2, z: 0.2 },
    fr: { x: 0.2, z: 0.2 },
    rl: { x: 1.2, z: 0.2 },
    rr: { x: 2.2, z: 0.2 }
  };
  const samples = Object.fromEntries(Object.entries(positions).map(([wheelId, point]) => [
    wheelId,
    state.sample(point)
  ]));
  assert.deepEqual(
    Object.fromEntries(Object.entries(samples).map(([wheelId, sample]) => [wheelId, sample.cellKey])),
    { fl: '-1,0', fr: '0,0', rl: '1,0', rr: '2,0' }
  );
  assert.equal(new Set(Object.values(samples).map((sample) => sample.effectiveGrip)).size >= 3, true);
});

test('cell initialization keeps authored road and terrain materials independent of global weather conversion', () => {
  const rainySampler = {
    getSurfaceById(id) {
      return {
        asphalt: { grip: 1 },
        dirt: { grip: 0.72 },
        'wet-asphalt': { grip: 0.72 }
      }[id] || { grip: 1 };
    },
    sampleWorld(point = {}) {
      if (Number(point.x || 0) < 0) {
        return {
          region: 'terrain',
          segment: { surface: 'asphalt' },
          surfaceId: 'wet-asphalt',
          materialId: 'grass',
          elevation: 0,
          normal: { x: 0, y: 1, z: 0 }
        };
      }
      return {
        region: 'road',
        segment: { surface: 'asphalt' },
        surfaceId: 'wet-asphalt',
        materialId: 'wet-asphalt',
        elevation: 0,
        normal: { x: 0, y: 1, z: 0 }
      };
    }
  };
  const state = createRaceTrackState({ seed: 2, surfaceModel: rainySampler });
  const terrain = state.sample({ x: -0.2, z: 0.2 }).cell;
  const road = state.sample({ x: 0.2, z: 0.2 }).cell;
  assert.equal(terrain.baseSurfaceId, 'dirt');
  assert.equal(terrain.materialId, 'grass');
  assert.equal(terrain.baseGrip, 0.72);
  assert.equal(road.baseSurfaceId, 'asphalt');
  assert.equal(road.materialId, 'asphalt');
  assert.equal(road.baseGrip, 1);
});

test('swept grounded tire contacts modify every crossed cell and airborne tires modify none', () => {
  const state = create();
  const common = {
    vehicleId: 'player',
    normalLoads: { fl: 3800, fr: 3800, rl: 3300, rr: 3300 },
    tireSlipByWheel: { fl: 0.8, fr: 0, rl: 0, rr: 0 },
    wheelContactScaleByWheel: { fl: 1, fr: 0, rl: 0, rr: 0 },
    wheelSurfaceState: {
      positions: {
        fl: { x: 3.8, z: 0.2 },
        fr: { x: 3.8, z: 1.2 },
        rl: { x: 3.8, z: 2.2 },
        rr: { x: 3.8, z: 3.2 }
      }
    },
    previousPositions: {
      fl: { x: 0.2, z: 0.2 },
      fr: { x: 0.2, z: 1.2 },
      rl: { x: 0.2, z: 2.2 },
      rr: { x: 0.2, z: 3.2 }
    },
    speedMps: 25,
    tireCompoundByWheel: { fl: 'tarmac', fr: 'tarmac', rl: 'tarmac', rr: 'tarmac' }
  };
  const queued = queueRaceTrackStateTireEvents(state, common);
  assert.equal(queued.filter((event) => event.wheelId === 'fl').length, 4);
  assert.equal(queued.some((event) => event.wheelId === 'fr'), false);
  state.advance(0.1, { type: 'clear', ambientTemperatureC: 22 });
  ['0,0', '1,0', '2,0', '3,0'].forEach((key) => assert.ok(state.cells.get(key).rubber > 0, key));
  assert.equal(Number(state.cells.get('0,1')?.rubber || 0), 0);
});

test('airborne wheels do not allocate or read dynamic Track State cells', () => {
  const state = create();
  let samples = 0;
  const trackState = {
    sample(point) {
      samples += 1;
      return state.sample(point);
    }
  };
  const result = getRaceWheelSurfaceState({
    wheelIds: ['fl', 'fr'],
    positions: {
      fl: { x: 0.2, z: 0.2 },
      fr: { x: 1.2, z: 0.2 }
    },
    groundedByWheel: { fl: true, fr: false },
    trackState,
    surfaceModel,
    adapter: {
      getSurfaceById: (id) => ({ id, grip: 1 }),
      getWheelGripForSurface: () => 1
    }
  });
  assert.equal(samples, 1);
  assert.ok(result.trackStateByWheel.fl);
  assert.equal(result.trackStateByWheel.fr, null);
  assert.equal(state.cells.has('1,0'), false);

  getRaceWheelContactState({
    wheelIds: ['fr'],
    positions: { fr: { x: 1.2, z: 0.2 } },
    groundedByWheel: { fr: false },
    trackState,
    surfaceModel
  });
  assert.equal(samples, 1);
  assert.equal(state.cells.has('1,0'), false);
});

test('traffic lays an emergent rubbered/swept line, carries mud, and displaces water', () => {
  const state = create();
  for (let x = 0; x < 5; x += 1) {
    state.mutateCell({ x, z: 0 }, {
      standingWaterDepthMm: 3,
      looseMarbles: 0.4,
      dirt: x === 0 ? 0.8 : 0,
      mud: x === 0 ? 0.5 : 0
    });
    state.sample({ x, z: 1 });
  }
  for (let lap = 0; lap < 20; lap += 1) {
    queueRaceTrackStateTireEvents(state, {
      vehicleId: 'player',
      normalLoads: { fl: 3900 },
      tireSlipByWheel: { fl: 0.55 },
      wheelContactScaleByWheel: { fl: 1 },
      wheelSurfaceState: { positions: { fl: { x: 4.8, z: 0.2 } } },
      previousPositions: { fl: { x: 0.2, z: 0.2 } },
      speedMps: 22,
      tireCompoundByWheel: { fl: 'tarmac' }
    });
    state.advance(0.1, { type: 'clear', ambientTemperatureC: 22, sunIntensity: 0.7 });
  }
  const line = state.sample({ x: 2.2, z: 0.2 });
  const unused = state.sample({ x: 2.2, z: 1.2 });
  assert.ok(line.cell.rubber > unused.cell.rubber * 1.2);
  assert.ok(line.cell.looseMarbles < 0.4);
  assert.ok(line.cell.standingWaterDepthMm < 3);
  assert.ok(state.sample({ x: 1.2, z: 0.2 }).cell.dirt + state.sample({ x: 1.2, z: 0.2 }).cell.mud > 0);
});

test('crash records leave persistent debris and oil at the physical location', () => {
  const state = create();
  const session = {
    worldX: 6.3,
    worldZ: 4.2,
    damageLog: [
      { sequence: 1, part: 'panels', amount: 24, source: 'scenery', distance: 50, worldX: 6.3, worldZ: 4.2 },
      { sequence: 2, part: 'engine', amount: 40, source: 'landing', distance: 51, worldX: 6.3, worldZ: 4.2 }
    ],
    trackStateDamageLogCursor: 0
  };
  const events = queueRaceTrackStateCrashEvents(state, session);
  assert.equal(events.length, 2);
  state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
  const cell = state.sample({ x: 6.3, z: 4.2 }).cell;
  assert.ok(cell.debris > 0);
  assert.ok(cell.oil > 0);
  assert.equal(queueRaceTrackStateCrashEvents(state, session).length, 0);

  session.worldX = 99;
  session.worldZ = 99;
  session.damageLog = [
    { sequence: 2, part: 'engine', amount: 40, source: 'landing', worldX: 6.3, worldZ: 4.2 },
    { sequence: 13, part: 'panels', amount: 20, source: 'scenery', worldX: 8.4, worldZ: 5.6 }
  ];
  assert.equal(queueRaceTrackStateCrashEvents(state, session).length, 1);
  state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
  assert.ok(state.sample({ x: 8.4, z: 5.6 }).cell.debris > 0);
  assert.equal(Number(state.sample({ x: 99, z: 99 }).cell.debris || 0), 0);
});

test('weather forcing derives deterministic ambient, precipitation, sun, wind, and humidity', () => {
  assert.deepEqual(
    createRaceTrackStateWeatherForcing({
      weatherState: { id: 'snow', effectiveIntensity: 0.5 },
      race: { timeOfDay: 'night' }
    }),
    {
      type: 'snow',
      precipitationRateMmPerS: 0.3,
      ambientTemperatureC: -4,
      sunIntensity: 0,
      windIntensity: 0.35,
      windDirectionRad: 0,
      humidity: 0.82
    }
  );
});

test('race ghost snapshot data restores the same Track State checksum', () => {
  const state = create();
  state.mutateCell({ x: 2, z: 3 }, { rubber: 0.8, oil: 0.1 });
  state.advance(0.1, { type: 'clear', ambientTemperatureC: 20 });
  const replay = state.createReplayRecord();
  const restored = createRaceTrackState({
    seed: 7,
    surfaceModel,
    elevationScaleM: 12,
    snapshot: replay.initialSnapshot
  });
  assert.equal(restored.getChecksum(), replay.initialChecksum);
});

test('completed race ghosts embed the Track State replay contract', () => {
  const editor = Object.create(RaceEditor.prototype);
  const replay = {
    version: 1,
    initialChecksum: 'start',
    finalChecksum: 'finish',
    events: []
  };
  editor.bestRaceGhosts = {};
  editor.playtestSession = {
    raceId: 'race',
    carId: 'car',
    elapsedMs: 1234,
    ghostRecording: [{ elapsedMs: 0, distance: 0 }],
    trackState: {
      createReplayRecord: () => replay
    }
  };
  Object.defineProperty(editor, 'selectedRace', {
    configurable: true,
    value: { id: 'race' }
  });
  editor.completeRaceGhost({ finished: true });
  assert.equal(editor.bestRaceGhosts.race.trackState, replay);
});
