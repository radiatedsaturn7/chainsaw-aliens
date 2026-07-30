import {
  getPackedRaceTileMapTransferables,
  packRaceTileMapForRuntime
} from '../racing/RacePackedTileMap.js';
import {
  getPackedRaceArtTransferables,
  packRaceArtDocumentForRuntime
} from '../racing/RacePackedArt.js';

globalThis.window = globalThis.window || globalThis;

const RACE_ART_FETCH_TIMEOUT_MS = 8000;
const RACE_ART_FETCH_CONCURRENCY = 3;

function uniqueArtRefs(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
}

function buildPackedTerrainUvs(positions = null, textureWorldM = 2.5) {
  if (!positions?.length) return new Float32Array(0);
  const scale = Math.max(0.001, Number(textureWorldM) || 2.5);
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let positionOffset = 0; positionOffset + 8 < positions.length; positionOffset += 9) {
    const minX = Math.min(
      positions[positionOffset],
      positions[positionOffset + 3],
      positions[positionOffset + 6]
    );
    const minZ = Math.min(
      positions[positionOffset + 2],
      positions[positionOffset + 5],
      positions[positionOffset + 8]
    );
    const originX = Math.floor((minX / scale) + 0.000001) * scale;
    const originZ = Math.floor((minZ / scale) + 0.000001) * scale;
    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
      const sourceOffset = positionOffset + vertexIndex * 3;
      const uvOffset = ((positionOffset / 3) + vertexIndex) * 2;
      uvs[uvOffset] = (positions[sourceOffset] - originX) / scale;
      uvs[uvOffset + 1] = -(positions[sourceOffset + 2] - originZ) / scale;
    }
  }
  return uvs;
}

