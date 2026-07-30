import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { location: { search: '' } };

const {
  getPackedRaceTileMapArtRefs,
  getPackedRaceTileMapStats,
  getPackedRaceTileMapTransferables,
  isPackedRaceTileMap,
  packRaceTileMapForRuntime,
  samplePackedRaceTileMapCell
} = await import('../../src/racing/RacePackedTileMap.js');
const { default: RaceEditor } = await import('../../src/ui/RaceEditor.js');

function createTileMap() {
  return {
    schemaVersion: 2,
    normalized: true,
    revision: 7,
    cellSizeM: 5,
    defaultTileId: 'grass',
    minElevation: -12,
    maxElevation: 12,
    cells: {
      '-3,8': {
        tileId: 'snow',
        tileWeights: { snow: 0.75, gravel: 0.25 },
        artRef: 'snow-art',
        elevation: 1.375,
        source: 'tile-editor'
      },
      '12,-4': {
        tileId: 'gravel',
        tileWeights: { gravel: 1 },
        artRef: 'gravel-art',
        elevation: -0.625,
        source: 'tile-editor'
      },
      '100,100': {
        tileId: 'grass',
        tileWeights: { grass: 1 },
        artRef: 'snow-art',
        elevation: 0,
        source: 'tile-editor'
      }
    }
  };
}

test('runtime tile packing preserves sparse coordinates, elevations, artwork, and weights', () => {
  const packed = packRaceTileMapForRuntime(createTileMap());

  assert.equal(isPackedRaceTileMap(packed), true);
  assert.equal(packed.count, 3);
  assert.deepEqual(samplePackedRaceTileMapCell(packed, -3, 8), {
    tileId: 'snow',
    tileWeights: { gravel: 0.25, snow: 0.75 },
    artRef: 'snow-art',
    elevation: 1.375,
    source: 'runtime-packed',
    tileLabel: null,
    explicit: true
  });
  assert.deepEqual(samplePackedRaceTileMapCell(packed, 12, -4), {
    tileId: 'gravel',
    tileWeights: { gravel: 1 },
    artRef: 'gravel-art',
    elevation: -0.625,
    source: 'runtime-packed',
    tileLabel: null,
    explicit: true
  });
  assert.equal(samplePackedRaceTileMapCell(packed, 0, 0), null);
  assert.deepEqual(getPackedRaceTileMapArtRefs(packed).sort(), ['gravel-art', 'snow-art']);
  assert.deepEqual(getPackedRaceTileMapStats(packed), {
    dominantArtRef: 'snow-art',
    hasPaintedTerrainCells: true,
    cellCount: 3,
    artRefCounts: [['gravel-art', 1], ['snow-art', 2]]
  });
});

test('packed tile arrays transfer without cloning the cell object graph', () => {
  const packed = packRaceTileMapForRuntime(createTileMap());
  const transferables = getPackedRaceTileMapTransferables(packed);
  const transferred = structuredClone(packed, { transfer: transferables });

  assert.equal(packed.cellX.byteLength, 0);
  assert.equal(isPackedRaceTileMap(transferred), true);
  assert.equal(samplePackedRaceTileMapCell(transferred, 100, 100)?.artRef, 'snow-art');
});

test('RaceEditor tile queries, stats, and object overrides work with runtime packed cells', () => {
  const tileMap = createTileMap();
  const packed = packRaceTileMapForRuntime(tileMap);
  const runtimeTileMap = {
    ...tileMap,
    cells: {},
    runtimePackedCells: packed
  };
  const editor = Object.create(RaceEditor.prototype);
  editor.raceTileMapStatsCache = null;
  editor.getRaceTileMapElevationBounds = () => ({ minElevation: -12, maxElevation: 12 });

  assert.equal(editor.getRaceTileMapCell(-3, 8, runtimeTileMap).elevation, 1.375);
  assert.equal(editor.getRaceTileMapCell(-3, 8, runtimeTileMap).artRef, 'snow-art');
  assert.equal(editor.getRaceTileMapCell(0, 0, runtimeTileMap).explicit, false);
  assert.equal(editor.getRaceTileMapStats(runtimeTileMap).cellCount, 3);
  assert.equal(editor.getRaceTileMapStats(runtimeTileMap).dominantArtRef, 'snow-art');

  runtimeTileMap.cells['-3,8'] = {
    tileId: 'asphalt',
    tileWeights: { asphalt: 1 },
    artRef: 'asphalt-art',
    elevation: 2,
    explicit: true
  };
  runtimeTileMap.revision += 1;
  assert.equal(editor.getRaceTileMapCell(-3, 8, runtimeTileMap).tileId, 'asphalt');
  assert.equal(editor.getRaceTileMapStats(runtimeTileMap).cellCount, 3);
  assert.equal(editor.getRaceTileMapStats(runtimeTileMap).dominantArtRef, 'gravel-art');
});
