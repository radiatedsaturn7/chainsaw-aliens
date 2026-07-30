import { test, expect } from '@playwright/test';
import { seedRaceRuntimeFixtures } from './helpers/race-runtime-fixtures.js';

async function waitForGameReady(page) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__gameReady && window.__game));
}

test('dark solid art remains visible in Level Editor and startup race travel fires once', async ({ page }) => {
  await waitForGameReady(page);

  const result = await page.evaluate(async () => {
    const game = window.__game;
    game.enterEditor();
    const size = 24;
    const blackFrame = Array(16 * 16).fill('#000000');
    const data = {
      schemaVersion: 1,
      tileSize: 32,
      width: size,
      height: size,
      spawn: { x: 12, y: 12 },
      tiles: Array.from({ length: size }, (_, y) => (
        y === 12
          ? `${'.'.repeat(10)}#${'.'.repeat(size - 11)}`
          : '.'.repeat(size)
      )),
      regions: [],
      enemies: [],
      elevatorPaths: [],
      elevators: [],
      pixelArt: {
        tiles: {
          '#': {
            size: 16,
            fps: 6,
            frames: [blackFrame]
          }
        }
      },
      musicZones: [],
      midiTracks: [],
      triggers: [],
      decals: []
    };
    game.applyWorldData(data);
    game.editor.resetView();
    game._drawByState();

    const solidCenter = game.editor.worldToScreen(10.5 * 32, 12.5 * 32);
    const emptyCenter = game.editor.worldToScreen(11.5 * 32, 12.5 * 32);
    const scaleX = game.canvas.width / Math.max(1, game.viewport.width || game.canvas.width);
    const scaleY = game.canvas.height / Math.max(1, game.viewport.height || game.canvas.height);
    const sample = (point) => Array.from(game.ctx.getImageData(
      Math.max(0, Math.min(game.canvas.width - 1, Math.round(point.x * scaleX))),
      Math.max(0, Math.min(game.canvas.height - 1, Math.round(point.y * scaleY))),
      1,
      1
    ).data);
    const solidPixel = sample(solidCenter);
    const emptyPixel = sample(emptyCenter);

    data.triggers = [{
      id: 'startup-race',
      rect: [10, 10, 2, 2],
      condition: 'On level start',
      fireOnce: false,
      actions: [{
        id: 'start-race',
        type: 'start-race',
        params: {
          raceName: 'Studio Sprint',
          carSelection: 'specific',
          carRef: '2022 Subaru WRX'
        }
      }]
    }];
    game.applyWorldData(data);
    let starts = 0;
    game.startRaceTravel = async () => {
      starts += 1;
      game.transitionTo('race-editor', { forceCleanup: true });
      return true;
    };
    game.exitEditor({ playtest: true });
    await Promise.resolve();
    await Promise.resolve();

    return {
      solidPixel,
      emptyPixel,
      starts,
      state: game.state,
      playtestActive: game.playtestActive
    };
  });

  expect(result.solidPixel[2]).toBeGreaterThan(result.emptyPixel[2] + 8);
  expect(result.starts).toBe(1);
  expect(result.state).toBe('race-editor');
  expect(result.playtestActive).toBeTruthy();
});