async function fetchRaceArtPayload(artRef = '', {
  timeoutMs = RACE_ART_FETCH_TIMEOUT_MS
} = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = typeof setTimeout === 'function'
    ? setTimeout(() => controller?.abort?.(), Math.max(1, Number(timeoutMs) || RACE_ART_FETCH_TIMEOUT_MS))
    : null;
  try {
    const response = await fetch(
      `/__storage/file?folder=art&name=${encodeURIComponent(artRef)}`,
      controller ? { signal: controller.signal } : undefined
    );
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.file || null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function packRaceArtRefsForRuntime(artRefs = [], {
  textureRefs = [],
  reportProgress = () => {},
  onAsset = null,
  progressStart = 0.84,
  progressEnd = 0.94,
  concurrency = RACE_ART_FETCH_CONCURRENCY
} = {}) {
  const refs = uniqueArtRefs(artRefs);
  const textureRefSet = new Set(uniqueArtRefs(textureRefs));
  const assets = [];
  const missingArtRefs = [];
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.max(1, Math.min(
    refs.length || 1,
    Math.round(Number(concurrency) || RACE_ART_FETCH_CONCURRENCY)
  ));
  const run = async () => {
    while (cursor < refs.length) {
      const index = cursor;
      cursor += 1;
      const artRef = refs[index];
      let packed = null;
      try {
        const file = await fetchRaceArtPayload(artRef);
        packed = file?.data
          ? packRaceArtDocumentForRuntime(file.data, {
            artRef,
            savedAt: file.savedAt,
            buildTexture: textureRefSet.has(artRef)
          })
          : null;
      } catch (_error) {
        packed = null;
      }
      if (packed) {
        assets.push(packed);
        await onAsset?.(packed, artRef);
      } else {
        missingArtRefs.push(artRef);
      }
      completed += 1;
      const amount = completed / Math.max(1, refs.length);
      reportProgress(
        progressStart + (progressEnd - progressStart) * amount,
        'art-pack'
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => run()));
  return { assets, missingArtRefs };
}

export function prepareRaceTravelDocumentForTransfer(document = null) {
  return document;
}

export function encodeRaceTravelDocumentForTransfer(document = null) {
  if (!document) return null;
  return new TextEncoder().encode(JSON.stringify(document));
}

export function prepareRaceSurfaceBakeForTransfer(surfaceBake = null) {
  if (!surfaceBake || !Array.isArray(surfaceBake.sections)) return surfaceBake || null;
  const compactPoint = (point = null) => {
    if (!point) return null;
    const z = Number(point.z ?? point.y ?? 0);
    return {
      x: Number(point.x || 0),
      z,
      y: z,
      elevation: Number(point.elevation || 0),
      yaw: Number(point.yaw || 0),
      distance: Number(point.distance || 0),
      roadDeckElevation: point.roadDeckElevation === true
    };
  };
  const pointFields = [
    'center',
    'left',
    'right',
    'marginLeft',
    'marginRight',
    'shoulderLeft',
    'shoulderRight'
  ];
  return {
    key: surfaceBake.key,
    routeLength: Number(surfaceBake.routeLength || 0),
    runtimeType: surfaceBake.runtimeType,
    allowVisualExtension: surfaceBake.allowVisualExtension === true,
    step: Number(surfaceBake.step || 0),
    sections: surfaceBake.sections.map((section = {}) => {
      const compact = Object.fromEntries(
        pointFields.map((field) => [field, compactPoint(section[field])])
      );
      compact.center = compact.center || compactPoint(section.center) || {};
      compact.center.segment = {
        surface: String(section.center?.segment?.surface || 'asphalt'),
        boundaryArtRef: String(section.center?.segment?.boundaryArtRef || '')
      };
      return compact;
    })
  };
}

export async function buildRaceTransferPackage(sourceRace = null, {
  name = '',
  options = null,
  includeRaceDocument = false,
  includeArtAssets = includeRaceDocument,
  sourceNormalized = false,
  artRefs = [],
  reportProgress = () => {}
} = {}) {
  if (!sourceRace) throw new Error('Race document is required');
  reportProgress(0.08, 'module-load');
  const { default: RaceEditor } = await import('./RaceEditor.js');
  const {
    packRaceCanonicalSurfaceMesh,
    getPackedRaceSurfaceTransferables
  } = await import('../racing/RaceBakedSurfaceSampler.js');
  const editor = new RaceEditor({
    deviceIsMobile: true,
    isMobile: true,
    exitRaceEditor() {}
  });
  if (!editor.applyLoadedRaceDocument(sourceRace, {
    name,
    normalized: sourceNormalized
  })) {
    throw new Error('Race document could not be loaded');
  }
  if (!options) {
    editor.playtestSession = {
      routeLength: editor.getRaceRouteLength(),
      routeRuntimeType: editor.getSelectedRaceRuntimeType()
    };
  }
  editor.validateRaceSurfaceGeometry = () => null;
  reportProgress(0.12, 'world-bake');
  const bake = editor.buildRaceWorldBake({
    ...(options || editor.getRacePlaytestWorldBakeOptions()),
    buildSurfaceSampler: false,
    retainTerrainCells: false,
    validate: false
  });
  reportProgress(0.76, 'physics-pack');
  const packedSampler = packRaceCanonicalSurfaceMesh(bake.mesh, {
    elevationScaleM: 12,
    bucketSizeM: Math.max(10, Math.min(24, Number(bake.terrainSize || 120) * 0.2))
  });
  reportProgress(0.84, 'terrain-pack');
  const packedTerrain = editor.packRaceThreeTerrainFromCanonicalMesh(bake.mesh, {
    tileMap: editor.ensureRaceTileMap(),
    useSunShading: editor.shouldUseRacePlaytestSunShading(),
    textured: editor.getRaceRenderDebugSettings().texturesEnabled !== false,
    textureWorldM: bake.textureWorldM
  });
  reportProgress(0.93, 'release-build');
  const tileMapStats = editor.getRaceTileMapStats(editor.ensureRaceTileMap());
  const compactSurfaceBake = prepareRaceSurfaceBakeForTransfer(bake.surfaceBake);
  const header = {
    key: bake.key,
    surfaceRevision: bake.surfaceRevision,
    terrainTopology: bake.terrainTopology,
    terrainSize: bake.terrainSize,
    routeLength: bake.routeLength,
    runtimeType: bake.runtimeType,
    textureWorldM: bake.textureWorldM,
    terrainCells: [],
    terrainBaseCells: [],
    terrainRefinementCells: [],
    terrainChunks: [],
    terrainGenerationStats: bake.terrainGenerationStats,
    surfaceBake: compactSurfaceBake,
    builtMs: bake.builtMs,
    mesh: null,
    surfaceSampler: null,
    packedTerrain: null,
    groundArtRef: String(tileMapStats?.dominantArtRef || ''),
    validation: null
  };
  let raceDocument = null;
  let packedTileMap = null;
  let raceTileMapTransferables = [];
  let packedArtAssets = [];
  let packedArtTransferables = [];
  let missingArtRefs = [];
  const raceArtRefs = editor.collectSelectedRaceArtRefs();
  const criticalArtRefs = new Set();
  const addCritical = (value) => {
    const clean = String(value || '').trim();
    if (clean) criticalArtRefs.add(clean);
  };
  addCritical(header.groundArtRef);
  addCritical(editor.selectedRace?.skyboxArtRef || editor.selectedRace?.visuals?.skyboxArtRef);
  Object.values(editor.selectedRace?.surfaceArt || {}).forEach(addCritical);
  addCritical(editor.selectedRace?.margin?.artRef);
  (editor.selectedRace?.road?.segments || []).forEach((segment) => {
    addCritical(segment?.artRef);
    addCritical(segment?.boundaryArtRef);
  });
  Object.values(editor.selectedRace?.road?.tileMap?.cells || {}).forEach((cell) => {
    addCritical(cell?.artRef || cell?.tileArtRef);
  });
  (Array.isArray(artRefs) ? artRefs : []).forEach(addCritical);
  const requestedArtRefs = uniqueArtRefs([
    ...raceArtRefs,
    ...(Array.isArray(artRefs) ? artRefs : [])
  ]);
  const artPlan = {
    criticalRefs: requestedArtRefs.filter((artRef) => criticalArtRefs.has(artRef)),
    deferredRefs: requestedArtRefs.filter((artRef) => !criticalArtRefs.has(artRef)),
    textureRefs: uniqueArtRefs([header.groundArtRef])
  };
  if (includeRaceDocument) {
    raceDocument = prepareRaceTravelDocumentForTransfer(editor.selectedRace);
    const tileMap = raceDocument?.road?.tileMap;
    if (tileMap) {
      packedTileMap = packRaceTileMapForRuntime(tileMap);
      raceTileMapTransferables = getPackedRaceTileMapTransferables(packedTileMap);
      tileMap.cells = {};
    }
  }
  if (includeArtAssets) {
    const packedArt = await packRaceArtRefsForRuntime(requestedArtRefs, {
      textureRefs: artPlan.textureRefs,
      reportProgress,
      progressStart: 0.935,
      progressEnd: 0.96
    });
    packedArtAssets = packedArt.assets;
    missingArtRefs = packedArt.missingArtRefs;
    packedArtTransferables = getPackedRaceArtTransferables(packedArtAssets);
    const groundAsset = packedArtAssets.find(
      (asset) => String(asset?.artRef || '') === String(header.groundArtRef || '')
    );
    const effectiveTextureWorldM = Math.max(
      Number(bake.textureWorldM) || 1,
      ((Number(groundAsset?.width) || 32) / 32) * (Number(bake.textureWorldM) || 1)
    );
    if (packedTerrain?.positions?.length
      && Math.abs(Number(packedTerrain.textureWorldM || 0) - effectiveTextureWorldM) > 0.000001) {
      packedTerrain.uvs = buildPackedTerrainUvs(
        packedTerrain.positions,
        effectiveTextureWorldM
      );
      packedTerrain.textureWorldM = effectiveTextureWorldM;
    }
  }
  return {
    header,
    packedSampler,
    packedTerrain,
    physicsTransferables: getPackedRaceSurfaceTransferables(packedSampler),
    terrainTransferables: [
      packedTerrain?.positions?.buffer,
      packedTerrain?.colors?.buffer,
      packedTerrain?.uvs?.buffer
    ].filter(Boolean),
    raceDocument,
    packedTileMap,
    raceTileMapTransferables,
    packedArtAssets,
    packedArtTransferables,
    missingArtRefs,
    artPlan
  };
}

const workerScope = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope
  ? globalThis
  : null;

if (workerScope) workerScope.onmessage = async (event) => {
  let request = event.data || {};
  const {
    id,
    command,
    raceName,
    name,
    options,
    artRefs,
    includeArtAssets = true,
    sourceNormalized = false
  } = request;
  let requestedRace = request.race;
  request = null;
  event = null;
  if (!id) return;
  let currentPhase = 'initializing';
  const reportProgress = (progress, phase) => {
    currentPhase = phase;
    workerScope.postMessage({ id, type: 'progress', progress, phase });
  };
  try {
    let sourceRace = requestedRace;
    requestedRace = null;
    let preparedTravel = false;
    if (command === 'load-race') {
      reportProgress(0.06, 'race-fetch');
      const response = await fetch(`/__storage/file?folder=races&name=${encodeURIComponent(raceName || '')}`);
      if (!response.ok) throw new Error(`Race not found: ${raceName || 'unnamed race'}`);
      const payload = await response.json();
      if (!payload?.ok || !payload.file?.data) {
        throw new Error(`Race could not load: ${raceName || 'unnamed race'}`);
      }
      sourceRace = payload.file.data;
      preparedTravel = true;
    }
    if (!sourceRace) return;
    let transferPackage = await buildRaceTransferPackage(sourceRace, {
      name: name || raceName,
      options,
      includeRaceDocument: preparedTravel,
      includeArtAssets: false,
      sourceNormalized: preparedTravel ? false : sourceNormalized,
      artRefs,
      reportProgress
    });
    sourceRace = null;
    let criticalAssets = [];
    let criticalMissingArtRefs = [];
    if (includeArtAssets) {
      const criticalArt = await packRaceArtRefsForRuntime(
        transferPackage.artPlan?.criticalRefs || [],
        {
          textureRefs: transferPackage.artPlan?.textureRefs || [],
          reportProgress,
          progressStart: 0.935,
          progressEnd: 0.955,
          onAsset: async (asset) => {
            workerScope.postMessage({
              id,
              type: 'prepared-art-item',
              priority: 'critical',
              asset
            }, getPackedRaceArtTransferables([asset]));
          }
        }
      );
      criticalAssets = criticalArt.assets;
      criticalMissingArtRefs = criticalArt.missingArtRefs;
      const groundAsset = criticalAssets.find(
        (asset) => String(asset?.artRef || '') === String(transferPackage.header?.groundArtRef || '')
      );
      const effectiveTextureWorldM = Math.max(
        Number(transferPackage.header?.textureWorldM) || 1,
        ((Number(groundAsset?.width) || 32) / 32)
          * (Number(transferPackage.header?.textureWorldM) || 1)
      );
      if (transferPackage.packedTerrain?.positions?.length
        && Math.abs(
          Number(transferPackage.packedTerrain.textureWorldM || 0) - effectiveTextureWorldM
        ) > 0.000001) {
        transferPackage.packedTerrain.uvs = buildPackedTerrainUvs(
          transferPackage.packedTerrain.positions,
          effectiveTextureWorldM
        );
        transferPackage.packedTerrain.textureWorldM = effectiveTextureWorldM;
        transferPackage.terrainTransferables = [
          transferPackage.packedTerrain.positions?.buffer,
          transferPackage.packedTerrain.colors?.buffer,
          transferPackage.packedTerrain.uvs?.buffer
        ].filter(Boolean);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    reportProgress(0.96, 'transfer-header');
    workerScope.postMessage({
      id,
      type: 'prepared-header',
      bake: transferPackage.header
    });
    transferPackage.header = null;
    reportProgress(0.965, 'transfer-physics');
    workerScope.postMessage({
      id,
      type: 'prepared-physics',
      surfaceSampler: transferPackage.packedSampler
    }, transferPackage.physicsTransferables);
    transferPackage.packedSampler = null;
    transferPackage.physicsTransferables = null;
    reportProgress(0.97, 'transfer-terrain');
    workerScope.postMessage({
      id,
      type: 'prepared-terrain',
      packedTerrain: transferPackage.packedTerrain
    }, transferPackage.terrainTransferables);
    transferPackage.packedTerrain = null;
    transferPackage.terrainTransferables = null;
    if (includeArtAssets) {
      reportProgress(0.975, 'transfer-art');
      criticalAssets = [];
      workerScope.postMessage({
        id,
        type: 'critical-art-ready',
        requiredArtRefs: transferPackage.artPlan?.criticalRefs || [],
        missingArtRefs: criticalMissingArtRefs
      });
    }
    if (preparedTravel) {
      reportProgress(0.98, 'encode-race');
      let raceBytes = encodeRaceTravelDocumentForTransfer(transferPackage.raceDocument);
      transferPackage.raceDocument = null;
      reportProgress(0.985, 'transfer-race');
      workerScope.postMessage({
        id,
        type: 'race-document',
        encoding: 'json-utf8',
        raceBytes: raceBytes.buffer,
        packedTileMap: transferPackage.packedTileMap,
        normalized: true
      }, [raceBytes.buffer, ...transferPackage.raceTileMapTransferables]);
      raceBytes = null;
      transferPackage.packedTileMap = null;
      transferPackage.raceTileMapTransferables = null;
    }
    workerScope.postMessage({
      id,
      type: 'core-ready'
    });
    reportProgress(0.99, 'transfer-complete');
    workerScope.postMessage({
      id,
      type: preparedTravel ? 'prepared-race' : 'prepared'
    });
    if (includeArtAssets && transferPackage.artPlan?.deferredRefs?.length) {
      const deferredArt = await packRaceArtRefsForRuntime(
        transferPackage.artPlan.deferredRefs,
        {
          textureRefs: [],
          reportProgress: () => {},
          progressStart: 0,
          progressEnd: 1,
          onAsset: async (asset) => {
            workerScope.postMessage({
              id,
              type: 'prepared-art-item',
              priority: 'deferred',
              asset
            }, getPackedRaceArtTransferables([asset]));
          }
        }
      );
      workerScope.postMessage({
        id,
        type: 'deferred-art-ready',
        missingArtRefs: deferredArt.missingArtRefs
      });
    } else {
      workerScope.postMessage({
        id,
        type: 'deferred-art-ready',
        missingArtRefs: []
      });
    }
    transferPackage = null;
  } catch (error) {
    workerScope.postMessage({
      id,
      type: 'error',
      phase: currentPhase,
      message: String(error?.message || error || 'Race preparation failed')
    });
  }
};
