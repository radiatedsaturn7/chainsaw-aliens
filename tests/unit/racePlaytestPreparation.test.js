import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { location: { search: '' } };
const {
  default: RaceEditor,
  decodeRaceTravelDocumentPayload
} = await import('../../src/ui/RaceEditor.js');
const {
  encodeRaceTravelDocumentForTransfer,
  prepareRaceSurfaceBakeForTransfer,
  prepareRaceTravelDocumentForTransfer
} = await import('../../src/ui/raceWorldBakeWorker.js');
const {
  getPackedRaceTileMapTransferables,
  packRaceTileMapForRuntime,
  samplePackedRaceTileMapCell
} = await import('../../src/racing/RacePackedTileMap.js');

class FakeWorker {
  static instances = [];

  constructor() {
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    this.request = message;
  }

  terminate() {
    this.terminated = true;
  }

  emit(payload) {
    this.onmessage?.({ data: { id: this.request.id, ...payload } });
  }

  emitMessageError() {
    this.onmessageerror?.({});
  }
}

function createEditor() {
  const editor = Object.create(RaceEditor.prototype);
  editor.game = {
    cancelRaceTravel: () => false,
    showSystemToast() {}
  };
  editor.project = { selectedCarId: 'car', cars: [{ id: 'car', name: 'Test Car' }] };
  editor.playtestSession = {
    routeLength: 100,
    routeRuntimeType: 'destination',
    running: true,
    startedAt: 1,
    elapsedMs: 50
  };
  editor.racePlaytestPreparation = null;
  editor.racePlaytestPreparationSequence = 0;
  editor.currentRaceDocumentName = 'Test Race';
  editor.raceWorldBakeCache = null;
  editor.status = '';
  editor.getRacePlaytestWorldBakeOptions = () => ({ terrainSize: 120 });
  editor.preloadSelectedRaceArtRefs = () => {
    editor.preloaded = true;
  };
  editor.resetRacePlaytestInputs = () => {};
  Object.defineProperty(editor, 'selectedRace', {
    configurable: true,
    value: { id: 'race', name: 'Test Race', road: { nodes: [], segments: [] } }
  });
  Object.defineProperty(editor, 'selectedCar', {
    configurable: true,
    value: { id: 'car', name: 'Test Car' }
  });
  return editor;
}

test('race travel documents round-trip through a transferable UTF-8 buffer', () => {
  const source = {
    id: 'dense-race',
    road: {
      tileMap: {
        cells: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [
          `${index},0`,
          { tileId: 'grass', elevation: index / 100 }
        ]))
      }
    }
  };
  const bytes = encodeRaceTravelDocumentForTransfer(source);
  const payload = structuredClone({
    encoding: 'json-utf8',
    raceBytes: bytes.buffer
  }, {
    transfer: [bytes.buffer]
  });

  assert.equal(bytes.byteLength, 0);
  assert.deepEqual(decodeRaceTravelDocumentPayload(payload), source);
  assert.equal(
    decodeRaceTravelDocumentPayload({ race: source }),
    source
  );
});

test('race travel documents attach a transferred packed tile grid to compact metadata', () => {
  const source = {
    id: 'packed-race',
    road: {
      tileMap: {
        schemaVersion: 2,
        normalized: true,
        revision: 0,
        cellSizeM: 5,
        defaultTileId: 'grass',
        cells: {
          '-2,7': {
            tileId: 'gravel',
            tileWeights: { gravel: 1 },
            artRef: 'ground-art',
            elevation: 1.25
          }
        }
      }
    }
  };
  const packedTileMap = packRaceTileMapForRuntime(source.road.tileMap);
  const metadata = structuredClone(source);
  metadata.road.tileMap.cells = {};
  const bytes = encodeRaceTravelDocumentForTransfer(metadata);
  const payload = structuredClone({
    encoding: 'json-utf8',
    raceBytes: bytes.buffer,
    packedTileMap
  }, {
    transfer: [bytes.buffer, ...getPackedRaceTileMapTransferables(packedTileMap)]
  });
  const decoded = decodeRaceTravelDocumentPayload(payload);

  assert.deepEqual(decoded.road.tileMap.cells, {});
  assert.equal(decoded.road.tileMap.runtimePackedCells.count, 1);
  assert.equal(samplePackedRaceTileMapCell(
    decoded.road.tileMap.runtimePackedCells,
    -2,
    7
  )?.elevation, 1.25);
});

test('packed terrain UVs are rebuilt with the hydrated artwork world scale', () => {
  const editor = Object.create(RaceEditor.prototype);
  editor.getRaceGroundTextureBaseWorldM = () => 1.002;
  const textureWorldM = editor.getRaceEffectiveGroundTextureWorldM({ width: 512 });
  const positions = new Float32Array([
    textureWorldM, 0, textureWorldM * 2,
    textureWorldM * 2, 0, textureWorldM * 2,
    textureWorldM, 0, textureWorldM * 3
  ]);
  const geometry = editor.getRaceThreePackedTerrainGeometry({
    packed: true,
    positions,
    uvs: new Float32Array([99, 99, 99, 99, 99, 99]),
    textureWorldM: 1,
    colors: new Float32Array(9).fill(1),
    triangleCount: 1
  }, { textureWorldM });
  const uvs = Array.from(geometry.getAttribute('uv').array);

  assert.equal(textureWorldM, 16.032);
  assert.deepEqual(uvs.map((value) => {
    const rounded = Math.round(value * 100000) / 100000;
    return Object.is(rounded, -0) ? 0 : rounded;
  }), [
    0, 0,
    1, 0,
    0, -1
  ]);
});

