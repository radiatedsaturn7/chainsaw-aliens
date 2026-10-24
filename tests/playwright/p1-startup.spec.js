import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`${mobile ? 'portrait touch' : 'desktop'}: saved P1 loads through travel worker, artwork transfer and first rendered frames`, async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
  await page.addInitScript(mobile => Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile } }), mobile);
  await page.goto('/index.html');
  await page.waitForFunction(() => window.__gameReady, null, { timeout: 60000 });
  expect(await page.evaluate(() => window.__game.deviceIsMobile)).toBe(mobile);
  const result = await page.evaluate(async () => {
    const game = window.__game;
    game.drawDisplayModeFilter=()=>{};
    const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
    const menu=(await hydrateProjectFilePayload('menus','Game Menu')).data;
    await game.menuPlayer.open(menu);game.draw();
    const loadingDraw=game.raceEditor.drawRacePreparationScreen.bind(game.raceEditor);
    game.raceEditor.drawRacePreparationScreen=(...args)=>{
      const result=loadingDraw(...args),e=game.raceEditor;
      if(e.raceLoadingEntry?.blackDrawn && !e.raceLoadingPresentation)window.__loadingBlackBeforeContent=true;
      return result;
    };
    const messages = [];
    const editor=game.raceEditor,finish=editor.finishRaceLoadingFrame.bind(editor);
    editor.finishRaceLoadingFrame=(...args)=>{
      if(editor.raceLoadingWarmup)window.__loadingWarmup={frames:editor.raceLoadingWarmup.frames,elapsed:editor.getNowMs()-editor.raceLoadingWarmup.started};
      return finish(...args);
    };
    const toast = game.showSystemToast.bind(game);
    game.showSystemToast = message => { messages.push(message); toast(message); };
    const started = await game.startRaceTravel({ raceName: 'p1', carSelection: 'specific', carRef: 'RTG-001' });
    return { started, messages, status: game.raceEditor.status,
      diagnostics: game.raceRuntimePreparation?.lastDiagnostics,
      phase: game.raceEditor.racePlaytestPreparation?.phase };
  });
  console.log('P1_START', JSON.stringify(result));
  expect(result.started, JSON.stringify(result)).toBe(true);
  await page.waitForFunction(() => {
    const s=window.__game.raceEditor.playtestSession;
    return s?.raceIntro?.active && !s.startupFramePending;
  },null,{timeout:90000});
  if(!mobile)await page.evaluate(()=>{
    const e=window.__game.raceEditor;e.raceInput.cameraView='first-person';e.playtestSession.cameraView='first-person';
  });
  const countdown=await page.evaluate(()=>{
    const e=window.__game.raceEditor,draw=e.drawRacePlaytestScreenContents.bind(e);
    window.__handoffCameras=[];
    e.drawRacePlaytestScreenContents=(...args)=>{
      const result=draw(...args),s=e.playtestSession,c=e.lastRaceRenderCamera;
      if(s?.raceIntro?.elapsed>=5.4 && s.countdownRemainingMs>3000 && window.__handoffCameras.length<90)
        window.__handoffCameras.push({t:s.raceIntro.elapsed,countdown:s.countdownRemainingMs,y:c?.camera?.elevation,fov:e.raceThreeWorldRenderer?.camera?.fov});
      return result;
    };
    return e.playtestSession.countdownRemainingMs;
  });
  for(const [shot,time] of [[0,.7],[1,2.5],[2,4.3]]){
    await page.evaluate(time=>{window.__game.raceEditor.playtestSession.raceIntro.elapsed=time;},time);
    await page.waitForTimeout(120);
    const camera=await page.evaluate(()=>{
      const e=window.__game.raceEditor,g=window.__game;
      const pixels=g.ctx.getImageData(0,0,g.canvas.width,g.canvas.height).data;
      let magenta=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>240&&pixels[i+1]<20&&pixels[i+2]>240)magenta++;
      window.__introMagenta=magenta;
      return {target:e.lastRaceRenderCamera?.camera?.cinematicTarget,view:e.lastRaceRenderCamera?.cameraView,countdown:e.playtestSession.countdownRemainingMs};
    });
    expect(await page.evaluate(()=>window.__introMagenta)).toBe(0);
    expect(camera.target).toBeTruthy();expect(camera.view).toBe('third-person');expect(camera.countdown).toBe(countdown);
    await page.screenshot({path:`test-results/p1-intro-${mobile?'portrait':'desktop'}-${shot}.png`});
  }
  const handoff=await page.evaluate(async()=>{
    const {advanceRaceIntro}=await import('/src/racing/RaceIntro.js');
    const g=window.__game,e=g.raceEditor,s=e.playtestSession;
    s.raceIntro.elapsed=5.37;s.raceIntro.handoffBlackDrawn=false;
    advanceRaceIntro(s,.1);g.draw();
    const b=e.lastRaceRenderCamera.bounds,scale=g.canvas.width/g.viewport.width;
    const pixel=[...g.ctx.getImageData(Math.round((b.x+b.w/2)*scale),Math.round((b.y+b.h/2)*scale),1,1).data];
    return {elapsed:s.raceIntro.elapsed,black:s.raceIntro.handoffBlackDrawn,pixel};
  });
  expect(handoff.elapsed).toBe(5.4);expect(handoff.black).toBe(true);expect(handoff.pixel.slice(0,3)).toEqual([0,0,0]);
  await page.waitForFunction(() => {
    const session = window.__game.raceEditor.playtestSession;
    return session?.running && !session.startupFramePending && session.elapsedMs > 2000;
  }, null, { timeout: 90000 });
  if(!mobile)expect(await page.evaluate(()=>window.__game.raceEditor.lastRaceRenderCamera.cameraView)).toBe('first-person');
  await page.screenshot({ path: `test-results/p1-running-${mobile ? 'portrait' : 'desktop'}.png` });
  console.log('P1_RUNNING', await page.evaluate(() => ({ state: window.__game.state,
    elapsed: window.__game.raceEditor.playtestSession?.elapsedMs,
    diagnostics: window.__game.raceRuntimePreparation?.lastDiagnostics })));
  const warm=await page.evaluate(()=>window.__loadingWarmup);
  expect(warm?.frames).toBeGreaterThanOrEqual(3);expect(warm?.elapsed).toBeGreaterThanOrEqual(1000);
  expect(await page.evaluate(()=>window.__loadingBlackBeforeContent)).toBe(true);
  console.log('HANDOFF_CAMERAS',await page.evaluate(()=>window.__handoffCameras));
  expect(errors).toEqual([]);
});
