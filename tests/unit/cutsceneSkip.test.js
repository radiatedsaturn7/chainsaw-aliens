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


test('the early cue fades in and out and obeys the timeline cutoff',()=>{
 assert.equal(cutsceneSkipHintAlpha(0),0);
 assert.ok(cutsceneSkipHintAlpha(60)>0 && cutsceneSkipHintAlpha(60)<.65);
 assert.equal(cutsceneSkipHintAlpha(500),.65);
 assert.ok(cutsceneSkipHintAlpha(950,1000)<.65);
 assert.equal(cutsceneSkipHintAlpha(1000,1000),0);
 assert.equal(cutsceneSkipHintAlpha(1650),0);
});

const hasSkipCue=(player,timeMs,width=768,height=432)=>{
 const paints=(runtime)=>{
  let rects=0;
  const ctx=new Proxy({globalAlpha:1,fillRect:()=>rects++},{get:(target,key)=>key in target?target[key]:()=>{}});
  runtime.draw(ctx,width,height);
  return rects;
 };
 player.timeMs=timeMs;
 const withCue=paints(player);
 return withCue>paints(Object.assign(Object.create(Object.getPrototypeOf(player)),player,{skipHintEndMs:0}));
};

test('skip cue fades away before the first visible caption and never returns',()=>{
 const player=new CutscenePlayer({});
 player.play({durationMs:9000,layers:[{id:'text',visible:true},{id:'muted',visible:false}],clips:[
  {type:'text',layerId:'muted',startMs:0,durationMs:700,text:'Hidden'},
  {type:'text',startMs:1100,durationMs:700,text:'First line',fadeInMs:250},
  {type:'text',startMs:3500,durationMs:900,text:'Second line'},
 ]});
 for(const [w,h] of [[768,432],[390,844]]){
  assert.equal(hasSkipCue(player,450,w,h),true);
  for(const t of [1000,1100,1700,2600,3500,6000])assert.equal(hasSkipCue(player,t,w,h),false);
 }
 assert.equal(player.active,true);
 for(let i=0;i<10;i++)player.handleInput({isDownCode:key=>key==='KeyG'},.1);
 assert.equal(player.active,false,'G remains available after the cue disappears');
});

test('suppress too-short cues, mid-scene playback and non-skippable scenes',()=>{
 const player=new CutscenePlayer({});
 for(const doc of [
  {durationMs:9000,clips:[{type:'text',startMs:300,durationMs:700,text:'Opening line'}]},
  {durationMs:9000,clips:[{type:'pause',startMs:120,durationMs:200,waitForInput:true}]},
 ]){
  player.play(doc);
  assert.equal(hasSkipCue(player,100),false);
 }
 player.play({durationMs:9000,clips:[]},{startMs:200});
 assert.equal(hasSkipCue(player,300),false);
 player.play({durationMs:9000,clips:[]},{skippable:false});
 assert.equal(hasSkipCue(player,400),false);
 player.play({durationMs:9000,clips:[]});
 assert.equal(hasSkipCue(player,1000),true);
 assert.equal(hasSkipCue(player,1650),false);
});

test('skip hint bitmap and thin progress bar fit the scene in portrait and landscape',()=>{
 for(const bounds of [{x:0,y:250,w:390,h:219},{x:80,y:0,w:693,h:390}]){
  const rects=[],ctx={globalAlpha:1,save(){},restore(){},fillRect(x,y,w,h){rects.push({x,y,w,h});}};
  drawCutsceneSkipHint(ctx,bounds,{elapsedMs:30000});assert.equal(rects.length,0);
  drawCutsceneSkipHint(ctx,bounds,{elapsedMs:30000,holdMs:500});assert.equal(rects.length,0);
  drawCutsceneSkipHint(ctx,bounds,{elapsedMs:460,holdMs:500});
  assert.ok(rects.length>2);
  for(const r of rects){assert.ok(r.x>=bounds.x&&r.y>=bounds.y);assert.ok(r.x+r.w<=bounds.x+bounds.w&&r.y+r.h<=bounds.y+bounds.h);}
  assert.equal(rects.at(-1).h,2);assert.equal(rects.at(-1).w,Math.round(rects.at(-2).w/2));
 }
});
