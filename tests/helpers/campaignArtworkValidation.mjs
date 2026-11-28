import {terrainArtMaterials} from '../../tools/race-environments/terrain-materials.mjs';
import {createCampaignHubMenus} from '../../src/menus/CampaignHubMenus.js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeRaceDoodadDocument} from '../../src/racing/raceDoodads.js';
import {isVisualOnlyRaceScenery} from '../../src/racing/simulation/DamageModel.js';

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

// Explicit byte-preserving supersession; terrain additionally requires counted material-correct cells.
export function verifySupersededArtwork(registry, imports, manifest, read, readBytes, used) {
 assert.equal(registry.schemaVersion,1);
 assert.deepEqual(Object.keys(registry).sort(),['assets','schemaVersion']);
 const verified=new Set(),hash=p=>createHash('sha256').update(readBytes(p)).digest('hex');
 // Inspect every saved race once; retain only reference sets, not decoded world data.
 const savedSkyRefs=new Set(),savedTerrainRefs=new Set();
 const scan=value=>{if(!value||typeof value!=='object')return;for(const [key,v]of Object.entries(value)){if(['artRef','roughArtRef','tileArtRef','groundPlaneArtRef'].includes(key)&&typeof v==='string')savedTerrainRefs.add(v);else if(v&&typeof v==='object')scan(v);}};
 for(const path of Object.values(manifest.folders.races)){const race=read(path)?.race;savedSkyRefs.add(race?.skyboxArtRef);savedSkyRefs.add(race?.skyboxSettings?.artRef);scan(race);}
 for(const [ref,r] of Object.entries(registry.assets)){
  assert.ok(['skybox','terrain'].includes(r.kind),'Unsupported supersession kind');
  const fields=['documentPath','documentSha256','kind','raceRef','reason','replacement','review','source','sourceSha256'];
  if(r.kind==='terrain')fields.push('replacementMaterial','replacementCellCount');
  assert.deepEqual(Object.keys(r).sort(),fields.sort());
  assert.ok(r.reason?.length>40&&r.review?.scope?.length>40,'Missing supersession review rationale');
  assert.ok((r.kind==='terrain'?['superseded-material-site-fit']:['superseded-location-season-mismatch','superseded-site-composition']).includes(r.review.verdict),'Invalid supersession review verdict');
  assert.match(r.review.path,/^data\/race-environments\/[a-z0-9-]+\.jpg$/);
  assert.equal(hash(r.review.path),r.review.sha256,'Missing or changed review evidence');
  assert.ok(imports[ref]&&imports[r.replacement]&&ref!==r.replacement,'Missing or self replacement');
  assert.ok(!registry.assets[r.replacement],'Replacement cannot itself be retired');
  assert.equal(imports[ref].source,r.source,'Retired source path changed');
  assert.equal(imports[ref].sourceSha256,r.sourceSha256,'Retired source registration changed');
  assert.equal(imports[ref].documentSha256,r.documentSha256,'Retired native registration changed');
  assert.equal(manifest.folders.art[ref],r.documentPath,'Retired native path changed');
  assert.equal(hash(r.source),r.sourceSha256,'Retired original bytes changed');
  assert.equal(hash('data/server-storage/files/'+r.documentPath),r.documentSha256,'Retired native bytes changed');
  assert.ok(used.has(r.replacement),'Replacement must have real campaign or free-race placement');
  assert.ok(!used.has(ref),'Retired sky still actively used');
  const race=read(manifest.folders.races[r.raceRef])?.race;
  if(r.kind==='skybox'){
   assert.equal(race?.skyboxArtRef,r.replacement,'Replacement race binding mismatch');
   assert.equal(race?.skyboxSettings?.artRef,r.replacement,'Replacement settings mismatch');
  }else{
   assert.equal(terrainArtMaterials[r.replacement],r.replacementMaterial,'Replacement material not independently declared');
   assert.ok(Number.isInteger(r.replacementCellCount)&&r.replacementCellCount>0,'Terrain replacement needs counted actual cells');
   const cells=Object.values(race?.road?.tileMap?.cells||{}).filter(c=>c.artRef===r.replacement||c.roughArtRef===r.replacement);
   assert.equal(cells.length,r.replacementCellCount,'Terrain replacement cell count mismatch');
   for(const c of cells){assert.equal(c.tileId,r.replacementMaterial,'Replacement changes visual material');assert.equal(c.artRef,r.replacement);assert.equal(c.roughArtRef,r.replacement);}
  }
  assert.ok(!(r.kind==='skybox'?savedSkyRefs:savedTerrainRefs).has(ref),r.kind==='skybox'?'Retired sky remains in saved race':'Retired terrain remains in saved race');
  verified.add(ref);
 }
 return verified;
}

