import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getEnteredRaceTriggers,
  normalizeRaceTrigger,
  normalizeRaceTriggers
} from '../../src/racing/raceTriggers.js';
import { createDefaultRace } from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('new races persist race start options and trigger storage', () => {
  const race = createDefaultRace();
  assert.deepEqual(race.raceStart, {
    musicTrackId: '',
    countdown: true,
    rollingStart: false,
    rollingStartSpeedMps: 13.4
  });
  assert.deepEqual(race.triggers, []);
});

test('race triggers normalize effect parameters and detect player entry', () => {
  const trigger = normalizeRaceTrigger({
    id: 'explosion',
    x: 10,
    z: 20,
    radiusM: 5,
    action: {
      type: 'play-animation',
      params: { artRef: 'explosion', durationMs: 900 }
    }
  });
  assert.equal(trigger.action.type, 'play-animation');
  assert.equal(trigger.action.params.artRef, 'explosion');
  assert.equal(getEnteredRaceTriggers([trigger], { x: 13, z: 23 }, new Set()).length, 1);
  assert.equal(getEnteredRaceTriggers([trigger], { x: 13, z: 23 }, new Set(['explosion'])).length, 0);
});

test('invalid trigger documents receive safe defaults', () => {
  const [trigger] = normalizeRaceTriggers([{ action: { type: 'unknown', params: { weather: 'acid' } } }]);
  assert.equal(trigger.action.type, 'play-sprite');
  assert.equal(trigger.action.params.weather, 'clear');
  assert.equal(trigger.fireOnce, true);
});

test('race editor start settings toggle and cycle rolling speed', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.handleMenuAction('race-countdown');
  editor.handleMenuAction('race-rolling-start');
  editor.handleMenuAction('race-rolling-speed');
  assert.equal(editor.getRaceStartSettings().countdown, false);
  assert.equal(editor.getRaceStartSettings().rollingStart, true);
  assert.equal(editor.getRaceStartSettings().rollingStartSpeedMps, 20);
});

test('race editor trigger effects spawn runtime animation and change runtime weather', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.playtestSession = { elapsedMs: 100, eventLog: [], triggerSprites: [] };
  editor.executeRaceTrigger(normalizeRaceTrigger({
    id: 'boom',
    x: 4,
    z: 8,
    action: { type: 'play-animation', params: { artRef: 'explosion', durationMs: 900 } }
  }));
  assert.equal(editor.playtestSession.triggerSprites[0].animated, true);
  assert.equal(editor.playtestSession.triggerSprites[0].artRef, 'explosion');
  editor.executeRaceTrigger(normalizeRaceTrigger({
    id: 'storm',
    action: { type: 'change-weather', params: { weather: 'storm' } }
  }));
  assert.equal(editor.playtestSession.triggerWeather, 'storm');
});

test('race trigger weather target is independently configurable', () => {
  const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });
  editor.selectedRace.triggers = [normalizeRaceTrigger({
    id: 'weather',
    action: { type: 'change-weather', params: { weather: 'clear' } }
  })];
  editor.handleMenuAction('trigger-weather');
  assert.equal(editor.getSelectedRaceTrigger().action.params.weather, 'rain');
});

test('playtest applies authored music, countdown, and rolling-start speed', () => {
  const musicCalls = [];
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {},
    setActiveMusicTrack(...args) { musicCalls.push(args); }
  });
  Object.assign(editor.getRaceStartSettings(), {
    musicTrackId: 'Race Theme',
    countdown: true,
    rollingStart: true,
    rollingStartSpeedMps: 20
  });
  editor.startPlaytest('starter-rwd', { hydrateCars: false });
  assert.equal(editor.playtestSession.countdownRemainingMs, 4000);
  assert.equal(editor.playtestSession.speedMps, 20);
  assert.equal(editor.playtestSession.rollingStart, true);
  assert.deepEqual(musicCalls[0], ['Race Theme', { restart: true }]);
});
