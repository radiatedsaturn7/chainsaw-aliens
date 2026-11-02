import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState} from '../../src/racing/trackState/TrackState.js';
import {createRaceTrackState} from '../../src/racing/trackState/TrackStateIntegration.js';

const forcing=i=>({type:i<60?'storm':i<120?'snow':'clear',precipitationRateMmPerS:i<120?.014:0,
 ambientTemperatureC:i<60?12:i<120?-8:15,sunIntensity:.2,humidity:.9});
test('background weather budgets integration work, stays fair, and contact reads catch up exactly',()=>{
 const states=[new TrackState({maxCellsPerStep:64,maxWeatherStepsPerStep:32}),new TrackState({maxCellsPerStep:64})];
 for(const s of states)for(let i=0;i<200;i++)s.getOrCreateCell({x:i,z:0},{coordinates:true});
 const budget=states[0];let calls=0;
 const original=budget.applyWeatherToCell;
 budget.applyWeatherToCell=function(...args){calls++;return original.apply(this,args);};
 for(let i=0;i<180;i++){
  calls=0;budget.advance(.1,forcing(i));assert.ok(calls<=32,`tick ${i}: ${calls}`);
  states[1].advance(.1,forcing(i));
 }
 assert.ok([...budget.cells.values()].every(c=>c.lastUpdatedStep>0),'no permanently starved cells');
 for(let i=0;i<200;i++)assert.deepEqual(budget.sample({x:i+.5,z:.5}),states[1].sample({x:i+.5,z:.5}));
 assert.equal(createRaceTrackState().maxWeatherStepsPerStep,2048);
 assert.equal(createRaceTrackState({maxWeatherStepsPerStep:Infinity}).maxWeatherStepsPerStep,Infinity);
});

test('budgeted flow neither creates receivers nor transfers into stale cells',()=>{
 const s=new TrackState({maxWeatherStepsPerStep:8,sampleBaseSurface:({x})=>({elevationM:10-x})});
 const a=s.getOrCreateCell({x:0,z:0},{coordinates:true});
 s.mutateCell({x:0,z:0},{standingWaterDepthMm:20});
 s.stepIndex=10;a.lastUpdatedStep=10;
 s.applyConservativeFlow([a]);assert.equal(s.cells.size,1);assert.equal(a.standingWaterDepthMm,20);
 const b=s.getOrCreateCell({x:1,z:0},{coordinates:true});b.lastUpdatedStep=0;
 s.applyConservativeFlow([a]);assert.equal(a.standingWaterDepthMm,20);
 b.lastUpdatedStep=10;const sum=a.standingWaterDepthMm+b.standingWaterDepthMm;
 s.applyConservativeFlow([a]);assert.ok(a.standingWaterDepthMm<20);
 assert.ok(20-a.standingWaterDepthMm<=20*.22+1e-6);
 assert.ok(Math.abs(a.standingWaterDepthMm+b.standingWaterDepthMm-sum)<2e-6);
});

test('batched weather mutation retains revisions, totals, checksums and cells',()=>{
 const states=[new TrackState(),new TrackState()];
 for(const s of states){s.advance(.1,forcing(0));s.getOrCreateCell({x:0,z:0},{coordinates:true});s.stepIndex=100;}
 const [a,b]=states,ca=[...a.cells.values()][0],cb=[...b.cells.values()][0];
 assert.ok(ca&&cb);
 a.catchUpCellWeather(ca,100);
 for(let i=cb.lastUpdatedStep+1;i<=100;i++)b.applyWeatherToCell(cb,b.getWeatherForStep(i),.1,i);
 assert.deepEqual(ca,cb);assert.deepEqual(a.totals,b.totals);
 assert.equal(a.visualRevision,b.visualRevision);assert.equal(a.cellSampleRevisions.get(ca),b.cellSampleRevisions.get(cb));
 assert.equal(a.getChecksum(),b.getChecksum());
});

test('budgeted weather resumes deterministically from a partially caught-up saved snapshot',()=>{
 const a=new TrackState({maxCellsPerStep:64,maxWeatherStepsPerStep:16});
 for(let i=199;i>=0;i--)a.getOrCreateCell({x:i,z:0},{coordinates:true});
 for(let i=0;i<3;i++)a.advance(.1,forcing(i));
 const b=TrackState.fromSnapshot(JSON.parse(JSON.stringify(a.createSnapshot())));
 assert.equal(b.maxWeatherStepsPerStep,16);
 assert.equal(a.getChecksum(),b.getChecksum());
 for(let i=3;i<140;i++){
  a.advance(.1,forcing(i));b.advance(.1,forcing(i));
  assert.equal(a.getChecksum(),b.getChecksum(),`resume tick ${i}`);
 }
});
