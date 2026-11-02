import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackState } from '../../src/racing/trackState/TrackState.js';

const storm = { type: 'storm', precipitationRateMmPerS: .02, ambientTemperatureC: 13,
  sunIntensity: 0, windIntensity: 1, humidity: 1 };
const snow = { ...storm, type: 'snow', ambientTemperatureC: -8 };
function make(disabled = false) {
  const state = new TrackState({ sampleBaseSurface: () => ({ baseSurfaceId: 'asphalt', friction: 1 }) });
  state.debugDisableWeatherReplayCache = disabled;
  for (let x = 0; x < 12; x++) state.getOrCreateCell({ x, z: 0 }, { coordinates: true });
  state.recordWeatherTransition(1, storm);
  return state;
}
function equal(actual, reference) {
  assert.deepEqual([...actual.cells], [...reference.cells]);
  assert.deepEqual(actual.totals, reference.totals);
  assert.equal(actual.getChecksum(), reference.getChecksum());
  assert.equal(actual.visualRevision, reference.visualRevision);
  for (const [key, cell] of actual.cells) {
    assert.equal(actual.cellSampleRevisions.get(cell), reference.cellSampleRevisions.get(reference.cells.get(key)));
    assert.equal(actual.visualCellRevisions.get(key), reference.visualCellRevisions.get(key));
  }
}

test('long weather replay shares exact results, retaining tire deposits and ordered totals', () => {
  const actual = make(), reference = make(true);
  for (const s of [actual, reference]) {
    let i = 0;
    for (const c of s.cells.values()) { c.oil = i++ / 20; c.rubber = i / 20; }
    s.stepIndex = 600;
    for (const c of s.cells.values()) s.catchUpCellWeather(c);
  }
  equal(actual, reference);
  assert.ok(actual.weatherReplayCache.hits >= 11);
  assert.equal(actual.weatherReplayCache.reusedSteps, 6600);
});

test('replay respects profiles, finite budgets, snow, thaw and changing weather history', () => {
  const actual = make(), reference = make(true);
  for (const s of [actual, reference]) {
    s.recordWeatherTransition(60, snow);
    s.recordWeatherTransition(160, { ...storm, ambientTemperatureC: 28, sunIntensity: .8 });
    let i = 0;
    for (const c of s.cells.values()) {
      c.compaction = (i % 2) * .5;
      c.standingWaterDepthMm = (i++ % 3) * .1;
    }
    s.stepIndex = 300;
    for (const c of s.cells.values()) { assert.equal(s.catchUpCellWeather(c, 300, 64), 64); }
    for (const c of s.cells.values()) s.catchUpCellWeather(c);
  }
  equal(actual, reference);
  for (const s of [actual, reference]) {
    s.recordWeatherTransition(301, snow);
    s.stepIndex = 500;
    for (const c of s.cells.values()) s.catchUpCellWeather(c);
  }
  equal(actual, reference);
});

test('tiny updates and full-normalization reference bypass replay cache', () => {
  for (const full of [false, true]) {
    const s = make(); s.debugFullWeatherClamp = full;
    s.stepIndex = full ? 600 : 4;
    for (const c of s.cells.values()) s.catchUpCellWeather(c);
    assert.equal(s.weatherReplayCache, undefined);
  }
});

test('cache eviction bounds memory without changing weather results', () => {
  const actual = make(), reference = make(true);
  for (const s of [actual, reference]) {
    s.stepIndex = 600;
    for (let i = 0; i < 80; i++) {
      const c = s.cells.values().next().value;
      c.lastUpdatedStep = 0; c.surfaceTemperatureC = i / 100;
      s.catchUpCellWeather(c);
    }
  }
  equal(actual, reference);
  assert.ok(actual.weatherReplayCache.steps <= 32768);
  assert.ok(actual.weatherReplayCache.entries.size <= 1024);
});

test('indexed history preserves boundaries, appends and checkpoint replacement',()=>{
 const s=make();
 for(let tick=2;tick<=300;tick++)s.recordWeatherTransition(tick,{...storm,humidity:tick/1000});
 const linear=step=>{let result=null;for(const [at,forcing] of s.weatherTimeline){if(at>step)break;result=forcing;}return result;};
 for(let step=0;step<350;step++)assert.equal(s.getWeatherForStep(step),linear(step));
 s.recordWeatherTransition(301,snow);assert.equal(s.getWeatherForStep(301).type,'snow');
 s.weatherTimeline=new Map([[250,storm],[301,snow]]);
 for(let step=0;step<350;step++)assert.equal(s.getWeatherForStep(step),linear(step));
});

test('staggered catch-up beyond 2048 steps agrees exactly across weather transitions',()=>{
 const actual=make(),reference=make(true);
 for(const s of [actual,reference]){
  for(let tick=2;tick<=120;tick++)s.recordWeatherTransition(tick,{...storm,precipitationRateMmPerS:tick/6000});
  s.recordWeatherTransition(400,snow);s.recordWeatherTransition(900,storm);
  let i=0;for(const c of s.cells.values())s.catchUpCellWeather(c,1+(i++%31));
  s.stepIndex=2200;
  for(const c of s.cells.values())s.catchUpCellWeather(c);
 }
 equal(actual,reference);
 assert.ok(actual.weatherReplayCache.reusedSteps>10000);
});

test('late catch-up seeks long forcing history without scanning past transitions',()=>{
 const s=make();
 for(let tick=2;tick<=8192;tick++)s.recordWeatherTransition(tick,{...storm,humidity:tick/10000});
 const entries=s.getWeatherTimelineIndex();
 let reads=0;
 const indexed=new Proxy(entries,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key);}});
 s.getWeatherTimelineIndex=()=>indexed;
 const c=s.cells.values().next().value;c.lastUpdatedStep=8192;s.stepIndex=8256;
 assert.equal(s.catchUpCellWeather(c),64);
 assert.ok(reads<100,`history reads: ${reads}`);
 assert.equal(c.lastUpdatedStep,8256);
});

test('short catch-up preserves missing forcing and exact transition boundaries',()=>{
 const s=make();
 s.weatherTimeline=new Map([[5,storm],[8,snow],[10,storm]]);
 const c=s.cells.values().next().value;
 const visited=[];const apply=s.applyWeatherToCell;
 s.applyWeatherToCell=function(cell,forcing,dt,step,options){visited.push([step,forcing.type]);return apply.call(this,cell,forcing,dt,step,options);};
 assert.equal(s.catchUpCellWeather(c,12),8);
 assert.deepEqual(visited,[[5,'storm'],[6,'storm'],[7,'storm'],[8,'snow'],[9,'snow'],[10,'storm'],[11,'storm'],[12,'storm']]);
});

test('appended forcing retains exact older replay blocks but rewritten history invalidates them',()=>{
 const actual=make(),reference=make(true);
 for(const s of [actual,reference])s.catchUpCellWeather([...s.cells.values()][0],600);
 const cache=actual.weatherReplayCache;
 for(const s of [actual,reference]){
  s.recordWeatherTransition(601,snow);
  s.catchUpCellWeather([...s.cells.values()][1],620);
 }
 assert.equal(actual.weatherReplayCache,cache);
 assert.ok(cache.hits>0);
 equal(actual,reference);
 for(const s of [actual,reference]){
  s.recordWeatherTransition(601,{...storm,ambientTemperatureC:25});
  s.catchUpCellWeather([...s.cells.values()][2],640);
 }
 assert.notEqual(actual.weatherReplayCache,cache);
 equal(actual,reference);
});
