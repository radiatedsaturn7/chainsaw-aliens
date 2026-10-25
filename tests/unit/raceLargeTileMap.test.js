import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('large painted tile maps can enumerate and cull cells without spreading function arguments', () => {
  const e = new RaceEditor({});
  const cells = Object.fromEntries(Array.from({ length: 180000 }, (_, i) => [`${i},0`, { tileId: 'grass', artRef: '' }]));
  const map = { cellSizeM: 5, cells };
  const entries = e.getRaceTileMapEntries(map);
  assert.equal(entries.length, 180000);
  assert.equal(entries[179999][0], '179999,0');
  assert.equal(entries[179999][1], cells['179999,0']);
  e.ensureRaceTileMap = () => map;
  assert.deepEqual(e.getRaceVisibleProjectedTileMapCells({ x: 0, y: 0, w: 390, h: 844 }, {
    camera: { x: 0, z: 0 }, cameraYaw: 0
  }), []);
});
