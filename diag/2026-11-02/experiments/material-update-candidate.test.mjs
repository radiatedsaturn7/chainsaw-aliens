import test from 'node:test';
import assert from 'node:assert/strict';
import {updateMaterialCell,baselineMaterialCell} from './material-update-candidate.mjs';
import {createTrackStateCell} from '../../../src/racing/trackState/TrackStateCell.js';
const overlay=(m,i)=>Object.assign(m,{baseSurfaceId:i%2?'asphalt':'dirt',surfaceId:i%2?'wet-asphalt':'dirt',effectiveGrip:i/100,effectiveGripMultiplier:.8,surfaceGripScale:.75,grip:i/100,trackStateConditionApplied:i%4!==0});
test('experimental stable material records match full replacement through schema and live-value changes',()=>{
 const a={},b={};
 const cell=createTrackStateCell({x:0,z:0});
 for(let i=0;i<200;i++){
  cell.standingWaterDepthMm=i/100;cell.baseGrip=.7+i/1000;
  cell.normal={x:0,y:1,z:i/100};
  if(i%3===0)cell.customValue=i;else delete cell.customValue;
  if(i===30)Object.defineProperty(cell,'hidden',{value:7,enumerable:false,configurable:true});
  let source=i%4?cell:null;
  if(i%17===0)source=Object.assign(Object.create({inheritedMaterial:i}),{dirt:.5});
  if(i%19===0)source=Object.assign(Object.create(null),{dirt:.9,roughness:.2});
  updateMaterialCell(a,source);baselineMaterialCell(b,source);
  overlay(a,i);overlay(b,i);
  assert.deepEqual(a,b);
  if(source?.normal)assert.equal(a.normal,source.normal);
 }
});
