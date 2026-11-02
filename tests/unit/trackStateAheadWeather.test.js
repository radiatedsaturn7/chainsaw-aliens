import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {prepareRaceAheadSlice} from '../../src/racing/RaceAheadPreparation.js';

const storm = {type:'storm', precipitationRateMmPerS:.02, ambientTemperatureC:13,
 sunIntensity:0, windIntensity:1, humidity:1};
function make() {
 const track = new TrackState({sampleBaseSurface: p => ({baseSurfaceId:'asphalt', friction:1,
  sunExposure:.5+(Math.floor(p.x/10)%20)/100})});
 track.recordWeatherTransition(1,storm);
 track.recordWeatherTransition(200,{...storm,type:'snow',ambientTemperatureC:-8});
 track.recordWeatherTransition(500,{...storm,type:'clear',precipitationRateMmPerS:0,ambientTemperatureC:25});
 track.stepIndex=1200;
 return track;
}
function same(a,b) {
 assert.deepEqual([...a.cells], [...b.cells]);
 assert.deepEqual(a.totals,b.totals);
 assert.equal(a.getChecksum(),b.getChecksum());
 assert.equal(a.visualRevision,b.visualRevision);
 for(const [key,c] of a.cells){
  assert.equal(a.cellSampleRevisions.get(c),b.cellSampleRevisions.get(b.cells.get(key)));
  assert.equal(a.visualCellRevisions.get(key),b.visualCellRevisions.get(key));
 }
}

test('ahead weather preparation is bounded and leaves all authoritative state untouched',()=>{
 const actual=make(), reference=make();
 let work=0, slices=0, result;
 do {
  result=actual.prepareNewCellWeather({x:1,z:1},32);
  assert.ok(result.steps<=32); work+=result.steps; slices++;
  assert.ok(slices<50);
  same(actual,reference);
  assert.equal(actual.orderedCellKeys.length,0);
  assert.equal(actual.environmentActiveKeys.length,0);
  assert.equal(actual.pendingEvents.length,0);
 }while(!result.complete);
 assert.equal(work,1199);
 assert.ok(slices>1);
 for(const throughStep of [1199,1200]) {
  const point={x:1,z:throughStep===1199?1:4};
  actual.getOrCreateCell(point,{throughStep}); reference.getOrCreateCell(point,{throughStep});
  same(actual,reference);
 }
});

test('partial preparation, profile eviction and history replacement retain exact weather and totals',()=>{
 const actual=make(),reference=make();
 for(let i=0;i<24;i++)actual.prepareNewCellWeather({x:i*10,z:0},7);
 assert.ok(actual.preparedWetCellWeatherCache.profiles.size<=4);
 assert.equal(actual.newWetCellWeatherCache,undefined);
 for(let i=0;i<24;i++){
  const point={x:i*10,z:0};
  actual.getOrCreateCell(point);reference.getOrCreateCell(point);
 }
 same(actual,reference);
 for(const track of [actual,reference]){
  track.weatherTimeline=new Map([[1000,storm]]);track.historyBaseStepIndex=1000;track.stepIndex=1250;
 }
 const point={x:500,z:500};
 for(let i=0;i<8;i++)actual.prepareNewCellWeather(point,32);
 actual.getOrCreateCell(point);reference.getOrCreateCell(point);
 same(actual,reference);
});

test('authoritative reads finish missing preparation rather than expose stale grip',()=>{
 const actual=make(),reference=make(); const point={x:3,z:6};
 actual.prepareNewCellWeather(point,3);
 assert.deepEqual(actual.sample(point),reference.sample(point));
 same(actual,reference);
 assert.equal(actual.prepareNewCellWeather(point,32).steps,0);
});

test('one road-ahead slice shares a total 32-tick weather budget and resumes its point',()=>{
 const track=make(); const cursor={}; let applied=0;
 const original=track.prepareNewCellWeather.bind(track);
 track.prepareNewCellWeather=(...args)=>{const result=original(...args);applied+=result.steps;return result;};
 const editor={playtestSession:{trackState:track,distance:0,speedMps:10},
  getRaceWorldPoseAtDistance:d=>({x:d,z:0}),getRaceRoadHalfWidthWorld:()=>3};
 for(let i=0;i<5;i++){
  applied=0;
  assert.equal(prepareRaceAheadSlice(editor,cursor),false);
  assert.ok(applied<=32);assert.equal(cursor.index,0);
 }
 assert.equal(track.cells.size,0);
});

test('an older authoritative request safely bypasses a profile prepared farther ahead',()=>{
 const actual=make(),reference=make();const point={x:1,z:1};
 while(!actual.prepareNewCellWeather(point,32).complete){}
 actual.getOrCreateCell(point,{throughStep:500});reference.getOrCreateCell(point,{throughStep:500});
 same(actual,reference);
 actual.sample(point);reference.sample(point);
 same(actual,reference);
});


test('optional profile preparation cannot evict demand profiles',()=>{
 const track=make();
 track.getOrCreateCell({x:1,z:1});
 const profiles=track.newWetCellWeatherCache.profiles;
 const entries=[...profiles];
 for(let i=0;i<40;i++)track.prepareNewCellWeather({x:i*10+2,z:100},32);
 assert.deepEqual([...profiles],entries);
 assert.ok(track.preparedWetCellWeatherCache.profiles.size<=4);
});

test('prepared cells do not become runoff receivers or alter subsequent water flow',()=>{
 const create=()=>{
  const s=new TrackState({maxWeatherStepsPerStep:2048,
   sampleBaseSurface:p=>({baseSurfaceId:'asphalt',friction:1,elevationM:-p.x*.1})});
  s.recordWeatherTransition(1,storm);s.stepIndex=300;return s;
 };
 const actual=create(),reference=create();
 while(!actual.prepareNewCellWeather({x:20,z:0},32).complete){}
 for(const s of [actual,reference]){
  s.sample({x:0,z:0});s.sample({x:2,z:0});
  for(const c of s.cells.values())c.standingWaterDepthMm=2;
 }
 for(let tick=0;tick<5;tick++){
  actual.step(storm);reference.step(storm);same(actual,reference);
 }
 assert.equal(actual.cells.size,2);
});
