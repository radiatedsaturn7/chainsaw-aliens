import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceFrameBudget, RaceSimulationClock } from '../../src/racing/RaceFrameBudget.js';

test('optional work respects reserved rendering time and resumes without restarting', () => {
  let now = 0, steps = 0;
  const budget = new RaceFrameBudget({ now: () => now, frameMs: 16, reserveMs: 8 });
  budget.begin();
  budget.enqueue('terrain', () => { steps++; now += 1; return steps === 2; });
  now = 9; budget.finish(); assert.equal(steps, 0);
  budget.begin(); budget.finish(); assert.equal(steps, 1);
  budget.begin(); budget.finish(); assert.equal(steps, 2);
  assert.equal(budget.jobs.size, 0);
});
test('bounded jobs expire under starvation without forcing work into a full frame', () => {
  let now = 0;
  const budget = new RaceFrameBudget({ now: () => now, maxJobs: 1 });
  budget.begin();
  budget.enqueue('old', () => assert.fail(), { maxAgeFrames: 1 });
  assert.equal(budget.enqueue('overflow', () => {}), false);
  now += 20; budget.finish();
  budget.begin(); now += 20; budget.finish();
  budget.begin(); budget.finish();
  assert.equal(budget.stats.expired, 1);
});
test('scheduler runs priority order and reports uninterruptible overruns', () => {
  let now = 0; const order = [];
  const budget = new RaceFrameBudget({ now: () => now }); budget.begin();
  budget.enqueue('low', () => order.push('low'));
  budget.enqueue('high', () => { order.push('high'); now += 20; }, { priority: 2 });
  budget.finish(); assert.deepEqual(order, ['high']); assert.equal(budget.stats.overruns, 1);
});
test('clock preserves normal time and bounds long-hitch catch-up across the whole race', () => {
  const clock = new RaceSimulationClock();
  for (let i = 0; i < 120; i++) assert.equal(clock.advance(1 / 120), 1 / 120);
  assert.equal(clock.discardedSeconds, 0);
  assert.equal(clock.advance(2), 1 / 30);
  assert.ok(clock.debtSeconds <= 1 / 15);
  for (let i = 0; i < 20; i++) assert.ok(clock.advance(1 / 60) <= 1 / 30);
  assert.equal(clock.debtSeconds, 0);
  assert.ok(Math.abs(clock.admittedSeconds + clock.discardedSeconds - (3 + 20 / 60)) < 1e-10);
  assert.equal(clock.advance(NaN), 0);
});

test('preparing surfaces ahead never changes authoritative cells, events or weather', async () => {
  const { TrackState } = await import('../../src/racing/trackState/TrackState.js');
  const create = () => new TrackState({ sampleBaseSurface: ({ x }) => ({
    baseSurfaceId: x < 10 ? 'asphalt' : 'dirt', surfaceTemperatureC: 20 }) });
  const warm = create(), cold = create();
  for (let i = 0; i < 500; i++) warm.prepareBaseSurface({ x: i * 3, z: 1 });
  assert.equal(warm.cells.size, 0);
  assert.ok(warm.preparedBaseSurfaces.size <= 256);
  assert.equal(warm.getChecksum(), cold.getChecksum());
  for (let i = 0; i < 40; i++) {
    const point = { x: i, z: 1 };
    warm.prepareBaseSurface(point);
    for (const state of [warm, cold]) state.advance(.1, { type: 'rain', precipitationRateMmPerS: .2 });
    assert.deepEqual(warm.sample(point), cold.sample(point));
  }
  assert.equal(warm.getChecksum(), cold.getChecksum());
});

test('a failed optional job is diagnosed without aborting essential simulation', () => {
  const budget = new RaceFrameBudget({ now: () => 0 });
  budget.begin(); budget.enqueue('bad-art', () => { throw Error('bad optional resource'); });
  assert.doesNotThrow(() => budget.finish());
  assert.equal(budget.stats.failed, 1);
  assert.match(budget.stats.lastError, /bad optional/);
  assert.equal(budget.jobs.size, 0);
});

