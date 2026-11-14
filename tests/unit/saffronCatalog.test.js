import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url))),cfg=read('assets/car-catalog/saffron-135-2010/import.json'),doc=read('data/server-storage/files/cars/Saffron 135 2010/document.json');
test('Saffron retains UK Sporting three-door SI anchors and five speeds rather than 105 six-speed',()=>{
 for(const c of [cfg.car,doc.car]){
  assert.equal(c.id,'saffron-135-2010');assert.equal(c.tuning.powerHp,c===cfg.car?99000/745.6998715822702:133);assert.equal(c.tuning.torqueLbFt,c===cfg.car?206*.737562149277:152);assert.equal(c.tuning.weightKg,1155);assert.equal(c.tuning.engineDisplacementL,1.368);assert.equal(c.tuning.drivetrain,'fwd');assert.equal(c.tuning.aspiration,'Turbocharged');
  assert.deepEqual(c.dimensions,{lengthM:4.065,widthM:1.687,wheelbaseM:2.51,trackFrontM:1.473,trackRearM:1.466});assert.equal(c.tuning.physics.bodyProfile.overallHeightM,1.49);assert.deepEqual(c.setup.tireSize,{widthMm:205,aspectRatio:45,wheelDiameterIn:17});
  assert.equal(c.transmissions.manual.gearRatios.length,5);assert.equal(c.transmissions.automatic.gearRatios.length,5);assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===5000&&Math.abs(p.torqueLbFt*5000/5252-cfg.car.tuning.powerHp)<1e-9));
 }
});
test('Saffron explicitly retains gearing uncertainty instead of certifying an unsourced final drive',()=>{
 for(const p of [cfg.provenance,doc.car.catalogProvenance]){
  assert.match(p.gearingStatus.finalDrive,/gameplay estimate.*NOT verified/);assert.match(p.gearingStatus.individualRatios,/gameplay estimates/);assert.equal(p.verifiedFacts.forwardGearCount,5);assert.equal(p.verifiedFacts.powerKw,99);
  assert.ok(!p.sources.some(s=>s.fields.includes('transmissions.manual.gearFinalDrive')));
 }
 assert.equal(cfg.cockpitCalibration.wheelPivotAndWidthPixels[0],1620);assert.ok(cfg.cockpitCalibration.wheelPivotAndWidthPixels[0]>cfg.cockpitCalibration.sourceImageSize[0]/2);
});
test('Saffron editor preserves manual plus auto assist, fixed camera and readable shared-wheel coordinates',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.defaultTransmissionType,'automatic');assert.equal(e.getRaceCarTuning(c).shiftMode,'automatic');assert.equal(e.getRaceCarTuning(c,{transmissionType:'manual'}).shiftMode,'manual');
 const {type,label,shiftMode,...a}=c.transmissions.automatic,{type:mt,label:ml,shiftMode:ms,...m}=c.transmissions.manual;assert.deepEqual(a,m);assert.equal(label,'Auto Assist (5MT)');assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');
 for(const v of Object.values(c.art.angleLayers)){assert.equal(v.body.artRef,'catalog-saffron-135-2010-body');assert.equal(v.tires.tireMode,'auto');}
 assert.equal(read('data/server-storage/files/manifest.json').folders.cars[c.name],'cars/Saffron 135 2010/document.json');
});
test('Saffron original PNG hashes and eight different body frames survive native import',()=>{
 for(const k of ['body','dashboard'])assert.equal(doc.car.catalogProvenance.sourceHashes[k],createHash('sha256').update(fs.readFileSync(new URL('../../assets/car-catalog/saffron-135-2010/'+k+'.png',import.meta.url))).digest('hex'));
 const d=read('data/server-storage/files/art/catalog-saffron-135-2010-body/document.json'),art=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));assert.equal(art.frames.length,8);assert.equal(new Set(art.frames.map(x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))).size,8);
});
