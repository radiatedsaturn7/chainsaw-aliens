import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildWheelCylinder,getWheelCameraBearing} from '../../src/racing/CarWheelCylinder.js';
import {normalizeCarAngleLayers} from '../../src/racing/CarDirectionalArt.js';

test('no-option wheel geometry retains the pre-inset golden across views and spins',()=>{
 const out=[];for(const bearing of[-2.356,-.785,.785,2.356])for(const spin of[0,.5,1,2,3])out.push(buildWheelCylinder({width:20,height:60,bearing,spin}));
 assert.equal(createHash('sha256').update(JSON.stringify(out)).digest('hex'),'fcd141e4f70f0dce900bbe9709a8694a59a25e3e36c4b5cbe13747a81cd16663');
});
test('invalid face-plane options leave geometry unchanged',()=>{
 const opts={width:20,height:60,bearing:.785};const base=buildWheelCylinder(opts);
 for(const faceInsetFraction of[undefined,null,NaN,Infinity,-.1,.50001,'0.5',true,{},[]])assert.deepEqual(buildWheelCylinder({...opts,faceInsetFraction}),base);
});
test('bounded face inset keeps tread, vertical geometry and spin across steering samples',()=>{
 for(const camera of[-2.356,-.785,.785,2.356])for(const steering of[-.5,0,.5])for(const spin of[0,.5,1,2,3]){
  const opts={width:20,height:60,bearing:getWheelCameraBearing(camera,steering),spin};const a=buildWheelCylinder(opts),b=buildWheelCylinder({...opts,faceInsetFraction:.5});
  assert.deepEqual(a.filter(t=>t.surface==='tread'),b.filter(t=>t.surface==='tread'));
  const ys=x=>x.filter(t=>t.surface==='wheel').map(t=>JSON.stringify(t.points.map(p=>p.y))).sort();assert.deepEqual(ys(a),ys(b));
  const centers=x=>x.filter(t=>t.surface==='wheel').map(t=>t.points[0]);const before=centers(a),after=centers(b);
  assert.ok(Math.abs(after[0].x-before[0].x)<=10+1e-9);
 }
});
test('asset normalization preserves only explicit finite bounded per-wheel values in its view',()=>{
 const base={rearLeft:{tires:{cylinder:true}}};const valid=normalizeCarAngleLayers({rearLeft:{tires:{cylinder:true,faceInsetByWheel:{fl:.5}}}});
 assert.deepEqual(valid.rearLeft.tires.faceInsetByWheel,{fl:.5});assert.equal(valid.frontLeft,undefined);assert.deepEqual(normalizeCarAngleLayers(valid),valid);
 for(const value of[NaN,Infinity,-1,.6,'0.5',null,true])assert.deepEqual(normalizeCarAngleLayers({rearLeft:{tires:{cylinder:true,faceInsetByWheel:{fl:value,invalid:.5}}}}),normalizeCarAngleLayers(base));
});
