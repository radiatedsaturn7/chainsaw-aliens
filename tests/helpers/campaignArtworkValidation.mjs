import assert from 'node:assert/strict';
import {normalizeRaceDoodadDocument} from '../../src/racing/raceDoodads.js';

// Independent authoring manifests, never the import ledger itself, define scope.
export function assertCampaignImportInventory(imports, inventory, expanded, fences) {
  assert.equal(inventory.assetCount, inventory.assets.length, 'source inventory count');
  const expected = new Map();
  const add = (source, name = null) => {
    assert.ok(source && !expected.has(source), `Duplicate authored source: ${source}`);
    expected.set(source, name);
  };
  inventory.assets.forEach(a => add(`assets/campaign-art/${a.path}`));
  [...expanded, ...fences].forEach(a => add(`assets/campaign-art/${a.source}`, a.name));
  const actual = new Map();
  for (const [name, record] of Object.entries(imports)) {
    assert.ok(!actual.has(record.source), `Duplicate imported source: ${record.source}`);
    actual.set(record.source, name);
  }
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), 'Exact authored/imported source coverage');
  for (const [source, name] of expected) {
    if (name !== null) assert.equal(actual.get(source), name, `Exact authored ref: ${source}`);
  }
  return expected;
}

export function createSavedDoodadResolver(manifest, read) {
  return ref => {
    const path = manifest.folders.doodads[ref];
    assert.ok(path, `Missing doodad registration: ${ref}`);
    const payload = read(path);
    assert.ok(payload?.doodad?.artRef, `Missing saved doodad artwork: ${ref}`);
    return normalizeRaceDoodadDocument(payload, ref);
  };
}

export function assertSceneryArtwork(editor, sprite, manifest, loadDefinition, preloadRefs = null) {
  assert.ok(sprite.doodadRef, `Missing doodad ref: ${sprite.id}`);
  const saved = loadDefinition(sprite.doodadRef);
  const effective = editor.getRaceDoodadForScenery(sprite);
  assert.ok(effective?.artRef, `Missing effective artwork: ${sprite.id}`);
  assert.equal(effective.artRef, saved.artRef, `Definition artwork mismatch: ${sprite.id}`);
  assert.ok(manifest.folders.art[effective.artRef], `Missing art registration: ${effective.artRef}`);
  if (sprite.artRef !== undefined) assert.equal(sprite.artRef, effective.artRef, `Explicit artwork mismatch: ${sprite.id}`);
  if (sprite.previewDoodad) assert.equal(effective.id, saved.id, `Embedded definition mismatch: ${sprite.id}`);
  if (preloadRefs) assert.ok(preloadRefs.has(effective.artRef), `Missing preload: ${effective.artRef}`);
  return effective;
}
