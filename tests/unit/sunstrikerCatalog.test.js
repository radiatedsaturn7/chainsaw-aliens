import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
const base=new URL('../../assets/car-catalog/sunstriker-gt-1994/',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Sunstriker preserves stock US1994 standard-roof mechanical anchors',()=>{
 const c=config.car,t=c.tuning;assert.equal(t.drivetrain,'rwd');assert.equal(t.weightKg,1549);assert.equal(t.powerHp,320);assert.equal(t.torqueLbFt,315);
 assert.deepEqual(c.transmissions.manual.gearRatios,[3.827,2.36,1.685,1.312,1,.793]);assert.equal(c.transmissions.manual.gearFinalDrive,3.133);assert.equal(c.transmissions.manual.reverseRatio,3.28);
 assert.deepEqual(c.setup.tireSizeByAxle,{front:{widthMm:235,aspectRatio:45,wheelDiameterIn:17},rear:{widthMm:255,aspectRatio:40,wheelDiameterIn:17}});assert.equal(t.dragCoefficient,.33);assert.ok(config.provenance.estimates.some(x=>x.includes('conflict unresolved')));
 assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===5600).torqueLbFt*5600/5252-320)<1e-8);
});
test('Sunstriker source anchors fit alpha openings and editor preserves individual controls',()=>{
 const body=decodePng(new URL('body.png',base).pathname);
 for(const [slot,points]of Object.entries(config.authoredWheelAnchors))if(!['front','rear'].includes(slot))for(const p of points){assert.ok(body.data[(p.y*body.width+p.x)*4+3]<128,slot);let top=p.y;while(top>0&&body.data[((top-1)*body.width+p.x)*4+3]<128)top--;assert.ok(p.radius>=p.y-top,slot);}
 const b=buildCatalogDocuments(config,body,decodePng(new URL('dashboard.png',base).pathname));assert.deepEqual(b.car.car.setup.tireSizeByAxle,config.car.setup.tireSizeByAxle);assert.equal(b.car.car.id,'sunstriker-gt-1994');assert.equal(b.car.car.camera.trackingMode,'fixed-rear');assert.equal(b.car.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(b.car.car.art.gauges.interior.coordinateSpace,'dashboard');assert.equal(b.art['catalog-sunstriker-gt-1994-body'].frames.length,8);
});
