import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url))),cfg=read('assets/car-catalog/celandine-ls-1995/import.json'),doc=read('data/server-storage/files/cars/Celandine LS 1995/document.json');
test('Celandine retains exact1995 stock LS sedan5MT anchors rather than coupe/GS-R/film tuning',()=>{
 for(const c of [cfg.car,doc.car]){
  assert.equal(c.id,'celandine-ls-1995');assert.equal(c.tuning.powerHp,142);assert.equal(c.tuning.torqueLbFt,127);assert.equal(c.tuning.weightKg,1226);assert.equal(c.tuning.engineDisplacementL,1.834);assert.equal(c.tuning.frontWeightDistribution,.62);assert.equal(c.tuning.drivetrain,'fwd');assert.equal(c.tuning.aspiration,'Naturally Aspirated');assert.equal(c.tuning.redlineRpm,6800);assert.equal(c.tuning.revLimitRpm,7000);
  assert.equal(c.dimensions.wheelbaseM,2.62);assert.equal(c.dimensions.lengthM,4.525);assert.equal(c.dimensions.widthM,1.71);assert.equal(c.tuning.physics.bodyProfile.overallHeightM,1.37);assert.equal(c.tuning.physics.bodyProfile.groundClearanceM,.15);assert.equal(c.tuning.steeringRatio,16.1);
  assert.deepEqual(c.transmissions.manual.gearRatios,[3.23,1.9,1.269,.966,.714]);assert.equal(c.transmissions.manual.reverseRatio,3);assert.equal(c.transmissions.manual.gearFinalDrive,4.266);assert.deepEqual(c.setup.tireSize,{widthMm:195,aspectRatio:60,wheelDiameterIn:14});
  assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===6300&&Math.abs(p.torqueLbFt*6300/5252-142)<1e-9));
 }
});
test('Celandine editor preserves manual plus auto assist, fixed camera and readable shared-wheel coordinates',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.defaultTransmissionType,'automatic');assert.equal(e.getRaceCarTuning(c).shiftMode,'automatic');assert.equal(e.getRaceCarTuning(c,{transmissionType:'manual'}).shiftMode,'manual');
 const {type,label,shiftMode,...a}=c.transmissions.automatic,{type:mt,label:ml,shiftMode:ms,...m}=c.transmissions.manual;assert.deepEqual(a,m);assert.equal(label,'Auto Assist (5MT)');assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');
 for(const v of Object.values(c.art.angleLayers)){assert.equal(v.body.artRef,'catalog-celandine-ls-1995-body');assert.equal(v.tires.tireMode,'auto');}
 assert.equal(read('data/server-storage/files/manifest.json').folders.cars[c.name],'cars/Celandine LS 1995/document.json');
});
test('Celandine original PNG hashes and eight different body frames survive native import',()=>{
 for(const k of ['body','dashboard'])assert.equal(doc.car.catalogProvenance.sourceHashes[k],createHash('sha256').update(fs.readFileSync(new URL('../../assets/car-catalog/celandine-ls-1995/'+k+'.png',import.meta.url))).digest('hex'));
 const d=read('data/server-storage/files/art/catalog-celandine-ls-1995-body/document.json'),art=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));assert.equal(art.frames.length,8);assert.equal(new Set(art.frames.map(x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))).size,8);
});
