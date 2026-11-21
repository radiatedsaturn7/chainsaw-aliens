import fs from 'node:fs';
import { test, expect, devices } from '@playwright/test';
import { resolveDiagnosticRaceChoice } from '../../tools/race-environments/selector.mjs';

const raceIndex = JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json')).folders.races;
const cases = [
  ['Brands Hatch — Grand Prix', 'skybox-brands-hatch-day-2994'],
  ['Acropolis Rally — Stage 4', 'environment-acropolis-limestone-day-v1'],
  ['Mars — Perseverance Jezero', 'environment-v1-jezero-dry-delta'],
  ['Moon — Apollo 17 Taurus-Littrow', 'environment-v1-taurus-littrow-massifs'],
];
const fences = ['building-row', 'canyon-wall', 'race-wall-catchfence', 'tree-line']
  .map(f => 'fence-region-generic-' + f);
async function boot(page) {
  await page.goto('/index.html?hideFullscreenForTesting');
  await page.waitForFunction(() => window.__gameReady && !window.__game.loading, null, { timeout: 120_000 });
}

for (const mobile of [false, true]) test.describe(mobile ? 'handheld' : 'desktop', () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    isMobile: mobile, hasTouch: mobile, ...(mobile ? { userAgent: devices['iPhone 13'].userAgent } : {}) });
  for (const [name, sky] of cases) test('expanded scenery: ' + name, async ({ page }, info) => {
    test.setTimeout(300_000); // unchanged race-environments-driving budgets
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await boot(page);
    const choices = await page.evaluate(async () => {
      const { hydrateServerStorage } = await import('/src/ui/serverStorage.js');
      await hydrateServerStorage({ folder: 'races' });
      return window.__game.menuPlayer.resources.choices('races', {});
    });
    const path = raceIndex[name];
    expect(path, 'exact candidate manifest race path').toMatch(/^races\/.+\/document[.]json$/u);
    const selected = resolveDiagnosticRaceChoice(choices, name, path);
    expect(await page.evaluate(async ({ value, sky }) => {
      const g = window.__game, e = g.raceEditor, draw = e.drawRaceSkyboxArt;
      window.__expansionSkyDraws = 0;
      e.drawRaceSkyboxArt = function (...args) {
        const drawn = draw.apply(this, args);
        if (drawn && this.playtestSession?.running && this.getRaceSkyboxSettings().artRef === sky)
          window.__expansionSkyDraws++;
        return drawn;
      };
      g.setDisplayMode('color');
      return g.startRaceTravel({ raceName: value, carSelection: 'specific', carRef: 'RTG-001' });
    }, { value: selected.value, sky })).toBe(true);
    try {
      await page.waitForFunction(() => {
        const g = window.__game, e = g.raceEditor, s = e.playtestSession;
        if (g.state === 'prompt' && !s?.running) throw Error('Race left startup: ' + e.status);
        return s?.running && !s.startupFramePending && s.elapsedMs > 2000 && window.__expansionSkyDraws > 0;
      }, null, { timeout: 180_000 });
      await page.screenshot({ path: info.outputPath('race-start.png') });
      const witness = await page.evaluate(async ({ name, sky }) => {
        const e = window.__game.raceEditor;
        if (e.selectedRace?.name !== name || e.getRaceSkyboxSettings().artRef !== sky) throw Error('Wrong selected race or sky');
        const target = e.ensureRaceScenery().find(s => s.visualOnly === true && s.expansionScenery?.version === 1);
        if (!target) throw Error('Expected generated visual-only doodad');
        await e.hydrateRaceArt(target.artRef);
        const art = e.getRaceArtSpriteCanvas(target.artRef);
        if (!art) throw Error('Generated doodad native canvas missing');
        // The generated prop may be far from the starting line. Stand a detached
        // camera directly ahead of its saved placement, without moving the live session.
        const c = document.createElement('canvas'); c.width = 390; c.height = 240;
        const ctx = c.getContext('2d');
        const nativeDraw = ctx.drawImage.bind(ctx);
        const bounds = { x:0, y:0, w:c.width, h:c.height };
        const yaw = (Number(target.yaw) || 0) + Math.PI / 7;
        const forward = e.getRaceForwardVector(yaw);
        const elevation = e.getRaceSurfaceModel().sampleWorld({ x:target.x, z:target.z }, 0).elevation;
        const view = { x:target.x-forward.x*18, z:target.z-forward.z*18, elevation, roadWidthScale:1 };
        let exactSpriteDraws = 0;
        const get = e.getRaceDoodadForScenery;
        let current = false;
        e.getRaceDoodadForScenery = function (sprite, ...rest) {
          current = sprite.id === target.id;
          return get.call(this, sprite, ...rest);
        };
        try {
          ctx.drawImage = (source, ...args) => {
            if (!current || source !== art) return;
            const [x, y, w, h] = args.slice(-4);
            if (x+w > 0 && x < c.width && y+h > 0 && y < c.height) exactSpriteDraws++;
            return nativeDraw(source, ...args);
          };
          e.drawRaceProjectedScenerySprites(ctx, bounds, { camera:view, cameraYaw:yaw });
        } finally {
          e.getRaceDoodadForScenery = get;
        }
        let visiblePixels=0;
        const pixels=ctx.getImageData(0,0,c.width,c.height).data;
        for (let i=3;i<pixels.length;i+=4) if (pixels[i]) visiblePixels++;
        return { liveSkyDraws:window.__expansionSkyDraws, exactSpriteDraws, visiblePixels, art:target.artRef,
          id:target.id, png:c.toDataURL('image/png').split(',')[1] };
      }, { name, sky });
      expect(witness.liveSkyDraws).toBeGreaterThan(0);
      expect(witness.exactSpriteDraws).toBeGreaterThan(0);
      expect(witness.visiblePixels).toBeGreaterThan(0);
      const { png, ...receipt } = witness;
      await info.attach('native isolated placement projection', { body:Buffer.from(png,'base64'), contentType:'image/png' });
      await info.attach('scenery receipt', { body:JSON.stringify(receipt), contentType:'application/json' });
      expect(errors).toEqual([]);
    } catch (error) {
      await info.attach('startup state', { body:JSON.stringify(await page.evaluate(() => {
        const g=window.__game, e=g.raceEditor, s=e.playtestSession;
        return { state:g.state, status:e.status, preparation:e.racePlaytestPreparation?.phase,
          race:e.selectedRace?.name, sky:e.getRaceSkyboxSettings().artRef,
          running:s?.running, pending:s?.startupFramePending, elapsed:s?.elapsedMs, draws:window.__expansionSkyDraws };
      }).catch(() => null)), contentType:'application/json' });
      throw error;
    }
  });

  test('paired Opportunity route first drive', async ({ page }, info) => {
    test.setTimeout(300_000);
    const name='Mars — Opportunity Endeavour Rim';
    const baseline=process.env.SCENERY_OPPORTUNITY_BASELINE==='1';
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const snapshot=()=>page.evaluate(()=>{
      const g=window.__game, e=g?.raceEditor, s=e?.playtestSession;
      return {race:e?.selectedRace?.name,sky:e?.getRaceSkyboxSettings()?.artRef,weather:e?.getRaceWeatherState(),
        fx:e?.getRaceRenderVisualFx(),savedWeather:e?.selectedRace?.weather,
        savedFx:e?.selectedRace?.visualFx,state:g?.state,status:e?.status,
        diagnostics:g?.raceRuntimePreparation?.lastDiagnostics,
        session:s&&{running:s.running,elapsed:s.elapsedMs,speed:s.speedMps,x:s.worldX,z:s.worldZ}};
    });
    let before=null,after=null;
    try{
      await boot(page);
      const choices=await page.evaluate(async()=>{
        const {hydrateServerStorage}=await import('/src/ui/serverStorage.js');
        await hydrateServerStorage({folder:'races'});
        return window.__game.menuPlayer.resources.choices('races',{});
      });
      const selected=resolveDiagnosticRaceChoice(choices,name,raceIndex[name]);
      expect(await page.evaluate(race=>{
        const g=window.__game;g.setDisplayMode('color');
        return g.startRaceTravel({raceName:race,carSelection:'specific',carRef:'RTG-001'});
      },selected.value)).toBe(true);
      await page.waitForFunction(()=>{
        const g=window.__game,e=g.raceEditor,s=e.playtestSession;
        if(g.state==='prompt'&&!s?.running)throw Error('Opportunity left startup: '+e.status);
        return s?.running&&!s.startupFramePending&&s.elapsedMs>2000;
      },null,{timeout:180_000});
      before=await snapshot();
      expect(before.race).toBe(name);
      expect(before.sky).toBe(baseline?'':'environment-v1-endeavour');
      await page.screenshot({path:info.outputPath('opportunity-start.png')});
      await page.keyboard.down('g');
      try{
        await page.waitForFunction(({x,z})=>{
          const s=window.__game.raceEditor.playtestSession;
          return s?.running&&s.speedMps>1&&Math.hypot(s.worldX-x,s.worldZ-z)>.5;
        },before.session,{timeout:30_000});
        after=await snapshot();
        await page.screenshot({path:info.outputPath('opportunity-moving.png')});
      }finally{await page.keyboard.up('g');}
      expect(after.session.elapsed).toBeGreaterThan(before.session.elapsed);
      expect(after.savedWeather).toEqual(before.savedWeather);
      expect(after.savedFx).toEqual(before.savedFx);
      expect(errors).toEqual([]);
    }finally{
      await info.attach('Opportunity paired scope', {body:JSON.stringify({
        baseline,device:mobile?'handheld':'desktop',before,after,last:await snapshot().catch(()=>null),errors
      }),contentType:'application/json'});
    }
  });

  test('four regional fence definitions appear in the actual doodad picker', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.__game.enterRaceEditor());
    for (const ref of fences) {
      await page.evaluate(() => { void window.__game.raceEditor.openRaceDoodadPicker(); });
      const row = page.locator(`.project-browser-row[data-name="${ref}"]`);
      await row.getByRole('button', { name:'Open', exact:true }).click();
      const result = await page.evaluate(async ref => {
        const e = window.__game.raceEditor;
        if (e.selectedDoodadRef !== ref) throw Error('Wrong picker selection');
        const { hydrateProjectFilePayload } = await import('/src/ui/projectFiles.js');
        const doc = (await hydrateProjectFilePayload('doodads', ref)).data;
        if (!doc?.doodad) throw Error('Native fence document missing');
        await e.hydrateRaceArt(doc.doodad.artRef);
        const c = e.getRaceArtSpriteCanvas(doc.doodad.artRef);
        return { ref:doc.doodad.artRef, isFence:doc.doodad.isFence, art:!!c?.width };
      }, ref);
      expect(result).toEqual({ ref, isFence:true, art:true });
    }
  });
});
