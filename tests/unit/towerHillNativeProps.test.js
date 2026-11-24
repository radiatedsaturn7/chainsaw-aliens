import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from '../../src/vendorBridge/three.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { modelAssets } from '../../src/model3d/ModelAssets.js';
import { prepareManagedRaceScenery } from '../../src/racing/RaceVisibleScenery.js';

const storage = '../../data/server-storage/files/';
const read = name => JSON.parse(readFileSync(new URL(storage + name, import.meta.url), 'utf8'));
function decode(stored) {
  if (stored.__chainsawStorage === 'compact-v1') {
    assert.match(stored.encoding, /^(json-)?gzip-base64$/);
    return JSON.parse(gunzipSync(Buffer.from(stored.data, 'base64')));
  }
  return stored;
}
const manifest = read('manifest.json');
const refs = ['tower-hill-mailbox', 'tower-hill-small-shed'];
const originalRoute = decode(read('races/Tower%20Hill%20Road/document.json')).race;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2e-6, `${actual} != ${expected}`);
function spriteCanvas(ref, revision = 0) {
  const width = 16, height = 24, pixels = new Uint8ClampedArray(width * height * 4);
  for (let y=2; y<21; y++) for (let x=1; x<13; x++) pixels[(y*width+x)*4+3]=255;
  return { ref, width, height, __raceArtCacheKey: `${ref}:${revision}`,
    getContext: () => ({ getImageData: () => ({ data: pixels }) }) };
}