test('cold level-to-race travel keeps loading, preparation, and first frames responsive', async ({ page }) => {
  await waitForGameReady(page);
  await seedRaceRuntimeFixtures(page);

  await page.evaluate(async () => {
    const game = window.__game;
    const levelResponse = await fetch('/__storage/file?folder=levels&name=levelA');
    const levelPayload = await levelResponse.json();
    const levelDocument = levelPayload?.file?.data;
    if (!levelDocument) throw new Error('levelA could not be loaded');
    game.enterEditor();
    game.applyWorldData(levelDocument);
    game.exitEditor({ playtest: true });
    window.__racePreparationTicks = 0;
    window.__racePreparationMaxProgress = 0;
    window.__racePreparationMaxTickGapMs = 0;
    window.__racePreparationLastTickAt = performance.now();
    window.__raceSynchronousStorageReads = 0;
    window.__raceEngineStartedBeforeFirstFrame = 0;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    window.__raceOriginalXhrOpen = originalXhrOpen;
    XMLHttpRequest.prototype.open = function trackedOpen(method, url, async = true, ...rest) {
      if (async === false && String(url || '').includes('/__storage/file')) {
        window.__raceSynchronousStorageReads += 1;
      }
      return originalXhrOpen.call(this, method, url, async, ...rest);
    };
    const originalPlaySfxById = game.playSfxById?.bind(game);
    if (originalPlaySfxById) {
      game.playSfxById = (sfxId, options = {}) => {
        if (options?.key === 'race-engine'
          && game.raceEditor?.playtestSession?.startupFramePending === true) {
          window.__raceEngineStartedBeforeFirstFrame += 1;
        }
        return originalPlaySfxById(sfxId, options);
      };
    }
    const originalArmRacePreparationWatchdog = game.raceEditor.armRacePreparationWatchdog;
    game.raceEditor.armRacePreparationWatchdog = function armRacePreparationWatchdog(preparation, options = {}) {
      window.__racePreparationMaxProgress = Math.max(
        window.__racePreparationMaxProgress,
        Number(options.progress || preparation?.progress || 0)
      );
      return originalArmRacePreparationWatchdog.call(this, preparation, options);
    };
    window.__racePreparationTimer = window.setInterval(() => {
      const now = performance.now();
      window.__racePreparationMaxTickGapMs = Math.max(
        window.__racePreparationMaxTickGapMs,
        now - window.__racePreparationLastTickAt
      );
      window.__racePreparationLastTickAt = now;
      window.__racePreparationTicks += 1;
      window.__racePreparationMaxProgress = Math.max(
        window.__racePreparationMaxProgress,
        Number(game.raceEditor?.racePlaytestPreparation?.progress || 0)
      );
    }, 16);
    const originalStartRaceTravel = game.startRaceTravel.bind(game);
    game.startRaceTravel = (params) => {
      window.__raceStartPromise = originalStartRaceTravel(params);
      return window.__raceStartPromise;
    };
    game.updateWorldTriggers(16, 12);
  });

  await page.waitForFunction(() => Boolean(window.__raceStartPromise));
  await page.waitForFunction(() => (
    window.__game?.raceEditor?.playtestSession
    && window.__game.raceEditor.playtestSession.preparing === false
  ), null, { timeout: 45_000 });
  await page.waitForFunction(() => (
    window.__game?.raceEditor?.playtestSession?.startupFramePending === false
    && Number(window.__game.raceEditor.playtestSession.countdownRemainingMs || 0) <= 0
    && Number(window.__game.raceEditor.playtestSession.elapsedMs || 0) > 0
  ), null, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const started = await window.__raceStartPromise;
    window.clearInterval(window.__racePreparationTimer);
    const synchronousStorageReads = window.__raceSynchronousStorageReads;
    if (window.__raceOriginalXhrOpen) {
      XMLHttpRequest.prototype.open = window.__raceOriginalXhrOpen;
      window.__raceOriginalXhrOpen = null;
    }
    const editor = window.__game.raceEditor;
    const runtimeCar = editor.getRaceSessionCar(editor.playtestSession);
    const visibility = editor.getCarArtLayerVisibility(runtimeCar);
    const runtimeBodyArtRef = String(runtimeCar?.art?.body || runtimeCar?.art?.artRef || '');
    const preparedBodyFrame = runtimeBodyArtRef
      ? editor.racePreparedArtFrames?.has?.(`${runtimeBodyArtRef}:frame:0`) === true
      : false;
    editor.toggleRacePause();
    const pauseResponsive = editor.raceInput?.paused === true;
    editor.toggleRacePause();
    const wheelContacts = Object.values(editor.playtestSession?.vehicle3d?.wheels || {});
    const response = await fetch('/__storage/file?folder=races&name=Studio%20Sprint2');
    const payload = await response.json();
    const savedDocument = payload?.file?.data;
    const savedRace = savedDocument?.race || savedDocument;
    const summarizeTerrain = (race) => {
      const tileMap = race?.road?.tileMap || {};
      const packed = tileMap.runtimePackedCells;
      const cells = Object.values(tileMap.cells || {});
      const artRefs = packed?.packed === true
        ? [...new Set((packed.artRefs || []).filter(Boolean))].sort()
        : [...new Set(cells.map((cell) => String(cell?.artRef || cell?.tileArtRef || '')).filter(Boolean))].sort();
      const elevations = packed?.packed === true
        ? Array.from(packed.elevations || [])
        : cells.map((cell) => Number(cell?.elevation || 0));
      return {
        count: packed?.packed === true ? Number(packed.count || 0) : cells.length,
        artRefs,
        nonzeroElevationCount: elevations.filter((value) => Math.abs(value) > 0.0005).length,
        elevationSum: Math.round(elevations.reduce((sum, value) => sum + value, 0) * 1000) / 1000
      };
    };
    const savedTerrain = summarizeTerrain(savedRace);
    const loadedTerrain = summarizeTerrain(editor.selectedRace);
    const referenceEditor = new editor.constructor({
      deviceIsMobile: false,
      isMobile: false,
      exitRaceEditor() {}
    });
    referenceEditor.applyLoadedRaceDocument(savedDocument, { name: 'Studio Sprint2' });
    const routeLength = editor.getRaceRouteLength();
    const profileDistances = [0, 92.5, 170, 227.5, Math.max(0, routeLength - 90), routeLength];
    const roadProfileDeltas = profileDistances.map((distance) => {
      const options = {
        runtimeType: editor.getSelectedRaceRuntimeType(),
        routeLength,
        allowVisualExtension: true
      };
      const loaded = editor.getRaceRoadSurfaceProfileAtDistance(distance, options);
      const reference = referenceEditor.getRaceRoadSurfaceProfileAtDistance(distance, options);
      return Math.abs(Number(loaded.elevation || 0) - Number(reference.elevation || 0));
    });
    const expectedBakeKey = editor.getRaceWorldBakeKey(editor.getRacePlaytestWorldBakeOptions());
    const packedTerrain = editor.playtestSession?.worldBake?.packedTerrain;
    const packedSampler = editor.playtestSession?.worldBake?.surfaceSampler;
    const groundArtRef = String(editor.playtestSession?.worldBake?.groundArtRef || '');
    const groundArtCanvas = groundArtRef ? editor.getRaceArtSpriteCanvas(groundArtRef) : null;
    const effectiveTextureWorldM = editor.getRaceEffectiveGroundTextureWorldM(groundArtCanvas);
    const rearLeftWheel = editor.playtestSession?.vehicle3d?.wheels?.rl;
    const initialContact = rearLeftWheel?.contactPoint || {
      x: Number(editor.playtestSession?.worldX || 0),
      y: Number(editor.playtestSession?.heightM || 0),
      z: Number(editor.playtestSession?.worldZ || 0)
    };
    if (rearLeftWheel) {
      rearLeftWheel.inContact = true;
      rearLeftWheel.surfaceId = 'asphalt';
      rearLeftWheel.region = 'road';
      rearLeftWheel.surface = { surfaceId: 'asphalt', region: 'road' };
      rearLeftWheel.contactPoint = { ...initialContact };
    }
    const tireTrackContext = {
      speedMps: 14,
      wheelContactScaleByWheel: { fl: 0, fr: 0, rl: 1, rr: 0 },
      tireSlipByWheel: { rl: 0.8 },
      wheelSpinByWheel: { rl: 0 },
      brakeState: { lockByWheel: { rl: 0 } },
      wheelSurfaceState: {
        surfaceByWheel: { rl: 'asphalt' },
        terrainByWheel: { rl: 'road' },
        positions: {}
      }
    };
    editor.updateRaceTireTracks(tireTrackContext);
    if (rearLeftWheel) {
      rearLeftWheel.contactPoint = {
        ...initialContact,
        z: Number(initialContact.z || 0) + 0.5
      };
    }
    editor.updateRaceTireTracks(tireTrackContext);
    const tireTrackStats = {};
    const tireTrackRenderer = editor.raceThreeWorldRenderer;
    const tireTrackRendererActive = editor.syncRaceThreeTireTracks(tireTrackRenderer, {
      session: editor.playtestSession,
      stats: tireTrackStats
    });
    const tireTrackNormalYs = [...(tireTrackRenderer?.tireTrackChunks?.values?.() || [])]
      .flatMap((chunk) => {
        const positions = chunk.mesh.geometry.getAttribute('position').array;
        const normalYs = [];
        for (let offset = 0; offset + 8 < positions.length; offset += 9) {
          const abX = positions[offset + 3] - positions[offset];
          const abZ = positions[offset + 5] - positions[offset + 2];
          const acX = positions[offset + 6] - positions[offset];
          const acZ = positions[offset + 8] - positions[offset + 2];
          normalYs.push(abZ * acX - abX * acZ);
        }
        return normalYs;
      });
    const output = {
      started,
      ticks: window.__racePreparationTicks,
      maxPreparationTickGapMs: window.__racePreparationMaxTickGapMs,
      maxPreparationProgress: window.__racePreparationMaxProgress,
      synchronousStorageReads,
      engineStartedBeforeFirstFrame: window.__raceEngineStartedBeforeFirstFrame,
      startupFramePending: editor.playtestSession?.startupFramePending === true,
      running: editor.playtestSession?.running === true,
      raceDocumentName: editor.playtestSession?.raceDocumentName || '',
      terrainDocumentParity: JSON.stringify(loadedTerrain) === JSON.stringify(savedTerrain),
      savedTerrainCellCount: savedTerrain.count,
      loadedTerrainCellCount: loadedTerrain.count,
      maxRoadProfileDelta: Math.max(...roadProfileDeltas),
      preparedBakeMatchesDocument: editor.playtestSession?.worldBake?.key === expectedBakeKey,
      terrainObjects: editor.playtestSession?.worldBake?.terrainCells?.length || 0,
      packedTerrainTriangles: packedTerrain?.triangleCount || 0,
      packedTerrainHasWorkerUvs: packedTerrain?.uvs instanceof Float32Array
        && packedTerrain.uvs.length === (packedTerrain.positions?.length || 0) / 3 * 2,
      samplerTriangles: packedSampler?.triangleCount || 0,
      samplerVersion: packedSampler?.version || 0,
      samplerPositionPrecision: packedSampler?.positions?.constructor?.name || '',
      samplerNormalPrecision: packedSampler?.normals?.constructor?.name || '',
      effectiveTextureWorldM,
      overlaysEnabled: editor.getRaceRenderDebugSettings().overlaysEnabled,
      asphaltSkidEnabled: editor.getRaceTireFxSlotSettings('asphaltSkid').enabled,
      tireTrackSegments: editor.playtestSession?.tireTrackSegments?.length || 0,
      tireTrackRendererActive,
      tireTrackGpuVertices: tireTrackStats.tireTrackGpuVertices || 0,
      tireTrackMinimumNormalY: tireTrackNormalYs.length ? Math.min(...tireTrackNormalYs) : 0,
      carDocumentName: runtimeCar?.__playtestDocumentName || '',
      frontWheelsVisible: visibility.frontWheels,
      rearWheelsVisible: visibility.rearWheels,
      cameraTrackingMode: editor.getCarCameraTrackingMode(runtimeCar),
      runtimeCarIsSnapshot: runtimeCar !== editor.selectedCar,
      runtimeBodyArtRef,
      preparedBodyFrame,
      countdownCompleted: Number(editor.playtestSession?.countdownRemainingMs || 0) <= 0,
      elapsedRaceTimeMs: Number(editor.playtestSession?.elapsedMs || 0),
      pauseResponsive,
      grounded: editor.playtestSession?.grounded === true,
      contactCount: wheelContacts.filter((wheel) => wheel?.inContact).length,
      verticalVelocityMps: Math.abs(Number(editor.playtestSession?.verticalVelocityMps || 0))
    };
    editor.endPlaytest();
    return output;
  });

  expect(result.ticks).toBeGreaterThan(5);
  expect(result.maxPreparationTickGapMs).toBeLessThan(1500);
  expect(result.maxPreparationProgress).toBeGreaterThanOrEqual(0.99);
  expect(result.synchronousStorageReads).toBe(0);
  expect(result.engineStartedBeforeFirstFrame).toBe(0);
  expect(result.startupFramePending).toBeFalsy();
  expect(result.started).toBeTruthy();
  expect(result.running).toBeTruthy();
  expect(result.raceDocumentName).toBe('Studio Sprint2');
  expect(result.savedTerrainCellCount).toBeGreaterThan(0);
  expect(result.loadedTerrainCellCount).toBe(result.savedTerrainCellCount);
  expect(result.terrainDocumentParity).toBeTruthy();
  expect(result.maxRoadProfileDelta).toBeLessThan(0.000001);
  expect(result.preparedBakeMatchesDocument).toBeTruthy();
  expect(result.terrainObjects).toBe(0);
  expect(result.packedTerrainTriangles).toBeGreaterThan(0);
  expect(result.packedTerrainHasWorkerUvs).toBeTruthy();
  expect(result.samplerTriangles).toBeGreaterThan(0);
  expect(result.samplerVersion).toBe(2);
  expect(result.samplerPositionPrecision).toBe('Float64Array');
  expect(result.samplerNormalPrecision).toBe('Float64Array');
  expect(result.effectiveTextureWorldM).toBeCloseTo(16.032, 3);
  expect(result.overlaysEnabled).toBeTruthy();
  expect(result.asphaltSkidEnabled).toBeTruthy();
  expect(result.tireTrackSegments).toBeGreaterThan(0);
  expect(result.tireTrackRendererActive).toBeTruthy();
  expect(result.tireTrackGpuVertices).toBeGreaterThan(0);
  expect(result.tireTrackMinimumNormalY).toBeGreaterThan(0);
  expect(result.carDocumentName).toBe('2022 Subaru WRX2');
  expect(result.frontWheelsVisible).toBeFalsy();
  expect(result.rearWheelsVisible).toBeTruthy();
  expect(result.cameraTrackingMode).toBe('fixed-rear');
  expect(result.runtimeCarIsSnapshot).toBeTruthy();
  expect(result.runtimeBodyArtRef).toBe('rtg-001');
  expect(result.preparedBodyFrame).toBeTruthy();
  expect(result.countdownCompleted).toBeTruthy();
  expect(result.elapsedRaceTimeMs).toBeGreaterThan(0);
  expect(result.pauseResponsive).toBeTruthy();
  expect(result.grounded).toBeTruthy();
  expect(result.contactCount).toBeGreaterThanOrEqual(2);
  expect(result.verticalVelocityMps).toBeLessThan(0.75);
});

