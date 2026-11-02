import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackState,RUNTIME_TRACK_STATE_CHECKPOINT_OPTIONS as runtime} from '../../src/racing/trackState/TrackState.js';
import {createRaceTrackState} from '../../src/racing/trackState/TrackStateIntegration.js';
import {createDeferredChecksumSnapshot} from '../../src/racing/trackState/TrackStateSerialization.js';
import {hashTrackStateValue} from '../../src/racing/trackState/TrackStateMath.js';
const sampleBaseSurface=()=>({baseSurfaceId:'asphalt',friction:1});
function create(options={}){return new TrackState({seed:42,sampleBaseSurface,eventHistoryLimit:100,...options});}
function populate(state){for(let x=0;x<500;x++)state.sample({x:x+.2,z:.2});}
function events(state,step,count=100){for(let n=0;n<count;n++)state.queueCrashContamination({stepIndex:step,vehicleId:'car',x:n%5+.2,z:.2,debris:.0001});}
function physical(state){return {cells:[...state.cells],totals:state.totals,step:state.stepIndex,carry:[...state.carryByTire]};}

test('deferred checksum retains wire format, quantization and a memoized normal checksum property',()=>{
 const payload={version:1,cells:[{x:1,temperature:32.123456789}],label:'雨'};
 const s=createDeferredChecksumSnapshot(payload);
 assert.equal(typeof Object.getOwnPropertyDescriptor(s,'checksum').get,'function');
 assert.equal(s.checksum,hashTrackStateValue(payload));
 assert.equal(Object.getOwnPropertyDescriptor(s,'checksum').get,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(s)),{...payload,checksum:hashTrackStateValue(payload)});
 assert.deepEqual(structuredClone(s),{...payload,checksum:hashTrackStateValue(payload)});
});
test('runtime checkpoint retires events without hashing and preserves a frozen baseline through further weather and contacts',()=>{
 const state=create(runtime),reference=create({eventHistoryLimit:Infinity});
 populate(state);populate(reference);
 for(let step=1;step<=8;step++){
  for(const s of [state,reference]){events(s,step);s.advance(.1,{type:'storm',precipitationRateMmPerS:.015,ambientTemperatureC:10});}
  // Read-only between-tick checkpoint work must not advance surface state.
  for(let i=0;i<6;i++)state.advance(0);
 }
 for(let i=0;state.checkpointBuilder && i<5000;i++)state.serviceCheckpointSlice();
 assert.equal(state.checkpointBuilder,null);
 assert.ok(state.performanceCounters.checkpointCompletedCount>0);
 assert.deepEqual(physical(state),physical(reference));
 const checkpoint=state.historyBaseSnapshot;
 assert.equal(typeof Object.getOwnPropertyDescriptor(checkpoint,'checksum').get,'function');
 const cells=JSON.stringify(checkpoint.cells);
 for(let step=9;step<=12;step++){
  for(const s of [state,reference]){events(s,step);s.advance(.1,{type:'clear',ambientTemperatureC:30});}
 }
 assert.equal(JSON.stringify(checkpoint.cells),cells);
 assert.deepEqual(physical(state),physical(reference));
 const record=state.createReplayRecord();
 const replay=TrackState.fromSnapshot(record.historyBaseSnapshot,{sampleBaseSurface});
 for(const event of record.events)replay.queueEvent(event);
 const timeline=new Map(record.weatherTimeline);let forcing={};
 for(let step=replay.stepIndex+1;step<=record.finalStepIndex;step++){
  if(timeline.has(step))forcing=timeline.get(step);
  replay.advance(.1,forcing);
 }
 assert.equal(replay.getChecksum(),record.finalChecksum);
});
test('runtime factory chooses deferred hashing, while standalone and explicit overrides preserve eager mode',()=>{
 assert.equal(createRaceTrackState().checkpointHashMode,'deferred');
 assert.equal(createRaceTrackState({checkpointHashMode:'incremental'}).checkpointHashMode,'incremental');
 assert.equal(create().checkpointHashMode,'incremental');
});
test('large checkpoint copy work scales but is bounded at 64 cells per slice',()=>{
 const state=create(runtime);populate(state);
 // Test scheduling without allocating hundreds of thousands of cells.
 state.beginCheckpointPreparation();
 state.checkpointBuilder.pendingKeys=Array.from({length:100000},(_,i)=>String(i));
 state.checkpointBuilder.pendingKeySet=new Set(state.checkpointBuilder.pendingKeys);
 state.serviceCheckpointSlice({allowFreeze:false});
 assert.equal(state.checkpointBuilder.pendingCursor,64);
});

test('checkpoint copying, assembly and commit do not pile into one service slice',()=>{
 const state=create({...runtime,eventHistoryLimit:1});
 state.sample({x:.2,z:.2});
 state.beginCheckpointPreparation();state.freezeCheckpointTarget();
 state.serviceCheckpointSlice();assert.equal(state.checkpointBuilder.phase,'assemble');
 assert.equal(state.performanceCounters.checkpointCompletedCount,0);
 state.serviceCheckpointSlice();assert.equal(state.checkpointBuilder.phase,'ready');
 assert.equal(state.performanceCounters.checkpointCompletedCount,0);
 state.serviceCheckpointSlice();assert.equal(state.checkpointBuilder,null);
 assert.equal(state.performanceCounters.checkpointCompletedCount,1);
});

test('stale checkpoint queue entries count against the slice budget',()=>{
 const state=create(runtime);populate(state);state.beginCheckpointPreparation();
 const builder=state.checkpointBuilder;
 builder.pendingKeys=Array.from({length:100000},(_,i)=>`stale-${i}`);
 builder.pendingKeySet.clear();
 state.serviceCheckpointSlice({allowFreeze:false});
 assert.equal(builder.pendingCursor,64,'skipped entries must not allow a full-map scan in one frame');
});