test('saved Tower Hill dual visuals preserve original projected art, collision and live render fallback', async () => {
  assert.equal(originalRoute.weather, 'snow');
  assert.equal(originalRoute.timeOfDay, 'night');
  const placements = originalRoute.scenery.filter(s => refs.includes(s.doodadRef));
  assert.equal(placements.length, 2);
  const [mail, shed] = refs.map(ref => placements.find(s => s.doodadRef === ref));
  for (const prop of [mail, shed]) {
    const ref = prop.previewDoodad.model.ref;
    assert.equal(ref, prop.doodadRef + '-3d');
    assert.equal(manifest.folders.models[ref], `models/${ref}/document.json`);
    assert.equal(prop.previewDoodad.artRef, prop.doodadRef);
  }
  // Same chunk as mailbox, to exercise partial art refresh in a chunk also
  // containing a warm native mesh, without touching the authored input.
  const neighbor = { ...mail, id:'same-chunk-art-fixture', previewDoodad: { ...mail.previewDoodad, artRef: 'neighbor', model: null } };
  const selected = [mail, shed, neighbor];
  const e = new RaceEditor({});
  e.project.races = [{ ...originalRoute, scenery: selected }]; e.project.selectedRaceId = originalRoute.id;
  e.getRaceSurfaceGeometryRevisionKey = () => 'exact-test-slope';
  const surface = { sampleWorld: ({ x, z }) => ({ elevation: (x-z)*.001 }) };
  e.getRaceSurfaceModel = () => surface;
  const art = new Map([...refs, 'neighbor'].map(ref => [ref, spriteCanvas(ref)]));
  e.getRaceArtSpriteCanvas = ref => art.get(ref);
  const materials = new Map([...art.keys()].map(ref => [ref, new THREE.MeshBasicMaterial()]));
  e.getRaceThreeDoodadMaterial = (_renderer, ref) => materials.get(ref);
  const stageQuad = prop => e.getRaceDoodadWorldQuad(prop);
  for (const prop of placements) {
    const old = { ...prop, previewDoodad: { ...prop.previewDoodad, model: null } };
    const { doodad, sprite, ...quad } = stageQuad(prop);
    const { doodad: oldDoodad, sprite: oldSprite, ...oldQuad } = stageQuad(old);
    assert.deepEqual(quad, oldQuad, 'saved raster crop and terrain anchoring must be identical');
    assert.deepEqual({ ...doodad, model: null }, oldDoodad);
    assert.deepEqual(e.getRaceDoodadHitboxWorldMeshes(prop, { forceVisible: true }),
      e.getRaceDoodadHitboxWorldMeshes(old, { forceVisible: true }));
  }
  const render = { scene: new THREE.Scene(), doodadMaterialCache: materials };
  const session = e.playtestSession = { elapsedMs:0, removedSceneryIds:[], flattenedSceneryIds:[] };
  const state = prepareManagedRaceScenery(selected, session);
  assert.equal(state.chunks.size, 2);
  const mailboxRef = mail.previewDoodad.model.ref, shedRef = shed.previewDoodad.model.ref;
  let mailboxReady;
  const savedLoad=modelAssets.load,savedHydrate=modelAssets.hydrate;
  modelAssets.load=()=>null;
  modelAssets.hydrate=(_folder, ref)=>ref===mailboxRef
    ? new Promise(resolve => { mailboxReady=resolve; })
    : Promise.reject(new Error('deliberate fixture transport failure'));
  const look = () => {
    const result = { byId: new Map(), raster: new Set(), calls:0, triangles:0 };
    render.dynamicDoodadGroup.traverse(entry => {
      if (entry.userData.modelInstance) result.byId.set(entry.userData.spriteId, entry);
      if (entry.userData.sceneryArtRef) result.raster.add(entry.userData.sceneryArtRef);
      if (entry.isMesh) {
        result.calls++;
        result.triangles += (entry.geometry.index?.count ?? entry.geometry.getAttribute('position').count)/3;
      }
    });
    return result;
  };
  try {
    assert.equal(e.addRaceThreeDoodads(render), true);
    const cold = look();
    assert.deepEqual(cold.raster, new Set([...refs,'neighbor']));
    assert.equal(cold.byId.size, 0);
    const failed = modelAssets.pending.get(shedRef);
    const delayed = modelAssets.pending.get(mailboxRef);
    await assert.rejects(failed);
    const coldNeighbor = render.dynamicDoodadChunks.get(`${Math.floor(shed.x/128)},${Math.floor(shed.z/128)}`).dynamicDoodadGroup;
    mailboxReady({ data: decode(read(manifest.folders.models[mailboxRef])) });
    await delayed;
    const stats={};
    assert.equal(e.addRaceThreeDoodads(render,{stats}), true);
    const warm = look();
    assert.equal(warm.byId.size,1);
    assert.equal(stats.dynamicDoodadChunkRebuilds,1,'unrelated chunks must not rebuild on model arrival');
    assert.equal(render.dynamicDoodadChunks.get(`${Math.floor(shed.x/128)},${Math.floor(shed.z/128)}`).dynamicDoodadGroup,coldNeighbor);
    assert.ok(warm.raster.has(shed.doodadRef),'failed model still shows its original art');
    assert.ok(!warm.raster.has(mail.doodadRef),'warm model replaces rather than doubles the sprite');
    const verifyNative = (holder, prop) => {
      // Compute in placement-local space (Three accounts for the parent's yaw).
      const instance = holder.userData.modelInstance;
      holder.remove(instance.object);
      const local = new THREE.Box3().setFromObject(instance.object);
      holder.add(instance.object);
      const qu = stageQuad(prop);
      const size = local.getSize(new THREE.Vector3());
      near(holder.position.x,prop.x); near(holder.position.z,prop.z); near(holder.rotation.y,prop.yaw);
      near(holder.position.y,e.getRaceThreeElevationM(qu.points[2]));
      const billboardRight = new THREE.Vector3(qu.points[1].x-qu.points[0].x,0,qu.points[1].z-qu.points[0].z).normalize();
      const up = new THREE.Vector3(0,1,0);
      const nativeYaw=holder.rotation.y+instance.root.rotation.y;
      const readableFront = new THREE.Vector3().crossVectors(billboardRight,up);
      near(billboardRight.dot(new THREE.Vector3(1,0,0).applyAxisAngle(up,nativeYaw)),1);
      near(readableFront.dot(new THREE.Vector3(0,0,1).applyAxisAngle(up,nativeYaw)),1);
      near(size.x,qu.widthM); near(size.y,qu.heightM); near(local.min.y,0);
      assert.ok(instance.root.children[0].material.map?.isDataTexture);
      assert.equal(instance.binding.ref,prop.previewDoodad.model.ref);
    };
    const holder=warm.byId.get(mail.id);
    verifyNative(holder,mail);
    assert.equal(stats.drawCalls,warm.calls); assert.equal(stats.polygons,warm.triangles);
    art.set('neighbor',spriteCanvas('neighbor',1));
    const artStats={};
    e.addRaceThreeDoodads(render,{stats:artStats});
    assert.equal(look().byId.get(mail.id),holder,'neighbor raster refresh should keep native geometry');
    assert.equal(artStats.drawCalls,look().calls); assert.equal(artStats.polygons,look().triangles);
    assert.deepEqual(render.dynamicDoodadAnimations, [], 'unanimated native props must not reskin per frame');

    // An explicit subsequent successful prepared load must replace the failed
    // fallback in the shed's chunk, without rebuilding the now-warm mailbox.
    modelAssets.hydrate = (_folder, ref) => ({ data: decode(read(manifest.folders.models[ref])) });
    await modelAssets.prepare(shedRef);
    const readyStats={};
    e.addRaceThreeDoodads(render,{stats:readyStats});
    const ready=look();
    assert.equal(ready.byId.size,2);
    assert.equal(ready.byId.get(mail.id),holder);
    assert.deepEqual(ready.raster,new Set(['neighbor']));
    assert.equal(readyStats.dynamicDoodadChunkRebuilds,1);
    assert.equal(readyStats.drawCalls,ready.calls); assert.equal(readyStats.polygons,ready.triangles);
    verifyNative(ready.byId.get(shed.id),shed);
    assert.deepEqual(render.dynamicDoodadAnimations, []);

    const draws=[];
    e.projectRaceWorldPointToCamera = point => ({ visible:true, screenX:(point.x-mail.x)/4+320,
      screenY:240-point.elevation, elevation:point.elevation,cameraZ:20,renderZ:20 });
    const context = { save(){}, restore(){}, translate(){}, scale(){}, drawImage(...args){draws.push(args);} };
    e.drawRaceProjectedScenerySprites(context,{x:0,y:0,w:640,h:480});
    for(const ref of refs)assert.ok(draws.some(args=>args[0] === art.get(ref) && args.length === 9),'warm 2D must use cropped original sprite');
    draws.length=0;
    e.drawRaceProjectedScenerySprites(context,{x:0,y:0,w:640,h:480},{skipDoodads:true});
    assert.equal(draws.length,0);
    session.flattenedSceneryIds.push(mail.id); session.removedSceneryIds.push(shed.id);
    e.addRaceThreeDoodads(render);
    const after=look();
    assert.equal(after.byId.size,0); assert.deepEqual(after.raster,new Set(['neighbor']));
  } finally {
    e.clearRaceThreeDynamicDoodads(render);
    modelAssets.load=savedLoad; modelAssets.hydrate=savedHydrate;
    for (const ref of [mailboxRef,shedRef]) { modelAssets.entries.delete(ref); modelAssets.errors.delete(ref); }
  }
});
