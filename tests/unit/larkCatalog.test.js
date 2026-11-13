import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const base=new URL('../../assets/car-catalog/lark-1600-1990/',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Lark base1990 US5MT uses OEM anchors and discloses mass conflict',()=>{
 const c=config.car,t=c.tuning;assert.equal(t.drivetrain,'rwd');assert.equal(t.weightKg,979.7595192);assert.equal(t.powerHp,116);assert.equal(t.torqueLbFt,100);
 assert.deepEqual(c.transmissions.manual.gearRatios,[3.136,1.888,1.330,1,.814]);assert.equal(c.transmissions.manual.reverseRatio,3.758);assert.equal(c.transmissions.manual.gearFinalDrive,4.3);
 assert.equal(c.dimensions.wheelbaseM,2.26568);assert.equal(t.steeringRatio,18);assert.equal(t.rearDifferentialAccel,0);assert.deepEqual(c.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:14});assert.equal(t.wheelRadiusM,.2888);
 assert.ok(config.provenance.estimates.some(x=>x.includes('2116lb')));assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===6500).torqueLbFt*6500/5252-116)<1e-9);
});
test('Lark source alpha openings, unique sprite regions and actual editor serialization',()=>{
 const body=decodePng(new URL('body.png',base).pathname),prepared=prepareCarSheet(body);assert.equal(prepared.crops.length,8);
 const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 for(const [slot,points]of Object.entries(config.authoredWheelAnchors)){
  const crop=prepared.crops[config.mapping[slots.indexOf(slot)]];
  for(const p of points){assert.ok(p.x>=crop.x&&p.x<crop.x+crop.width);if(['front','rear'].includes(slot))continue;assert.ok(body.data[(p.y*body.width+p.x)*4+3]<128);let top=p.y;while(top>0&&body.data[((top-1)*body.width+p.x)*4+3]<128)top--;assert.ok(p.radius>=p.y-top,`${slot} ${p.x} radius${p.radius} needs${p.y-top}`);}
 }
 const b=buildCatalogDocuments(config,body,decodePng(new URL('dashboard.png',base).pathname));assert.equal(b.car.car.id,'lark-1600-1990');assert.equal(b.car.car.camera.trackingMode,'fixed-rear');assert.equal(b.car.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(b.car.car.art.gauges.interior.coordinateSpace,'dashboard');assert.equal(b.art['catalog-lark-1600-1990-body'].frames.length,8);
});
