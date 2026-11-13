import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/mossling-2019/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Mossling 2019/document.json',import.meta.url)));
test('Mossling uses explicit UK full-options 2H manual reference, not permanent AWD',()=>{const t=c.car.tuning;assert.equal(t.weightKg,1135);assert.ok(Math.abs(t.powerHp*0.7456998715822702-75)<1e-8);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314-130)<1e-8);assert.deepEqual(t.gearRatios,[4.425,2.304,1.674,1.190,1]);assert.equal(t.gearFinalDrive,4.09);assert.equal(t.reverseRatio,5.151);assert.equal(d.car.defaultTransmissionType,'manual');assert.equal(d.car.mechanics.fuelLiters,40);assert.equal(d.car.mechanics.boostBar,0);assert.equal(t.drivetrain,'rwd');assert.equal(t.engineDisplacementL,1.462);const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.3465)<1e-9);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7);assert.ok(c.provenance.estimates.some(x=>x.includes('4H/4L')&&x.includes('not implemented')));});
test('Mossling native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Mossling production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Mossling failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