test('live race bounds physics catch-up, advances one race clock and clears debt on pause', async () => {
  const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');
  const editor = new RaceEditor({}, { mode: 'race' });
  editor.selectedRace.scenery = []; editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const session = editor.playtestSession;
  Object.assign(session, { countdownRemainingMs: 0, startupFramePending: false,
    preparing: false, running: true, launchLockMs: 0 });
  if (session.raceIntro) session.raceIntro.active = false;
  editor.updatePlaytest(1 / 60);
  const runner = session.vehicleDynamicsRunner;
  assert.ok(runner);
  const before = runner.stepIndex, elapsed = session.elapsedMs;
  editor.updatePlaytest(.5);
  assert.ok(runner.stepIndex - before <= Math.ceil(runner.config.chassisHz / 30));
  assert.ok(Math.abs(session.elapsedMs - elapsed - 1000 / 30) < 1e-6);
  assert.ok(session.frameSimulationClock.discardedSeconds > .3);
  assert.ok(session.frameBudget.stats.frames >= 2);
  const pausedAt = runner.stepIndex;
  editor.raceInput.paused = true; editor.updatePlaytest(10);
  assert.equal(runner.stepIndex, pausedAt);
  assert.equal(session.frameSimulationClock.debtSeconds, 0);
  editor.raceInput.paused = false; editor.updatePlaytest(1 / 60);
  assert.ok(runner.stepIndex - pausedAt <= Math.ceil(runner.config.chassisHz / 60));
});

test('live race receives uncapped callback time but advances player and race by the same bounded delta', async () => {
  const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');
  const { FrameTiming } = await import('../../src/game/FrameTiming.js');
  const game = {};
  const editor = new RaceEditor(game, { mode: 'race' });
  editor.selectedRace.scenery = []; editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const session = editor.playtestSession;
  Object.assign(session, { countdownRemainingMs: 0, startupFramePending: false,
    preparing: false, running: true, launchLockMs: 0 });
  if (session.raceIntro) session.raceIntro.active = false;
  const timing = game.frameTiming = new FrameTiming(0);
  timing.inUpdate = true;
  timing.sample(0, session, true); editor.updatePlaytest(0);
  timing.sample(1000 / 60, session, true); editor.updatePlaytest(timing.updateSeconds);
  const runner = session.vehicleDynamicsRunner, before = runner.stepIndex, elapsed = session.elapsedMs;
  timing.sample(1000 / 60 + 95, session, true); editor.updatePlaytest(timing.updateSeconds);
  assert.equal(timing.updateSeconds, .033);
  assert.ok(Math.abs(session.frameRawSeconds - .095) < 1e-10);
  assert.ok(Math.abs(session.elapsedMs - elapsed - 1000 / 30) < 1e-6);
  assert.ok(runner.stepIndex - before <= Math.ceil(runner.config.chassisHz / 30));
  const clock = session.frameSimulationClock;
  assert.ok(clock.debtSeconds > .06 && clock.debtSeconds < 1 / 15);
  assert.ok(Math.abs(clock.rawSeconds - clock.admittedSeconds - clock.debtSeconds - clock.discardedSeconds) < 1e-10);
});

test('countdown without a music clock uses the presentation delta, including a long callback', async () => {
  const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');
  const { FrameTiming } = await import('../../src/game/FrameTiming.js');
  const game = {};
  const editor = new RaceEditor(game, { mode: 'race' });
  editor.selectedRace.scenery = []; editor.selectedRace.hazards = [];
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const session = editor.playtestSession;
  Object.assign(session, { countdownRemainingMs: 4000, startupFramePending: false,
    preparing: false, running: true, launchLockMs: 0, raceMusicPending: false,
    raceMusicCountdownClock: false });
  if (session.raceIntro) session.raceIntro.active = false;
  assert.doesNotThrow(() => editor.updatePlaytest(1 / 60));
  assert.ok(Math.abs(session.countdownRemainingMs - (4000 - 1000 / 60)) < 1e-8);
  assert.equal(session.elapsedMs, 0);
  const timing = game.frameTiming = new FrameTiming(0);
  timing.inUpdate = true;
  timing.sample(0, session, true); editor.updatePlaytest(0);
  const remaining = session.countdownRemainingMs;
  timing.sample(95, session, true);
  assert.doesNotThrow(() => editor.updatePlaytest(timing.updateSeconds));
  assert.equal(session.countdownRemainingMs, remaining - 33);
  assert.equal(session.frameClockMode, 'countdown');
  assert.equal(session.elapsedMs, 0);
});