test('canonical terrain packing matches the legacy geometry buffers without retaining terrain cells', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const points = [
    { x: 0, z: 0, elevation: 0, terrainRegion: 'terrain' },
    { x: 5, z: 0, elevation: 0.1, terrainRegion: 'terrain' },
    { x: 5, z: 5, elevation: 0.2, terrainRegion: 'terrain' }
  ];
  const tileCell = {
    tileId: 'grass',
    tileWeights: { grass: 1 }
  };
  const cells = [{ points, tileCell }];
  const mesh = {
    vertices: points,
    triangles: [{
      indices: [0, 1, 2],
      vertices: points,
      region: 'terrain',
      source: 'terrain:0',
      tileCell,
      terrainCell: cells[0]
    }]
  };
  const options = {
    tileMap: { defaultTileId: 'grass' },
    useSunShading: false,
    textured: true
  };
  const legacyGeometry = editor.getRaceThreeTerrainGeometry(cells, options);
  const packed = editor.packRaceThreeTerrainFromCanonicalMesh(mesh, options);

  assert.equal(packed.packed, true);
  assert.equal(packed.triangleCount, 1);
  assert.deepEqual(
    Array.from(packed.positions),
    Array.from(legacyGeometry.getAttribute('position').array)
  );
  assert.deepEqual(
    Array.from(packed.colors),
    Array.from(legacyGeometry.getAttribute('color').array)
  );
});

test('compact worker surface bake preserves static road geometry while removing heavy metadata', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const makePoint = (x, z, elevation, extra = {}) => ({
    x,
    z,
    y: z,
    elevation,
    yaw: 0,
    distance: z,
    roadDeckElevation: true,
    tangent: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: 1, z: 0 },
    ...extra
  });
  const segment = {
    surface: 'asphalt',
    boundaryArtRef: 'apron',
    unusedPhysicsMetadata: Array(50).fill('discard')
  };
  const section = (z) => ({
    center: makePoint(0, z, 0, { segment }),
    left: makePoint(-2, z, 0),
    right: makePoint(2, z, 0),
    marginLeft: makePoint(-2.25, z, 0),
    marginRight: makePoint(2.25, z, 0),
    shoulderLeft: makePoint(-3, z, 0),
    shoulderRight: makePoint(3, z, 0),
    transitionLeft: makePoint(-5, z, 0),
    transitionRight: makePoint(5, z, 0),
    metrics: { unused: Array(50).fill(1) },
    deck: { unused: true }
  });
  const fullSurfaceBake = {
    key: 'surface',
    routeLength: 10,
    runtimeType: 'destination',
    allowVisualExtension: true,
    step: 10,
    sections: [section(0), section(10)]
  };
  const compactSurfaceBake = prepareRaceSurfaceBakeForTransfer(fullSurfaceBake);
  const renderOptions = {
    textureWorldM: 1,
    texturesEnabled: true,
    useSunShading: false,
    weatherState: null
  };
  const summarize = (meshes) => JSON.stringify({
    road: meshes.roadMeshes.map((mesh) => ({
      color: mesh.color,
      artRef: mesh.artRef,
      points: mesh.points.map((point) => [point.x, point.z, point.elevation])
    })),
    boundary: meshes.boundaryMeshes.map((mesh) => ({
      color: mesh.color,
      artRef: mesh.artRef,
      points: mesh.points.map((point) => [point.x, point.z, point.elevation])
    })),
    shoulder: meshes.shoulderMeshes.map((mesh) => ({
      color: mesh.color,
      artRef: mesh.artRef,
      points: mesh.points.map((point) => [point.x, point.z, point.elevation])
    }))
  });

  editor.raceStaticTrackSurfaceMeshCache = null;
  const fullMeshes = editor.getRaceStaticTrackSurfaceMeshes({
    key: 'full',
    surfaceRevision: 'full',
    terrainTopology: 'road-origin-indexed',
    runtimeType: 'destination',
    routeLength: 10,
    surfaceBake: fullSurfaceBake
  }, renderOptions);
  editor.raceStaticTrackSurfaceMeshCache = null;
  const compactMeshes = editor.getRaceStaticTrackSurfaceMeshes({
    key: 'compact',
    surfaceRevision: 'compact',
    terrainTopology: 'road-origin-indexed',
    runtimeType: 'destination',
    routeLength: 10,
    surfaceBake: compactSurfaceBake
  }, renderOptions);

  assert.equal(summarize(compactMeshes), summarize(fullMeshes));
  assert.equal('transitionLeft' in compactSurfaceBake.sections[0], false);
  assert.equal('metrics' in compactSurfaceBake.sections[0], false);
  assert.equal(compactSurfaceBake.sections[0].center.segment.surface, 'asphalt');
  assert.equal(
    JSON.stringify(compactSurfaceBake).length < JSON.stringify(fullSurfaceBake).length * 0.5,
    true
  );
});

