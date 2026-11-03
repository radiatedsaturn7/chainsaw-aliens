import test from 'node:test';
import assert from 'node:assert/strict';
import {drawWheelCylinder} from '../../src/racing/CarWheelCylinder.js';
import {drawWheelCylinder as legacy} from '../fixtures/carWheelCylinderLegacy.js';
function recorder(){
 const calls=[];
 const ctx=new Proxy({imageSmoothingEnabled:true},{get(target,key){if(key in target)return target[key];if(String(key).startsWith('__race'))return undefined;return (...args)=>calls.push([key,...args]);},set(target,key,value){calls.push(['set',key,value]);target[key]=value;return true;}});
 return {ctx,calls};
}
test('scalar wheel texture coordinates preserve every Canvas command across bearings, spin, and cropped art',()=>{
 const tread={width:128,height:64},wheel={width:64,height:128};
 for(let i=0;i<48;i++)for(const cropped of [false,true]){
  const options={tread,wheel,width:20,height:50,bearing:i*Math.PI/24,spin:i*.11,segments:12+i%3*6};
  if(cropped){options.treadBounds={x:5,y:3,width:30,height:40};options.wheelBounds={x:3,y:8,width:50,height:58};}
  const a=recorder(),b=recorder();
  assert.equal(drawWheelCylinder(a.ctx,options),legacy(b.ctx,options));
  assert.deepEqual(a.calls,b.calls);
 }
});
test('wheel painter preserves missing textures and degenerate UV behavior',()=>{
 for(const options of [{},{tread:{}},{tread:{width:0,height:0},wheel:{width:0,height:0}},{tread:{width:64,height:64},wheel:{width:64,height:64},treadBounds:{x:0,y:0,width:0,height:0}}]){
  const a=recorder(),b=recorder();
  assert.equal(drawWheelCylinder(a.ctx,options),legacy(b.ctx,options));assert.deepEqual(a.calls,b.calls);
 }
});

import {buildWheelCylinder,createWheelCylinderScratch} from '../../src/racing/CarWheelCylinder.js';
import {buildWheelCylinder as legacyBuild} from '../fixtures/carWheelCylinderLegacy.js';
test('borrowed wheel geometry matches legacy geometry across changing tessellation and preserves independent results',()=>{
 const scratch=createWheelCylinderScratch();
 const retained=buildWheelCylinder({bearing:.4}),saved=structuredClone(retained);
 for(let i=0;i<200;i++){
  const options={width:12+i%7,height:30+i%11,bearing:i*.17,spin:i*.31,segments:[0,1,3,12,24,36][i%6]};
  assert.deepEqual(buildWheelCylinder(options,scratch),legacyBuild(options));
 }
 assert.deepEqual(retained,saved,'default API geometry must not be borrowed');
 buildWheelCylinder({bearing:.7},scratch);
 const record=scratch.records[0],point=record.points[0],uv=record.uv[0],triangles=scratch.triangles;
 assert.equal(buildWheelCylinder({bearing:.8,spin:.6},scratch),triangles);
 assert.equal(scratch.records[0],record);assert.equal(record.points[0],point);assert.equal(record.uv[0],uv);
});
test('nested wheel paints cannot overwrite the outer geometry',()=>{
 const options={tread:{width:64,height:64},wheel:{width:64,height:64},bearing:.7,spin:.4};
 function draw(painter){
  const log=recorder();let entered=false;
  log.ctx.drawImage=(...args)=>{
   log.calls.push(['image',...args]);
   if(!entered){entered=true;painter(log.ctx,{...options,bearing:2,spin:1});}
  };
  log.calls.length=0;
  painter(log.ctx,options);return log.calls;
 }
 assert.deepEqual(draw(drawWheelCylinder),draw(legacy));
});
test('a failed wheel paint releases borrowed geometry and restores smoothing',()=>{
 const options={tread:{width:64,height:64},wheel:{width:64,height:64},bearing:.7};
 const log=recorder();log.ctx.drawImage=()=>{throw Error('paint failed');};
 assert.throws(()=>drawWheelCylinder(log.ctx,options),/paint failed/);
 assert.equal(log.ctx.imageSmoothingEnabled,true);
 log.ctx.drawImage=()=>{};
 assert.equal(drawWheelCylinder(log.ctx,options),true);
});
