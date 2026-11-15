import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
const cfg=read('assets/car-catalog/briar-2024/import.json'),doc=read('data/server-storage/files/cars/Briar 2024/document.json');
test('Briar 2024 retains Base source anchors and discloses CVT assumptions',()=>{
 for(const c of [cfg.car,doc.car]){
  assert.equal(c.id,'briar-2024');assert.equal(c.tuning.weightKg,3454*.45359237);assert.equal(c.tuning.powerHp,182);assert.equal(c.tuning.torqueLbFt,176);assert.equal(c.tuning.engineDisplacementL,2.498);assert.equal(c.tuning.drivetrain,'awd');assert.equal(c.tuning.aspiration,'Naturally Aspirated');
  assert.equal(c.dimensions.wheelbaseM,105.1*.0254);assert.equal(c.dimensions.lengthM,182.7*.0254);assert.equal(c.dimensions.widthM,71.5*.0254);assert.equal(c.tuning.physics.bodyProfile.overallHeightM,67.5*.0254);assert.equal(c.tuning.physics.bodyProfile.groundClearanceM,8.7*.0254);
  assert.deepEqual(c.setup.tireSize,{widthMm:225,aspectRatio:60,wheelDiameterIn:17});assert.equal(c.tuning.wheelRadiusM,.3509);
  assert.deepEqual(Object.keys(c.transmissions),['automatic']);assert.equal(c.defaultTransmissionType,'automatic');assert.equal(c.transmissions.automatic.gearRatios.length,1);assert.equal(c.transmissions.automatic.cvt.powerRpm,5800);
  assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===4400&&p.torqueLbFt===176));assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===5800&&Math.abs(p.torqueLbFt*5800/5252-182)<1e-9));
 }
 assert.match(cfg.provenance.estimates[0],/NOT verified Base/);
});
test('Briar real editor roundtrip retains new art, fixed camera and shared wheel with visible-opening gauges',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;
 assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');assert.ok(c.art.interior.steeringWheel.anchorX<.3);
 assert.equal(e.getRaceCarTuning(c).cvt.maxRatio,3.601);
 const manifest=read('data/server-storage/files/manifest.json');assert.equal(manifest.folders.cars[c.name],'cars/Briar 2024/document.json');
 for(const [slot,v]of Object.entries(c.art.angleLayers)){assert.equal(v.body.artRef,'catalog-briar-2024-body');assert.equal(v.tires.tireMode,'auto');}
});
test('Briar source PNG hashes match imported original art provenance and eight separate angles',()=>{
 for(const [key,file]of [['body','body.png'],['dashboard','dashboard.png']]){
  const hash=createHash('sha256').update(fs.readFileSync(new URL('../../assets/car-catalog/briar-2024/'+file,import.meta.url))).digest('hex');assert.equal(doc.car.catalogProvenance.sourceHashes[key],hash);
 }
 const packed=read('data/server-storage/files/art/catalog-briar-2024-body/document.json');const art=JSON.parse(gunzipSync(Buffer.from(packed.data,'base64')));assert.equal(art.frames.length,8);assert.equal(new Set(art.frames.map(x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))).size,8);
});