test('race travel preparation streams terrain before starting the session', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();

    assert.equal(editor.startRacePlaytestPreparation(), true);
    const worker = FakeWorker.instances[0];
    assert.ok(worker);
    assert.equal(editor.playtestSession.preparing, true);
    assert.equal(editor.playtestSession.running, false);

    worker.emit({
      type: 'header',
      total: 2,
      bake: { key: 'bake', terrainCells: [], terrainBaseCells: [], terrainRefinementCells: [] }
    });
    worker.emit({ type: 'cells', loaded: 1, total: 2, cells: [{ key: 'a' }] });
    assert.equal(editor.playtestSession.running, false);
    assert.equal(editor.racePlaytestPreparation.progress > 0.15, true);
    worker.emit({ type: 'cells', loaded: 2, total: 2, cells: [{ key: 'b' }] });
    worker.emit({ type: 'complete' });

    assert.equal(editor.playtestSession.preparing, false);
    assert.equal(editor.playtestSession.running, true);
    assert.equal(editor.playtestSession.elapsedMs, 0);
    assert.equal(editor.playtestSession.worldBake.terrainCells.length, 2);
    assert.equal(editor.raceWorldBakeCache, editor.playtestSession.worldBake);
    assert.equal(editor.preloaded, undefined);
    assert.equal(editor.playtestSession.startupFramePending, true);
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('canceling race preparation terminates the worker and clears the pending session', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.startRacePlaytestPreparation();
    const worker = FakeWorker.instances[0];

    assert.equal(editor.cancelRacePlaytestPreparation(), true);

    assert.equal(worker.terminated, true);
    assert.equal(editor.racePlaytestPreparation, null);
    assert.equal(editor.playtestSession, null);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('packed worker terrain starts without retaining streamed terrain objects', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.startRacePlaytestPreparation();
    const worker = FakeWorker.instances[0];
    const packedTerrain = {
      packed: true,
      positions: new Float32Array(18),
      uvs: new Float32Array(12),
      colors: new Float32Array(18),
      triangleCount: 2
    };
    const surfaceSampler = {
      packed: true,
      triangleCount: 2,
      positions: new Float32Array(18)
    };

    worker.emit({
      type: 'prepared-art',
      assets: [],
      missingArtRefs: []
    });
    worker.emit({
      type: 'prepared',
      bake: {
        key: 'packed-bake',
        terrainCells: [],
        terrainBaseCells: [],
        terrainRefinementCells: [],
        packedTerrain,
        surfaceSampler
      }
    });

    assert.equal(editor.playtestSession.running, true);
    assert.equal(editor.playtestSession.worldBake.terrainCells.length, 0);
    assert.equal(editor.playtestSession.worldBake.packedTerrain, packedTerrain);
    assert.equal(editor.playtestSession.worldBake.surfaceSampler, surfaceSampler);
    assert.equal(worker.terminated, false);
    worker.emit({ type: 'deferred-art-ready', missingArtRefs: [] });
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('chunked worker preparation assembles header physics and terrain before starting', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.startRacePlaytestPreparation();
    const worker = FakeWorker.instances[0];
    const surfaceSampler = {
      packed: true,
      version: 2,
      triangleCount: 2,
      positions: new Float64Array(18)
    };
    const packedTerrain = {
      packed: true,
      triangleCount: 2,
      positions: new Float32Array(18),
      colors: new Float32Array(18)
    };

    worker.emit({
      type: 'prepared-header',
      bake: {
        key: 'chunked-bake',
        terrainCells: [],
        surfaceSampler: null,
        packedTerrain: null
      }
    });
    worker.emit({ type: 'prepared-physics', surfaceSampler });
    worker.emit({ type: 'prepared-terrain', packedTerrain });
    worker.emit({ type: 'prepared-art', assets: [], missingArtRefs: [] });
    assert.equal(editor.playtestSession.running, false);
    worker.emit({ type: 'prepared' });

    assert.equal(editor.playtestSession.running, true);
    assert.equal(editor.playtestSession.worldBake.surfaceSampler, surfaceSampler);
    assert.equal(editor.playtestSession.worldBake.packedTerrain, packedTerrain);
    assert.equal(worker.terminated, false);
    worker.emit({ type: 'deferred-art-ready', missingArtRefs: [] });
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('critical artwork and an explicit core-ready message gate race startup', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.startRacePlaytestPreparation();
    const worker = FakeWorker.instances[0];
    const criticalAsset = {
      packed: true,
      version: 1,
      artRef: 'ground',
      width: 1,
      height: 1,
      frames: [{ index: 0, pixels: new Uint8ClampedArray([1, 2, 3, 255]) }]
    };

    worker.emit({
      type: 'prepared-header',
      bake: { key: 'ready-bake', terrainCells: [] }
    });
    worker.emit({
      type: 'prepared-physics',
      surfaceSampler: null
    });
    worker.emit({
      type: 'prepared-terrain',
      packedTerrain: { packed: true, triangleCount: 1 }
    });
    worker.emit({
      type: 'prepared-art-item',
      priority: 'critical',
      asset: criticalAsset
    });
    worker.emit({ type: 'core-ready' });
    worker.emit({ type: 'prepared' });

    assert.equal(editor.playtestSession.running, false);
    worker.emit({
      type: 'critical-art-ready',
      requiredArtRefs: ['ground'],
      missingArtRefs: []
    });

    assert.equal(editor.playtestSession.running, true);
    assert.equal(editor.playtestSession.startupFramePending, true);
    assert.equal(worker.terminated, false);
    worker.emit({ type: 'deferred-art-ready', missingArtRefs: [] });
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('missing required startup artwork fails instead of starting with a legacy fallback', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    let toast = '';
    editor.game.showSystemToast = (message) => {
      toast = String(message || '');
    };
    editor.startRacePlaytestPreparation();
    const worker = FakeWorker.instances[0];
    worker.emit({
      type: 'prepared-header',
      bake: { key: 'missing-art-bake', terrainCells: [] }
    });
    worker.emit({ type: 'prepared-physics', surfaceSampler: null });
    worker.emit({
      type: 'prepared-terrain',
      packedTerrain: { packed: true, triangleCount: 1 }
    });
    worker.emit({ type: 'core-ready' });
    worker.emit({ type: 'prepared' });
    worker.emit({
      type: 'critical-art-ready',
      requiredArtRefs: ['rtg-001'],
      missingArtRefs: ['rtg-001']
    });

    assert.equal(editor.playtestSession, null);
    assert.match(toast, /required artwork.*rtg-001/i);
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('incremental artwork adoption rejects conversion errors instead of remaining pending', async () => {
  const editor = Object.create(RaceEditor.prototype);
  editor.adoptPreparedRaceArtAssets = () => {
    throw new Error('canvas conversion failed');
  };

  await assert.rejects(
    editor.adoptPreparedRaceArtAssetsIncrementally([{ artRef: 'rtg-001' }]),
    /canvas conversion failed/
  );
});

test('preparation progress never displays 100 percent before presentation completes', () => {
  const editor = createEditor();
  editor.racePlaytestPreparation = {
    progress: 0.999,
    raceName: 'Studio Sprint2',
    phase: 'Starting race'
  };
  const labels = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    fillText(value) {
      labels.push(String(value));
    },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {}
  };
  editor.buttons = [];
  editor.drawButton = () => {};

  editor.drawRacePreparationScreen(ctx, 640, 360);

  assert.equal(labels.some((label) => label.includes('99%')), true);
  assert.equal(labels.some((label) => label.includes('100%')), false);
});

test('browser Race Editor playtest starts through the worker without synchronous prewarm work', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = new RaceEditor({
      deviceIsMobile: false,
      isMobile: false,
      exitRaceEditor() {}
    });
    let preloadCount = 0;
    let prewarmCount = 0;
    let sfxSeedCount = 0;
    editor.preloadSelectedRaceArtRefs = () => {
      preloadCount += 1;
    };
    editor.prewarmRacePlaytestRenderResources = () => {
      prewarmCount += 1;
    };
    editor.ensureCarEngineSfxDocuments = () => {
      sfxSeedCount += 1;
    };

    editor.startPlaytest(editor.selectedCar.id, { hydrateCars: false });

    assert.equal(editor.playtestSession.preparing, true);
    assert.equal(editor.playtestSession.running, false);
    assert.equal(FakeWorker.instances.length, 1);
    assert.equal(FakeWorker.instances[0].request.includeArtAssets, true);
    assert.equal(FakeWorker.instances[0].request.sourceNormalized, true);
    assert.equal(preloadCount, 0);
    assert.equal(prewarmCount, 0);
    assert.equal(sfxSeedCount, 0);
    editor.cancelRacePlaytestPreparation();
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('Car Editor schedules its saved-track preview in a worker and stays usable while pending', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = new RaceEditor({
      deviceIsMobile: false,
      isMobile: false,
      exitRaceEditor() {}
    }, { mode: 'car' });
    let prewarmCount = 0;
    editor.prewarmRacePlaytestRenderResources = () => {
      prewarmCount += 1;
    };

    const pending = editor.ensureCarEditorPreviewPlaytestSession();
    const worker = FakeWorker.instances[0];

    assert.equal(pending, null);
    assert.ok(worker);
    assert.equal(worker.request.command, 'load-race');
    assert.equal(worker.request.raceName, 'Studio Sprint');
    assert.equal(editor.playtestSession, null);

    const previewRace = editor.selectedRace;
    worker.emit({
      type: 'prepared-header',
      bake: {
        key: 'car-preview-bake',
        terrainCells: [],
        terrainTopology: 'road-origin-indexed'
      }
    });
    worker.emit({
      type: 'prepared-physics',
      surfaceSampler: null
    });
    worker.emit({
      type: 'prepared-terrain',
      packedTerrain: {
        packed: true,
        positions: new Float32Array(9),
        colors: new Float32Array(9),
        uvs: new Float32Array(6),
        textureWorldM: 1,
        triangleCount: 1
      }
    });
    worker.emit({ type: 'prepared-art', assets: [], missingArtRefs: [] });
    worker.emit({
      type: 'race-document',
      encoding: 'json-utf8',
      raceBytes: encodeRaceTravelDocumentForTransfer(previewRace).buffer,
      normalized: true
    });
    worker.emit({ type: 'prepared-race' });

    assert.ok(editor.carEditorPreviewPlaytest?.session);
    assert.equal(editor.carEditorPreviewPlaytest.session.worldBake.key, 'car-preview-bake');
    assert.equal(editor.carEditorPreviewPlaytest.session.countdownRemainingMs, 0);
    assert.equal(editor.carEditorPreviewPlaytest.session.startupFramePending, true);
    assert.equal(editor.carEditorPreviewPlaytest.session.startupPhase, 'presenting');
    assert.equal(prewarmCount, 0);
    assert.equal(editor.playtestSession, null);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('first-frame presentation gates physics without blocking pause or editor input', () => {
  const editor = Object.create(RaceEditor.prototype);
  editor.previewOffset = 0;
  editor.carEditorPreviewResetGuardMs = 0;
  editor.playtestSession = {
    running: true,
    preparing: false,
    startupFramePending: true,
    carEditorPreview: false
  };
  editor.raceInput = { paused: false };
  editor.mode = 'race';
  editor.gamepadSubmenuOpen = false;
  editor.mobileRootOpen = false;
  editor.playtestPickerOpen = false;
  let keyboardUpdates = 0;
  let physicsUpdates = 0;
  let pauseToggles = 0;
  editor.updateRacePlaytestFps = () => {};
  editor.updateRaceMapThumbstickPan = () => {};
  editor.hasPhysicalRaceGamepad = () => false;
  editor.updateRaceKeyboardInput = () => {
    keyboardUpdates += 1;
  };
  editor.isLivePlaytestSession = () => true;
  editor.updatePlaytest = () => {
    physicsUpdates += 1;
  };
  editor.toggleRacePause = () => {
    pauseToggles += 1;
  };
  const input = {
    wasPressed(action) {
      return action === 'pause';
    },
    wasPressedCode() {
      return false;
    }
  };

  editor.update(input, 1 / 60);

  assert.equal(keyboardUpdates, 1);
  assert.equal(physicsUpdates, 0);
  assert.equal(pauseToggles, 1);
});

test('Car Editor never draws the obsolete synthetic preview when workers are unavailable', () => {
  const previousWorker = globalThis.Worker;
  try {
    delete globalThis.Worker;
    const editor = new RaceEditor({
      deviceIsMobile: false,
      isMobile: false,
      exitRaceEditor() {}
    }, { mode: 'car' });
    editor.bindCarEditorPreviewPlaytest = () => null;
    let legacyDraws = 0;
    editor.drawCarEditorStudioSprintPreviewRoad = () => {
      legacyDraws += 1;
    };
    const labels = [];
    const ctx = {
      save() {},
      restore() {},
      fillRect() {},
      strokeRect() {},
      fillText(value) {
        labels.push(String(value));
      },
      set fillStyle(_value) {},
      set strokeStyle(_value) {},
      set lineWidth(_value) {},
      set font(_value) {},
      set textAlign(_value) {},
      set textBaseline(_value) {}
    };

    editor.drawCarEditorPreview(ctx, { x: 0, y: 0, w: 320, h: 180 }, editor.selectedCar);

    assert.equal(legacyDraws, 0);
    assert.equal(labels.some((label) => /real track preview unavailable/i.test(label)), true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('Car Editor tuning changes restart the vehicle without rebaking the preview track', () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = new RaceEditor({
      deviceIsMobile: false,
      isMobile: false,
      exitRaceEditor() {}
    }, { mode: 'car' });
    editor.ensureCarEditorPreviewPlaytestSession();
    const worker = FakeWorker.instances[0];
    const previewRace = editor.selectedRace;
    worker.emit({
      type: 'prepared-header',
      bake: {
        key: 'cached-car-preview',
        terrainCells: [],
        terrainTopology: 'road-origin-indexed'
      }
    });
    worker.emit({
      type: 'prepared-physics',
      surfaceSampler: null
    });
    worker.emit({
      type: 'prepared-terrain',
      packedTerrain: {
        packed: true,
        positions: new Float32Array(9),
        colors: new Float32Array(9),
        uvs: new Float32Array(6),
        textureWorldM: 1,
        triangleCount: 1
      }
    });
    worker.emit({ type: 'prepared-art', assets: [], missingArtRefs: [] });
    worker.emit({
      type: 'race-document',
      encoding: 'json-utf8',
      raceBytes: encodeRaceTravelDocumentForTransfer(previewRace).buffer,
      normalized: true
    });
    worker.emit({ type: 'prepared-race' });
    const firstSession = editor.carEditorPreviewPlaytest.session;

    editor.selectedCar.tuning = {
      ...(editor.selectedCar.tuning || {}),
      powerMultiplier: 1.1
    };
    editor.getNowMs = () => 10000;
    assert.equal(editor.ensureCarEditorPreviewPlaytestSession().session, firstSession);
    editor.getNowMs = () => 14001;
    const restarted = editor.ensureCarEditorPreviewPlaytestSession();

    assert.equal(FakeWorker.instances.length, 1);
    assert.notEqual(restarted.session, firstSession);
    assert.equal(restarted.session.worldBake.key, 'cached-car-preview');

    const tuningSession = restarted.session;
    editor.selectedCar.art = {
      ...(editor.selectedCar.art || {}),
      bodyArtRef: 'new-body-art'
    };
    editor.getNowMs = () => 20000;
    assert.equal(editor.ensureCarEditorPreviewPlaytestSession().session, tuningSession);
    editor.getNowMs = () => 24001;
    const artworkRestarted = editor.ensureCarEditorPreviewPlaytestSession();

    assert.equal(FakeWorker.instances.length, 1);
    assert.notEqual(artworkRestarted.session, tuningSession);
    assert.equal(artworkRestarted.session.worldBake.key, 'cached-car-preview');
    assert.equal(artworkRestarted.session.runtimeCar.art.bodyArtRef, 'new-body-art');
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('race loading creates a cancellable preparation session before hydration', () => {
  const editor = createEditor();

  const id = editor.beginRaceTravelLoading('Studio Sprint', 'car');

  assert.equal(id > 0, true);
  assert.equal(editor.playtestSession.preparing, true);
  assert.equal(editor.playtestSession.running, false);
  assert.equal(editor.racePlaytestPreparation.phase, 'Loading');
  assert.equal(editor.racePlaytestPreparation.raceName, 'Studio Sprint');
});

test('race loading worker timeout rejects with its preparation stage instead of hanging', async () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.getRacePreparationTimeoutMs = () => 1;
    editor.beginRaceTravelLoading('Studio Sprint', 'car');

    await assert.rejects(
      editor.loadRaceTravelDocument('Studio Sprint'),
      (error) => error?.code === 'RACE_PREPARATION_TIMEOUT'
        && error?.racePreparationStage === 'race-fetch'
    );
    assert.equal(FakeWorker.instances[0].terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('race loading absolute deadline rejects even when the phase watchdog is still pending', async () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.getRacePreparationTimeoutMs = () => 1000;
    editor.getRacePreparationAbsoluteTimeoutMs = () => 1;
    editor.beginRaceTravelLoading('Studio Sprint', 'car');

    await assert.rejects(
      editor.loadRaceTravelDocument('Studio Sprint'),
      (error) => error?.code === 'RACE_PREPARATION_DEADLINE'
        && error?.racePreparationStage === 'race-fetch'
    );
    assert.equal(FakeWorker.instances[0].terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('race loading rejects unreadable worker messages instead of remaining pending', async () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.beginRaceTravelLoading('Studio Sprint', 'car');
    const loading = editor.loadRaceTravelDocument('Studio Sprint');
    const worker = FakeWorker.instances[0];

    worker.emitMessageError();

    await assert.rejects(loading, /unreadable message/i);
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('race travel worker preserves authored terrain cells while returning a packed bake', async () => {
  const source = {
    kind: 'race-track',
    savedAt: 42,
    race: {
      id: 'studio-sprint',
      name: 'Studio Sprint',
      road: {
        tileMap: {
          defaultTileId: 'grass',
          cells: {
            '1,2': {
              tileId: 'grass',
              tileWeights: { grass: 1 },
              artRef: 'providenceGround',
              elevation: 0.342,
              source: 'height-brush'
            }
          }
        }
      }
    }
  };

  const transferred = prepareRaceTravelDocumentForTransfer(source);

  assert.deepEqual(transferred, source);
  assert.equal(transferred.race.road.tileMap.cells['1,2'].artRef, 'providenceGround');
  assert.equal(transferred.race.road.tileMap.cells['1,2'].elevation, 0.342);

  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.beginRaceTravelLoading('Studio Sprint', 'car');
    const loading = editor.loadRaceTravelDocument('Studio Sprint', { artRefs: ['car-body'] });
    const worker = FakeWorker.instances[0];

    assert.equal(worker.request.command, 'load-race');
    assert.equal(worker.request.raceName, 'Studio Sprint');
    assert.deepEqual(worker.request.artRefs, ['car-body']);
    let resolved = false;
    loading.then(() => {
      resolved = true;
    });
    worker.emit({
      type: 'prepared-header',
      bake: {
        key: 'travel-bake',
        surfaceSampler: null,
        packedTerrain: null
      }
    });
    worker.emit({
      type: 'prepared-physics',
      surfaceSampler: { packed: true, version: 2, triangleCount: 3 }
    });
    worker.emit({
      type: 'prepared-terrain',
      packedTerrain: { packed: true, triangleCount: 2 }
    });
    const preparedArt = {
      packed: true,
      version: 1,
      artRef: 'ground',
      width: 1,
      height: 1,
      frames: [{ index: 0, pixels: new Uint8ClampedArray([1, 2, 3, 255]) }]
    };
    worker.emit({
      type: 'prepared-art',
      assets: [preparedArt],
      missingArtRefs: ['optional-missing']
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    const raceBytes = encodeRaceTravelDocumentForTransfer(source);
    worker.emit({
      type: 'race-document',
      encoding: 'json-utf8',
      raceBytes: raceBytes.buffer,
      normalized: true
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    worker.emit({ type: 'prepared-race' });

    assert.deepEqual(await loading, {
      race: source,
      bake: {
        key: 'travel-bake',
        surfaceSampler: { packed: true, version: 2, triangleCount: 3 },
        packedTerrain: { packed: true, triangleCount: 2 }
      },
      artAssets: [preparedArt],
      missingArtRefs: ['optional-missing'],
      normalizedRace: true
    });
    assert.equal(worker.terminated, false);
    worker.emit({ type: 'deferred-art-ready', missingArtRefs: [] });
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('malformed race document buffers reject instead of leaving travel at 99 percent', async () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.beginRaceTravelLoading('Studio Sprint', 'car');
    const loading = editor.loadRaceTravelDocument('Studio Sprint');
    const worker = FakeWorker.instances[0];

    worker.emit({
      type: 'prepared-header',
      bake: { key: 'travel-bake', surfaceSampler: null, packedTerrain: null }
    });
    worker.emit({ type: 'prepared-physics', surfaceSampler: { packed: true } });
    worker.emit({ type: 'prepared-terrain', packedTerrain: { packed: true } });
    worker.emit({
      type: 'race-document',
      encoding: 'json-utf8',
      raceBytes: new TextEncoder().encode('{invalid json').buffer,
      normalized: true
    });
    worker.emit({ type: 'prepared-race' });

    await assert.rejects(loading, /JSON|position|expected/i);
    assert.equal(worker.terminated, true);
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('canceling after the race buffer arrives prevents deferred document decoding', async () => {
  const previousWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  FakeWorker.instances.length = 0;
  try {
    const editor = createEditor();
    editor.beginRaceTravelLoading('Studio Sprint', 'car');
    const loading = editor.loadRaceTravelDocument('Studio Sprint');
    const worker = FakeWorker.instances[0];

    worker.emit({
      type: 'prepared-header',
      bake: { key: 'travel-bake', surfaceSampler: null, packedTerrain: null }
    });
    worker.emit({ type: 'prepared-physics', surfaceSampler: { packed: true } });
    worker.emit({ type: 'prepared-terrain', packedTerrain: { packed: true } });
    worker.emit({
      type: 'race-document',
      encoding: 'json-utf8',
      raceBytes: encodeRaceTravelDocumentForTransfer({
        id: 'should-not-load',
        road: { nodes: [], segments: [] }
      }).buffer,
      normalized: true
    });
    worker.emit({ type: 'prepared-race' });
    assert.equal(editor.cancelRacePlaytestPreparation(), true);

    await assert.rejects(loading, /canceled/i);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(editor.racePlaytestPreparation, null);
    assert.equal(editor.selectedRace.id, 'race');
  } finally {
    globalThis.Worker = previousWorker;
  }
});

test('normalized worker race documents are adopted without another object-graph clone', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const normalizedRace = {
    id: 'prepared-race',
    name: 'Prepared Race',
    type: 'destination',
    road: {
      nodes: [],
      segments: [{ length: 100, surface: 'asphalt' }],
      tileMap: {
        schemaVersion: 2,
        normalized: true,
        revision: 0,
        cellSizeM: 5,
        defaultTileId: 'grass',
        cells: {}
      }
    },
    competition: { mode: 'solo', aiDrivers: [] },
    hazards: [],
    scenery: [],
    sceneryDefinitions: [],
    decals: [],
    triggers: []
  };

  assert.equal(editor.applyLoadedRaceDocument(normalizedRace, {
    name: 'Prepared Race',
    normalized: true
  }), true);
  assert.equal(editor.selectedRace, normalizedRace);
});

test('prepared travel bake and runtime car are installed before vehicle physics initializes', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  const car = editor.selectedCar;
  editor.currentRaceDocumentName = 'Studio Sprint2';
  const preparedWorldBake = {
    key: 'travel-bake',
    terrainCells: [],
    surfaceSampler: { packed: true, triangleCount: 0 }
  };
  let initializedAgainstPreparedBake = false;
  editor.resetRaceVehiclePhysicsState = ({ session, car: initializedCar }) => {
    initializedAgainstPreparedBake = session.worldBake === preparedWorldBake
      && editor.raceWorldBakeCache === preparedWorldBake
      && session.runtimeCar === initializedCar
      && initializedCar !== car;
    session.vehicle3d = { enabled: true };
    return session.vehicle3d;
  };

  editor.startPlaytest(editor.getRaceCarProjectIdentity(car), {
    hydrateCars: false,
    raceTravel: true,
    preparedWorldBake,
    runtimeCarOverrides: {
      art: { layerVisibility: { frontWheels: false, rearWheels: true } },
      camera: { trackingMode: 'fixed-rear' },
      tuning: { springFront: 0.82 }
    }
  });

  assert.equal(initializedAgainstPreparedBake, true);
  assert.equal(editor.playtestSession.raceDocumentName, 'Studio Sprint2');
  assert.equal(editor.status.includes('Playtesting Studio Sprint2'), true);
  assert.equal(editor.getRaceSessionCar(editor.playtestSession), editor.playtestSession.runtimeCar);
  assert.equal(editor.getCarArtLayerVisibility(editor.playtestSession.runtimeCar).frontWheels, false);
  assert.equal(editor.getCarArtLayerVisibility(car).frontWheels, true);
  assert.equal(editor.getCarCameraTrackingMode(editor.playtestSession.runtimeCar), 'fixed-rear');
  assert.equal(editor.playtestSession.runtimeCar.tuning.springFront, 0.82);
});

test('prepared race travel suppresses engine audio until the first playable frame renders', () => {
  const editor = Object.create(RaceEditor.prototype);
  let played = 0;
  editor.playtestSession = {
    running: true,
    startupFramePending: true,
    engineSoundId: 'engine',
    engineRpm: 900,
    runtimeCar: { audio: { engineSfxVolume: 1 } }
  };
  editor.game = {
    audio: { setEngineRev() {} },
    playSfxById() {
      played += 1;
    },
    stopSfxById() {}
  };
  editor.getRaceEngineSfxPitchCents = () => 0;
  editor.getRaceSessionCar = (session) => session.runtimeCar;

  editor.updateRaceEngineAudio({ tuning: { idleRpm: 900, redlineRpm: 6500 } });
  assert.equal(played, 0);
  assert.equal(editor.markRaceStartupFrameRendered(), true);
  editor.updateRaceEngineAudio({ tuning: { idleRpm: 900, redlineRpm: 6500 } });
  assert.equal(played, 1);
});

test('first-frame renderer failures return to the origin with a phase-specific error', () => {
  const editor = Object.create(RaceEditor.prototype);
  let canceled = 0;
  let toasted = '';
  editor.playtestSession = {
    running: true,
    startupFramePending: true,
    carEditorPreview: false
  };
  editor.raceInput = {};
  editor.drawRacePlaytestScreen = () => {
    throw new Error('WebGL allocation failed');
  };
  editor.resetRacePlaytestInputs = () => {};
  editor.restoreRaceAuthoringMenuState = () => {};
  editor.game = {
    audio: {
      setEngineRev() {},
      setTireScreech() {}
    },
    stopSfxById() {},
    cancelRaceTravel() {
      canceled += 1;
      return true;
    },
    showSystemToast(message) {
      toasted = message;
    }
  };
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    fillText() {}
  };
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(editor.drawRacePlaytestFrameSafely(ctx, { x: 0, y: 0, w: 320, h: 180 }), false);
  } finally {
    console.error = previousConsoleError;
  }
  assert.equal(canceled, 1);
  assert.match(toasted, /first frame.*WebGL allocation failed/i);
  assert.equal(editor.playtestSession, null);
});

test('Car Editor first-frame failures clear only the preview and preserve editor controls', () => {
  const editor = Object.create(RaceEditor.prototype);
  let resetOptions = null;
  let toasted = '';
  editor.playtestSession = {
    running: true,
    startupFramePending: true,
    carEditorPreview: true
  };
  editor.drawRacePlaytestScreen = () => {
    throw new Error('Car preview WebGL allocation failed');
  };
  editor.resetCarEditorPreviewPlaytest = (options) => {
    resetOptions = options;
    editor.playtestSession = null;
  };
  editor.game = {
    audio: {
      setEngineRev() {},
      setTireScreech() {}
    },
    stopSfxById() {},
    showSystemToast(message) {
      toasted = message;
    }
  };
  const ctx = {
    save() {},
    restore() {},
    fillRect() {},
    fillText() {}
  };
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(editor.drawRacePlaytestFrameSafely(ctx, { x: 0, y: 0, w: 320, h: 180 }), false);
  } finally {
    console.error = previousConsoleError;
  }
  assert.deepEqual(resetOptions, { preserveEditorUi: true });
  assert.match(toasted, /first frame.*Car preview WebGL allocation failed/i);
});

test('simulation failures return a level-triggered race to its origin instead of freezing the countdown', () => {
  const editor = Object.create(RaceEditor.prototype);
  let canceled = 0;
  let toasted = '';
  editor.playtestSession = {
    running: true,
    startupPhase: 'countdown',
    carEditorPreview: false
  };
  editor.raceInput = {};
  editor.updatePlaytest = () => {
    throw new Error('First physics tick failed');
  };
  editor.resetRacePlaytestInputs = () => {};
  editor.restoreRaceAuthoringMenuState = () => {};
  editor.game = {
    audio: {
      setEngineRev() {},
      setTireScreech() {}
    },
    stopSfxById() {},
    cancelRaceTravel() {
      canceled += 1;
      return true;
    },
    showSystemToast(message) {
      toasted = message;
    }
  };
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(editor.updatePlaytestSafely(1 / 60), false);
  } finally {
    console.error = previousConsoleError;
  }

  assert.equal(canceled, 1);
  assert.equal(editor.playtestSession, null);
  assert.match(toasted, /race simulation stopped.*First physics tick failed/i);
});

test('Car Editor simulation failures clear only the preview and keep the editor responsive', () => {
  const editor = Object.create(RaceEditor.prototype);
  let resetOptions = null;
  let toasted = '';
  const runtimeCar = { id: 'wrx2', name: '2022 Subaru WRX2' };
  editor.playtestSession = {
    running: true,
    startupPhase: 'running',
    carEditorPreview: true,
    runtimeCar
  };
  editor.updatePlaytest = () => {
    throw new Error('Preview physics tick failed');
  };
  editor.getCarEditorPreviewTuningRevision = () => 'wrx2-revision';
  editor.resetCarEditorPreviewPlaytest = (options) => {
    resetOptions = options;
  };
  editor.game = {
    audio: {
      setEngineRev() {},
      setTireScreech() {}
    },
    stopSfxById() {},
    showSystemToast(message) {
      toasted = message;
    }
  };
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(editor.updatePlaytestSafely(1 / 60, {
      session: editor.playtestSession,
      carEditorPreview: true
    }), false);
  } finally {
    console.error = previousConsoleError;
  }

  assert.deepEqual(resetOptions, {
    guardArtPicker: true,
    preserveEditorUi: true
  });
  assert.equal(editor.carEditorPreviewRuntimeFailureRevision, 'wrx2-revision');
  assert.match(editor.carEditorPreviewRuntimeFailureMessage, /Preview physics tick failed/i);
  assert.match(toasted, /race simulation stopped.*Preview physics tick failed/i);
});

test('prepared artwork is adopted into sprite and texture caches without project-file reads', () => {
  const previousDocument = globalThis.document;
  const previousImageData = globalThis.ImageData;
  let putCount = 0;
  globalThis.ImageData = class TestImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            putImageData() {
              putCount += 1;
            }
          };
        }
      };
    }
  };
  try {
    const editor = Object.create(RaceEditor.prototype);
    editor.racePreparedArtFrames = new Map();
    editor.raceArtTextureCache = new Map();
    editor.lastRaceRenderStats = null;
    editor.getRaceGroundTextureBaseWorldM = () => 1;
    const packed = {
      artRef: 'prepared-ground',
      width: 1,
      height: 1,
      savedAt: 10,
      frames: [{ index: 0, pixels: new Uint8ClampedArray([10, 20, 30, 255]) }],
      texture: {
        mipLevels: [{ width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) }],
        terrainMipLevels: [{ width: 1, height: 1, data: new Uint8ClampedArray([12, 20, 32, 255]) }]
      }
    };

    const result = editor.adoptPreparedRaceArtAssets([packed]);

    assert.equal(result.frameCount, 1);
    assert.equal(result.textureCount, 1);
    assert.equal(putCount, 1);
    assert.equal(editor.racePreparedArtFrames.has('prepared-ground:frame:0'), true);
    assert.equal(editor.raceArtTextureCache.has('prepared-ground:1x1'), true);
  } finally {
    globalThis.document = previousDocument;
    globalThis.ImageData = previousImageData;
  }
});

test('applying a loaded race clears every previous runtime surface cache', () => {
  const editor = new RaceEditor({
    deviceIsMobile: false,
    isMobile: false,
    exitRaceEditor() {}
  });
  editor.raceSurfaceModel = { stale: true };
  editor.raceWorldBakeCache = { key: 'stale-world' };
  editor.raceTerrainBakeCache = { key: 'stale-terrain' };
  editor.raceEditorSurfacePreviewBake = { key: 'stale-preview' };

  assert.equal(editor.applyLoadedRaceDocument({
    race: {
      id: 'new-race',
      name: 'New Race',
      type: 'destination',
      road: { nodes: [], segments: [{ length: 100, surface: 'asphalt' }] }
    }
  }, { name: 'New Race' }), true);

  assert.equal(editor.raceSurfaceModel, null);
  assert.equal(editor.raceWorldBakeCache, null);
  assert.equal(editor.raceTerrainBakeCache, null);
  assert.equal(editor.raceEditorSurfacePreviewBake, null);
});