export function validateArtworkIntent(policy, imports, used, editorLoaded, configured, existingDeferred = new Set(), authoredFreeRaceUsed = new Set(), supersession = null) {
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
  const retired=supersession?verifySupersededArtwork(supersession.registry,imports,supersession.manifest,supersession.read,supersession.readBytes,new Set([...used,...authoredFreeRaceUsed])):new Set();
  for(const ref of retired){
    assert.ok(!policy.editorAssets[ref]&&!policy.configuredUnused[ref]&&!existingDeferred.has(ref),'Conflicting retired intent');
    diagnostics.push(`SUPERSEDED ART PRESERVED: ${ref} -> ${supersession.registry.assets[ref].replacement}; original source/native bytes verified, explicit review retained.`);
  }
  if (!used.has('road-snow-patchy')) {
    assert.ok(configured.has('road-snow-patchy'), 'Configured snow diagnostic is stale: mapping missing');
    diagnostics.push('UNUSED CONFIGURED ART: road-snow-patchy — Pikes Peak Highway snow mapping has no active segment; retained configuration debt.');
  }
  for (const ref of Object.keys(imports)) {
    if (policy.editorAssets[ref] || existingDeferred.has(ref) || ref === 'road-snow-patchy') continue;
    assert.ok(used.has(ref) || authoredFreeRaceUsed.has(ref) || retired.has(ref), `Campaign art has no actual placement: ${ref}`);
  }
  return diagnostics;
}

// Separate authored free-race scope: exact registry bindings must be selected by
// the shipped Game Menu and resolve to active saved slots or placements, not preloads.
export function authoredFreeRaceArtwork(registry, menu, manifest, read, campaignPaths) {
  assert.equal(registry.schemaVersion, 1);
  const selectors=menu.screens.flatMap(s=>s.elements||[]);
  assert.ok(selectors.some(e=>e.source==='races'&&e.binding==='raceRef'),'Missing runtime free-race selector');
  const refs=new Set();
  for(const [ref,rule] of Object.entries(registry.assets)){
    assert.ok(rule.reason && ['sky','ground','scenery'].includes(rule.slot),`Invalid free-race intent: ${ref}`);
    const path=manifest.folders.races[rule.raceRef];
    assert.ok(path,`Unreachable free race: ${rule.raceRef}`);
    assert.ok(!campaignPaths.includes(path),'Campaign asset must retain campaign guard');
    assert.ok(manifest.folders.art[ref],`Missing free-race art: ${ref}`);
    const race=read(path).race;
    assert.ok(race,`Invalid free race document: ${rule.raceRef}`);
    if(rule.slot==='sky'){
      assert.equal(race.skyboxArtRef,ref,`Free-race sky placement: ${ref}`);
      assert.equal(race.skyboxSettings?.artRef,ref,`Free-race sky settings: ${ref}`);
    }else if(rule.slot==='ground'){
      assert.equal(race.groundPlaneArtRef,ref,`Free-race ground placement: ${ref}`);
    }else{
      assert.ok(typeof rule.placementId==='string'&&rule.placementId.length>0&&typeof rule.doodadRef==='string'&&rule.doodadRef.length>0,
        `Invalid free-race scenery witness: ${ref}`);
      const placements=(race.scenery||[]).filter(p=>p.id===rule.placementId);
      assert.equal(placements.length,1,`Free-race scenery must have one exact saved placement: ${ref}`);
      const [placement]=placements;
      assert.equal(placement.artRef,ref,`Free-race scenery placement art: ${ref}`);
      assert.equal(placement.doodadRef,rule.doodadRef,`Free-race scenery placement doodad: ${ref}`);
      assert.ok(isVisualOnlyRaceScenery(placement)&&placement.state!=='removed',`Free-race scenery must be an active visual-only placement: ${ref}`);
      assert.equal(placement.previewDoodad.artRef,ref,`Free-race scenery preview art: ${ref}`);
      const doodadPath=manifest.folders.doodads?.[rule.doodadRef];
      assert.ok(doodadPath,`Missing free-race scenery doodad: ${rule.doodadRef}`);
      assert.equal(read(doodadPath)?.doodad?.artRef,ref,`Free-race scenery native doodad art: ${ref}`);
    }
    refs.add(ref);
  }
  return refs;
}
