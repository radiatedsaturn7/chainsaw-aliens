import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const base=new URL('../../assets/car-catalog/cinder-si-1991/',import.meta.url),config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Cinder exact US1991Si uses corroborated secondary mass and retains alternate',()=>{
 const c=config.car,t=c.tuning;assert.equal(t.drivetrain,'fwd');assert.equal(t.weightKg,2174*.45359237);assert.equal(t.powerHp,108);assert.equal(t.torqueLbFt,100);
 assert.deepEqual(c.transmissions.manual.gearRatios,[3.250,1.894,1.259,.937,.771]);assert.equal(c.transmissions.manual.reverseRatio,3.153);assert.equal(c.transmissions.manual.gearFinalDrive,4.25);
 assert.equal(c.dimensions.wheelbaseM,2.30124);assert.equal(t.frontDifferentialAccel,0);assert.deepEqual(c.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:14});assert.equal(t.wheelRadiusM,.2888);
 assert.ok(config.provenance.estimates.some(x=>x.includes('2167lb')));assert.ok(config.provenance.sources.some(x=>x.url.includes('edmunds')));assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===6000).torqueLbFt*6000/5252-108)<1e-9);
});
test('Cinder measured source openings serialize through real editor',()=>{
 const body=decodePng(new URL('body.png',base).pathname),prepared=prepareCarSheet(body);assert.equal(prepared.crops.length,8);
 const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 for(const [slot,points]of Object.entries(config.authoredWheelAnchors)){
  const crop=prepared.crops[config.mapping[slots.indexOf(slot)]];
  for(const p of points){assert.ok(p.x>=crop.x&&p.x<crop.x+crop.width);if(['front','rear'].includes(slot))continue;assert.ok(body.data[(p.y*body.width+p.x)*4+3]<128);let top=p.y;while(top>0&&body.data[((top-1)*body.width+p.x)*4+3]<128)top--;assert.ok(p.radius>=p.y-top,`${slot} ${p.x} radius${p.radius} needs${p.y-top}`);}
 }
 const b=buildCatalogDocuments(config,body,decodePng(new URL('dashboard.png',base).pathname));assert.equal(b.car.car.id,'cinder-si-1991');assert.equal(b.car.car.camera.trackingMode,'fixed-rear');assert.equal(b.car.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(b.car.car.art.gauges.interior.coordinateSpace,'dashboard');assert.equal(b.art['catalog-cinder-si-1991-body'].frames.length,8);
});
test('Cinder angle mapping follows nose direction and physical wheel identities',()=>{
 // Sources1/2/5 nose left;3/6/7 nose right. Rear diagonals differ from Lark atlas.
 assert.deepEqual(config.mapping,[0,1,2,5,4,3,6,7]);
 assert.deepEqual(config.authoredWheelAnchors.frontRight.map(p=>p.wheel),['fr','rr']);
 assert.deepEqual(config.authoredWheelAnchors.frontLeft.map(p=>p.wheel),['rl','fl']);
 const doc=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Cinder Si 1991/document.json',import.meta.url)));
 for(const [slot,frame]of Object.entries({frontRight:1,right:2,rearRight:5,rearLeft:3,left:6,frontLeft:7}))assert.equal(doc.car.art.angleLayers[slot].body.frameIndex,frame);
});
