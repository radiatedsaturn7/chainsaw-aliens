import test from 'node:test';
import assert from 'node:assert/strict';
import {CutscenePlayer} from '../../src/ui/CutsceneEditor.js';
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
