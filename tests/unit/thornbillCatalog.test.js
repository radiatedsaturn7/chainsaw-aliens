import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url))),cfg=read('assets/car-catalog/thornbill-gt-2018/import.json'),doc=read('data/server-storage/files/cars/Thornbill GT 2018/document.json');
test('Thornbill retains GT RWD factory mechanical anchors, not 2.0T or AWD specs',()=>{
 for(const c of [cfg.car,doc.car]){
  assert.equal(c.id,'thornbill-gt-2018');assert.equal(c.tuning.drivetrain,'rwd');assert.equal(c.tuning.powerHp,365);assert.equal(c.tuning.torqueLbFt,376);assert.equal(c.tuning.engineDisplacementL,3.342);assert.equal(c.tuning.weightKg,3829*.45359237);
  assert.equal(c.dimensions.wheelbaseM,114.4*.0254);assert.equal(c.dimensions.lengthM,190.2*.0254);assert.equal(c.dimensions.widthM,73.6*.0254);assert.equal(c.tuning.physics.bodyProfile.overallHeightM,55.1*.0254);
  assert.deepEqual(Object.keys(c.transmissions),['automatic']);const t=c.transmissions.automatic;assert.deepEqual(t.gearRatios,[3.665,2.396,1.610,1.190,1,.826,.643,.556]);assert.equal(t.reverseRatio,2.273);assert.equal(t.gearFinalDrive,3.538);assert.equal(t.cvt,undefined);
  assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===6000&&Math.abs(p.torqueLbFt*6000/5252-365)<1e-9));
 }
 assert.match(cfg.provenance.estimates[0],/minimum RWD/);assert.match(cfg.provenance.sources[0].access,/403/);
});
test('Thornbill real editor roundtrip preserves staggered tire geometry, fixed camera and shared wheel',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));
 assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');assert.ok(c.art.interior.steeringWheel.anchorX<.3);
 const g=axleTireGeometry(c.setup,c.tuning);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.3313)<1e-12);assert.ok(Math.abs(g.wheelRadiusByWheelM.rr-.33055)<1e-12);assert.equal(g.wheelWidthByWheelM.fl,.225);assert.equal(g.wheelWidthByWheelM.rr,.255);assert.ok(Math.abs(e.getRaceCarTuning(c).wheelRadiusM-.33055)<1e-12);
 for(const v of Object.values(c.art.angleLayers)){assert.equal(v.body.artRef,'catalog-thornbill-gt-2018-body');assert.equal(v.tires.tireMode,'auto');}
 const m=read('data/server-storage/files/manifest.json');assert.equal(m.folders.cars[c.name],'cars/Thornbill GT 2018/document.json');
});
test('Thornbill authored PNG hashes and all eight separate frames survive import',()=>{
 for(const k of ['body','dashboard'])assert.equal(doc.car.catalogProvenance.sourceHashes[k],createHash('sha256').update(fs.readFileSync(new URL('../../assets/car-catalog/thornbill-gt-2018/'+k+'.png',import.meta.url))).digest('hex'));
 const d=read('data/server-storage/files/art/catalog-thornbill-gt-2018-body/document.json'),art=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));assert.equal(art.frames.length,8);assert.equal(new Set(art.frames.map(x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))).size,8);
});
