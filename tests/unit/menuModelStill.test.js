import test from 'node:test';
import assert from 'node:assert/strict';
import {MENU_MODEL_STILL_ANGLE,menuModelStillBounds,paintMenuModelStill} from '../../src/menus/MenuModelStill.js';

function rig(){
  const assets=new Map(),draws=[],painted=[];
  return {assets,draws,painted,
    ctx:{drawImage(...args){painted.push(args);}},
    preview:{draw(...args){draws.push(args);return true;}},
    options:{library:assets,canvasFactory:()=>({getContext:()=>({})})}};
}
const slot={x:20,y:40,w:220,h:110};
const car={id:'aartg001',art:{bodyModel:{ref:'Chassis'},wheelModel:{ref:'Wheel'}}};

test('showroom model still is centered and deliberately smaller than its card',()=>{
  const {x,y,w,h}=menuModelStillBounds(slot);
  assert.equal(x+w/2,slot.x+slot.w/2);
  assert.equal(y+h/2,slot.y+slot.h/2);
  assert(w<slot.w&&h<slot.h);
});

test('real bound models wait for asset readiness and never cache placeholder geometry',()=>{
  const {ctx,preview,options,assets,draws}=rig();
  assert.equal(paintMenuModelStill(ctx,slot,car,preview,options),false);
  assets.set('Chassis',{});
  assert.equal(paintMenuModelStill(ctx,slot,car,preview,options),false);
  assert.equal(draws.length,0);
  assets.set('Wheel',{});
  assert.equal(paintMenuModelStill(ctx,slot,car,preview,options),true);
  assert.equal(draws.length,1);
});

test('fixed camera still renders once across frame sizes and repaints after real model update',()=>{
  const {ctx,preview,options,assets,draws,painted}=rig();
  assets.set('Chassis',{});assets.set('Wheel',{});
  assert(paintMenuModelStill(ctx,slot,car,preview,options));
  assert(paintMenuModelStill(ctx,{...slot,w:292,h:142},car,preview,options));
  assert.equal(draws.length,1);
  assert.deepEqual(draws[0].slice(1),[{x:0,y:0,w:160,h:104},car,(MENU_MODEL_STILL_ANGLE+180)*Math.PI/180,0]);
  assert.equal(painted[0][0],painted[1][0]);
  assets.set('Chassis',{updated:true});
  assert(paintMenuModelStill(ctx,slot,car,preview,options));
  assert.equal(draws.length,2);
  assert.notEqual(painted[0][0],painted[2][0]);
});

test('does not generate a 3D body still for 2D cars or cars with only model wheels',()=>{
  const {ctx,preview,options,draws}=rig();
  for(const art of [{},{wheelModel:{ref:'Wheel'}}])assert.equal(paintMenuModelStill(ctx,slot,{art},preview,options),false);
  assert.equal(draws.length,0);
});


test('map model follows heading, reuses its canvas and stays cached while parked',()=>{
 const {ctx,preview,options,assets,draws,painted}=rig();
 assets.set('Chassis',{});assets.set('Wheel',{});
 for(const angle of [0,90,180,270,360,360])
  assert(paintMenuModelStill(ctx,slot,car,preview,{...options,angle}));
 assert.equal(draws.length,5);
 assert.deepEqual(draws.map(d=>d[3]),[180,270,360,450,180].map(a=>a*Math.PI/180));
 assert(painted.every(p=>p[0]===painted[0][0]),'heading changes reuse the offscreen canvas');
});
