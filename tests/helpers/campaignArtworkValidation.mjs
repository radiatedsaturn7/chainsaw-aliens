import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
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

// Use the same enabled race choices as campaign installation, not every library race.
export function campaignArtworkRacePaths(catalog, research, installed, manifest) {
  const {screens} = createCampaignHubMenus(catalog, research, installed);
  const refs = new Set(screens.flatMap(s => s.elements)
    .filter(e => !e.disabled && e.action?.type === 'set-param' && e.action?.parameter === 'raceRef')
    .map(e => e.action.value));
  return [...refs].map(ref => {
    const path = manifest.folders.races[ref];
    assert.ok(path, `Missing playable campaign race: ${ref}`);
    return path;
  });
}

// Preload tables alone are not placements. Resolve only definitions referenced by scenery.
export function placedSceneryArtRefs(race, resolve) {
  const refs = new Set();
  for (const p of race.scenery || []) {
    if (p.state === 'removed') continue;
    const embedded = (race.sceneryDefinitions || []).find(d => (d.ref || d.name) === p.doodadRef);
    const definition = p.previewDoodad || embedded || (p.doodadRef && resolve(p.doodadRef));
    if (p.artRef) refs.add(p.artRef);
    if (definition?.artRef) refs.add(definition.artRef);
  }
  return refs;
}

export function validateArtworkIntent(policy, imports, used, editorLoaded, configured, existingDeferred = new Set()) {
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.defaultIntent, 'campaign-placement');
  for (const [ref, intent] of Object.entries(policy.editorAssets)) {
    assert.ok(['doodad', 'skybox'].includes(intent.kind) && intent.reason, `Invalid editor intent: ${ref}`);
    assert.equal(imports[ref]?.source, intent.source, `Editor source mismatch: ${ref}`);
    assert.ok(editorLoaded.has(ref), `Editor asset did not load: ${ref}`);
    assert.ok(!policy.configuredUnused[ref], `Conflicting intent: ${ref}`);
  }
  // This is one observable configuration debt, not a general exemption mechanism.
  assert.deepEqual(Object.keys(policy.configuredUnused), ['road-snow-patchy']);
  const snow = policy.configuredUnused['road-snow-patchy'];
  assert.equal(snow.raceRef, 'Pikes Peak Highway');assert.equal(snow.surface, 'snow');
  assert.ok(imports['road-snow-patchy'], 'Missing configured snow import');
  const diagnostics = [];
  if (!used.has('road-snow-patchy')) {
    assert.ok(configured.has('road-snow-patchy'), 'Configured snow diagnostic is stale: mapping missing');
    diagnostics.push('UNUSED CONFIGURED ART: road-snow-patchy — Pikes Peak Highway snow mapping has no active segment; retained configuration debt.');
  }
  for (const ref of Object.keys(imports)) {
    if (policy.editorAssets[ref] || existingDeferred.has(ref) || ref === 'road-snow-patchy') continue;
    assert.ok(used.has(ref), `Campaign art has no actual placement: ${ref}`);
  }
  return diagnostics;
}
