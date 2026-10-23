import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuScreenTransition} from '../../src/menus/MenuScreenTransition.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
const bounds={x:10,y:20,w:960,h:540};
function canvas(){return {getContext:()=>({drawImage(){}})};}
test('screen transition fades the old frame to black then reveals the new frame',()=>{
 const transition=new MenuScreenTransition(),draws=[];
 const ctx={save(){},restore(){},drawImage(){draws.push('old')},fillRect(){draws.push(this.fillStyle)}};
 transition.start({},bounds,canvas);transition.draw(ctx,bounds);assert.deepEqual(draws,['old','rgba(0,0,0,0)']);
 transition.update(.075);draws.length=0;transition.draw(ctx,bounds);assert.deepEqual(draws,['old','rgba(0,0,0,0.5)']);
 transition.update(.075);draws.length=0;transition.draw(ctx,bounds);assert.deepEqual(draws,['rgba(0,0,0,1)']);
 transition.update(.15);assert.equal(transition.active,false);
});
test('transition supports skipped frames, unavailable canvas, and cancellation',()=>{
 const transition=new MenuScreenTransition();transition.start(null,bounds,canvas);assert.equal(transition.active,false);
 transition.start({},bounds,canvas);transition.update(1);assert.equal(transition.active,false);
 transition.start({},bounds,canvas);transition.reset();assert.equal(transition.snapshot,null);
});
test('menu navigation fades in preview and blocks confirmation and touch until finished',async()=>{
 const previous=globalThis.document;
 const player=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};
 await player.open(createMenuDocument(),{preview:true});
 try {
  globalThis.document={createElement:canvas};player.lastDrawCanvas={};player.bounds=bounds;
  player.flow.goTo('settings');assert.equal(player.screenTransition.active,true);
  let activations=0;player.activate=()=>activations++;
  player.update({wasPressedCode:key=>key==='Enter'},.1);assert.equal(activations,0);
  player.handlePointerDown({x:200,y:200});assert.equal(activations,0);
  player.update({},.21);assert.equal(player.screenTransition.elapsed,.15);assert.equal(player.pendingScreenEntry,true);
  const ctx=new Proxy({canvas:{},getTransform:()=>({a:2,d:2,e:0,f:0}),measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
  player.draw(ctx,390,844);assert.equal(player.transitionBlackDrawn,true);
  player.update({},.01);assert.equal(player.pendingScreenEntry,false);
  player.draw(ctx,390,844);assert.equal(player.screenTransition.hold,false);
  player.update({},.15);assert.equal(player.screenTransition.active,false);
  player.update({wasPressedCode:key=>key==='Enter'},.01);assert.equal(activations,1);
  player.flow.back();assert.equal(player.screenTransition.active,true);
  player.cleanup();assert.equal(player.screenTransition.active,false);assert.equal(player.lastDrawCanvas,null);
 }finally{globalThis.document=previous;}
});

for(const dpr of [1,2,3])test(`portrait snapshot crops only the menu viewport at DPR ${dpr}`,()=>{
 const transition=new MenuScreenTransition(),calls=[],b={x:18,y:130,w:354,h:199.125};
 const image={getContext:()=>({drawImage:(...args)=>calls.push(args)})};
 transition.start({},b,()=>image,{transform:{a:dpr,d:dpr,e:4,f:6},hold:true});
 assert.deepEqual(calls[0].slice(1,5),[b.x*dpr+4,b.y*dpr+6,b.w*dpr,b.h*dpr]);
 assert.equal(image.width,Math.ceil(b.w*dpr));assert.equal(image.height,Math.ceil(b.h*dpr));
 transition.update(.8);assert.equal(transition.elapsed,.15);assert.equal(transition.active,true);
 transition.release();transition.update(.15);assert.equal(transition.active,false);
});

test('Game Start begins fading before car selection setup or rendering',async()=>{
 const previous=globalThis.document,player=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};
 await player.open(createMenuDocument(),{preview:true});
 try {
  globalThis.document={createElement:canvas};player.lastDrawCanvas={};player.bounds=bounds;
  let choices=0;player.resources.choices=()=>{choices++;return [];};
  await player.activate(player.flow.screen.elements.find(e=>e.id==='start'));
  assert.equal(player.flow.screenId,'cars');assert.equal(player.screenTransition.active,true);assert.equal(player.pendingScreenEntry,true);assert.equal(choices,0);
  const ctx=new Proxy({canvas:{},measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
  player.draw(ctx,390,844);assert.equal(choices,0);
  player.update({},.15);assert.equal(choices,0);player.draw(ctx,390,844);assert.equal(choices,0);
  player.update({},.01);assert.ok(choices>0);assert.equal(player.screenTransition.elapsed,.15);assert.equal(player.screenTransition.hold,true);
  player.draw(ctx,390,844);assert.equal(player.screenTransition.hold,false);
  player.cleanup();
 } finally {globalThis.document=previous;}
});

test('garage screens switch instantly in both directions but leaving the group still fades',async()=>{
 const previous=globalThis.document,player=new MenuPlayer({input:{},transitionTo(){},setActiveMusicTrack(){}});
 player.settings.load=async()=>{};player.resources.prepareGarage=async()=>{};player.openTuner=()=>{};
 await player.open(createMenuDocument(),{preview:true,screenId:'garage'});
 try{
  globalThis.document={createElement:canvas};player.lastDrawCanvas={};player.bounds=bounds;
  for(const id of ['tuning','garage','upgrades','tuning','garage']){
   player.flow.goTo(id);assert.equal(player.screenTransition.active,false,id);assert.equal(player.pendingScreenEntry,false,id);
  }
  player.flow.goTo('world-map');assert.equal(player.screenTransition.active,true);
  player.cleanup();
 }finally{globalThis.document=previous;}
});
