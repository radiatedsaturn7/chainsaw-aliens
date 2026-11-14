import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {decodePng} from '../../scripts/car-catalog-import.mjs';import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),cfg=read('assets/car-catalog/cicada-turbo-2015/import.json'),doc=read('data/server-storage/files/cars/Cicada Turbo 2015/document.json');
test('Cicada source openings and eight-angle yaw mapping are individually authored',()=>{const im=decodePng(new URL('assets/car-catalog/cicada-turbo-2015/body.png',root).pathname),p=prepareCarSheet(im);assert.equal(p.crops.length,8);assert.deepEqual(cfg.mapping,[0,7,2,3,4,5,6,1]);const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];for(const[slot,points]of Object.entries(cfg.authoredWheelAnchors)){const crop=p.crops[cfg.mapping[slots.indexOf(slot)]];for(const a of points){assert.ok(a.x>=crop.x&&a.x<crop.x+crop.width,slot);if(['front','rear'].includes(slot))continue;assert.ok(im.data[(a.y*im.width+a.x)*4+3]<128,slot);let top=a.y;while(top>0&&im.data[((top-1)*im.width+a.x)*4+3]<128)top--;assert.ok(a.radius>=a.y-top);}}});
test('Cicada real editor roundtrip preserves fixed rear camera, LHD instruments and shared wheel',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});const c=e.serializeSelectedCarDocument().car;assert.deepEqual(c,withLegacyGaugeDefaults(doc.car));assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');assert.ok(c.art.interior.steeringWheel.anchorX<.4);assert.equal(c.art.gauges.interior.coordinateSpace,'dashboard');for(const w of c.art.gauges.interior.widgets)assert.ok(w.x<.5);assert.equal(c.tuning.powerHp,237);});

test('Cicada uses 2015 US coupe specifications not Euro dry or Spider values',()=>{const c=cfg.car,t=c.tuning;assert.equal(t.weightKg,1118);assert.equal(t.powerHp,237);assert.equal(t.torqueLbFt,258);assert.equal(t.revLimitRpm,6500);assert.equal(t.frontWeightDistribution,.41);assert.equal(t.dragCoefficient,.335);assert.equal(c.transmissions.automatic.label,'6DCT');assert.deepEqual(c.transmissions.automatic.gearRatios,[4.154,2.269,1.435,.978,.755,.622]);assert.equal(t.gearFinalDrive,4.118);assert.equal(c.setup.tireSizeByAxle.front.wheelDiameterIn,17);assert.equal(c.setup.tireSizeByAxle.rear.wheelDiameterIn,18);assert.ok(cfg.provenance.estimates.some(x=>x.includes('reverse4.0')));for(const car of [c,doc.car])for(const layer of Object.values(car.art.angleLayers))assert.equal(layer.tires.tireMode,'auto');});

test('Cicada production editor preview launches on tire support, not an occluding mid-engine box',()=>{
 assert.equal(cfg.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(doc.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(doc),{name:doc.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Cicada failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
