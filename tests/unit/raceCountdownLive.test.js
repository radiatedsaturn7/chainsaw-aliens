import assert from 'node:assert/strict';
import test from 'node:test';

import RaceEditor from '../../src/ui/RaceEditor.js';

function createCountdownEditor({
  weather = 'clear',
  aiCount = 0,
  rollingStart = false,
  rollingStartSpeedMps = 13.4
} = {}) {
  const audioUpdates = [];
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.selectedRace.hazards = [];
  editor.selectedRace.scenery = [];
  editor.selectedRace.weather = weather;
  editor.selectedRace.weatherIntensity = weather === 'clear' ? 0 : 1;
  editor.selectedRace.road.segments = [{
    length: 1200,
    curve: 0,
    elevation: 0,
    surface: 'asphalt',
    turn: 'smooth',
    hazardIds: []
  }];
  Object.assign(editor.getRaceStartSettings(), {
    countdown: true,
    rollingStart,
    rollingStartSpeedMps
  });
  editor.setRaceAiCount(aiCount);
  editor.updateRaceEngineAudio = (context) => audioUpdates.push(context);
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  editor.playtestSession.startupFramePending = false;
  return { editor, audioUpdates };
}

function runFrames(editor, frames, dt = 1 / 60) {
  for (let frame = 0; frame < frames; frame += 1) {
    editor.updatePlaytest(dt);
  }
}

test('standing countdown free-revs to the limiter without moving or mutating the race', () => {
  const { editor, audioUpdates } = createCountdownEditor({ weather: 'snow', aiCount: 1 });
  const session = editor.playtestSession;
  const tuning = editor.getRaceCarTuning(editor.getRaceSessionCar(session));
  session.countdownRemainingMs = 10000;
  const start = {
    x: session.worldX,
    z: session.worldZ,
    distance: session.distance,
    projectedDistance: session.projectedDistance,
    aiDistance: session.aiRuntime[0].distance,
    trackStep: session.trackState?.stepIndex || 0,
    trackCellCount: session.trackState?.cells?.size || 0
  };
  editor.raceInput.keyboardThrottle = true;

  const heldRpm = [];
  for (let frame = 0; frame < 180; frame += 1) {
    editor.updatePlaytest(1 / 60);
    heldRpm.push(session.engineRpm);
  }

  assert.equal(session.elapsedMs, 0);
  assert.equal(session.sceneElapsedMs > 2900, true);
  assert.equal(Math.max(...heldRpm) >= tuning.revLimitRpm - 150, true);
  assert.equal(Math.max(...heldRpm) > tuning.launchRpm + 500, true);
  const limiterRpm = heldRpm.slice(-90);
  assert.equal(
    Math.max(...limiterRpm) - Math.min(...limiterRpm)
      >= Math.max(45, tuning.revLimiterDropRpm * 0.18),
    true
  );
  assert.equal(audioUpdates.some((update) => Number(update.throttle || 0) > 0.5), true);
  const stagedRpm = Math.max(...limiterRpm);
  editor.raceInput.keyboardThrottle = false;
  runFrames(editor, 45);
  assert.equal(session.engineRpm < stagedRpm - 300, true);
  assert.equal(session.speedMps, 0);
  assert.equal(session.worldX, start.x);
  assert.equal(session.worldZ, start.z);
  assert.equal(session.distance, start.distance);
  assert.equal(session.projectedDistance, start.projectedDistance);
  assert.equal(session.aiRuntime[0].distance, start.aiDistance);
  assert.equal(session.aiRuntime[0].speedMps, 0);
  assert.equal(session.trackState?.stepIndex || 0, start.trackStep);
  assert.equal(session.trackState?.cells?.size || 0, start.trackCellCount);
  assert.equal(session.tireTrackSegments.length, 0);
  assert.equal(session.ghostRecording.length, 0);
});

test('countdown scene clock animates precipitation but explicit pause freezes it', () => {
  const { editor } = createCountdownEditor({ weather: 'snow' });
  const session = editor.playtestSession;
  const weatherState = editor.getRaceWeatherState();
  const particles = editor.ensureRaceSnowParticleField({
    session,
    weatherState
  });
  const beforeHeight = particles[4].heightM;

  editor.updatePlaytest(0.1);
  const animatedHeight = session.snowParticles3d[4].heightM;

  assert.equal(session.elapsedMs, 0);
  assert.equal(session.sceneElapsedMs, 100);
  assert.equal(animatedHeight < beforeHeight, true);
  assert.equal(editor.getRaceWeatherState().snowDepthInches, 0);

  const countdownBeforePause = session.countdownRemainingMs;
  editor.raceInput.paused = true;
  editor.updatePlaytest(0.5);

  assert.equal(session.sceneElapsedMs, 100);
  assert.equal(session.countdownRemainingMs, countdownBeforePause);
  assert.equal(session.snowParticles3d[4].heightM, animatedHeight);
});

test('analog countdown throttle free-revs proportionally below redline', () => {
  const { editor } = createCountdownEditor();
  const session = editor.playtestSession;
  const tuning = editor.getRaceCarTuning(editor.getRaceSessionCar(session));
  session.countdownRemainingMs = 10000;
  editor.game.input = {
    getGamepadAxes: () => ({
      leftX: 0,
      rightX: 0,
      rightTrigger: 0.45,
      leftTrigger: 0
    })
  };

  runFrames(editor, 180);

  const normalizedRpm = (session.engineRpm - tuning.idleRpm)
    / Math.max(1, tuning.revLimitRpm - tuning.idleRpm);
  assert.equal(normalizedRpm > 0.32, true);
  assert.equal(normalizedRpm < 0.58, true);
  assert.equal(session.speedMps, 0);
  assert.equal(session.elapsedMs, 0);
});

test('rolling countdown holds the authored formation speed without starting race timing', () => {
  const rollingSpeedMps = 12;
  const { editor } = createCountdownEditor({
    aiCount: 1,
    rollingStart: true,
    rollingStartSpeedMps: rollingSpeedMps
  });
  const session = editor.playtestSession;
  const playerStartDistance = session.distance;
  const aiStartDistance = session.aiRuntime[0].distance;
  const checkpointAtStart = session.checkpointIndex;
  editor.raceInput.keyboardThrottle = true;

  editor.updatePlaytest(1);

  assert.equal(session.elapsedMs, 0);
  assert.equal(session.speedMps, rollingSpeedMps);
  assert.equal(session.distance > playerStartDistance + rollingSpeedMps * 0.9, true);
  assert.equal(session.aiRuntime[0].speedMps, rollingSpeedMps);
  assert.equal(session.aiRuntime[0].distance > aiStartDistance + rollingSpeedMps * 0.9, true);
  assert.equal(session.aiRuntime[0].currentLapMs, 0);
  assert.equal(session.checkpointIndex, checkpointAtStart);
  const tuning = editor.getRaceCarTuning(editor.getRaceSessionCar(session));
  assert.equal(session.engineRpm > tuning.launchRpm + 500, true);
});

test('drivetrain and race clock engage immediately after the countdown reaches GO', () => {
  const { editor } = createCountdownEditor();
  const session = editor.playtestSession;
  editor.raceInput.keyboardThrottle = true;

  runFrames(editor, 250);
  const distanceAtGo = session.distance;
  runFrames(editor, 30);

  assert.equal(session.countdownRemainingMs, 0);
  assert.equal(session.elapsedMs > 0, true);
  assert.equal(session.speedMps > 0.2, true);
  assert.equal(session.distance > distanceAtGo, true);
});
