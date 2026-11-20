import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolveRuntimeId} from '../../tools/art/runtime-source-binding.mjs';

test('source keys resolve only through explicit verified bindings', () => {
  assert.equal(resolveRuntimeId({id:'native-car'}), 'native-car');
  assert.equal(resolveRuntimeId({id:'source-example',runtimeDocumentId:'native-car',runtimeDocumentIdVerified:true}), 'native-car');
  for (const source of [
    {id:'source-example'},
    {id:'source-example',runtimeDocumentId:'native-car'},
    {id:'native-car',runtimeDocumentIdVerified:false},
    {id:'source-example',runtimeDocumentId:'../wrong',runtimeDocumentIdVerified:true},
  ]) assert.throws(() => resolveRuntimeId(source));
});

test('all 31 temporary packages bind to unchanged canonical saved documents', () => {
  const root = new URL('../../', import.meta.url);
  const dirs = fs.readdirSync(new URL('assets/car-catalog/', root)).filter(id => id.startsWith('source-'));
  assert.equal(dirs.length, 31);
  const ids = new Set();
  for (const id of dirs) {
    const config = JSON.parse(fs.readFileSync(new URL(`assets/car-catalog/${id}/package-config.json`, root)));
    const status = JSON.parse(fs.readFileSync(new URL(`assets/car-catalog/${id}/package-status.json`, root)));
    const stored = JSON.parse(fs.readFileSync(new URL(`data/server-storage/files/cars/${encodeURIComponent(config.name)}/document.json`, root)));
    const doc = stored.__chainsawStorage ? JSON.parse(gunzipSync(Buffer.from(stored.data, 'base64'))) : stored;
    assert.equal(resolveRuntimeId(config), doc.car.id);
    assert.equal(resolveRuntimeId(status), doc.car.id);
    assert.equal(config.name, doc.car.name);
    assert.ok(!ids.has(doc.car.id));
    ids.add(doc.car.id);
  }
});
