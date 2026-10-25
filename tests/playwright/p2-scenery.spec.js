import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('P2 scenery stress starts with eleven rivals and renders bounded fence batches',async({page})=>{
 test.setTimeout(360000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const result=await page.evaluate(async()=>{
  const game=window.__game;
  const started=await game.startRaceTravel({raceName:'p2loadtest',carSelection:'specific',carRef:'RTG-001'});
  if(!started)throw Error('P2 did not start: '+game.raceEditor.status);
  const e=game.raceEditor,times=[],base=e.addRaceThreeDoodads.bind(e);
  e.addRaceThreeDoodads=(...args)=>{const t=performance.now();try{return base(...args);}finally{times.push(performance.now()-t);}};
  const session=e.playtestSession;session.countdownRemainingMs=0;session.startupFramePending=false;session.launchLockMs=0;
  e.raceInput.paused=false;
  const updates=[];
  for(let frame=0;frame<180;frame++){
   const t=performance.now();if(!e.updatePlaytestSafely(1/60))throw Error('Simulation update failed');updates.push(performance.now()-t);
   if(frame%10===0)game.draw();
  }
  const sortedUpdates=updates.slice(10).sort((a,b)=>a-b);
  const renderer=e.getRaceThreeWorldRenderer(390,400);
  const fences=renderer.dynamicDoodadGroup?.children.filter(m=>m.name.startsWith('raceFence:'))||[];
  const sorted=times.slice(5).sort((a,b)=>a-b);
  return{started,ai:e.playtestSession.aiRuntime.length,scenery:e.ensureRaceScenery().length,frames:times.length,
   fenceMeshes:fences.length,maxFenceRadius:Math.max(...fences.map(m=>m.geometry.boundingSphere.radius)),
   p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],
   updateP50Ms:sortedUpdates[Math.floor(sortedUpdates.length*.5)],updateP95Ms:sortedUpdates[Math.floor(sortedUpdates.length*.95)],elapsed:e.playtestSession.elapsedMs,authority:'Chromium software WebGL; scenery CPU pass, not phone GPU FPS'};
 });
 console.log('P2_SCENERY',JSON.stringify(result));fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/p2-scenery.json',JSON.stringify(result,null,2));
 expect(result.ai).toBe(11);expect(result.scenery).toBeGreaterThan(9000);expect(result.frames).toBeGreaterThan(10);
 expect(result.elapsed).toBeGreaterThan(2000);expect(result.fenceMeshes).toBeGreaterThan(6);expect(result.maxFenceRadius).toBeLessThan(200);
 await page.screenshot({path:'test-results/p2-scenery.png'});
});
