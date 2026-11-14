import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url))),cfg=read('assets/car-catalog/fenfire-1800-1986/import.json'),doc=read('data/server-storage/files/cars/Fenfire 1800 1986/document.json');
test('Fenfire retains stock road RS200 dimensions, full-fuel mass and engine instead of Evolution race specs',()=>{
 for(const c of [cfg.car,doc.car]){
  assert.equal(c.id,'fenfire-1800-1986');assert.equal(c.tuning.powerHp,250);assert.equal(c.tuning.torqueLbFt,215);assert.equal(c.tuning.weightKg,1180);assert.equal(c.tuning.engineDisplacementL,1.8035);assert.equal(c.tuning.frontWeightDistribution,545/1180);assert.equal(c.tuning.drivetrain,'awd');assert.equal(c.tuning.aspiration,'Turbocharged');assert.equal(c.tuning.revLimitRpm,7400);assert.equal(c.tuning.centerDifferentialBalance,.63);
  assert.deepEqual(c.dimensions,{lengthM:4,widthM:1.764,wheelbaseM:2.53,trackFrontM:1.502,trackRearM:1.498});assert.equal(c.tuning.physics.bodyProfile.overallHeightM,1.322);assert.equal(c.tuning.physics.bodyProfile.groundClearanceM,.18);
  assert.deepEqual(c.setup.tireSize,{widthMm:225,aspectRatio:50,wheelDiameterIn:16});assert.equal(c.tuning.wheelRadiusM,.3088);assert.deepEqual(c.setup.tirePressurePsi,{fl:29,fr:29,rl:29,rr:29});
  assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===6500&&Math.abs(p.torqueLbFt*6500/5252-250)<1e-9));
 }
});
test('Fenfire includes primary transfer exactly once and reproduces owner-manual road-speed table',()=>{
 const ratios=[2.692,1.824,1.318,1.043,.786],overall=[12.289,8.326,6.016,4.760,3.587],speed=[9.47,13.98,19.34,24.45,32.44];
 for(const c of [cfg.car,doc.car])for(const t of Object.values(c.transmissions)){
  assert.deepEqual(t.gearRatios,ratios);assert.equal(t.reverseRatio,3.083);assert.equal(t.gearFinalDrive,4.375*1.043);
  ratios.forEach((r,i)=>{// Published inputs and overall columns are rounded independently to three decimals.
  const roundingBound=.0005*(4.375*1.043+r*4.375+r*1.043+1)+.00001;assert.ok(Math.abs(r*t.gearFinalDrive-overall[i])<roundingBound);const kmh=1000/(r*t.gearFinalDrive)*2*Math.PI*.3088*60/1000;assert.ok(Math.abs(kmh-speed[i])<.06,`${i}: ${kmh}`);});
 }
});
test('Fenfire editor preserves selectable manual, Auto Assist, fixed camera and shared wheel',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.defaultTransmissionType,'automatic');assert.equal(e.getRaceCarTuning(c).shiftMode,'automatic');assert.equal(e.getRaceCarTuning(c,{transmissionType:'manual'}).shiftMode,'manual');
 const {type,label,shiftMode,...a}=c.transmissions.automatic,{type:mt,label:ml,shiftMode:ms,...m}=c.transmissions.manual;assert.deepEqual(a,m);assert.equal(label,'Auto Assist (5MT)');assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');
 for(const v of Object.values(c.art.angleLayers)){assert.equal(v.body.artRef,'catalog-fenfire-1800-1986-body');assert.equal(v.tires.tireMode,'auto');}
 assert.equal(read('data/server-storage/files/manifest.json').folders.cars[c.name],'cars/Fenfire 1800 1986/document.json');
});
test('Fenfire original PNG hashes and eight distinct frames survive native import',()=>{
 for(const k of ['body','dashboard'])assert.equal(doc.car.catalogProvenance.sourceHashes[k],createHash('sha256').update(fs.readFileSync(new URL('../../assets/car-catalog/fenfire-1800-1986/'+k+'.png',import.meta.url))).digest('hex'));
 const d=read('data/server-storage/files/art/catalog-fenfire-1800-1986-body/document.json'),art=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));assert.equal(art.frames.length,8);assert.equal(new Set(art.frames.map(x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))).size,8);
});
