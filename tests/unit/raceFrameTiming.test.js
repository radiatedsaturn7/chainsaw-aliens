import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameTiming, getActiveRaceEditor } from '../../src/game/FrameTiming.js';
import { advanceRaceSimulationClock, RaceSimulationClock } from '../../src/racing/RaceFrameBudget.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const conserved = clock => close(clock.rawSeconds, clock.admittedSeconds + clock.debtSeconds + clock.discardedSeconds);
function fixture() {
  const session = { running: true };
  const timing = new FrameTiming(0);
  timing.inUpdate = true;
  const editor = { playtestSession: session, game: { frameTiming: timing } };
  timing.sample(0, session, true);
  advanceRaceSimulationClock(editor, 0);
  return { session, timing, editor };
}

test('a 95ms callback reaches the bounded race clock despite the legacy 33ms update cap', () => {
  const { session, timing, editor } = fixture();
  timing.sample(95, session, true);
  close(timing.updateSeconds, .033);
  close(timing.upstreamDiscardedSeconds, .062);
  close(advanceRaceSimulationClock(editor, timing.updateSeconds), 1 / 30);
  const clock = session.frameSimulationClock;
  close(clock.rawSeconds, .095);
  close(clock.debtSeconds, .095 - 1 / 30);
  close(clock.discardedSeconds, 0);
  conserved(clock);
  for (let i = 1; i <= 5; i++) {
    timing.sample(95 + i * 1000 / 60, session, true);
    assert.ok(advanceRaceSimulationClock(editor, timing.updateSeconds) <= 1 / 30);
    conserved(clock);
  }
  close(clock.debtSeconds, 0);
  close(clock.admittedSeconds, .095 + 5 / 60);
});

test('one callback cannot repay debt or admit raw time twice', () => {
  const { session, timing, editor } = fixture();
  timing.sample(95, session, true);
  advanceRaceSimulationClock(editor, timing.updateSeconds);
  const clock = session.frameSimulationClock;
  const before = { raw: clock.rawSeconds, admitted: clock.admittedSeconds, debt: clock.debtSeconds };
  assert.equal(advanceRaceSimulationClock(editor, timing.updateSeconds), 0);
  assert.equal(clock.rawSeconds, before.raw);
  assert.equal(clock.admittedSeconds, before.admitted);
  assert.equal(clock.debtSeconds, before.debt);
  assert.equal(session.frameTimeExclusionReason, 'already-consumed');
  conserved(clock);
});

test('visibility suspension is excluded and preexisting debt is explicitly discarded on resume', () => {
  const { session, timing, editor } = fixture();
  timing.sample(95, session, true);
  advanceRaceSimulationClock(editor, timing.updateSeconds);
  timing.invalidateRaceElapsed(); // visibilitychange is delivered even if rAF is suspended
  timing.sample(10095, session, true);
  assert.equal(advanceRaceSimulationClock(editor, timing.updateSeconds), 0);
  assert.equal(session.frameTimeExclusionReason, 'visibility-resume');
  close(session.frameExcludedSeconds, 10);
  close(session.frameSimulationClock.excludedSeconds, 10);
  close(session.frameSimulationClock.debtSeconds, 0);
  conserved(session.frameSimulationClock);
  timing.sample(10095 + 1000 / 60, session, true);
  close(advanceRaceSimulationClock(editor, timing.updateSeconds), 1 / 60);
});

test('pause, input blocking, and session changes cannot become race catch-up debt', () => {
  const { session, timing, editor } = fixture();
  timing.sample(1000, session, false);
  timing.sample(2000, session, true);
  assert.equal(advanceRaceSimulationClock(editor, timing.updateSeconds), 0);
  assert.equal(session.frameTimeExclusionReason, 'race-transition');
  timing.sample(3000, session, true, false, true);
  assert.equal(timing.raceExclusionReason, 'input-blocked');
  timing.sample(4000, session, true);
  assert.equal(advanceRaceSimulationClock(editor, timing.updateSeconds), 0);
  const next = editor.playtestSession = { running: true };
  timing.sample(5000, next, true);
  assert.equal(advanceRaceSimulationClock(editor, timing.updateSeconds), 0);
  conserved(next.frameSimulationClock);
});

test('long hitch admission stays bounded and direct simulation callers retain their dt contract', () => {
  const editor = { playtestSession: {} };
  close(advanceRaceSimulationClock(editor, 2), 1 / 30);
  const clock = editor.playtestSession.frameSimulationClock;
  close(clock.debtSeconds, 1 / 15);
  close(clock.discardedSeconds, 1.9);
  conserved(clock);
  clock.resetDebt();
  conserved(clock);
  assert.equal(new RaceSimulationClock().advance(NaN), 0);
  editor.game = { frameTiming: new FrameTiming(0) };
  editor.game.frameTiming.sample(16, editor.playtestSession, true);
  // A replay/test invoking simulation outside game.update must not consume an
  // old browser callback, even when the editor also has a live frame clock.
  close(advanceRaceSimulationClock(editor, 1 / 60), 1 / 60);
});

test('countdown and independent worker policies also conserve their admitted and discarded time', () => {
  const countdown = fixture();
  countdown.timing.sample(95, countdown.session, true);
  close(advanceRaceSimulationClock(countdown.editor, .033, { preStart: true }), .033);
  close(countdown.session.frameSimulationClock.discardedSeconds, .062);
  conserved(countdown.session.frameSimulationClock);
  const worker = fixture();
  worker.timing.sample(95, worker.session, true);
  close(advanceRaceSimulationClock(worker.editor, .033, { workerOwnsClock: true }), .095);
  assert.equal(worker.session.frameClockMode, 'worker-wall');
  conserved(worker.session.frameSimulationClock);
});

test('root callback timing selects the active car test-drive without advancing a passive preview', () => {
  const game = { state: 'race-editor', raceEditor: { playtestSession: { running: true } },
    carEditor: { playtestSession: { running: true } } };
  assert.equal(getActiveRaceEditor(game), game.raceEditor);
  game.state = 'car-editor';
  const editor = getActiveRaceEditor(game); editor.game = game;
  assert.equal(editor, game.carEditor);
  const timing = game.frameTiming = new FrameTiming(0); timing.inUpdate = true;
  timing.sample(0, editor.playtestSession, true); advanceRaceSimulationClock(editor, 0);
  timing.sample(95, editor.playtestSession, true); advanceRaceSimulationClock(editor, timing.updateSeconds);
  close(editor.playtestSession.frameRawSeconds, .095);
  conserved(editor.playtestSession.frameSimulationClock);
  editor.carEditorPreviewPlaytest = { session: editor.playtestSession };
  editor.playtestSession = null;
  timing.sample(111, editor.playtestSession, false);
  assert.equal(timing.raceSeconds, 0, 'passive preview is not a root race session');
  game.state = 'title'; assert.equal(getActiveRaceEditor(game), null);
});
