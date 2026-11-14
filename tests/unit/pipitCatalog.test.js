import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/pipit-100-2007/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Pipit 100 2007/document.json',import.meta.url)));
test('Pipit uses UK curb mass and metric output with documented regional gearbox',()=>{const t=c.car.tuning;assert.ok(Math.abs(t.powerHp*.7456998715822702-73.5)<1e-9);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314004-131)<1e-9);assert.equal(t.weightKg,975);assert.equal(t.drivetrain,'fwd');assert.equal(t.engineDisplacementL,1.368);assert.equal(c.car.transmissions.manual.label,'6MT');assert.deepEqual(t.gearRatios,[3.545,2.158,1.480,1.121,.921,.766]);assert.equal(t.gearFinalDrive,4.071);assert.equal(t.reverseRatio,3.818);assert.equal(t.frontDifferentialAccel,0);assert.equal(d.car.mechanics.fuelTankGallons,35/3.785411784);const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.27825)<1e-9);assert.equal(g.wheelRadiusByWheelM.fl,g.wheelRadiusByWheelM.rr);assert.ok(c.provenance.estimates.some(s=>s.includes('regional assumption')));assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===6000).torqueLbFt*6000/5252-t.powerHp)<1e-9);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7,'RHD wheel must be on right');for(const g of d.car.art.gauges.interior.widgets)assert.ok(g.x>.55,'All dashboard instruments in right recess');});
test('Pipit native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Pipit production editor preview launches on tire support, not an occluding hatch box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Pipit failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
