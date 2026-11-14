import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {decodePng} from '../../scripts/car-catalog-import.mjs';import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),cfg=read('assets/car-catalog/bramble-2021/import.json'),doc=read('data/server-storage/files/cars/Bramble 2021/document.json');
test('Bramble source openings and eight-angle yaw mapping are individually authored',()=>{const im=decodePng(new URL('assets/car-catalog/bramble-2021/body.png',root).pathname),p=prepareCarSheet(im);assert.equal(p.crops.length,8);assert.deepEqual(cfg.mapping,[0,7,2,3,4,5,6,1]);const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];for(const[slot,points]of Object.entries(cfg.authoredWheelAnchors)){const crop=p.crops[cfg.mapping[slots.indexOf(slot)]];for(const a of points){assert.ok(a.x>=crop.x&&a.x<crop.x+crop.width,slot);if(['front','rear'].includes(slot))continue;assert.ok(im.data[(a.y*im.width+a.x)*4+3]<128,slot);let top=a.y;while(top>0&&im.data[((top-1)*im.width+a.x)*4+3]<128)top--;assert.ok(a.radius>=a.y-top);}}});
test('Bramble real editor roundtrip preserves fixed rear camera, RHD instruments and shared wheel',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.ok(c.art.interior.steeringWheel.anchorX>.7);assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');assert.equal(c.art.interior.steeringWheel.sizeSpace,'viewport');assert.equal(c.tuning.powerHp,257);});

test('Bramble preserves UK base specs and equivalent dual-final gear reductions',()=>{
 const c=cfg.car,t=c.tuning;assert.equal(t.weightKg,1280);assert.equal(t.engineDisplacementL,1.618);assert.equal(t.drivetrain,'awd');assert.equal(t.powerHp,257);assert.ok(Math.abs(t.torqueLbFt-360*.7375621493)<.00001);assert.equal(t.centerDifferentialBalance,.4);assert.equal(c.transmissions.manual.label,'6MT');
 const raw=[3.538,2.238,1.535,1.162,1.081,.902];raw.forEach((r,i)=>assert.ok(Math.abs(c.transmissions.manual.gearRatios[i]*t.gearFinalDrive-r*(i<4?3.941:3.350))<1e-10));assert.ok(Math.abs(t.reverseRatio*t.gearFinalDrive-3.831*3.350)<1e-10);assert.equal(c.setup.tireSize.widthMm,225);assert.equal(t.frontDifferentialAccel,0);assert.equal(t.rearDifferentialAccel,0);
 for(const car of [c,doc.car])for(const [slot,layer]of Object.entries(car.art.angleLayers))assert.equal(layer.tires.tireMode,'auto',slot);
});

test('Bramble defaults to automatic assist while retaining selectable sourced manual gearing',()=>{
 for(const car of [cfg.car,doc.car]){
  assert.equal(car.defaultTransmissionType,'automatic');
  const {type,label,shiftMode,...assist}=car.transmissions.automatic;
  const {type:manualType,label:manualLabel,shiftMode:manualMode,...manual}=car.transmissions.manual;
  assert.equal(type,'automatic');assert.equal(shiftMode,'automatic');assert.equal(label,'Auto Assist (6MT)');
  assert.equal(manualType,'manual');assert.equal(manualMode,'manual');assert.equal(manualLabel,'6MT');
  assert.deepEqual(assist,manual);
 }
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});
 const car=e.serializeSelectedCarDocument().car;
 assert.equal(car.defaultTransmissionType,'automatic');
 assert.equal(e.getRaceCarTuning(car,{transmissionType:'automatic'}).shiftMode,'automatic');
 assert.equal(e.getRaceCarTuning(car,{transmissionType:'manual'}).shiftMode,'manual');
 assert.deepEqual(car.transmissions,cfg.car.transmissions);
});
