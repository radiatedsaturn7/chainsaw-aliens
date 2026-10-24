import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuDocument,normalizeMenuDocument,normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {createLoadingMenuScreen,loadingFact} from '../../src/menus/MenuLoadingScreen.js';
import MenuEditor from '../../src/ui/MenuEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
import {widgetDefaults} from '../../src/menus/MenuWidgets.js';
test('loading screen and fact lists survive save/reopen with ordinary layout controls',async()=>{
 const game={carEditor:new RaceEditor({},{mode:'car'})},editor=new MenuEditor(game);
 editor.menu.screens[0].backgroundArt='splash';await editor.runAction('screen-loading');
 assert.equal(editor.menu.loadingScreen,editor.screen.id);assert.equal(editor.screen.backgroundArt,'splash');
 editor.screen.elements.find(e=>e.type==='random-fact').facts=['First fact.','Second fact.'];
 const reopened=normalizeMenuDocument(JSON.parse(JSON.stringify(editor.menu)));
 assert.deepEqual(reopened,editor.menu);
 assert.equal(loadingFact({facts:['A','B']},.9),'B');assert.equal(loadingFact({facts:[]},.9),'');
 assert.equal(widgetDefaults('progress-bar').binding,'loadingProgress');
});
test('loading progress clamps to its bounds and cannot become selectable',()=>{
 const fills=[];const ctx=new Proxy({fillRect:(...args)=>fills.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{}});
 const document=createMenuDocument(),screen={background:'#000',elements:[normalizeMenuElement({...widgetDefaults('progress-bar'),x:0,y:0,w:1,h:1,strokeWidth:0})]};
 for(const progress of [-1,.4,2]){fills.length=0;drawMenuScreen(ctx,{x:10,y:20,w:100,h:10},document,screen,{loadingProgress:progress});assert.equal(fills.at(-1)[2],Math.max(0,Math.min(1,progress))*100);}
});

test('race presentation waits for rendered warmup frames and the complete exit fade',()=>{
 const savedDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
 try{
  const e=new RaceEditor({});let now=0;e.getNowMs=()=>now;
  e.playtestSession={running:true,startupFramePending:true,countdownRemainingMs:3000};
  e.raceLoadingPresentation={};e.drawRacePreparationScreen=()=>{e.raceLoadingBounds={x:10,y:20,w:100,h:60};};
  const ctx={canvas:{},getTransform:()=>({a:1,d:1,e:0,f:0}),save(){},restore(){},drawImage(){},fillRect(){}};
  for(now of [0,500,999]){e.finishRaceLoadingFrame(ctx,120,100);assert.equal(e.playtestSession.startupFramePending,true);assert.equal(e.raceLoadingWarmup.exit,null);}
  now=1000;e.finishRaceLoadingFrame(ctx,120,100);assert.equal(e.raceLoadingWarmup.exit.active,true);
  now=1200;e.finishRaceLoadingFrame(ctx,120,100);assert.equal(e.playtestSession.startupFramePending,true);
  now=1301;e.finishRaceLoadingFrame(ctx,120,100);assert.equal(e.playtestSession.startupFramePending,false);
  assert.equal(e.playtestSession.countdownRemainingMs,3000);assert.equal(e.raceLoadingPresentation,null);
 }finally{globalThis.document=savedDocument;}
});

test('a cached race still displays loading before presenting its first race frame',()=>{
 const e=new RaceEditor({});e.playtestSession={startupFramePending:true,running:true};
 let loading=0;e.drawRacePreparationScreen=()=>loading++;
 e.draw({},400,800);assert.equal(loading,1);assert.equal(e.playtestSession.startupFramePending,true);
});

test('loading content is not created until a fully black entry frame has been drawn',()=>{
 const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
 try{
  const e=new RaceEditor({});let now=0;e.getNowMs=()=>now;
  e.playtestSession={preparing:true};e.racePlaytestPreparation={progress:.2};
  const fills=[],ctx=new Proxy({canvas:{},measureText:()=>({width:20}),fillRect(){fills.push(this.fillStyle);},getTransform:()=>({a:1,d:1,e:0,f:0})},{get:(o,k)=>k in o?o[k]:()=>{}});
  e.drawRacePreparationScreen(ctx,640,360);assert.equal(e.raceLoadingPresentation,undefined);
  now=500;e.drawRacePreparationScreen(ctx,640,360);
  assert.equal(e.raceLoadingEntry.blackDrawn,true);assert.equal(fills.at(-1),'rgba(0,0,0,1)');
  assert.equal(e.raceLoadingPresentation,undefined);
  now=516;e.drawRacePreparationScreen(ctx,640,360);assert.ok(e.raceLoadingPresentation);
 }finally{globalThis.document=saved;}
});
