import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {DEFAULT_CAR_SMOKE,normalizeCarSmoke,carSmokeArtRef} from '../../src/racing/CarSmoke.js';import RaceEditor from '../../src/ui/RaceEditor.js';
const root=new URL('../../',import.meta.url);const read=p=>{const d=JSON.parse(fs.readFileSync(new URL(p,root)));return d.__chainsawStorage==='compact-v1'?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const configs=fs.readdirSync(new URL('assets/car-catalog/',root)).filter(n=>fs.existsSync(new URL(`assets/car-catalog/${n}/import.json`,root))).map(n=>read(`assets/car-catalog/${n}/import.json`));
test('all sourced catalog cars use actual fixed-rear editor mode and existing surface FX',()=>{
 assert.equal(configs.length,64);
 for(const {car} of configs){assert.equal(car.camera.trackingMode,'fixed-rear',car.id);assert.deepEqual(car.art.smoke,DEFAULT_CAR_SMOKE);assert.deepEqual(normalizeCarSmoke(car.art.smoke),DEFAULT_CAR_SMOKE);
 for(const ref of new Set(Object.values(car.art.smoke)))assert.ok(fs.existsSync(new URL(`data/server-storage/files/art/${ref}/document.json`,root)),ref);
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});assert.equal(editor.getCarCameraTrackingMode(car),'fixed-rear');
 }
});
test('published source-matched cars retain fixed-rear and particle art after editor roundtrip',()=>{
 const ids=new Set(configs.map(c=>c.car.id));let count=0;
 for(const n of fs.readdirSync(new URL('data/server-storage/files/cars/',root))){const p=`data/server-storage/files/cars/${n}/document.json`;if(!fs.existsSync(new URL(p,root)))continue;const d=read(p);if(!ids.has(d.car?.id))continue;count++;
 assert.equal(d.car.camera.trackingMode,'fixed-rear',n);assert.deepEqual(d.car.art.smoke,DEFAULT_CAR_SMOKE,n);
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});editor.applyLoadedCarDocument(d,{name:d.car.name});const c=editor.serializeSelectedCarDocument().car;assert.equal(c.camera.trackingMode,'fixed-rear');assert.deepEqual(c.art.smoke,DEFAULT_CAR_SMOKE);
 }assert.equal(count,configs.length);
});
test('EV has tire smoke and spray, not an invented exhaust emitter; skid marks remain separate',()=>{
 const ev=configs.find(c=>c.car.id==='volt-hound-gt-2023').car;assert.equal(carSmokeArtRef(ev,'asphalt','skidSmoke'),'burnoutsmoke');assert.equal(carSmokeArtRef(ev,'water','wetSpray'),'waterspray');assert.equal(carSmokeArtRef(ev,'asphalt','asphaltSkid'),'');assert.ok(!Object.keys(ev.art.smoke).some(k=>/exhaust/i.test(k)));
});
