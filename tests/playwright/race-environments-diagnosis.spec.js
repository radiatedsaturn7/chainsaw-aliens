import fs from 'node:fs';
import {test,expect} from '@playwright/test';
const races=(process.env.RACE_QA_RACES||'Ozark Backroads|Moki Dugway').split('|');
for(const race of races)for(const mobile of (process.env.RACE_QA_MOBILE==='both'?[false,true]:[process.env.RACE_QA_MOBILE==='true'])) {
 test(`${race} ${mobile?'handheld':'desktop'} baseline comparison`,async({page},info)=>{
  test.setTimeout(300000);
  const startedAt=Date.now(),events=[];
  const record=(type,value)=>{const event={ms:Date.now()-startedAt,type,value};events.push(event);if(['ready','travel-return','first-playable','moving','final'].includes(type))console.log(race,type,event.ms,JSON.stringify(value));};
  page.on('pageerror',e=>record('pageerror',e.stack||e.message));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))record(m.type(),m.text());});
  page.on('requestfailed',r=>record('requestfailed',{url:r.url(),error:r.failure()}));
  page.on('response',r=>{if(r.status()>=400)record('http-error',{url:r.url(),status:r.status()});});
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:720});
  await page.addInitScript(mobile=>Object.defineProperty(navigator,'userAgentData',{configurable:true,value:{mobile}}),mobile);
  const state=()=>page.evaluate(()=>{const g=window.__game,e=g?.raceEditor,s=e?.playtestSession;return {ready:window.__gameReady,state:g?.state,status:e?.status,error:g?.lastRaceTravelError,diagnostics:g?.raceRuntimePreparation?.lastDiagnostics,phase:e?.racePlaytestPreparation?.phase,warmup:e?.raceLoadingWarmup?{frames:e.raceLoadingWarmup.frames,surfacePrepared:e.raceLoadingWarmup.surfacePrepared,artReadyFrames:e.raceLoadingWarmup.artReadyFrames,exit:e.raceLoadingWarmup.exit,age:performance.now()-e.raceLoadingWarmup.started}:null,deferredArtWorker:!!s?.deferredArtWorker,session:s?{running:s.running,pending:s.startupFramePending,elapsed:s.elapsedMs,speed:s.speedMps,intro:s.raceIntro?.active,countdown:s.countdownRemainingMs,paused:e.raceInput.paused}:null,sky:e?.getRaceSkyboxSettings?.().artRef,renderer:!!e?.raceThreeWorldRenderer};});
  try{
   await page.goto('/index.html?hideFullscreenForTesting');
   await page.waitForFunction(()=>window.__gameReady&&!window.__game.loading&&window.__game.state!=='loading',null,{timeout:120000});
   await page.evaluate(async()=>{const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');const menu=(await hydrateProjectFilePayload('menus','Game Menu')).data;await window.__game.menuPlayer.open(menu);window.__game.draw();});record('ready',await state());
   await page.evaluate(()=>{const g=window.__game,e=g.raceEditor;window.__qaWarmup=[];window.__qaDraws={draw:0,finish:0};for(const [name,key]of [['drawRacePlaytestScreenContents','draw'],['finishRaceLoadingFrame','finish']]){const original=e[name].bind(e);e[name]=(...args)=>{window.__qaDraws[key]++;return original(...args);};}window.__qaTimer=setInterval(()=>{const w=e.raceLoadingWarmup,s=e.playtestSession;if(window.__qaWarmup.length<600)window.__qaWarmup.push({at:performance.now(),status:e.status,pending:s?.startupFramePending,deferred:!!s?.deferredArtWorker,frames:w?.frames,surfacePrepared:w?.surfacePrepared,artReadyFrames:w?.artReadyFrames,exit:w?.exit,draws:{...window.__qaDraws}});},500);});
   const started=await page.evaluate(async race=>{const g=window.__game;g.setDisplayMode('color');return g.startRaceTravel({raceName:race,carSelection:'specific',carRef:'RTG-001'});},race);
   record('travel-return',{started,state:await state()});expect(started).toBe(true);
   await page.waitForFunction(()=>{const s=window.__game.raceEditor.playtestSession;return (s?.running&&!s.startupFramePending&&s.elapsedMs>2000)||window.__game.state==='prompt';},null,{timeout:180000});
   const playable=await state();record('first-playable',playable);expect(playable.session?.running,JSON.stringify(playable)).toBe(true);expect(playable.session?.pending).toBe(false);expect(playable.session?.elapsed).toBeGreaterThan(2000);
   // Actual game's accelerator is G; ArrowUp only changes gear.
   await page.keyboard.down('g');
   await page.waitForFunction(()=>window.__game.raceEditor.playtestSession.speedMps>1,null,{timeout:30000});
   record('moving',await state());
   await page.screenshot({path:info.outputPath('moving.png')});await page.keyboard.up('g');
  }finally{
   record('warmup-trace',await page.evaluate(()=>({samples:window.__qaWarmup,draws:window.__qaDraws})).catch(()=>null));
   record('final',await state().catch(e=>({error:e.message})));
   await page.screenshot({path:info.outputPath('final.png')}).catch(()=>{});
   fs.mkdirSync(info.outputPath(),{recursive:true});fs.writeFileSync(info.outputPath('diagnosis.json'),JSON.stringify({commit:process.env.RACE_QA_COMMIT,race,mobile,events},null,2));
   console.log('Evidence saved',info.outputPath('diagnosis.json'));
  }
 });
}
