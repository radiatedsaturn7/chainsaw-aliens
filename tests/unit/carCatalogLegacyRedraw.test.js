import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash}from'node:crypto';import {gunzipSync}from'node:zlib';
import {decodePng}from'../../scripts/car-catalog-import.mjs';import {prepareCarSheet,carSheetDocument}from'../../src/racing/CarGraphicImport.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
for(const id of ['sti-airslayer','rtg-s'])test(id+' distinct original eight-view redraw preserves every non-exterior field',()=>{
 const cfg=read(`assets/car-catalog/${id}/redraw.json`),d=read(`data/server-storage/files/cars/${cfg.name}/document.json`),ref=`catalog-${id}-body`,art=read(`data/server-storage/files/art/${ref}/document.json`);
 const im=decodePng(`assets/car-catalog/${id}/body.png`);assert.deepEqual(art,carSheetDocument(im,prepareCarSheet(im)));assert.equal(art.frames.length,8);
 for(const [slot,a]of Object.entries(d.car.art.angleLayers)){assert.equal(a.body.artRef,ref);assert.ok(a.body.transforms.bodyScaleX>0);assert.ok(a.tires.transforms.tireScaleY>0);if(!['front','rear'].includes(slot))for(const p of cfg.authoredWheelAnchors[slot])assert.ok(im.data[(p.y*im.width+p.x)*4+3]<50,'Transparent runtime wheel opening: '+slot);delete a.body;delete a.tires.transforms;}
 assert.equal(createHash('sha256').update(JSON.stringify(d)).digest('hex'),cfg.preservedDocumentSha256);
 const original=read('data/server-storage/files/cars/RTG-001/document.json');for(const a of Object.values(original.car.art.angleLayers))assert.notEqual(a.body?.artRef,ref);
 assert.equal(read('data/server-storage/files/manifest.json').folders.art[ref],`art/${ref}/document.json`);
});
