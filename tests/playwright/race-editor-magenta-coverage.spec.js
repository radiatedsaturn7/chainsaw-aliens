import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
  await page.waitForFunction(() => window.__game.state !== 'loading');
}

const COVERAGE_CASES = [
  { name: 'direct-640x360-three', width: 640, height: 360, mode: 'direct', threeEnabled: true },
  { name: 'direct-640x360-webgl', width: 640, height: 360, mode: 'direct', threeEnabled: false },
  { name: 'portrait-390x844-three', width: 390, height: 844, mode: 'handheld', threeEnabled: true },
  { name: 'portrait-390x844-webgl', width: 390, height: 844, mode: 'handheld', threeEnabled: false }
];

COVERAGE_CASES.forEach((coverageCase) => {
test(`Race Editor Studio Sprint ${coverageCase.name} frames expose no magenta terrain holes`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: coverageCase.width, height: coverageCase.height });
  await waitForGameReady(page);

  const samples = await page.evaluate(async (config) => {
    const game = window.__game;
    game.setViewport?.({
      width: config.width,
      height: config.height,
      scale: 1,
      dpr: 1,
      isMobile: config.mode === 'handheld'
    });
    game.updateControlScheme?.();
    game.enterRaceEditor();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const editor = game.raceEditor;
    editor.selectedRace.groundRenderer = 'webgl-track';
    editor.selectedRace.renderDebug = {
      ...(editor.selectedRace.renderDebug || {}),
      trackEnabled: true,
      terrainEnabled: true,
      texturesEnabled: true,
      detailEnabled: false,
      threeEnabled: config.threeEnabled,
      terrainBudgetEnabled: true,
      overlaysEnabled: true
    };
    editor.raceInput.cameraView = 'third-person';
    editor.startPlaytest(editor.project.selectedCarId);
    editor.playtestSession.launchLockMs = 0;
    editor.playtestSession.elapsedMs = 4000;
    editor.playtestSession.running = true;
    editor.playtestSession.speedMps = 30 * 0.44704;
    editor.playtestSession.routeRuntimeType = editor.getSelectedRaceRuntimeType();
    editor.playtestSession.routeLength = editor.getRaceRouteLength();
    editor.precomputeRacePlaytestWorld?.();

    const canvas = game.canvas;
    const ctx = game.ctx;
    const width = canvas.width;
    const height = canvas.height;
    const handheldLayout = config.mode === 'handheld'
      ? editor.getRaceHandheldLayout(width, height)
      : null;
    const bounds = handheldLayout?.screen || { x: 0, y: 0, w: width, h: height };
    const routeLength = Math.max(1, editor.playtestSession.routeLength);
    const sampleStepM = Math.max(6, Math.min(14, routeLength / 120));
    const addFrame = (frames, direction, label, distance) => {
      const clamped = Math.max(0, Math.min(routeLength, Number(distance) || 0));
      const key = `${direction}:${Math.round(clamped * 10)}`;
      if (frames.some((frame) => frame.key === key)) return;
      frames.push({
        key,
        direction,
        label: `${direction}-${label}`,
        distance: clamped
      });
    };
    const buildFrameSpecs = (direction) => {
      const frames = [];
      addFrame(frames, direction, 'start', 0);
      addFrame(frames, direction, 'progress-18', routeLength * 0.18);
      addFrame(frames, direction, 'progress-34', routeLength * 0.34);
      addFrame(frames, direction, 'start-approach', Math.min(8, routeLength * 0.02));
      addFrame(frames, direction, 'node-4-bend', routeLength * 0.38);
      addFrame(frames, direction, 'mid-route', routeLength * 0.52);
      addFrame(frames, direction, 'final-bend', routeLength * 0.76);
      addFrame(frames, direction, 'finish-approach', Math.max(0, routeLength - 28));
      addFrame(frames, direction, 'finish', routeLength);
      if (direction === 'forward') {
        for (let distance = 0; distance <= routeLength; distance += sampleStepM) {
          addFrame(frames, direction, `${Math.round(distance)}m`, distance);
        }
      } else {
        for (let distance = routeLength; distance >= 0; distance -= sampleStepM) {
          addFrame(frames, direction, `${Math.round(distance)}m`, distance);
        }
      }
      return frames.sort((a, b) => (
        direction === 'forward'
          ? a.distance - b.distance
          : b.distance - a.distance
      ));
    };
    const frameSpecs = [
      ...buildFrameSpecs('forward'),
      ...buildFrameSpecs('backward')
    ];

    const rendered = [];
    for (const frame of frameSpecs) {
      const distance = Math.max(0, Math.min(routeLength, frame.distance));
      const pose = editor.getRaceWorldPoseAtDistance(distance, { runtimeType: editor.playtestSession.routeRuntimeType });
      const reverseYawOffset = frame.direction === 'backward' ? Math.PI : 0;
      const yaw = pose.yaw + reverseYawOffset;
      editor.playtestSession.distance = distance;
      editor.playtestSession.projectedDistance = distance;
      editor.playtestSession.previousDistance = frame.direction === 'backward'
        ? Math.min(routeLength, distance + 1)
        : Math.max(0, distance - 1);
      editor.playtestSession.worldX = pose.x;
      editor.playtestSession.worldZ = pose.z;
      editor.playtestSession.carYaw = yaw;
      editor.playtestSession.velocityYaw = yaw;
      editor.playtestSession.cameraYaw = yaw;
      editor.playtestSession.lateral = 0;
      editor.playtestSession.roadViewOffset = 0;
      editor.playtestSession.trackViewOffset = 0;
      editor.playtestSession.cameraView = 'third-person';

      ctx.clearRect(0, 0, width, height);
      if (config.mode === 'handheld') {
        editor.drawRacePlaytestScreen(ctx, bounds);
      } else {
        editor.drawRaceProjectedRoadPath(ctx, bounds, { showPlaytestHud: false });
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const image = ctx.getImageData(0, 0, width, height);
      let magentaPixels = 0;
      let blackVoidPixels = 0;
      let skyColoredPixels = 0;
      let checkedPixels = 0;
      const horizonY = Math.max(bounds.y + 1, Math.min(bounds.y + bounds.h - 1, Math.round(bounds.y + bounds.h * Number(editor.lastRaceRenderCamera?.camera?.horizonRatio || 0.32))));
      const skyBottom = Math.max(1, Math.floor(horizonY * 0.72));
      for (let y = Math.max(0, Math.floor(bounds.y)); y < Math.min(height, Math.ceil(bounds.y + bounds.h)); y += 1) {
        for (let x = Math.max(0, Math.floor(bounds.x)); x < Math.min(width, Math.ceil(bounds.x + bounds.w)); x += 1) {
          const offset = (y * width + x) * 4;
          const r = image.data[offset];
          const g = image.data[offset + 1];
          const b = image.data[offset + 2];
          const a = image.data[offset + 3];
          if (a > 200 && r > 220 && b > 220 && g < 45) magentaPixels += 1;
          if (y > horizonY + 3 && a > 220 && r < 6 && g < 6 && b < 6) blackVoidPixels += 1;
          if (y < skyBottom) {
            checkedPixels += 1;
            const isBlank = a < 20 || (r < 8 && g < 8 && b < 8);
            const isMagenta = a > 200 && r > 220 && b > 220 && g < 45;
            if (!isBlank && !isMagenta) skyColoredPixels += 1;
          }
        }
      }
      rendered.push({
        ...frame,
        distance,
        magentaPixels,
        blackVoidPixels,
        skyCoverage: checkedPixels ? skyColoredPixels / checkedPixels : 0,
        stats: editor.lastRaceRenderStats || null,
        dataUrl: magentaPixels > 0 || blackVoidPixels > 0 || (checkedPixels && skyColoredPixels / checkedPixels < 0.65)
          ? canvas.toDataURL('image/png')
          : ''
      });
    }
    return rendered;
  }, coverageCase);

  const worst = samples.reduce((current, sample) => (
    sample.magentaPixels > current.magentaPixels ? sample : current
  ), samples[0]);
  const worstBlackVoid = samples.reduce((current, sample) => (
    sample.blackVoidPixels > current.blackVoidPixels ? sample : current
  ), samples[0]);
  const missingSky = samples.find((sample) => sample.skyCoverage < 0.65);
  if (worst?.magentaPixels > 0 || worstBlackVoid?.blackVoidPixels > 0 || missingSky) {
    const diagnosticFrame = worst?.magentaPixels > 0 ? worst : worstBlackVoid?.blackVoidPixels > 0 ? worstBlackVoid : missingSky;
    const dataUrl = diagnosticFrame?.dataUrl || '';
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    if (base64) {
      await testInfo.attach(`studio-sprint-${diagnosticFrame?.label || 'frame'}.png`, {
        body: Buffer.from(base64, 'base64'),
        contentType: 'image/png'
      });
    }
  }

  expect(missingSky, `Studio Sprint skybox/background missing in frame ${missingSky?.label || 'unknown'}`).toBeFalsy();
  expect(worstBlackVoid.blackVoidPixels, `Studio Sprint frame ${worstBlackVoid.label} exposed ${worstBlackVoid.blackVoidPixels} black void pixels`).toBe(0);
  expect(worst.magentaPixels, `Studio Sprint frame ${worst.label} exposed ${worst.magentaPixels} magenta pixels`).toBe(0);
  for (const sample of samples) {
    expect(sample.stats?.terrainCoverageDropped || 0, `${coverageCase.name} frame ${sample.label} dropped base terrain coverage`).toBe(0);
    if (coverageCase.threeEnabled) {
      expect(sample.stats?.threeTerrainRenderer || 0, `${coverageCase.name} frame ${sample.label} did not use Three terrain`).toBe(1);
      expect(sample.stats?.threeTerrainPolygons || 0, `${coverageCase.name} frame ${sample.label} had no Three terrain polygons`).toBeGreaterThan(0);
    } else {
      expect(sample.stats?.threeTerrainRenderer || 0, `${coverageCase.name} frame ${sample.label} unexpectedly used Three terrain`).toBe(0);
      expect(sample.stats?.terrainWorldMeshPolygons || 0, `${coverageCase.name} frame ${sample.label} had no custom WebGL terrain polygons`).toBeGreaterThan(0);
    }
  }
});
});
