import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fitTireTextureRegions } from '../../src/racing/CarTireTextureFit.js';

const read = relative => JSON.parse(fs.readFileSync(new URL('../../' + relative, import.meta.url)));
test('catalog Rain tread and wheel use two distinct opaque fitted frames without changing physical setup', () => {
  const tire=read('data/server-storage/files/tires/Rain/document.json');
  assert.equal(tire.baseCompound,'rain');
  assert.deepEqual(tire.size,{widthMm:245,aspectRatio:40,wheelDiameterIn:18});
  assert.equal(tire.pressurePsi,32);
  assert.deepEqual(tire.compound,{"id":"rain","label":"Rain","surfaceGrip":{"asphalt":0.94,"wet-asphalt":1.03,"dirt":0.72,"gravel":0.7,"mud":0.56,"wet-gravel":0.76,"snow":0.34,"slush":0.5},"wetEvacuationFactor":1.35,"treadDepthMm":8.5,"wearRate":1.1});
  const ref='catalog-rain-directional';
  const packed=read(`data/server-storage/files/art/${ref}/document.json`);
  const art=JSON.parse(zlib.gunzipSync(Buffer.from(packed.data,'base64')));
  assert.equal(art.frames.length,2);
  assert.equal(art.width,658); assert.equal(art.height,671);
  for(const frame of art.frames)assert.equal(frame.length,art.width*art.height);
  assert.notDeepEqual(art.frames[0],art.frames[1]);
  const fitted=fitTireTextureRegions(art.frames,art.width,art.height,{treadFrame:0,wheelFrame:1});
  assert.ok(fitted.wheel.region.radius>300,'opaque backing supports full wheel face, not just one spoke');
  assert.ok(fitted.wheel.region.radius<art.width/2);
  assert.deepEqual(tire.graphics.tireSurfaces.tread,{artRef:ref,frameIndex:0,...fitted.tread});
  assert.deepEqual(tire.graphics.tireSurfaces.wheel,{artRef:ref,frameIndex:1,...fitted.wheel});
  assert.equal(Object.keys(tire.graphics.angleLayers).length,8);
  for(const [angle,layers] of Object.entries(tire.graphics.angleLayers)) {
    assert.equal(layers.tires.artRef,ref);
    assert.equal(layers.tires.frameIndex,['left','right'].includes(angle)?1:0);
    assert.equal(layers.tires.cylinder,true);
  }
});
