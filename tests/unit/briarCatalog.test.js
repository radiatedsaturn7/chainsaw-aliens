import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
const base=new URL('../../assets/car-catalog/briar-xt-2004/',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Briar uses US2004 XT5MT mechanical anchors and explicit dimension conflicts',()=>{
 const c=config.car,t=c.tuning;assert.equal(c.defaultTransmissionType,'manual');assert.equal(t.drivetrain,'awd');assert.equal(t.weightKg,1455);assert.equal(t.powerHp,210);assert.equal(t.torqueLbFt,235);
 assert.deepEqual(c.transmissions.manual.gearRatios,[3.454,1.947,1.366,.972,.738]);assert.equal(c.transmissions.manual.gearFinalDrive,4.444);assert.equal(c.transmissions.manual.reverseRatio,3.333);
 assert.equal(c.dimensions.wheelbaseM,2.525);assert.equal(t.physics.bodyProfile.overallHeightM,1.585);assert.equal(t.physics.bodyProfile.groundClearanceM,.195);assert.ok(config.provenance.estimates.some(x=>x.includes('conflict unresolved')));
 assert.equal(c.setup.tireSize.widthMm,215);assert.equal(t.wheelRadiusM,.3322);assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===5600).torqueLbFt*5600/5252-210)<1e-8);
});
test('Briar measured openings and editor serializer preserve unique artwork, camera and controls',()=>{
 const body=decodePng(new URL('body.png',base).pathname);
 for(const [slot,points]of Object.entries(config.authoredWheelAnchors))if(!['front','rear'].includes(slot))for(const p of points){assert.ok(body.data[(p.y*body.width+p.x)*4+3]<128);let top=p.y;while(top>0&&body.data[((top-1)*body.width+p.x)*4+3]<128)top--;assert.ok(p.radius>=p.y-top,slot);}
 const b=buildCatalogDocuments(config,body,decodePng(new URL('dashboard.png',base).pathname));assert.equal(b.car.car.id,'briar-xt-2004');assert.equal(b.car.car.camera.trackingMode,'fixed-rear');assert.equal(b.car.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(b.car.car.art.gauges.interior.coordinateSpace,'dashboard');assert.equal(b.art['catalog-briar-xt-2004-body'].frames.length,8);
});
