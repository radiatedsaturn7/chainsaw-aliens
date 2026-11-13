import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodePng} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet,carSheetDocument} from '../../src/racing/CarGraphicImport.js';
test('Kestrel revised exterior matches published editor art and source hash',()=>{
 const root=new URL('../../',import.meta.url),png=new URL('assets/car-catalog/kestrel-660-2018/body.png',root);
 const image=decodePng(png.pathname),expected=carSheetDocument(image,prepareCarSheet(image));
 const stored=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/art/catalog-kestrel-660-2018-body/document.json',root)));
 assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))),expected);
 const car=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/cars/2018 Kestrel 660/document.json',root))).car;
 assert.equal(car.catalogProvenance.sourceHashes.body,createHash('sha256').update(fs.readFileSync(png)).digest('hex'));
 assert.equal(expected.frames.length,8);
 for(const frame of expected.frames){assert.ok(frame.some(p=>p===null));assert.ok(frame.some(p=>p!==null));}
});