test('active weather insertion retains canonical numeric order without parsing keys', async () => {
 const { TrackState } = await import('../../src/racing/trackState/TrackState.js');
 const { compareTrackStateCellKeys } = await import('../../src/racing/trackState/TrackStateMath.js');
 const state = new TrackState();
 const keys = [];
 for (let i = 0; i < 400; i++) {
   const x = (i * 173) % 419 - 200, z = i % 13 - 6;
   const key = `${x},${z}`;
   state.cells.set(key, { x, z }); keys.push(key);
   state.insertEnvironmentActiveKey(key);
 }
 assert.deepEqual(state.environmentActiveKeys, [...new Set(keys)].sort(compareTrackStateCellKeys));
 for (const key of keys) state.insertEnvironmentActiveKey(key);
 assert.equal(state.environmentActiveKeys.length, new Set(keys).size);
});

test('ahead preparation is resumable, bounded and follows the road rather than a straight ray', async () => {
 const { prepareRaceAheadSlice } = await import('../../src/racing/RaceAheadPreparation.js');
 const samples = [];
 const track = { cellSizeM: 1, prepareBaseSurface: p => samples.push(p) };
 const editor = { playtestSession: { trackState: track, distance: 0, speedMps: 20 },
   getRaceWorldPoseAtDistance: d => ({ x: 20 * Math.sin(d / 20), z: d, segment: {} }),
   getRaceRoadHalfWidthWorld: () => 3 };
 const cursor = {};
 assert.equal(prepareRaceAheadSlice(editor, cursor, 8), false);
 assert.equal(samples.length, 8);
 for (let i = 0; i < 11; i++) prepareRaceAheadSlice(editor, cursor, 8);
 assert.equal(samples.length, 96);
 assert.equal(prepareRaceAheadSlice(editor, cursor), true);
 assert.equal(samples.length, 96);
 assert.ok(samples.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)));
 editor.playtestSession.distance = 16;
 assert.equal(prepareRaceAheadSlice(editor, cursor, 8), false);
 assert.equal(cursor.index, 8);
});

test('loading preparation completes in bounded slices and cannot block loading on optional failure', async () => {
 const { prepareRaceLoadingSurfaceSlice } = await import('../../src/racing/RaceAheadPreparation.js');
 let samples = 0;
 const editor = { playtestSession: { distance: 0, trackState: { cellSizeM: 1,
   prepareBaseSurface: () => samples++ } }, withRaceGeometryReadCache: fn => fn(),
   getRaceWorldPoseAtDistance: d => ({ x: 0, z: d }), getRaceRoadHalfWidthWorld: () => 3 };
 const warm = {};
 for (let i = 0; i < 12; i++) {
   assert.equal(prepareRaceLoadingSurfaceSlice(editor, warm), i === 11);
   assert.equal(samples, (i + 1) * 8);
 }
 editor.playtestSession.aheadPreparationCursor = {};
 editor.playtestSession.trackState.prepareBaseSurface = () => { throw Error('invalid optional sample'); };
 const failed = {};
 assert.equal(prepareRaceLoadingSurfaceSlice(editor, failed), true);
 assert.match(failed.surfacePreparationError, /invalid optional sample/);
});

test('frame coordinator waits for outer recovery/items before admitting optional jobs', async () => {
 const { runBudgetedRaceFrame } = await import('../../src/racing/RaceFrameBudget.js');
 let now = 0, samples = 0;
 const budget = new RaceFrameBudget({ now: () => now });
 const editor = { raceInput: {}, deferRaceFrameBudgetFinish: true,
   playtestSession: { running: true, frameBudget: budget, distance: 0,
     trackState: { cellSizeM: 1, prepareBaseSurface: () => samples++ } },
   getRaceWorldPoseAtDistance: d => ({x: 0, z: d}) };
 runBudgetedRaceFrame(editor, () => { now += 2; editor.playtestSession.frameAdmittedSeconds = 1/60; });
 assert.equal(samples, 0);
 now += 10; // essential recovery work outside the physics orchestration call
 budget.finish();
 assert.equal(samples, 0);
 assert.equal(budget.stats.essentialMs, 12);
 assert.equal(budget.stats.deferred, 1);
 budget.finish(); assert.equal(budget.stats.deferred, 1, 'only finish a frame once');
});
