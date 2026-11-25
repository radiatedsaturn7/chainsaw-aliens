import test from 'node:test';
import assert from 'node:assert/strict';
import {CutscenePlayer, cutsceneSkipHintAlpha, drawCutsceneSkipHint} from '../../src/ui/CutsceneEditor.js';
import {MenuPreviewSurface} from '../../src/menus/MenuPreviewSurface.js';

test('skip requires one uninterrupted second of G and ignores taps and other buttons',()=>{
 const player=new CutscenePlayer({});let done=0;
 player.play({durationMs:10000,clips:[]},{onDone:()=>done++});
 player.handleInput({wasPressed:()=>true},.1);assert.equal(player.active,true);
 const held={isDownCode:key=>key==='KeyG'};
 for(let i=0;i<9;i++)player.handleInput(held,.1);
 assert.equal(player.active,true);
 player.handleInput({},.1);assert.equal(player.skipHoldMs,0);
 for(let i=0;i<10;i++)player.handleInput(held,.1);
 assert.equal(player.active,false);assert.equal(done,1);
});

test('controller confirm holds skip but non-skippable cutscenes remain active',()=>{
 const player=new CutscenePlayer({});
 for(const skippable of [false,true]){
  player.play({durationMs:10000,clips:[]},{skippable});
  for(let i=0;i<12;i++)player.handleInput({isGamepadDown:key=>key==='jump'},.1);
  assert.equal(player.active,!skippable);
 }
});

test('simulated menu pad retains G/R in both orientations and exposes held G without repeating pulses',()=>{
 const surface=new MenuPreviewSurface({deviceIsMobile:true,input:{}});
 for(const [width,height] of [[390,844],[844,390]]){
  surface.layout(width,height);
  const g=surface.controls.buttons.find(b=>b.id==='jump'),r=surface.controls.buttons.find(b=>b.id==='attack');
  assert.equal(g.label,'G');assert.equal(r.label,'R');
  const point={id:7,x:g.x,y:g.y};surface.down(point);
  assert.equal(surface.controls.isHeld('jump'),true);
  assert.equal(surface.pressed()('jump'),true);assert.equal(surface.pressed()('jump'),false);
  const player=new CutscenePlayer({});player.play({durationMs:10000,clips:[]});
  for(let i=0;i<10;i++)player.handleInput({},.1,{skipHeld:surface.controls.isHeld('jump')});
  assert.equal(player.active,false);
  surface.up(point);assert.equal(surface.controls.isHeld('jump'),false);
 }
});


test('skip hint lets the shot establish, fades away, and returns only while holding',()=>{
 assert.equal(cutsceneSkipHintAlpha(0),0);
 assert.equal(cutsceneSkipHintAlpha(1500),0);
 assert.ok(cutsceneSkipHintAlpha(1700)>0 && cutsceneSkipHintAlpha(1700)<.65);
 assert.equal(cutsceneSkipHintAlpha(3000),.65);
 assert.ok(cutsceneSkipHintAlpha(6300)<.65);
 assert.equal(cutsceneSkipHintAlpha(6700),0);
 assert.equal(cutsceneSkipHintAlpha(30000,500),.9);
 assert.equal(cutsceneSkipHintAlpha(30000,0),0);
 const player=new CutscenePlayer({});player.play({durationMs:60000,sceneFadeInMs:4000,clips:[]});
 assert.equal(player.skipHintDelayMs,4500);
 player.waitingPauseClipId='dialogue';player.update(10);
 assert.equal(player.timeMs,0);assert.equal(cutsceneSkipHintAlpha(player.skipHintElapsedMs,0,player.skipHintDelayMs),0);
 player.play({durationMs:60000,clips:[]});assert.equal(player.skipHintElapsedMs,0);
});

test('skip hint bitmap and thin progress bar fit the scene in portrait and landscape',()=>{
 for(const bounds of [{x:0,y:250,w:390,h:219},{x:80,y:0,w:693,h:390}]){
  const rects=[],ctx={globalAlpha:1,save(){},restore(){},fillRect(x,y,w,h){rects.push({x,y,w,h});}};
  drawCutsceneSkipHint(ctx,bounds,{elapsedMs:30000});assert.equal(rects.length,0);
  drawCutsceneSkipHint(ctx,bounds,{elapsedMs:30000,holdMs:500});
  assert.ok(rects.length>2);
  for(const r of rects){assert.ok(r.x>=bounds.x&&r.y>=bounds.y);assert.ok(r.x+r.w<=bounds.x+bounds.w&&r.y+r.h<=bounds.y+bounds.h);}
  assert.equal(rects.at(-1).h,2);assert.equal(rects.at(-1).w,Math.round(rects.at(-2).w/2));
 }
});
