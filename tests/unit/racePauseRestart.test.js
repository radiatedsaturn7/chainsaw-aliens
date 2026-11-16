import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('pause Restart Race starts a fresh attempt with the same car and baked track without cancelling travel', () => {
  let closed = 0;
  let stopped = 0;
  const travel = {};
  const editor = new RaceEditor({
    raceTravelSession: travel,
    stopSfxById() { stopped++; },
    cancelRaceTravel() { throw new Error('restart must stay in race'); }
  });
  // Render prewarming is unrelated to restart lifecycle and needs a browser.
  editor.preloadSelectedRaceArtRefs = () => {};
  editor.prewarmRacePlaytestRenderResources = () => {};
  editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  const old = editor.playtestSession;
  const bake = { key: 'prepared-track' };
  old.worldBake = bake;
  old.elapsedMs = 12000;
  old.distance = 150;
  old.lap = 2;
  old.tireTrackSegments.push({ id: 1 });
  old.activeEngineSoundId = 'engine';
  old.deferredArtWorker = { terminate() { closed++; } };
  editor.vehicleDynamicsAuthority = { session: old, workerBridge: { close() { closed++; } } };
  editor.raceInput.autoShift = false;
  editor.raceInput.keyboardThrottle = true;
  editor.raceInput.activeDpadPointerId = 42;
  editor.toggleRacePause();
  const rows = editor.getRacePauseMenuRows();
  assert.equal(rows.find(row => row.id === 'race-restart').label, 'Restart Race');
  editor.raceInput.pauseMenuIndex = rows.findIndex(row => row.id === 'race-restart');
  editor.handleRacePauseMenuInput({ wasGamepadPressed: key => key === 'gamepadA' });
  const fresh = editor.playtestSession;
  assert.notEqual(fresh, old);
  assert.equal(old.running, false);
  assert.equal(fresh.carId, old.carId);
  assert.equal(fresh.raceId, old.raceId);
  assert.equal(fresh.worldBake, bake);
  assert.equal(fresh.elapsedMs, 0);
  assert.equal(fresh.distance, 0);
  assert.equal(fresh.lap, 1);
  assert.equal(fresh.countdownRemainingMs, editor.getRaceStartSettings().countdown ? 4000 : 0);
  assert.equal(fresh.tireTrackSegments.length, 0);
  assert.notEqual(fresh.trackState, old.trackState);
  assert.equal(editor.raceInput.paused, false);
  assert.equal(editor.raceInput.autoShift, false);
  assert.equal(editor.raceInput.keyboardThrottle, false);
  assert.equal(editor.raceInput.activeDpadPointerId, null);
  assert.equal(editor.game.raceTravelSession, travel);
  assert.equal(closed, 2);
  assert.equal(stopped, 1);
});

test('racing pause nests Debug, lights and signals with parent-aware Back',()=>{
 const e=new RaceEditor({});e.playtestSession={};e.raceInput.paused=true;e.raceInput.pauseMenuMode='main';
 assert.ok(!e.getRacePauseMenuRows().some(r=>r.id==='race-debug'));
 e.getRacePauseMenuRows().find(r=>r.id==='race-car-settings').onClick();
 const settings=e.getRacePauseMenuRows();
 assert.deepEqual(settings.map(r=>r.id),['race-car-controls','race-toggle-transmission','race-driving-guide','race-pace-notes','race-toggle-telemetry','race-fullscreen','race-debug','race-pause-back']);
 settings[0].onClick();
 assert.deepEqual(e.getRacePauseMenuRows().slice(0,-1).map(r=>r.id),['race-toggle-abs','race-toggle-tc','race-launch-control','race-car-lights','race-wipers','race-car-signals']);
 for(const [id,mode,children] of [['race-car-lights','car-lights',['race-headlights','race-highBeams','race-auxLights']],['race-car-signals','car-signals',['race-signal-left','race-signal-right','race-signal-hazards']]]){
  e.getRacePauseMenuRows().find(r=>r.id===id).onClick();assert.equal(e.raceInput.pauseMenuMode,mode);
  assert.deepEqual(e.getRacePauseMenuRows().slice(0,-1).map(r=>r.id),children);
  e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'car-controls');
 }
 const abs=e.raceInput.absEnabled;e.getRacePauseMenuRows()[0].onClick();assert.equal(e.raceInput.absEnabled,!abs);
 e.getRacePauseMenuRows().at(-1).onClick();assert.equal(e.raceInput.pauseMenuMode,'settings');
 e.getRacePauseMenuRows().find(r=>r.id==='race-debug').onClick();
 e.getRacePauseMenuRows().find(r=>r.id==='race-debug-menu-ai').onClick();
 e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'debug');
 e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'settings');assert.equal(e.getRacePauseMenuRows()[e.raceInput.pauseMenuIndex].id,'race-debug');
 e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'main');assert.equal(e.raceInput.paused,true);
});

test('pause Reset Position uses the route-center reset and resumes without restarting',()=>{
 const e=new RaceEditor({});e.playtestSession={distance:123,routeRuntimeType:'road',elapsedMs:456};e.raceInput.paused=true;
 e.getRaceWorldPoseAtDistance=(distance)=>{assert.equal(distance,123);return {yaw:1.2};};
 let reset;e.resetRaceCarToRouteCenter=value=>{reset=value;};e.toggleRacePause=()=>{e.raceInput.paused=false;};
 e.getRacePauseMenuRows().find(r=>r.id==='race-reset-position').onClick();
 assert.deepEqual(reset,{projection:{distance:123},roadYaw:1.2,preserveMotion:false,reason:'select-hold-reset'});
 assert.equal(e.raceInput.paused,false);assert.equal(e.playtestSession.elapsedMs,456);
 e.playtestSession.countdownRemainingMs=1000;assert.equal(e.resetRacePosition(),false);
});
test('pause Full Screen enters and exits browser fullscreen',async()=>{
 const prior=globalThis.document;let entered=0,exited=0;
 try{
  globalThis.document={documentElement:{requestFullscreen:async()=>{entered++;}},exitFullscreen:async()=>{exited++;}};
  const e=new RaceEditor({});e.playtestSession={};e.raceInput.pauseMenuMode='settings';
  await e.getRacePauseMenuRows().find(r=>r.id==='race-fullscreen').onClick();assert.equal(entered,1);
  globalThis.document.fullscreenElement={};await e.toggleRaceFullscreen();assert.equal(exited,1);
 }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
