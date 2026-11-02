import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceWheelContactStateFromSamples as current} from '../../src/racing/RaceVehicleSurfaceContact.js';
import {createRaceWheelContactStateFromSamples as before} from './fixtures/wheelContactBeforeMergeRemoval.js';
import {TrackState} from '../../src/racing/trackState/TrackState.js';

test('wheel contacts preserve normalization, invalid surfaces, materials and output ownership',()=>{
 const ids=['fl','fr','rl','rr'],retained=[];
 const trackState=new TrackState();
 for(let i=0;i<200;i++) {
  const positions={},surfaceSamples={};
  ids.forEach((id,j)=>{
   positions[id]={x:i%9+j,y:2,z:j};
   surfaceSamples[id]=Object.freeze({elevation:i/7+j,heightM:i%7===0?null:undefined,
    normal:i%11===0?{x:0,y:0,z:0}:{x:j/3,y:1,z:0},
    region:i%3?'road':'terrain',friction:.7,surfaceId:'asphalt',
    valid:i%13!==0,triangleId:i,projection:{segment:{surface:'asphalt'},distance:i},
    // Unknown metadata must not leak into authoritative geometry.
    extra:'preserve raw ownership'});
  });
  const args={positions,surfaceSamples,trackState:i%2?trackState:null,
   groundedByWheel:{fl:i%3!==0},tuning:{wheelbaseM:2.3,trackWidthM:1.7}};
  const actual=current(args),expected=before(args);
  assert.deepEqual(actual,expected);
  // Track-state cells intentionally remain live; sample/contact scalars don't.
  retained.push([actual,current(args)]);
  assert.notEqual(actual.contacts,retained.at(-1)[1].contacts);
 }
 for(const [actual,expected] of retained)assert.deepEqual(actual,expected);
});

test('prepared samples and explicit reusable targets retain their contract',()=>{
 const positions={fl:{x:1,y:2,z:3}};
 const raw={physicsTerrainQueryFrameSample:true,valid:true,heightM:4,
  normal:{x:0,y:1,z:0},region:'road',surfaceId:'dirt',friction:.5};
 const args={wheelIds:['fl'],positions,surfaceSamples:{fl:raw},preparedSamples:true};
 const a={},b={};
 assert.deepEqual(current({...args,target:a}),before({...args,target:b}));
 assert.equal(a.contacts.fl.surfaceSample,raw);
 raw.valid=false;
 assert.deepEqual(current({...args,target:a}),before({...args,target:b}));
 assert.equal(Object.hasOwn(a.heights,'fl'),false);
});
