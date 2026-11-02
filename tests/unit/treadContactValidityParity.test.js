import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreadContactValidityScratch,resolveTreadContactValidity} from '../../src/racing/simulation/ContactPatchTireModel.js';
import {referenceTreadContactValidity} from './fixtures/treadValidityReference.js';

test('reused tread-validation vectors preserve support and rejection results exactly',()=>{
 let seed=1099;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const vector=()=>({x:random()*4-2,y:random()*4-2,z:random()*4-2});
 const scratch=createTreadContactValidityScratch(),target={},states=new Set();
 for(let i=0;i<20000;i++){
  const aligned=i%2===0;
  const request={state:{position:vector(),orientation:i%3?{x:random(),y:random(),z:random(),w:random()}:{w:1},contactPatches:{fl:{validTreadContact:i%7===0}}},
   config:{bodyProfile:{pieces:i%3?[{type:i%5?'box':'convex',centerM:vector(),sizeM:{x:1.8,y:1.2,z:4},vertices:Array.from({length:8},vector)}]:[]}},
   environment:{bodyOccludedByWheel:{fl:i%29===0}},wheelId:'fl',
   kinematics:{surfaceNormalWorld:aligned?{x:0,y:1,z:0}:vector(),suspensionAxisWorld:aligned?{x:0,y:-1,z:0}:vector(),wheelLateralWorld:aligned?{x:1,y:0,z:0}:vector(),suspensionMountPositionWorld:vector(),contactPointWorld:vector()},
   surfaceSample:{valid:i%31!==0,region:'road',source:i%11?'asphalt':'curb'},
   rawRequestedCompressionM:i%37===0?NaN:random()*.5-.1,suspensionTravelM:.25};
  const expected=referenceTreadContactValidity(request);
  const actual=resolveTreadContactValidity({...request,target,computationScratch:scratch});
  assert.strictEqual(actual,target);
  assert.deepEqual(actual,expected,`case ${i}`);
  states.add(actual.state);
 }
 assert.ok(states.has('valid-suspension-support'));
 assert.ok(states.has('body-occluded'));
 assert.ok(states.has('wrong-suspension-side'));
 assert.ok(states.has('full-bump-support'));
});