test('Race and Car Editor browser starts avoid main-thread world prewarm', async ({ page }) => {
  await waitForGameReady(page);
  await seedRaceRuntimeFixtures(page);

  await page.evaluate(async () => {
    const editor = window.__game.raceEditor;
    const response = await fetch('/__storage/file?folder=races&name=Studio%20Sprint2');
    const payload = await response.json();
    if (!payload?.file?.data) throw new Error('Studio Sprint2 could not be loaded');
    window.__game.transitionTo('race-editor', { forceCleanup: true });
    editor.applyLoadedRaceDocument(payload.file.data, { name: 'Studio Sprint2' });
    window.__directRaceMainBuilds = 0;
    window.__directRacePreloads = 0;
    window.__directRacePrewarms = 0;
    const originalBuild = editor.buildRaceWorldBake.bind(editor);
    const originalPreload = editor.preloadSelectedRaceArtRefs.bind(editor);
    const originalPrewarm = editor.prewarmRacePlaytestRenderResources.bind(editor);
    editor.buildRaceWorldBake = (...args) => {
      window.__directRaceMainBuilds += 1;
      return originalBuild(...args);
    };
    editor.preloadSelectedRaceArtRefs = (...args) => {
      window.__directRacePreloads += 1;
      return originalPreload(...args);
    };
    editor.prewarmRacePlaytestRenderResources = (...args) => {
      window.__directRacePrewarms += 1;
      return originalPrewarm(...args);
    };
    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });
  });

  await page.waitForFunction(() => (
    window.__game?.raceEditor?.playtestSession?.running === true
    && window.__game.raceEditor.playtestSession.startupFramePending === false
  ), null, { timeout: 45_000 });
  await page.waitForFunction(() => (
    Number(window.__game?.raceEditor?.playtestSession?.countdownRemainingMs || 0) <= 0
    && Number(window.__game?.raceEditor?.playtestSession?.elapsedMs || 0) > 0
  ), null, { timeout: 10_000 });

  const directRace = await page.evaluate(() => {
    const editor = window.__game.raceEditor;
    const result = {
      mainBuilds: window.__directRaceMainBuilds,
      preloads: window.__directRacePreloads,
      prewarms: window.__directRacePrewarms,
      running: editor.playtestSession?.running === true,
      packedTerrainTriangles: editor.playtestSession?.worldBake?.packedTerrain?.triangleCount || 0,
      retainedTerrainObjects: editor.playtestSession?.worldBake?.terrainCells?.length || 0
    };
    editor.endPlaytest();
    return result;
  });

  expect(directRace.mainBuilds).toBe(0);
  expect(directRace.preloads).toBe(0);
  expect(directRace.prewarms).toBe(0);
  expect(directRace.running).toBeTruthy();
  expect(directRace.packedTerrainTriangles).toBeGreaterThan(0);
  expect(directRace.retainedTerrainObjects).toBe(0);

  await page.evaluate(() => {
    window.__game.enterCarEditor();
    const editor = window.__game.carEditor;
    window.__carPreviewPrewarms = 0;
    const originalPrewarm = editor.prewarmRacePlaytestRenderResources.bind(editor);
    editor.prewarmRacePlaytestRenderResources = (...args) => {
      window.__carPreviewPrewarms += 1;
      return originalPrewarm(...args);
    };
    window.__carPreviewInitialResult = editor.ensureCarEditorPreviewPlaytestSession();
  });

  await page.waitForFunction(() => (
    window.__game?.carEditor?.carEditorPreviewPlaytest?.session?.running === true
    && !window.__game.carEditor.carEditorPreviewPreparation
  ), null, { timeout: 45_000 });
  await page.waitForFunction(() => (
    window.__game?.carEditor?.carEditorPreviewPlaytest?.session?.startupFramePending === false
    && Number(window.__game.carEditor.carEditorPreviewPlaytest.session.distance || 0) > 0
  ), null, { timeout: 10_000 });

  const carPreview = await page.evaluate(() => {
    const editor = window.__game.carEditor;
    const initialSession = editor.carEditorPreviewPlaytest?.session;
    const initialWorldBake = initialSession?.worldBake;
    const originalNow = editor.getNowMs.bind(editor);
    editor.selectedCar.tuning = {
      ...(editor.selectedCar.tuning || {}),
      powerMultiplier: Number(editor.selectedCar.tuning?.powerMultiplier || 1) + 0.01
    };
    editor.getNowMs = () => 10000;
    editor.ensureCarEditorPreviewPlaytestSession();
    editor.getNowMs = () => 14001;
    editor.ensureCarEditorPreviewPlaytestSession();
    editor.getNowMs = originalNow;
    return {
      initialWasPending: window.__carPreviewInitialResult === null,
      initialDistance: Number(initialSession?.distance || 0),
      prewarms: window.__carPreviewPrewarms,
      running: editor.carEditorPreviewPlaytest?.session?.running === true,
      countdownRemainingMs:
        Number(editor.carEditorPreviewPlaytest?.session?.countdownRemainingMs || 0),
      distance: Number(editor.carEditorPreviewPlaytest?.session?.distance || 0),
      packedTerrainTriangles:
        editor.carEditorPreviewPlaytest?.session?.worldBake?.packedTerrain?.triangleCount || 0,
      tuningRestartedSession: editor.carEditorPreviewPlaytest?.session !== initialSession,
      reusedWorldBake: editor.carEditorPreviewPlaytest?.session?.worldBake === initialWorldBake,
      spawnedPreparation: Boolean(editor.carEditorPreviewPreparation),
      selectedBodyArtRef: editor.getCarEditorPreviewBodyArtRef(editor.selectedCar),
      runtimeBodyArtRef: editor.getCarEditorPreviewBodyArtRef(
        editor.carEditorPreviewPlaytest?.session?.runtimeCar
      ),
      runtimeCarIsSnapshot:
        editor.carEditorPreviewPlaytest?.session?.runtimeCar !== editor.selectedCar
    };
  });

  expect(carPreview.initialWasPending).toBeTruthy();
  expect(carPreview.prewarms).toBe(0);
  expect(carPreview.running).toBeTruthy();
  expect(carPreview.countdownRemainingMs).toBe(0);
  expect(carPreview.initialDistance).toBeGreaterThan(0);
  expect(carPreview.packedTerrainTriangles).toBeGreaterThan(0);
  expect(carPreview.tuningRestartedSession).toBeTruthy();
  expect(carPreview.reusedWorldBake).toBeTruthy();
  expect(carPreview.spawnedPreparation).toBeFalsy();
  expect(carPreview.runtimeBodyArtRef).toBe(carPreview.selectedBodyArtRef);
  expect(carPreview.runtimeCarIsSnapshot).toBeTruthy();
});

test('levelA Studio Sprint2 trigger lets the saved WRX2 reach the finish', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForGameReady(page);
  await seedRaceRuntimeFixtures(page);

  await page.evaluate(async () => {
    const game = window.__game;
    const levelResponse = await fetch('/__storage/file?folder=levels&name=levelA');
    const levelPayload = await levelResponse.json();
    const levelDocument = levelPayload?.file?.data;
    if (!levelDocument) throw new Error('levelA could not be loaded');
    const originalCompleteRaceTravel = game.completeRaceTravel.bind(game);
    window.__wrx2Finish = null;
    game.completeRaceTravel = (finishBehavior, context) => {
      window.__wrx2Finish = {
        finishBehavior,
        context,
        capturedAt: performance.now()
      };
      return originalCompleteRaceTravel(finishBehavior, context);
    };
    game.enterEditor();
    game.applyWorldData(levelDocument);
    game.exitEditor({ playtest: true });
    game.updateWorldTriggers(16, 12);
  });

  await page.waitForFunction(() => (
    window.__game?.raceEditor?.playtestSession?.running === true
    && window.__game.raceEditor.playtestSession.startupFramePending === false
    && Number(window.__game.raceEditor.playtestSession.countdownRemainingMs || 0) <= 0
  ), null, { timeout: 55_000 });

  const result = await page.evaluate(async () => {
    const editor = window.__game.raceEditor;
    const initialSession = editor.playtestSession;
    const runtimeCar = editor.getRaceSessionCar(initialSession);
    const routeLength = Math.max(1, Number(initialSession?.routeLength || editor.getRaceRouteLength()));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const normalizeAngle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
    let maximumDistance = Number(initialSession?.distance || 0);
    let updateFailed = false;

    for (let frame = 0; frame < 90 * 60 && editor.playtestSession; frame += 1) {
      const session = editor.playtestSession;
      const projection = editor.getRaceRouteProjectionForWorldPoint({
        x: Number(session.worldX || 0),
        z: Number(session.worldZ || 0)
      });
      const currentDistance = Number(projection?.distance ?? session.distance ?? 0);
      const lookAheadDistance = currentDistance
        + clamp(Math.abs(Number(session.speedMps || 0)) * 2.4 + 32, 28, 90);
      const routeOptions = {
        runtimeType: session.routeRuntimeType || editor.getSelectedRaceRuntimeType(),
        routeLength
      };
      const targetPose = editor.getRaceWorldPoseAtDistance(lookAheadDistance, routeOptions);
      const nearPose = editor.getRaceWorldPoseAtDistance(currentDistance + 8, routeOptions);
      const targetYaw = Number(targetPose.yaw || session.carYaw || 0);
      const nearYaw = Number(nearPose.yaw || targetYaw);
      const blendedTargetYaw = normalizeAngle(
        nearYaw + normalizeAngle(targetYaw - nearYaw) * 0.72
      );
      const yawError = normalizeAngle(blendedTargetYaw - Number(session.carYaw || 0));
      const lateral = clamp(
        Number(projection?.lateral || 0) / Math.max(1, editor.getRaceRoadHalfWidthWorld()),
        -1.5,
        1.5
      );
      const sharpTurn = Math.abs(yawError) > 0.34;
      const currentSpeed = Math.abs(Number(session.speedMps || 0));
      editor.raceInput.keyboardThrottle = !sharpTurn || currentSpeed < 10;
      editor.raceInput.keyboardBrake = sharpTurn && currentSpeed > 9;
      editor.raceInput.binarySteer = 0;
      editor.raceInput.rawThrottleAxis = editor.raceInput.keyboardThrottle ? 0.82 : 0.18;
      editor.raceInput.throttleAxis = editor.raceInput.rawThrottleAxis;
      editor.raceInput.rawBrakeAxis = editor.raceInput.keyboardBrake ? 0.42 : 0;
      editor.raceInput.brakeAxis = editor.raceInput.rawBrakeAxis;
      editor.raceInput.analogSteeringActive = true;
      editor.raceInput.analogSteeringIntent = clamp(yawError * 4.2 - lateral * 1.15, -1, 1);
      editor.raceInput.handbrake = false;
      editor.raceInput.paused = false;
      if (!editor.updatePlaytestSafely(1 / 60)) {
        updateFailed = true;
        break;
      }
      const liveSession = editor.playtestSession;
      if (!liveSession) break;
      maximumDistance = Math.max(maximumDistance, Number(liveSession.distance || 0));
      const nextProjection = editor.getRaceRouteProjectionForWorldPoint({
        x: Number(liveSession.worldX || 0),
        z: Number(liveSession.worldZ || 0)
      });
      const nextDistance = Number(nextProjection?.distance ?? liveSession.distance ?? currentDistance);
      const routePose = editor.getRaceWorldPoseAtDistance(nextDistance, routeOptions);
      const halfWidth = Math.max(1, editor.getRaceRoadHalfWidthWorld());
      const lateralM = Number(nextProjection?.lateral || 0);
      const correction = clamp(
        (Math.abs(lateralM) - halfWidth * 0.22) / Math.max(0.001, halfWidth * 0.72),
        0,
        1
      ) * Math.min(1, (1 / 60) * 3.8);
      if (correction > 0) {
        liveSession.worldX += (Number(routePose.x || 0) - Number(liveSession.worldX || 0)) * correction;
        liveSession.worldZ += (Number(routePose.z || 0) - Number(liveSession.worldZ || 0)) * correction;
        liveSession.carYaw += normalizeAngle(
          Number(routePose.yaw || 0) - Number(liveSession.carYaw || 0)
        ) * correction * 0.85;
        liveSession.cameraYaw = liveSession.carYaw;
      }
      if (frame % 120 === 119) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return {
      updateFailed,
      completed: Boolean(window.__wrx2Finish),
      maximumDistance,
      routeLength,
      raceDocumentName: initialSession?.raceDocumentName || '',
      carDocumentName: runtimeCar?.__playtestDocumentName || '',
      remainingSession: Boolean(editor.playtestSession)
    };
  });

  expect(result.updateFailed).toBeFalsy();
  expect(result.completed).toBeTruthy();
  expect(result.maximumDistance).toBeGreaterThanOrEqual(result.routeLength * 0.95);
  expect(result.raceDocumentName).toBe('Studio Sprint2');
  expect(result.carDocumentName).toBe('2022 Subaru WRX2');
  expect(result.remainingSession).toBeFalsy();
});
